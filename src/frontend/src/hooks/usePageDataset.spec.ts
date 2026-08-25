import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StartupWarmupDatasetKey } from '../query/sharedQueries';
import {
  computePageDatasetState,
  computePageSurfaceBlocking,
  computeDatasetRenderable,
  computePageSurfaceBusy,
  usePageDataset,
  type PageDatasetState,
} from './usePageDataset';
import { createElement, type ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Module-scope mock registration for the usePageDataset hook tests below.
// vi.hoisted and vi.mock are compile-time hints: Vitest hoists them to the top
// of the module before any imports run, so they must be declared at the top
// level to reflect their actual execution order (nested declarations trigger
// Vitest hoisting warnings).
// ---------------------------------------------------------------------------

const { mockUseQuery, mockUseStartupWarmupState, mockGetStartupWarmupQueryOptions } = vi.hoisted(
  () => ({
    mockUseQuery: vi.fn(),
    mockUseStartupWarmupState: vi.fn(),
    mockGetStartupWarmupQueryOptions: vi.fn(),
  })
);

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useQuery: mockUseQuery,
  };
});

vi.mock('../features/auth/startupWarmupState', () => ({
  useStartupWarmupState: mockUseStartupWarmupState,
}));

vi.mock('../query/sharedQueries', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getStartupWarmupQueryOptions: mockGetStartupWarmupQueryOptions,
  };
});

// ---------------------------------------------------------------------------
// Shared factory helpers for warmup-state test doubles
// ---------------------------------------------------------------------------

interface WarmupStateDouble {
  isDatasetReady: (key: StartupWarmupDatasetKey) => boolean;
  isDatasetFailed: (key: StartupWarmupDatasetKey) => boolean;
  snapshot: {
    datasets: Record<StartupWarmupDatasetKey, { isTrustworthy: boolean }>;
  };
}

/**
 * Creates a warmup-state test double with per-dataset readiness, failure, and
 * trustworthiness controls.
 *
 * @param {boolean} ready - Whether `isDatasetReady` returns true for the key.
 * @param {boolean} failed - Whether `isDatasetFailed` returns true for the key.
 * @param {boolean} trustworthy - Trustworthiness stored in the dataset snapshot.
 * @param {StartupWarmupDatasetKey} datasetKey - Dataset key the double answers for.
 * @returns {WarmupStateDouble} A warmup-state test double.
 */
function createWarmupStateDouble(
  ready: boolean,
  failed: boolean,
  trustworthy: boolean,
  datasetKey: StartupWarmupDatasetKey = 'classPartials'
): WarmupStateDouble {
  return {
    isDatasetReady: (key: StartupWarmupDatasetKey) => key === datasetKey && ready,
    isDatasetFailed: (key: StartupWarmupDatasetKey) => key === datasetKey && failed,
    snapshot: {
      datasets: {
        classPartials: { isTrustworthy: false },
        assignmentDefinitionPartials: { isTrustworthy: false },
        assignmentTopics: { isTrustworthy: false },
        cohorts: { isTrustworthy: false },
        yearGroups: { isTrustworthy: false },
        [datasetKey]: { isTrustworthy: trustworthy },
      },
    },
  };
}

interface QueryResultDouble<TData> {
  data: TData | undefined;
  isError: boolean;
}

// ---------------------------------------------------------------------------
// computePageDatasetState
// ---------------------------------------------------------------------------

describe('computePageDatasetState', () => {
  const datasetKey: StartupWarmupDatasetKey = 'classPartials';

  it('returns all positive flags when the dataset is ready, trustworthy, and query data is present', () => {
    const warmupState = createWarmupStateDouble(true, false, true, datasetKey);
    const queryResult: QueryResultDouble<string[]> = { data: ['item'], isError: false };

    const state: PageDatasetState = computePageDatasetState(datasetKey, queryResult, warmupState);

    expect(state.hasQueryData).toBe(true);
    expect(state.isQueryError).toBe(false);
    expect(state.isDatasetFailed).toBe(false);
    expect(state.isDatasetReady).toBe(true);
    expect(state.isDatasetTrustworthy).toBe(true);
    expect(state.hasTrustworthyDataset).toBe(true);
  });

  it('returns correct flags when the dataset has failed with no query data and no query error', () => {
    const warmupState = createWarmupStateDouble(false, true, false, datasetKey);
    const queryResult: QueryResultDouble<string[]> = { data: undefined, isError: false };

    const state: PageDatasetState = computePageDatasetState(datasetKey, queryResult, warmupState);

    expect(state.hasQueryData).toBe(false);
    expect(state.isQueryError).toBe(false);
    expect(state.isDatasetFailed).toBe(true);
    expect(state.isDatasetReady).toBe(false);
    expect(state.isDatasetTrustworthy).toBe(false);
    expect(state.hasTrustworthyDataset).toBe(false);
  });

  it('returns correct flags when the dataset has failed but query data was recovered with no query error', () => {
    const warmupState = createWarmupStateDouble(false, true, false, datasetKey);
    const queryResult: QueryResultDouble<string[]> = { data: ['cached'], isError: false };

    const state: PageDatasetState = computePageDatasetState(datasetKey, queryResult, warmupState);

    expect(state.hasQueryData).toBe(true);
    expect(state.isQueryError).toBe(false);
    expect(state.isDatasetFailed).toBe(true);
    expect(state.isDatasetReady).toBe(false);
    expect(state.isDatasetTrustworthy).toBe(false);
    expect(state.hasTrustworthyDataset).toBe(false);
  });

  it('returns correct flags when the dataset has failed, query data is present, and the query is errored', () => {
    const warmupState = createWarmupStateDouble(false, true, false, datasetKey);
    const queryResult: QueryResultDouble<string[]> = { data: ['stale'], isError: true };

    const state: PageDatasetState = computePageDatasetState(datasetKey, queryResult, warmupState);

    expect(state.hasQueryData).toBe(true);
    expect(state.isQueryError).toBe(true);
    expect(state.isDatasetFailed).toBe(true);
    expect(state.isDatasetReady).toBe(false);
    expect(state.isDatasetTrustworthy).toBe(false);
    expect(state.hasTrustworthyDataset).toBe(false);
  });

  it('returns correct flags when the dataset is not ready and untrustworthy', () => {
    const warmupState = createWarmupStateDouble(false, false, false, datasetKey);
    const queryResult: QueryResultDouble<string[]> = { data: ['item'], isError: false };

    const state: PageDatasetState = computePageDatasetState(datasetKey, queryResult, warmupState);

    expect(state.hasQueryData).toBe(true);
    expect(state.isQueryError).toBe(false);
    expect(state.isDatasetFailed).toBe(false);
    expect(state.isDatasetReady).toBe(false);
    expect(state.isDatasetTrustworthy).toBe(false);
    expect(state.hasTrustworthyDataset).toBe(false);
  });

  it('returns correct flags when the dataset is ready and trustworthy but the query has errored', () => {
    const warmupState = createWarmupStateDouble(true, false, true, datasetKey);
    const queryResult: QueryResultDouble<string[]> = { data: ['stale'], isError: true };

    const state: PageDatasetState = computePageDatasetState(datasetKey, queryResult, warmupState);

    expect(state.hasQueryData).toBe(true);
    expect(state.isQueryError).toBe(true);
    expect(state.isDatasetFailed).toBe(false);
    expect(state.isDatasetReady).toBe(true);
    expect(state.isDatasetTrustworthy).toBe(true);
    expect(state.hasTrustworthyDataset).toBe(true);
  });

  it('returns correct flags when the dataset is ready and trustworthy but no query data has arrived yet', () => {
    const warmupState = createWarmupStateDouble(true, false, true, datasetKey);
    const queryResult: QueryResultDouble<string[]> = { data: undefined, isError: false };

    const state: PageDatasetState = computePageDatasetState(datasetKey, queryResult, warmupState);

    expect(state.hasQueryData).toBe(false);
    expect(state.isQueryError).toBe(false);
    expect(state.isDatasetFailed).toBe(false);
    expect(state.isDatasetReady).toBe(true);
    expect(state.isDatasetTrustworthy).toBe(true);
    expect(state.hasTrustworthyDataset).toBe(true);
  });

  it('returns correct flags when the dataset has failed, no query data, and the query is errored', () => {
    const warmupState = createWarmupStateDouble(false, true, false, datasetKey);
    const queryResult: QueryResultDouble<string[]> = { data: undefined, isError: true };

    const state: PageDatasetState = computePageDatasetState(datasetKey, queryResult, warmupState);

    expect(state.hasQueryData).toBe(false);
    expect(state.isQueryError).toBe(true);
    expect(state.isDatasetFailed).toBe(true);
    expect(state.isDatasetReady).toBe(false);
    expect(state.isDatasetTrustworthy).toBe(false);
    expect(state.hasTrustworthyDataset).toBe(false);
  });

  it('returns correct flags when isDatasetReady is true but isDatasetTrustworthy is false (defensive — impossible in practice)', () => {
    const datasetKey: StartupWarmupDatasetKey = 'classPartials';
    // This combination cannot be produced naturally by the startup warmup system,
    // but the derivation logic should handle it correctly regardless.
    const warmupState: WarmupStateDouble = {
      isDatasetReady: (key: StartupWarmupDatasetKey) => key === datasetKey,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- _key param required by WarmupStateDouble interface; unconditionally returning false in this defensive test
      isDatasetFailed: (_key: StartupWarmupDatasetKey) => false,
      snapshot: {
        datasets: {
          classPartials: { isTrustworthy: false },
          assignmentDefinitionPartials: { isTrustworthy: false },
          assignmentTopics: { isTrustworthy: false },
          cohorts: { isTrustworthy: false },
          yearGroups: { isTrustworthy: false },
        },
      },
    };
    const queryResult: QueryResultDouble<string[]> = { data: ['item'], isError: false };

    const state: PageDatasetState = computePageDatasetState(datasetKey, queryResult, warmupState);

    expect(state.hasQueryData).toBe(true);
    expect(state.isQueryError).toBe(false);
    expect(state.isDatasetFailed).toBe(false);
    expect(state.isDatasetReady).toBe(true);
    expect(state.isDatasetTrustworthy).toBe(false);
    expect(state.hasTrustworthyDataset).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// computePageSurfaceBlocking
// ---------------------------------------------------------------------------

describe('computePageSurfaceBlocking', () => {
  it('blocks when the dataset has failed and there is no query data', () => {
    const datasetState: PageDatasetState = {
      hasQueryData: false,
      isQueryError: false,
      isDatasetFailed: true,
      isDatasetReady: false,
      isDatasetTrustworthy: false,
      hasTrustworthyDataset: false,
    };

    expect(computePageSurfaceBlocking(datasetState)).toBe(true);
  });

  it('does not block when the dataset has failed but data was recovered with no query error', () => {
    const datasetState: PageDatasetState = {
      hasQueryData: true,
      isQueryError: false,
      isDatasetFailed: true,
      isDatasetReady: false,
      isDatasetTrustworthy: false,
      hasTrustworthyDataset: false,
    };

    expect(computePageSurfaceBlocking(datasetState)).toBe(false);
  });

  it('blocks when the dataset has failed, data is present, but the query is errored', () => {
    const datasetState: PageDatasetState = {
      hasQueryData: true,
      isQueryError: true,
      isDatasetFailed: true,
      isDatasetReady: false,
      isDatasetTrustworthy: false,
      hasTrustworthyDataset: false,
    };

    expect(computePageSurfaceBlocking(datasetState)).toBe(true);
  });

  it('blocks when the dataset is ready but untrustworthy', () => {
    const datasetState: PageDatasetState = {
      hasQueryData: true,
      isQueryError: false,
      isDatasetFailed: false,
      isDatasetReady: true,
      isDatasetTrustworthy: false,
      hasTrustworthyDataset: false,
    };

    expect(computePageSurfaceBlocking(datasetState)).toBe(true);
  });

  it('blocks when the dataset is ready, trustworthy, but the query is errored', () => {
    const datasetState: PageDatasetState = {
      hasQueryData: true,
      isQueryError: true,
      isDatasetFailed: false,
      isDatasetReady: true,
      isDatasetTrustworthy: true,
      hasTrustworthyDataset: true,
    };

    expect(computePageSurfaceBlocking(datasetState)).toBe(true);
  });

  it('blocks when the dataset is ready, trustworthy, the query is errored, and no query data is present', () => {
    const datasetState: PageDatasetState = {
      hasQueryData: false,
      isQueryError: true,
      isDatasetFailed: false,
      isDatasetReady: true,
      isDatasetTrustworthy: true,
      hasTrustworthyDataset: true,
    };

    expect(computePageSurfaceBlocking(datasetState)).toBe(true);
  });

  it('does not block when the dataset is ready, trustworthy, and the query is not errored', () => {
    const datasetState: PageDatasetState = {
      hasQueryData: true,
      isQueryError: false,
      isDatasetFailed: false,
      isDatasetReady: true,
      isDatasetTrustworthy: true,
      hasTrustworthyDataset: true,
    };

    expect(computePageSurfaceBlocking(datasetState)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// computeDatasetRenderable
// ---------------------------------------------------------------------------

describe('computeDatasetRenderable', () => {
  it('marks a trustworthy dataset as renderable', () => {
    const datasetState: PageDatasetState = {
      hasQueryData: true,
      isQueryError: false,
      isDatasetFailed: false,
      isDatasetReady: true,
      isDatasetTrustworthy: true,
      hasTrustworthyDataset: true,
    };

    expect(computeDatasetRenderable(datasetState)).toBe(true);
  });

  it('marks a recovered dataset (failed with data and no error) as renderable', () => {
    const datasetState: PageDatasetState = {
      hasQueryData: true,
      isQueryError: false,
      isDatasetFailed: true,
      isDatasetReady: false,
      isDatasetTrustworthy: false,
      hasTrustworthyDataset: false,
    };

    expect(computeDatasetRenderable(datasetState)).toBe(true);
  });

  it('marks a failed dataset with no query data as not renderable', () => {
    const datasetState: PageDatasetState = {
      hasQueryData: false,
      isQueryError: false,
      isDatasetFailed: true,
      isDatasetReady: false,
      isDatasetTrustworthy: false,
      hasTrustworthyDataset: false,
    };

    expect(computeDatasetRenderable(datasetState)).toBe(false);
  });

  it('marks a failed dataset with data and a query error as not renderable', () => {
    const datasetState: PageDatasetState = {
      hasQueryData: true,
      isQueryError: true,
      isDatasetFailed: true,
      isDatasetReady: false,
      isDatasetTrustworthy: false,
      hasTrustworthyDataset: false,
    };

    expect(computeDatasetRenderable(datasetState)).toBe(false);
  });

  it('marks a not-ready, untrustworthy dataset as not renderable', () => {
    const datasetState: PageDatasetState = {
      hasQueryData: true,
      isQueryError: false,
      isDatasetFailed: false,
      isDatasetReady: false,
      isDatasetTrustworthy: false,
      hasTrustworthyDataset: false,
    };

    expect(computeDatasetRenderable(datasetState)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// computePageSurfaceBusy
// ---------------------------------------------------------------------------

describe('computePageSurfaceBusy', () => {
  it('returns busy when at least one fetch flag is true', () => {
    expect(computePageSurfaceBusy([true], [false])).toBe(true);
  });

  it('returns busy when at least one mutation flag is true', () => {
    expect(computePageSurfaceBusy([false], [true])).toBe(true);
  });

  it('returns not busy when all fetch and mutation flags are false', () => {
    expect(computePageSurfaceBusy([false, false], [false])).toBe(false);
  });

  it('returns not busy when both arrays are empty', () => {
    expect(computePageSurfaceBusy([], [])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// usePageDataset — hook integration test helpers (module scope)
// ---------------------------------------------------------------------------

/**
 * Creates a fresh QueryClient suitable for hook tests.
 *
 * Retries are disabled so failed queries do not loop.
 *
 * @returns {QueryClient} A test QueryClient.
 */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

/**
 * Creates a React wrapper that provides the given QueryClient.
 *
 * @param {QueryClient} queryClient QueryClient to provide.
 * @returns {Function} A wrapper component for renderHook.
 */
function createTestWrapper(queryClient: QueryClient) {
  return function TestWrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

/**
 * Builds a minimal {@link UseQueryResult} double for the mocked useQuery.
 *
 * Only the fields consumed by {@link computePageDatasetState} (`data` and
 * `isError`) are meaningful; the rest are present to satisfy the shape.
 *
 * @param {TData} [data] Optional query data.
 * @param {boolean} [isError=false] Whether the query is in an error state.
 * @returns {UseQueryResult<TData>} A mock query result.
 */
function createMockUseQueryResult<TData>(
  data?: TData,
  isError: boolean = false
): UseQueryResult<TData> {
  return {
    data,
    dataUpdatedAt: 0,
    error: null,
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    fetchStatus: 'idle' as const,
    isError,
    isFetched: true,
    isFetchedAfterMount: false,
    isFetching: false,
    isInitialLoading: false,
    isLoading: false,
    isLoadingError: false,
    isPaused: false,
    isPending: false,
    isPlaceholderData: false,
    isRefetchError: false,
    isRefetching: false,
    isStale: false,
    isSuccess: !isError,
    status: isError ? ('error' as const) : ('success' as const),
    refetch: vi.fn(),
    promise: Promise.resolve(data as TData),
  } as unknown as UseQueryResult<TData>;
}

/**
 * Derives a warmup status string from ready/failed flags.
 *
 * @param {boolean} ready Whether the dataset is ready.
 * @param {boolean} failed Whether the dataset has failed.
 * @returns {'ready' | 'failed' | 'loading'} Warmup status.
 */
function resolveWarmupStatus(ready: boolean, failed: boolean): 'ready' | 'failed' | 'loading' {
  if (ready) {
    return 'ready';
  }

  if (failed) {
    return 'failed';
  }

  return 'loading';
}

/**
 * Builds a compliant return value for the mocked useStartupWarmupState.
 *
 * @param {object} overrides Dataset-state overrides.
 * @param {boolean} [overrides.ready=false] Whether isDatasetReady returns true.
 * @param {boolean} [overrides.failed=false] Whether isDatasetFailed returns true.
 * @param {boolean} [overrides.trustworthy=false] Trustworthiness flag.
 * @param {StartupWarmupDatasetKey} [overrides.datasetKey='classPartials'] Dataset key.
 * @returns {Record<string, unknown>} A warmup-state double.
 */
function createWarmupStateReturn(
  overrides: {
    ready?: boolean;
    failed?: boolean;
    trustworthy?: boolean;
    datasetKey?: StartupWarmupDatasetKey;
  } = {}
): Record<string, unknown> {
  const {
    ready = false,
    failed = false,
    trustworthy = false,
    datasetKey = 'classPartials',
  } = overrides;

  const status = resolveWarmupStatus(ready, failed);

  return {
    warmupState: status,
    isLoading: status === 'loading',
    isReady: status === 'ready',
    isFailed: status === 'failed',
    snapshot: {
      datasets: {
        [datasetKey]: { status, isTrustworthy: trustworthy },
      },
    },
    isDatasetReady: (key: string) => key === datasetKey && ready,
    isDatasetFailed: (key: string) => key === datasetKey && failed,
  };
}

/**
 * Returns a valid query-options double consumed by useQuery inside the hook.
 *
 * @returns {Record<string, unknown>} Query options with queryKey and queryFn.
 */
function createQueryOptionsDouble(): Record<string, unknown> {
  return {
    queryKey: ['test-dataset'],
    queryFn: vi.fn().mockResolvedValue(['mock-response']),
  };
}

// ---------------------------------------------------------------------------
// usePageDataset — hook integration tests (red phase)
// ---------------------------------------------------------------------------

describe('usePageDataset', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  // -----------------------------------------------------------------------
  // enabled behaviour
  // -----------------------------------------------------------------------

  describe('enabled behaviour', () => {
    it('enables useQuery when the warmup dataset is ready', () => {
      const queryClient = createTestQueryClient();
      const wrapper = createTestWrapper(queryClient);

      mockUseStartupWarmupState.mockReturnValue(
        createWarmupStateReturn({ ready: true, trustworthy: true })
      );
      mockGetStartupWarmupQueryOptions.mockReturnValue(createQueryOptionsDouble());
      mockUseQuery.mockReturnValue(createMockUseQueryResult<string[]>(['item']));

      renderHook(() => usePageDataset<string[]>('classPartials'), { wrapper });

      expect(mockUseStartupWarmupState).toHaveBeenCalled();
      expect(mockGetStartupWarmupQueryOptions).toHaveBeenCalledWith('classPartials');

      const useQueryCall = mockUseQuery.mock.calls[0]?.[0];
      expect(useQueryCall).toMatchObject({
        enabled: true,
        refetchOnMount: false,
        queryKey: ['test-dataset'],
        queryFn: expect.any(Function),
      });
    });

    it('enables useQuery when the warmup dataset has failed', () => {
      const queryClient = createTestQueryClient();
      const wrapper = createTestWrapper(queryClient);

      mockUseStartupWarmupState.mockReturnValue(createWarmupStateReturn({ failed: true }));
      mockGetStartupWarmupQueryOptions.mockReturnValue(createQueryOptionsDouble());
      mockUseQuery.mockReturnValue(createMockUseQueryResult<string[]>());

      renderHook(() => usePageDataset<string[]>('classPartials'), { wrapper });

      expect(mockGetStartupWarmupQueryOptions).toHaveBeenCalledWith('classPartials');

      const useQueryCall = mockUseQuery.mock.calls[0]?.[0];
      expect(useQueryCall).toMatchObject({ enabled: true, refetchOnMount: false });
    });

    it('disables useQuery when the warmup dataset is loading', () => {
      const queryClient = createTestQueryClient();
      const wrapper = createTestWrapper(queryClient);

      mockUseStartupWarmupState.mockReturnValue(
        createWarmupStateReturn({ ready: false, failed: false })
      );
      mockGetStartupWarmupQueryOptions.mockReturnValue(createQueryOptionsDouble());
      mockUseQuery.mockReturnValue(createMockUseQueryResult<string[]>());

      renderHook(() => usePageDataset<string[]>('classPartials'), { wrapper });

      expect(mockGetStartupWarmupQueryOptions).toHaveBeenCalledWith('classPartials');

      const useQueryCall = mockUseQuery.mock.calls[0]?.[0];
      expect(useQueryCall).toMatchObject({ enabled: false, refetchOnMount: false });
    });
  });

  // -----------------------------------------------------------------------
  // dataset trustworthiness
  // -----------------------------------------------------------------------

  describe('dataset trustworthiness', () => {
    it('returns hasTrustworthyDataset true when the dataset is ready and trustworthy', () => {
      const queryClient = createTestQueryClient();
      const wrapper = createTestWrapper(queryClient);

      mockUseStartupWarmupState.mockReturnValue(
        createWarmupStateReturn({ ready: true, trustworthy: true })
      );
      mockGetStartupWarmupQueryOptions.mockReturnValue(createQueryOptionsDouble());
      mockUseQuery.mockReturnValue(createMockUseQueryResult<string[]>(['item']));

      const { result } = renderHook(() => usePageDataset<string[]>('classPartials'), { wrapper });

      expect(result.current.datasetState.hasTrustworthyDataset).toBe(true);
    });

    it('returns hasTrustworthyDataset false when the dataset is not trustworthy', () => {
      const queryClient = createTestQueryClient();
      const wrapper = createTestWrapper(queryClient);

      mockUseStartupWarmupState.mockReturnValue(
        createWarmupStateReturn({ ready: true, trustworthy: false })
      );
      mockGetStartupWarmupQueryOptions.mockReturnValue(createQueryOptionsDouble());
      mockUseQuery.mockReturnValue(createMockUseQueryResult<string[]>(['item']));

      const { result } = renderHook(() => usePageDataset<string[]>('classPartials'), { wrapper });

      expect(result.current.datasetState.hasTrustworthyDataset).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // error handling
  // -----------------------------------------------------------------------

  describe('error handling', () => {
    it('throws when called with an unknown dataset key', () => {
      const queryClient = createTestQueryClient();
      const wrapper = createTestWrapper(queryClient);

      mockUseStartupWarmupState.mockReturnValue(
        createWarmupStateReturn({ ready: true, trustworthy: true })
      );
      mockGetStartupWarmupQueryOptions.mockImplementation(() => {
        throw new Error('Unknown startup warm-up dataset key: invalid-key.');
      });
      mockUseQuery.mockReturnValue(createMockUseQueryResult<string[]>());

      expect(() =>
        renderHook(() => usePageDataset<string[]>('invalid-key' as StartupWarmupDatasetKey), {
          wrapper,
        })
      ).toThrow('Unknown startup warm-up dataset key: invalid-key.');
    });
  });
});
