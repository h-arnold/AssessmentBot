import { type QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../../query/queryKeys';
import type * as QueryInvalidationModule from './queryInvalidation';

const runMutationWithRequiredClassPartialsRefreshMock = vi.hoisted(() => vi.fn());

vi.mock('./queryInvalidation', async () => {
  const actual = await vi.importActual('./queryInvalidation') as typeof QueryInvalidationModule;

  return {
    ...actual,
    runMutationWithRequiredClassPartialsRefresh: runMutationWithRequiredClassPartialsRefreshMock,
  };
});

type BulkMutationOrchestrationModule = Readonly<{
  runBulkMutationOrchestration: (options: Readonly<{
    clearFeedback: () => void;
    handleOutcome: (outcome: QueryInvalidationModule.RequiredClassPartialsRefreshOutcome<unknown>) => Promise<void>;
    mutate: () => Promise<unknown>;
    queryClient: Pick<QueryClient, 'invalidateQueries'>;
    setSubmitting: (value: boolean) => void;
  }>) => Promise<void>;
}>;

/**
 * Creates a deferred promise for async sequencing assertions.
 *
 * @template T
 * @returns {{ promise: Promise<T>; resolvePromise: (value: T) => void }} Deferred promise controls.
 */
function createDeferredPromise<T>() {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolvePromise,
  };
}

/**
 * Loads the future bulk mutation orchestration helper module under test.
 *
 * @returns {Promise<BulkMutationOrchestrationModule>} The helper module.
 */
async function loadBulkMutationOrchestrationModule(): Promise<BulkMutationOrchestrationModule> {
  const modulePath = './bulkMutationOrchestration';

  return import(modulePath as string) as Promise<BulkMutationOrchestrationModule>;
}

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe('bulkMutationOrchestration', () => {
  it('clears feedback before mutation execution, waits for class-partials invalidation, and hands off the exact outcome object', async () => {
    const { runBulkMutationOrchestration } = await loadBulkMutationOrchestrationModule();
    const trace: string[] = [];
    const setSubmitting = vi.fn((value: boolean) => {
      trace.push(value ? 'submitting:true' : 'submitting:false');
    });
    const clearFeedback = vi.fn(() => {
      trace.push('clear-feedback');
    });
    const mutate = vi.fn(async () => {
      trace.push('mutate');
      return [{ classId: 'class-001' }];
    });
    const invalidationStarted = createDeferredPromise<void>();
    const invalidationCompleted = createDeferredPromise<void>();
    const invalidateQueries = vi.fn(async () => {
      trace.push('invalidate-class-partials:start');
      invalidationStarted.resolvePromise(undefined as void);
      await invalidationCompleted.promise;
      trace.push('invalidate-class-partials:end');
    });
    const expectedOutcome = {
      mutationResult: [{ classId: 'class-001' }],
      mutationStatus: 'success',
      refreshStatus: 'success',
    } satisfies QueryInvalidationModule.RequiredClassPartialsRefreshOutcome<unknown>;
    const handleOutcome = vi.fn(async (outcome: QueryInvalidationModule.RequiredClassPartialsRefreshOutcome<unknown>) => {
      trace.push('handle-outcome');
      expect(outcome).toBe(expectedOutcome);
    });

    runMutationWithRequiredClassPartialsRefreshMock.mockImplementation(async ({ mutate: executeMutation }) => {
      trace.push('refresh-wrapper:start');
      await executeMutation();
      trace.push('refresh-wrapper:end');

      return expectedOutcome;
    });

    const orchestrationPromise = runBulkMutationOrchestration({
      clearFeedback,
      handleOutcome,
      mutate,
      queryClient: { invalidateQueries } as Pick<QueryClient, 'invalidateQueries'>,
      setSubmitting,
    });

    await invalidationStarted.promise;
    expect(handleOutcome).not.toHaveBeenCalled();

    invalidationCompleted.resolvePromise(undefined as void);
    await orchestrationPromise;

    expect(trace).toEqual([
      'submitting:true',
      'clear-feedback',
      'refresh-wrapper:start',
      'mutate',
      'refresh-wrapper:end',
      'invalidate-class-partials:start',
      'invalidate-class-partials:end',
      'handle-outcome',
      'submitting:false',
    ]);
    expect(clearFeedback).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.classPartials(),
        refetchType: 'none',
      }),
    );
    expect(handleOutcome).toHaveBeenCalledTimes(1);
    expect(handleOutcome.mock.calls[0]?.[0]).toBe(expectedOutcome);
  });

  it('always clears submitting even when the outcome handler throws', async () => {
    const { runBulkMutationOrchestration } = await loadBulkMutationOrchestrationModule();
    const setSubmitting = vi.fn();
    const clearFeedback = vi.fn();
    const mutate = vi.fn().mockResolvedValue([{ classId: 'class-001' }]);
    const invalidateQueries = vi.fn(async () => {});
    const outcomeError = new Error('Outcome handler failed.');
    const handleOutcome = vi.fn().mockRejectedValue(outcomeError);

    runMutationWithRequiredClassPartialsRefreshMock.mockResolvedValue({
      mutationResult: [{ classId: 'class-001' }],
      mutationStatus: 'success',
      refreshStatus: 'success',
    } satisfies QueryInvalidationModule.RequiredClassPartialsRefreshOutcome<unknown>);

    await expect(
      runBulkMutationOrchestration({
        clearFeedback,
        handleOutcome,
        mutate,
        queryClient: { invalidateQueries } as Pick<QueryClient, 'invalidateQueries'>,
        setSubmitting,
      }),
    ).rejects.toBe(outcomeError);

    expect(setSubmitting).toHaveBeenNthCalledWith(1, true);
    expect(setSubmitting).toHaveBeenLastCalledWith(false);
    expect(invalidateQueries).toHaveBeenCalledTimes(1);
  });

});
