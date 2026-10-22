import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataAnalysisService } from '../dataAnalysisService';
import * as queue from '@/services/api/apiQueue';
import {
  createMetadataRefreshFixture,
  newestAssignment,
  recentEntry,
  SUMMARY_TIME,
  NEW_SOURCE_TIME,
} from '@/test/abClass/metadataRefreshFixtures';
import { installMetadataRefreshTransport } from '@/test/abClass/metadataRefreshTransport';
import { refreshABClassMetadata } from './refreshABClassMetadata';

const TWO_CHANGED_WRITES = 2;

afterEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('refreshABClassMetadata cheap task orchestration', () => {
  it.each(['noAssignments', 'unchanged', 'staleSource'] as const)(
    'skips %s before enqueue, network, calculation or clock',
    async (reason) => {
      const context = createMetadataRefreshFixture('small');
      const entry = recentEntry(context.classFull, context.classFull.assignments.length - 1);
      context.classFull.metadata = {
        classAverages: { ...entry.averages, updatedAt: SUMMARY_TIME },
        recentAssignments: [entry],
      };
      if (reason === 'noAssignments') context.classFull.assignments = [];
      else if (reason === 'staleSource') entry.updatedAt = SUMMARY_TIME;
      const backend = installMetadataRefreshTransport(context.classFull);
      const reserve = vi.spyOn(queue, 'runApiQueuedTask');
      const calculate = vi.spyOn(DataAnalysisService.prototype, 'analyse');
      const now = vi.fn(() => SUMMARY_TIME);

      await expect(refreshABClassMetadata(context, now)).resolves.toEqual({
        status: 'skipped',
        reason,
      });
      expect(reserve).not.toHaveBeenCalled();
      expect(backend.dispatched).not.toHaveBeenCalled();
      expect(calculate).not.toHaveBeenCalled();
      expect(now).not.toHaveBeenCalled();
    }
  );

  it('ignores changed score/weighting/display analysis when the target version is equal', async () => {
    const context = createMetadataRefreshFixture('medium');
    const target = newestAssignment(context.classFull);
    const entry = recentEntry(context.classFull, context.classFull.assignments.indexOf(target));
    context.classFull.metadata = {
      classAverages: { ...entry.averages, updatedAt: SUMMARY_TIME },
      recentAssignments: [entry],
    };
    context.assignmentDefinitionPartials.forEach((definition) => {
      definition.assignmentWeighting = 0;
    });
    context.averagingResult.appliedCriterionWeightings = { completeness: 1, accuracy: 0, spag: 0 };
    const backend = installMetadataRefreshTransport(context.classFull);
    const calculate = vi.spyOn(DataAnalysisService.prototype, 'analyse');
    const now = vi.fn(() => SUMMARY_TIME);

    await expect(refreshABClassMetadata(context, now)).resolves.toEqual({
      status: 'skipped',
      reason: 'unchanged',
    });
    expect(calculate).not.toHaveBeenCalled();
    expect(backend.dispatched).not.toHaveBeenCalled();
    expect(now).not.toHaveBeenCalled();
  });

  it('refreshes a new source timestamp even when calculated scores are identical', async () => {
    const context = createMetadataRefreshFixture('small');
    context.classFull.metadata = null;
    const backend = installMetadataRefreshTransport(context.classFull);
    const now = vi.fn(() => SUMMARY_TIME);
    await refreshABClassMetadata(context, now);
    const first = backend.readStored()!;
    const next = structuredClone(first);
    newestAssignment(next).updatedAt = NEW_SOURCE_TIME;
    backend.replaceStored(next);

    await expect(
      refreshABClassMetadata({ ...context, classFull: next }, now)
    ).resolves.toMatchObject({ status: 'saved', confirmedPersistence: true });
    const saved = backend.readStored()!.metadata!;
    expect(saved.recentAssignments[0].averages).toEqual(
      first.metadata!.recentAssignments[0].averages
    );
    expect(saved.recentAssignments[0].updatedAt).toBe(NEW_SOURCE_TIME);
    expect(backend.events).toEqual(['getABClass', 'updateABClass', 'getABClass', 'updateABClass']);
    expect(now).toHaveBeenCalledTimes(TWO_CHANGED_WRITES);
  });

  it.each([null, 'invalid', '2026-02-30T00:00:00.000Z'])(
    'fails source timestamp %s without reading the clock or dispatching',
    async (timestamp) => {
      const context = createMetadataRefreshFixture('small');
      context.classFull.metadata = null;
      context.classFull.assignments[0].updatedAt = timestamp;
      const backend = installMetadataRefreshTransport(context.classFull);
      const now = vi.fn(() => SUMMARY_TIME);
      await expect(refreshABClassMetadata(context, now)).rejects.toThrow();
      expect(backend.dispatched).not.toHaveBeenCalled();
      expect(now).not.toHaveBeenCalled();
    }
  );
});
