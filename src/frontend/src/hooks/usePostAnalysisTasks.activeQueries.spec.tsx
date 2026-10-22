import { QueryObserver } from '@tanstack/react-query';
import { act, cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAppQueryClient } from '@/query/queryClient';
import { queryKeys } from '@/query/queryKeys';
import { ApiTransportError } from '@/errors/apiTransportError';
import { ClassPartialSchema } from '@/services/googleClassrooms/classPartials.zod';
import type { FrontendLogEntry } from '@/logging/frontendLogger';
import { createMetadataRefreshFixture } from '@/test/abClass/metadataRefreshFixtures';
import {
  metadataDescriptor,
  METADATA_TASK_ID,
  REFRESH_TITLE,
  REFRESH_DESCRIPTION,
  SAVE_TITLE,
  renderFeedbackOwners,
} from '@/test/abClass/postAnalysisFeedbackTestSupport';

const REFRESH_FAILURE_COUNT = 2;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

describe('usePostAnalysisTasks real query refresh integration', () => {
  it('observes both active refetch failures, preserves confirmed save and continues independent work', async () => {
    const context = createMetadataRefreshFixture('small');
    const original = structuredClone(context);
    const classPartial = ClassPartialSchema.parse(context.classFull);
    const queryClient = createAppQueryClient();
    const detailError = new ApiTransportError({
      requestId: 'detail-refresh-request',
      error: { code: 'INTERNAL_ERROR', message: 'technical detail refresh', isRetriable: false },
    });
    const listError = new ApiTransportError({
      requestId: 'list-refresh-request',
      error: { code: 'INTERNAL_ERROR', message: 'technical list refresh', isRetriable: false },
    });
    const detailGate = Promise.withResolvers<typeof context.classFull>();
    const listGate = Promise.withResolvers<(typeof classPartial)[]>();
    const detailFetch = vi.fn(() => detailGate.promise);
    const listFetch = vi.fn(() => listGate.promise);
    // Real subscribed observers, fresh initial data: only invalidation can fetch.
    const detail = new QueryObserver(queryClient, {
      queryKey: queryKeys.abClass(context.classFull.classId),
      queryFn: detailFetch,
      initialData: context.classFull,
    });
    const list = new QueryObserver(queryClient, {
      queryKey: queryKeys.classPartials(),
      queryFn: listFetch,
      initialData: [classPartial],
    });
    const detachDetail = detail.subscribe(() => {});
    const detachList = list.subscribe(() => {});
    const logs = vi.spyOn(console, 'error').mockImplementation(() => {});
    const later = vi.fn(() => ({ status: 'succeeded' }) as const);
    const saved = vi.fn(() => ({ status: 'succeeded', confirmedPersistence: true }) as const);
    const owner = renderFeedbackOwners(
      [context],
      [
        metadataDescriptor(saved),
        {
          id: 'independent',
          run: later,
        },
      ],
      true,
      queryClient
    );
    try {
      await waitFor(() => {
        expect(detailFetch).toHaveBeenCalledTimes(1);
        expect(listFetch).toHaveBeenCalledTimes(1);
      });
      await act(async () => detailGate.reject(detailError));
      expect(detail.getCurrentResult().error).toBe(detailError);
      expect(owner.read(0).outcomes[0].data.status).toBe('pending');
      expect(later).not.toHaveBeenCalled();
      expect(screen.queryByText(REFRESH_TITLE)).not.toBeInTheDocument();
      await act(async () => listGate.reject(listError));
      await waitFor(() => expect(owner.read(0).outcomes[1].data.status).toBe('succeeded'));
      expect(list.getCurrentResult().error).toBe(listError);
      expect(owner.read(0).outcomes[0].data).toEqual({
        taskId: METADATA_TASK_ID,
        status: 'failed',
        confirmedPersistence: true,
      });
      expect(owner.read(0).outcomes[0].error).toBeInstanceOf(Error);
      expect(await screen.findByRole('status')).toHaveTextContent(REFRESH_TITLE);
      expect(screen.getByRole('status')).toHaveTextContent(REFRESH_DESCRIPTION);
      expect(screen.queryByText(SAVE_TITLE)).not.toBeInTheDocument();
      expect(screen.queryByText(detailError.message)).not.toBeInTheDocument();
      expect(context).toEqual(original);
      expect(saved).toHaveBeenCalledTimes(1);
      expect(later).toHaveBeenCalledTimes(1);

      const diagnostics = logs.mock.calls.map((call) => call[1] as FrontendLogEntry);
      // One diagnostic per distinct refresh failure, not a third duplicate summary error.
      expect(diagnostics).toHaveLength(REFRESH_FAILURE_COUNT);
      expect(new Set(diagnostics.map((entry) => entry.metadata?.requestId))).toEqual(
        new Set([detailError.requestId, listError.requestId])
      );
      for (const entry of diagnostics) {
        expect(entry.metadata).toEqual(
          expect.objectContaining({
            taskId: METADATA_TASK_ID,
            classId: context.classFull.classId,
            confirmedPersistence: true,
            errorCode: 'INTERNAL_ERROR',
          })
        );
        expect(entry.metadata).not.toHaveProperty('classFull');
        expect(entry.metadata).not.toHaveProperty('submissions');
        expect(entry.metadata).not.toHaveProperty('metadata');
        expect(entry.metadata).not.toHaveProperty('averagingResult');
      }
    } finally {
      // Resolve unused gates on RED, so absent invalidation cannot leak a rejection.
      await act(async () => {
        detailGate.resolve(context.classFull);
        listGate.resolve([classPartial]);
        owner.unmount();
        detachDetail();
        detachList();
        queryClient.clear();
      });
    }
  });

  it('marks inactive queries stale without fetching them or unrelated assignment/definition datasets', async () => {
    const context = createMetadataRefreshFixture('small');
    const queryClient = createAppQueryClient();
    const detailKey = queryKeys.abClass(context.classFull.classId);
    const listKey = queryKeys.classPartials();
    const unrelated = [
      queryKeys.assignment(
        context.classFull.classId,
        context.classFull.assignments[0].assignmentId
      ),
      queryKeys.assignmentDefinitionPartials(),
      queryKeys.abClass('unrelated-class'),
    ];
    const fetch = vi.fn(() => Promise.reject(new Error('inactive query must not fetch')));
    for (const queryKey of [detailKey, listKey, ...unrelated]) {
      queryClient.setQueryDefaults(queryKey, { queryFn: fetch });
      queryClient.setQueryData(queryKey, context.classFull);
    }
    const imperative = vi.spyOn(queryClient, 'query');
    const owner = renderFeedbackOwners(
      [context],
      [metadataDescriptor(() => ({ status: 'succeeded', confirmedPersistence: true }))],
      false,
      queryClient
    );
    await waitFor(() => expect(owner.read(0).outcomes[0].data.status).toBe('succeeded'));
    expect(queryClient.getQueryState(detailKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true);
    for (const key of unrelated) expect(queryClient.getQueryState(key)?.isInvalidated).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    expect(imperative).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
