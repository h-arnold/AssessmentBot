import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataAnalysisService } from '../dataAnalysis/dataAnalysisService';
import { refreshABClassMetadata } from '../dataAnalysis/postAnalysis/refreshABClassMetadata';
import { getQueueState, runApiQueuedTask } from '../api/apiQueue';
import {
  createMetadataRefreshFixture,
  newestAssignment,
  recentEntry,
  SUMMARY_TIME,
  NEW_SOURCE_TIME,
} from '@/test/abClass/metadataRefreshFixtures';
import { installMetadataRefreshTransport } from '@/test/abClass/metadataRefreshTransport';
import { refreshABClassMetadataInQueue } from './abClassMetadataService';

const TWO_ASSIGNMENTS = 2;

afterEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('refreshABClassMetadataInQueue complete FIFO operation', () => {
  it('does not freshly read or calculate until its existing bulk lane slot is active', async () => {
    const context = createMetadataRefreshFixture('small');
    context.classFull.metadata = null;
    const backend = installMetadataRefreshTransport(context.classFull);
    const gate = Promise.withResolvers<void>();
    const blocker = runApiQueuedTask('classesBulkMutation', () => gate.promise);
    const calculate = vi.spyOn(DataAnalysisService.prototype, 'analyse');
    const now = vi.fn(() => SUMMARY_TIME);
    const pending = refreshABClassMetadataInQueue(
      {
        classId: context.classFull.classId,
        assignmentDefinitionPartials: context.assignmentDefinitionPartials,
      },
      now
    );
    const settled = Promise.allSettled([pending]);
    try {
      expect(getQueueState('classesBulkMutation')).toEqual({ active: true, pending: 1 });
      expect(backend.dispatched).not.toHaveBeenCalled();
      expect(calculate).not.toHaveBeenCalled();
      expect(now).not.toHaveBeenCalled();
      gate.resolve();
      await blocker;
      await expect(pending).resolves.toMatchObject({ status: 'saved', confirmedPersistence: true });
      expect(backend.events).toEqual(['getABClass', 'updateABClass']);
    } finally {
      gate.resolve();
      await blocker;
      await settled;
    }
  });

  it('selects a newer authoritative target after entering the queue, never the cached target', async () => {
    const context = createMetadataRefreshFixture('small');
    context.classFull.metadata = null;
    const fresh = structuredClone(context.classFull);
    const different = fresh.assignments[0];
    different.updatedAt = NEW_SOURCE_TIME;
    expect(different.assignmentId).not.toBe(newestAssignment(context.classFull).assignmentId);
    const backend = installMetadataRefreshTransport(fresh);
    const calculate = vi.spyOn(DataAnalysisService.prototype, 'analyse');

    await refreshABClassMetadata(context, () => SUMMARY_TIME);

    expect(backend.readStored()!.metadata!.recentAssignments[0]).toMatchObject({
      assignmentId: different.assignmentId,
      updatedAt: NEW_SOURCE_TIME,
    });
    expect(calculate.mock.calls[0][0].classes[0].assignments).toEqual(fresh.assignments);
    expect(calculate.mock.calls[1][0].classes[0].assignments).toEqual([different]);
  });

  it.each(['noAssignments', 'unchanged', 'staleSource'] as const)(
    'rechecks authoritative %s without calculation, write or clock',
    async (reason) => {
      const context = createMetadataRefreshFixture('small');
      context.classFull.metadata = null;
      const fresh = structuredClone(context.classFull);
      const entry = recentEntry(fresh, fresh.assignments.length - 1);
      if (reason === 'staleSource') entry.updatedAt = SUMMARY_TIME;
      fresh.metadata = {
        classAverages: { ...entry.averages, updatedAt: SUMMARY_TIME },
        recentAssignments: [entry],
      };
      if (reason === 'noAssignments') fresh.assignments = [];
      const backend = installMetadataRefreshTransport(fresh);
      const calculate = vi.spyOn(DataAnalysisService.prototype, 'analyse');
      const now = vi.fn(() => SUMMARY_TIME);

      await expect(refreshABClassMetadata(context, now)).resolves.toEqual({
        status: 'skipped',
        reason,
      });

      expect(backend.events).toEqual(['getABClass']);
      expect(calculate).not.toHaveBeenCalled();
      expect(now).not.toHaveBeenCalled();
    }
  );

  it('serialises duplicate owners through a fresh read/recheck so only one writes', async () => {
    const context = createMetadataRefreshFixture('small');
    context.classFull.metadata = null;
    const backend = installMetadataRefreshTransport(context.classFull);
    backend.blocked.add('updateABClass');
    const now = vi.fn(() => SUMMARY_TIME);
    const first = refreshABClassMetadata(context, now);
    const second = refreshABClassMetadata(context, now);
    const settled = Promise.allSettled([first, second]);
    try {
      await vi.waitFor(() => expect(backend.events).toEqual(['getABClass', 'updateABClass']));
      expect(getQueueState('classesBulkMutation')).toEqual({ active: true, pending: 1 });
      backend.blocked.delete('updateABClass');
      backend.release('updateABClass');
      await expect(first).resolves.toMatchObject({ status: 'saved', confirmedPersistence: true });
      await expect(second).resolves.toEqual({ status: 'skipped', reason: 'unchanged' });
      expect(backend.events).toEqual(['getABClass', 'updateABClass', 'getABClass']);
      expect(now).toHaveBeenCalledTimes(1);
    } finally {
      backend.blocked.clear();
      backend.releaseAll();
      await settled;
    }
  });

  it('holds the whole read/calculate/write operation and merges a later version without losing prior history', async () => {
    const context = createMetadataRefreshFixture('medium');
    const allAssignments = structuredClone(context.classFull.assignments);
    context.classFull.assignments = [allAssignments[0]];
    context.classFull.metadata = null;
    const secondContext = {
      ...context,
      classFull: { ...context.classFull, assignments: allAssignments.slice(0, TWO_ASSIGNMENTS) },
    };
    const backend = installMetadataRefreshTransport(context.classFull);
    // A new assignment version arrives on the server while the first save is active.
    backend.afterWrite.mockImplementationOnce((document) => {
      document.assignments = allAssignments.slice(0, TWO_ASSIGNMENTS);
    });
    backend.blocked.add('getABClass');
    backend.blocked.add('updateABClass');
    const first = refreshABClassMetadata(context, () => SUMMARY_TIME);
    const second = refreshABClassMetadata(secondContext, () => SUMMARY_TIME);
    const settled = Promise.allSettled([first, second]);
    try {
      expect(backend.events).toEqual(['getABClass']);
      backend.blocked.delete('getABClass');
      backend.release('getABClass');
      await vi.waitFor(() => expect(backend.events).toEqual(['getABClass', 'updateABClass']));
      expect(getQueueState('classesBulkMutation')).toEqual({ active: true, pending: 1 });
      backend.blocked.delete('updateABClass');
      backend.release('updateABClass');
      await expect(first).resolves.toMatchObject({ status: 'saved' });
      await expect(second).resolves.toMatchObject({ status: 'saved' });
      expect(backend.events).toEqual([
        'getABClass',
        'updateABClass',
        'getABClass',
        'updateABClass',
      ]);
      expect(
        backend.readStored()!.metadata!.recentAssignments.map((entry) => entry.assignmentId)
      ).toEqual([allAssignments[1].assignmentId, allAssignments[0].assignmentId]);
    } finally {
      backend.blocked.clear();
      backend.releaseAll();
      await settled;
    }
  });
});
