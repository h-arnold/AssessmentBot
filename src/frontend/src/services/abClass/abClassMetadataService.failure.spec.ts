import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiTransportError } from '@/errors/apiTransportError';
import { DataAnalysisService } from '../dataAnalysis/dataAnalysisService';
import { refreshABClassMetadata } from '../dataAnalysis/postAnalysis/refreshABClassMetadata';
import { getQueueState, runApiQueuedTask } from '../api/apiQueue';
import {
  canonicalRefreshClass,
  createMetadataRefreshFixture,
  newestAssignment,
  PROFILES,
  SUMMARY_TIME,
} from '@/test/abClass/metadataRefreshFixtures';
import { installMetadataRefreshTransport } from '@/test/abClass/metadataRefreshTransport';

const FULL_AND_TARGET_ANALYSES = 2;

afterEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ABClass metadata failure propagation', () => {
  it.each(PROFILES)(
    'propagates the untouched canonical newest-instance null-name failure without writing (%s)',
    async (profile) => {
      const context = createMetadataRefreshFixture(profile);
      context.classFull = canonicalRefreshClass(profile, context.classFull.classId);
      context.classFull.metadata = null;
      const target = newestAssignment(context.classFull);
      const unnamed = target.submissions.find((submission) => submission.studentName === null)!;
      expect(unnamed).toBeDefined();
      context.averagingResult = new DataAnalysisService().analyse({
        classes: [context.classFull],
        assignmentDefinitionPartials: context.assignmentDefinitionPartials,
        filter: { classIds: [context.classFull.classId] },
      })[0];
      const backend = installMetadataRefreshTransport(context.classFull);
      const before = backend.readStored();
      const calculate = vi.spyOn(DataAnalysisService.prototype, 'analyse');
      const now = vi.fn(() => SUMMARY_TIME);

      const attempt = refreshABClassMetadata(context, now);
      await expect(attempt).rejects.toThrow(
        `buildPerStudentRows: null studentName for studentId '${unnamed.studentId}'`
      );
      expect(calculate).toHaveBeenCalledTimes(FULL_AND_TARGET_ANALYSES);
      expect(calculate.mock.results[0].type).toBe('return');
      expect(calculate.mock.results[1].type).toBe('throw');
      await expect(attempt).rejects.toBe(calculate.mock.results[1].value);
      expect(calculate.mock.calls[1][0].classes[0].assignments).toEqual([target]);
      expect(backend.events).toEqual(['getABClass']);
      expect(backend.readStored()).toEqual(before);
      expect(now).not.toHaveBeenCalled();
      expect(getQueueState('classesBulkMutation')).toEqual({ active: false, pending: 0 });
    }
  );

  it('fails not found without recreation, calculation or stamping', async () => {
    const context = createMetadataRefreshFixture('small');
    context.classFull.metadata = null;
    const backend = installMetadataRefreshTransport(null);
    const calculate = vi.spyOn(DataAnalysisService.prototype, 'analyse');
    const now = vi.fn(() => SUMMARY_TIME);

    await expect(refreshABClassMetadata(context, now)).rejects.toThrow();
    expect(backend.events).toEqual(['getABClass']);
    expect(calculate).not.toHaveBeenCalled();
    expect(now).not.toHaveBeenCalled();
  });

  it.each(['getABClass', 'updateABClass'])(
    'propagates non-retriable %s failure and releases the lane without rollback or task retry',
    async (method) => {
      const context = createMetadataRefreshFixture('small');
      context.classFull.metadata = null;
      const backend = installMetadataRefreshTransport(context.classFull);
      backend.failures.add(method);
      const before = backend.readStored();
      vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(refreshABClassMetadata(context, () => SUMMARY_TIME)).rejects.toMatchObject({
        code: 'INTERNAL_ERROR',
        requestId: 'metadata-failure',
        isRetriable: false,
      });
      expect(backend.events).toEqual(
        method === 'getABClass' ? ['getABClass'] : ['getABClass', 'updateABClass']
      );
      expect(backend.readStored()).toEqual(before);
      expect(getQueueState('classesBulkMutation')).toEqual({ active: false, pending: 0 });
      await expect(runApiQueuedTask('classesBulkMutation', () => 'released')).resolves.toBe(
        'released'
      );
    }
  );

  it('preserves the exact calculation failure and never stamps or writes', async () => {
    const context = createMetadataRefreshFixture('small');
    context.classFull.metadata = null;
    const backend = installMetadataRefreshTransport(context.classFull);
    const failure = new Error('Calculation invariant failed');
    vi.spyOn(DataAnalysisService.prototype, 'analyse').mockImplementation(() => {
      throw failure;
    });
    const now = vi.fn(() => SUMMARY_TIME);

    await expect(refreshABClassMetadata(context, now)).rejects.toBe(failure);
    expect(backend.events).toEqual(['getABClass']);
    expect(now).not.toHaveBeenCalled();
  });

  it.each(['getABClass', 'updateABClass'])(
    'uses real response validation for malformed %s success',
    async (method) => {
      const context = createMetadataRefreshFixture('small');
      context.classFull.metadata = null;
      const backend = installMetadataRefreshTransport(context.classFull);
      backend.overrides.set(method, { ...context.classFull, metadata: { recentAssignments: [] } });
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(refreshABClassMetadata(context, () => SUMMARY_TIME)).rejects.toBeInstanceOf(
        z.ZodError
      );
      const diagnostic = expect.objectContaining({ method, zodIssues: expect.any(Array) });
      expect(log).toHaveBeenCalledWith(
        'services/apiService.parseApiResponse',
        expect.objectContaining({
          metadata: diagnostic,
        })
      );
      expect(backend.events).toEqual(
        method === 'getABClass' ? ['getABClass'] : ['getABClass', 'updateABClass']
      );
    }
  );

  it('fails malformed authoritative assignment time after read, never substitutes the summary clock', async () => {
    const context = createMetadataRefreshFixture('small');
    context.classFull.metadata = null;
    const fresh = structuredClone(context.classFull);
    fresh.assignments[0].updatedAt = null;
    const backend = installMetadataRefreshTransport(fresh);
    const now = vi.fn(() => SUMMARY_TIME);

    await expect(refreshABClassMetadata(context, now)).rejects.toThrow();
    expect(backend.events).toEqual(['getABClass']);
    expect(now).not.toHaveBeenCalled();
  });

  it('rejects an invalid summary clock through shared metadata validation before update dispatch', async () => {
    const context = createMetadataRefreshFixture('small');
    context.classFull.metadata = null;
    const backend = installMetadataRefreshTransport(context.classFull);

    await expect(refreshABClassMetadata(context, () => 'not-canonical')).rejects.toThrow();
    expect(backend.events).toEqual(['getABClass']);
  });

  it('does not reclassify a transport error as a successful or skipped save', async () => {
    const context = createMetadataRefreshFixture('small');
    context.classFull.metadata = null;
    const backend = installMetadataRefreshTransport(context.classFull);
    backend.failures.add('updateABClass');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(refreshABClassMetadata(context, () => SUMMARY_TIME)).rejects.toBeInstanceOf(
      ApiTransportError
    );
  });
});
