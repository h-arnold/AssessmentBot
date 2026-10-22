import { act, cleanup, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAppQueryClient } from '@/query/queryClient';
import { queryKeys } from '@/query/queryKeys';
import {
  createMetadataRefreshFixture,
  newestAssignment,
} from '@/test/abClass/metadataRefreshFixtures';
import {
  metadataDescriptor,
  METADATA_TASK_ID,
  renderFeedbackOwners,
} from '@/test/abClass/postAnalysisFeedbackTestSupport';
import { PostAnalysisTaskOutcomeDataSchema } from '@/services/dataAnalysis/postAnalysis/postAnalysis.zod';

const REQUIRED_INVALIDATIONS = 2;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

describe('usePostAnalysisTasks required metadata invalidation', () => {
  it('invalidates only detail and list once after confirmed persistence, including replay and cache-only updates', async () => {
    const context = createMetadataRefreshFixture('small');
    const queryClient = createAppQueryClient();
    const invalidation = vi.spyOn(queryClient, 'invalidateQueries');
    const imperativeRead = vi.spyOn(queryClient, 'query');
    const write = Promise.withResolvers<{ status: 'succeeded'; confirmedPersistence: true }>();
    const run = vi.fn(() => write.promise);
    const owner = renderFeedbackOwners([context], [metadataDescriptor(run)], true, queryClient);
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    expect(invalidation).not.toHaveBeenCalled();
    await act(async () => write.resolve({ status: 'succeeded', confirmedPersistence: true }));
    await waitFor(() => expect(invalidation).toHaveBeenCalledTimes(REQUIRED_INVALIDATIONS));
    expect(invalidation).toHaveBeenCalledWith(
      { queryKey: queryKeys.abClass(context.classFull.classId) },
      { throwOnError: true }
    );
    expect(invalidation).toHaveBeenCalledWith(
      { queryKey: queryKeys.classPartials() },
      { throwOnError: true }
    );
    expect(imperativeRead).not.toHaveBeenCalled();
    await act(async () => owner.rerenderOwner());
    await act(async () => owner.update(0, structuredClone(context)));
    const refreshed = structuredClone(context);
    refreshed.classFull.metadata = null;
    expect(newestAssignment(refreshed.classFull)).toEqual(newestAssignment(context.classFull));
    await act(async () => owner.update(0, refreshed));
    await waitFor(() => expect(owner.read(0).outcomes[0].data.status).toBe('succeeded'));
    expect(run).toHaveBeenCalledTimes(1);
    expect(invalidation).toHaveBeenCalledTimes(REQUIRED_INVALIDATIONS);
  });

  it.each(['noAssignments', 'unchanged', 'staleSource', 'failed', 'unconfirmed'] as const)(
    'does not invalidate for %s before a confirmed write',
    async (result) => {
      const queryClient = createAppQueryClient();
      const invalidation = vi.spyOn(queryClient, 'invalidateQueries');
      const owner = renderFeedbackOwners(
        [createMetadataRefreshFixture('small')],
        [
          metadataDescriptor(() => {
            if (result === 'failed') throw new Error('write failed');
            return result === 'unconfirmed'
              ? { status: 'succeeded' }
              : { status: 'skipped', reason: result };
          }),
        ],
        false,
        queryClient
      );
      await waitFor(() => expect(owner.read(0).outcomes[0].data.status).not.toBe('pending'));
      expect(invalidation).not.toHaveBeenCalled();
    }
  );

  it('starts both invalidations and awaits both settlements even when detail refresh rejects first', async () => {
    const queryClient = createAppQueryClient();
    const firstError = new Error('detail refresh failed');
    const list = Promise.withResolvers<void>();
    const invalidation = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockImplementation((filters) =>
        filters?.queryKey?.[0] === 'abClass' ? Promise.reject(firstError) : list.promise
      );
    const later = vi.fn(() => ({ status: 'succeeded' }) as const);
    const owner = renderFeedbackOwners(
      [createMetadataRefreshFixture('small')],
      [
        metadataDescriptor(() => ({ status: 'succeeded', confirmedPersistence: true })),
        { id: 'independent', run: later },
      ],
      true,
      queryClient
    );
    try {
      await waitFor(() => expect(invalidation).toHaveBeenCalledTimes(REQUIRED_INVALIDATIONS));
      expect(owner.read(0).outcomes[0].data.status).toBe('pending');
      expect(later).not.toHaveBeenCalled();
    } finally {
      await act(async () => list.resolve());
    }
    await waitFor(() => expect(later).toHaveBeenCalledTimes(1));
    expect(owner.read(0).outcomes.map(({ data }) => data)).toEqual([
      { taskId: METADATA_TASK_ID, status: 'failed', confirmedPersistence: true },
      { taskId: 'independent', status: 'succeeded' },
    ]);
    expect(owner.read(0).outcomes[0].error).toBeInstanceOf(Error);
  });

  it('retains confirmed persistence in serialisable failed outcome data, separate from its local Error', () => {
    const failed = { taskId: METADATA_TASK_ID, status: 'failed', confirmedPersistence: true };
    expect(PostAnalysisTaskOutcomeDataSchema.safeParse(failed).success).toBe(true);
    expect(PostAnalysisTaskOutcomeDataSchema.parse(failed)).toEqual(failed);
    expect(
      PostAnalysisTaskOutcomeDataSchema.safeParse({ ...failed, confirmedPersistence: false })
        .success
    ).toBe(false);
    expect(
      PostAnalysisTaskOutcomeDataSchema.safeParse({ ...failed, error: new Error('local') }).success
    ).toBe(false);
  });
});
