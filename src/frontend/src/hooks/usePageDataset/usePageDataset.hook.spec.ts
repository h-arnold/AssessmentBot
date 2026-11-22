import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StartupWarmupDatasetKey } from '@/query/sharedQueries';
import { usePageDataset } from './usePageDataset';
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
  () => {
    return {
      mockUseQuery: vi.fn(),
      mockUseStartupWarmupState: vi.fn(),
      mockGetStartupWarmupQueryOptions: vi.fn(),
    };
  }
);

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useQuery: mockUseQuery,
  };
});

vi.mock('@/features/auth/startupWarmupState', () => {
  return {
    useStartupWarmupState: mockUseStartupWarmupState,
  };
});

vi.mock('@/query/sharedQueries', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getStartupWarmupQueryOptions: mockGetStartupWarmupQueryOptions,
  };
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
 * The successful result fields consumed by {@link computePageDatasetState} are
 * meaningful; the rest are present to satisfy the shape.
 *
 * @param {TData} [data] Optional query data.
 * @returns {UseQueryResult<TData>} A mock query result.
 */
function createMockUseQueryResult<TData>(data?: TData): UseQueryResult<TData> {
  return {
    data,
    dataUpdatedAt: 0,
    error: null,
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    fetchStatus: 'idle' as const,
    isError: false,
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
    isSuccess: true,
    status: 'success' as const,
    refetch: vi.fn(),
    promise: Promise.resolve(data as TData),
  } as unknown as UseQueryResult<TData>;
}

/**
 * Derives a warmup status string from ready/failed flags.
 *
 * @param {boolean} isReady Whether the dataset is ready.
 * @param {boolean} hasFailed Whether the dataset has failed.
 * @returns {'ready' | 'failed' | 'loading'} Warmup status.
 */
function resolveWarmupStatus(isReady: boolean, hasFailed: boolean): 'ready' | 'failed' | 'loading' {
  if (isReady) {
    return 'ready';
  }

  if (hasFailed) {
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

      expect(() => {
        return renderHook(
          () => usePageDataset<string[]>('invalid-key' as StartupWarmupDatasetKey),
          {
            wrapper,
          }
        );
      }).toThrow('Unknown startup warm-up dataset key: invalid-key.');
    });
  });
});
