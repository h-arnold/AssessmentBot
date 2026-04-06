import { QueryObserver } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiTransportError } from '../../errors/apiTransportError';
import { createAppQueryClient } from '../../query/queryClient';
import { queryKeys } from '../../query/queryKeys';

const { getABClassPartialsMock } = vi.hoisted(() => ({
  getABClassPartialsMock: vi.fn(),
}));

vi.mock('../../services/classPartialsService', () => ({
  getABClassPartials: getABClassPartialsMock,
}));

const initialAndRefreshCallCount = 2;

type QueryInvalidationModule = Readonly<{
  invalidateCohortsAfterMutation: (
    queryClient: ReturnType<typeof createAppQueryClient>,
    options?: Readonly<{ requireImmediateConsistency?: boolean }>
  ) => Promise<void>;
  invalidateYearGroupsAfterMutation: (
    queryClient: ReturnType<typeof createAppQueryClient>,
    options?: Readonly<{ requireImmediateConsistency?: boolean }>
  ) => Promise<void>;
  runMutationWithRequiredClassPartialsRefresh: <TResult>(options: Readonly<{
    mutate: () => Promise<TResult>;
    queryClient: ReturnType<typeof createAppQueryClient>;
  }>) => Promise<
    | Readonly<{
        mutationResult: TResult;
        mutationStatus: 'success';
        refreshStatus: 'success';
      }>
    | Readonly<{
        mutationResult: TResult;
        mutationStatus: 'success';
        refreshError: Readonly<{
          code?: string;
          requestId?: string;
          retriable?: boolean;
        }>;
        refreshStatus: 'failed';
      }>
  >;
}>;

type ActiveClassPartialsQuerySubscription = Readonly<{
  queryClient: ReturnType<typeof createAppQueryClient>;
  unsubscribe: () => void;
}>;

/**
 * Loads the future query invalidation helper module under test.
 *
 * @returns {Promise<QueryInvalidationModule>} The imported query invalidation module.
 */
async function loadQueryInvalidationModule(): Promise<QueryInvalidationModule> {
  return import('./queryInvalidation') as Promise<QueryInvalidationModule>;
}

/**
 * Subscribes an active class-partials observer so refetch-only behaviour is testable.
 *
 * @returns {Promise<ActiveClassPartialsQuerySubscription>} Active query controls.
 */
async function subscribeToActiveClassPartialsQuery(): Promise<ActiveClassPartialsQuerySubscription> {
  const queryClient = createAppQueryClient();
  const { getClassPartialsQueryOptions } = await import('../../query/sharedQueries');
  const observer = new QueryObserver(queryClient, getClassPartialsQueryOptions());
  const unsubscribe = observer.subscribe(() => {});

  await observer.refetch();

  return {
    queryClient,
    unsubscribe,
  };
}

describe('query invalidation orchestration', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('invalidates cohorts without refetching when immediate consistency is not required', async () => {
    const queryClient = createAppQueryClient();
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const refetchQueriesSpy = vi.spyOn(queryClient, 'refetchQueries');
    const { invalidateCohortsAfterMutation } = await loadQueryInvalidationModule();

    await invalidateCohortsAfterMutation(queryClient);

    expect(invalidateQueriesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        exact: true,
        queryKey: queryKeys.cohorts(),
      })
    );
    expect(refetchQueriesSpy).not.toHaveBeenCalled();
  });

  it('invalidates and refetches cohorts when immediate consistency is required', async () => {
    const queryClient = createAppQueryClient();
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const refetchQueriesSpy = vi.spyOn(queryClient, 'refetchQueries');
    const { invalidateCohortsAfterMutation } = await loadQueryInvalidationModule();

    await invalidateCohortsAfterMutation(queryClient, { requireImmediateConsistency: true });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        exact: true,
        queryKey: queryKeys.cohorts(),
      })
    );
    expect(refetchQueriesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        exact: true,
        queryKey: queryKeys.cohorts(),
        type: 'active',
      })
    );
  });

  it('invalidates year groups without refetching when immediate consistency is not required', async () => {
    const queryClient = createAppQueryClient();
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const refetchQueriesSpy = vi.spyOn(queryClient, 'refetchQueries');
    const { invalidateYearGroupsAfterMutation } = await loadQueryInvalidationModule();

    await invalidateYearGroupsAfterMutation(queryClient);

    expect(invalidateQueriesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        exact: true,
        queryKey: queryKeys.yearGroups(),
      })
    );
    expect(refetchQueriesSpy).not.toHaveBeenCalled();
  });

  it('invalidates and refetches year groups when immediate consistency is required', async () => {
    const queryClient = createAppQueryClient();
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const refetchQueriesSpy = vi.spyOn(queryClient, 'refetchQueries');
    const { invalidateYearGroupsAfterMutation } = await loadQueryInvalidationModule();

    await invalidateYearGroupsAfterMutation(queryClient, { requireImmediateConsistency: true });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        exact: true,
        queryKey: queryKeys.yearGroups(),
      })
    );
    expect(refetchQueriesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        exact: true,
        queryKey: queryKeys.yearGroups(),
        type: 'active',
      })
    );
  });

  it('returns a composite success outcome after a required class-partials refetch succeeds', async () => {
    getABClassPartialsMock
      .mockResolvedValueOnce([{ classId: 'existing-class' }])
      .mockResolvedValueOnce([{ classId: 'new-class' }]);

    const mutationResult = { classId: 'new-class' };
    const mutate = vi.fn().mockResolvedValue(mutationResult);
    const { queryClient, unsubscribe } = await subscribeToActiveClassPartialsQuery();
    const { runMutationWithRequiredClassPartialsRefresh } = await loadQueryInvalidationModule();

    await expect(
      runMutationWithRequiredClassPartialsRefresh({
        mutate,
        queryClient,
      })
    ).resolves.toEqual({
      mutationResult,
      mutationStatus: 'success',
      refreshStatus: 'success',
    });
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(getABClassPartialsMock).toHaveBeenCalledTimes(initialAndRefreshCallCount);

    unsubscribe();
  });

  it('returns refresh-failure metadata when a required class-partials refetch fails after mutation success', async () => {
    getABClassPartialsMock.mockResolvedValueOnce([{ classId: 'existing-class' }]).mockRejectedValueOnce(
      new ApiTransportError({
        requestId: 'request-123',
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests.',
          retriable: true,
        },
      })
    );

    const mutationResult = { classId: 'class-99' };
    const mutate = vi.fn().mockResolvedValue(mutationResult);
    const { queryClient, unsubscribe } = await subscribeToActiveClassPartialsQuery();
    const { runMutationWithRequiredClassPartialsRefresh } = await loadQueryInvalidationModule();

    await expect(
      runMutationWithRequiredClassPartialsRefresh({
        mutate,
        queryClient,
      })
    ).resolves.toEqual({
      mutationResult,
      mutationStatus: 'success',
      refreshError: {
        code: 'RATE_LIMITED',
        requestId: 'request-123',
        retriable: true,
      },
      refreshStatus: 'failed',
    });
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(getABClassPartialsMock).toHaveBeenCalledTimes(initialAndRefreshCallCount);

    unsubscribe();
  });

  it('propagates mutation failure before attempting a required class-partials refetch', async () => {
    const mutationError = new Error('Mutation failed before refresh');
    const mutate = vi.fn().mockRejectedValue(mutationError);
    const queryClient = createAppQueryClient();
    const refetchQueriesSpy = vi.spyOn(queryClient, 'refetchQueries');
    const { runMutationWithRequiredClassPartialsRefresh } = await loadQueryInvalidationModule();

    await expect(
      runMutationWithRequiredClassPartialsRefresh({
        mutate,
        queryClient,
      })
    ).rejects.toBe(mutationError);
    expect(refetchQueriesSpy).not.toHaveBeenCalled();
    expect(getABClassPartialsMock).not.toHaveBeenCalled();
  });
});
