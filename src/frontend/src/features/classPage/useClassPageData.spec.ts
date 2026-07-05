/**
 * Tests for the Class page data orchestrator hook (`useClassPageData`).
 *
 * @remarks
 * This is the **red phase** — the implementation file (`useClassPageData.ts`)
 * does not exist yet, so all tests will fail with "Cannot find module"
 * on import.  This confirms the red-phase contract before implementation.
 *
 * @see SPEC_CLASS_PAGE.md — "useClassPageData — data orchestrator hook"
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { createMetricResult } from '../../test/dataAnalysis/fixtures';
import { useClassPageData } from './useClassPageData';
import type { ClassPageAdapterResult } from './classPageAdapter.zod';
import type { AveragingResult } from '../../services/dataAnalysis/dataAnalysis.zod';
import type { ClassFull } from '../../services/googleClassrooms/classDetail/classDetailService.zod';
import type { PageDatasetState } from '../../hooks/usePageDataset';

// ===========================================================================
// Mock setup (hoisted)
// ===========================================================================

const {
  mockUseQuery,
  mockUsePageDataset,
  mockGetABClassQueryOptions,
  mockAnalyse,
  mockAdaptClassPageToViewModel,
} = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
  mockUsePageDataset: vi.fn(),
  mockGetABClassQueryOptions: vi.fn(),
  mockAnalyse: vi.fn(),
  mockAdaptClassPageToViewModel: vi.fn(),
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useQuery: mockUseQuery,
  };
});

vi.mock('../../hooks/usePageDataset', () => ({
  usePageDataset: mockUsePageDataset,
}));

vi.mock('../../query/sharedQueries', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getABClassQueryOptions: mockGetABClassQueryOptions,
  };
});

vi.mock('../../services/dataAnalysis/dataAnalysisService', () => ({
  DataAnalysisService: vi.fn().mockImplementation(function () {
    return { analyse: mockAnalyse };
  }),
}));

vi.mock('./classPageAdapter', () => ({
  adaptClassPageToViewModel: mockAdaptClassPageToViewModel,
}));

// ===========================================================================
// Shared test helpers
// ===========================================================================

/**
 * Creates a fresh QueryClient suitable for hook tests.
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

// ===========================================================================
// Fixture factories
// ===========================================================================

/** Default classId used across tests. */
const DEFAULT_CLASS_ID = 'class-abc-123';

/**
 * Creates a minimal ClassFull fixture.
 *
 * @param {Partial<ClassFull>} [overrides] - Optional overrides.
 * @returns {ClassFull} A ClassFull fixture.
 */
function createClassFull(overrides?: Partial<ClassFull>): ClassFull {
  return {
    classId: DEFAULT_CLASS_ID,
    className: 'Test Class 7A',
    cohortKey: null,
    courseLength: 1,
    yearGroupKey: 'yg-7',
    classOwner: null,
    teachers: [],
    students: [],
    assignments: [],
    active: true,
    ...overrides,
  } as unknown as ClassFull;
}

/**
 * Creates a minimal AveragingResult fixture for the default class.
 *
 * @param {Partial<AveragingResult>} [overrides] - Optional overrides.
 * @returns {AveragingResult} An AveragingResult fixture.
 */
function createAveragingResult(overrides?: Partial<AveragingResult>): AveragingResult {
  return {
    classId: DEFAULT_CLASS_ID,
    className: 'Test Class 7A',
    perStudent: [],
    perTask: [],
    perClass: {
      completeness: createMetricResult('computed', { value: 4 }),
      accuracy: createMetricResult('computed', { value: 3.5 }),
      spag: createMetricResult('notAttempted'),
      overall: createMetricResult('computed', { value: 3.8 }),
    },
    appliedCriterionWeightings: { completeness: 0.4, accuracy: 0.4, spag: 0.2 },
    ...overrides,
  };
}

/**
 * Creates a minimal ClassPageAdapterResult fixture.
 *
 * @param {Partial<ClassPageAdapterResult>} [overrides] - Optional overrides.
 * @returns {ClassPageAdapterResult} A ClassPageAdapterResult fixture.
 */
function createAdapterResult(overrides?: Partial<ClassPageAdapterResult>): ClassPageAdapterResult {
  return {
    recentAssignments: [],
    studentAverages: [],
    classMetrics: {
      completeness: createMetricResult('computed', { value: 4 }),
      accuracy: createMetricResult('computed', { value: 3.5 }),
      spag: createMetricResult('notAttempted'),
      overall: createMetricResult('computed', { value: 3.8 }),
    },
    ...overrides,
  };
}

/**
 * Compute the React Query status from pending and error flags.
 *
 * @param {boolean} isPending - Whether the query is pending.
 * @param {boolean} isError - Whether the query is in error.
 * @returns {QueryStatus} The query status.
 */
function computeStatus(isPending: boolean, isError: boolean): QueryStatus {
  if (isPending) {
    return 'pending';
  }

  if (isError) {
    return 'error';
  }

  return 'success';
}

/** React Query query status union. */
type QueryStatus = 'pending' | 'error' | 'success';

/**
 * Build a shared base UseQueryResult mock with all non-override fields set.
 *
 * @param {ClassFull | null | undefined} queryData - The query data payload.
 * @param {Error | null} queryError - The query error object.
 * @param {boolean} queryIsPending - Whether the query is pending.
 * @param {QueryStatus} status - The query status.
 * @param {Function} refetch - Refetch function mock.
 * @returns {object} Partial UseQueryResult mock.
 */
function buildBaseQueryResult(
  queryData: ClassFull | null | undefined,
  queryError: Error | null,
  queryIsPending: boolean,
  status: 'pending' | 'error' | 'success',
  refetch: ReturnType<typeof vi.fn>
) {
  return {
    data: queryData ?? null,
    dataUpdatedAt: 0,
    error: queryError,
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    fetchStatus: queryIsPending ? ('fetching' as const) : ('idle' as const),
    isFetched: !queryIsPending,
    isFetchedAfterMount: !queryIsPending,
    isFetching: queryIsPending,
    isInitialLoading: queryIsPending,
    isLoading: queryIsPending,
    isLoadingError: false,
    isPaused: false,
    isPending: queryIsPending,
    isPlaceholderData: false,
    isRefetchError: false,
    isRefetching: false,
    isStale: false,
    isSuccess: status === 'success',
    refetch,
    promise: Promise.resolve(queryData ?? null),
  };
}

/**
 * Build a mock UseQueryResult for the per-class query.
 *
 * @param {object} overrides - Query result overrides.
 * @param {ClassFull | null} [overrides.data] - Query data payload.
 * @param {boolean} [overrides.isPending=false] - Whether the query is pending.
 * @param {boolean} [overrides.isError=false] - Whether the query is in error.
 * @param {Error | null} [overrides.error=null] - Query error object.
 * @param {Function} [overrides.refetch] - Refetch function mock.
 * @returns {UseQueryResult<ClassFull | null, Error>} A mock query result.
 */
function createMockClassQueryResult(overrides: {
  data?: ClassFull | null;
  isPending?: boolean;
  isError?: boolean;
  error?: Error | null;
  refetch?: ReturnType<typeof vi.fn>;
}): UseQueryResult<ClassFull | null, Error> {
  const queryIsPending = overrides.isPending ?? false;
  const queryIsError = overrides.isError ?? false;
  const queryError = overrides.error ?? null;
  const refetch = overrides.refetch ?? vi.fn();
  const queryData = overrides.data;
  const status = computeStatus(queryIsPending, queryIsError);

  return {
    ...buildBaseQueryResult(queryData, queryError, queryIsPending, status, refetch),
    isError: queryIsError,
    status: status as 'pending' | 'error' | 'success',
  } as unknown as UseQueryResult<ClassFull | null, Error>;
}

/**
 * Build a PageDatasetState fixture with the given overrides.
 * Defaults to a trustworthily-ready dataset.
 *
 * @param {Partial<PageDatasetState>} [overrides] - Optional overrides for state fields.
 * @returns {PageDatasetState} A PageDatasetState fixture.
 */
function createDatasetState(overrides?: Partial<PageDatasetState>): PageDatasetState {
  return {
    hasQueryData: true,
    isQueryError: false,
    isDatasetFailed: false,
    isDatasetReady: true,
    isDatasetTrustworthy: true,
    hasTrustworthyDataset: true,
    ...overrides,
  };
}

/**
 * Build a usePageDataset return value with the given query result and dataset state.
 *
 * Provides default non-null `data` (empty array) for the assignmentDefinitionPartials
 * query so the analyser/adapter pipeline guard does not block tests that expect
 * the pipeline to run.  Tests that need null/no data must explicitly override
 * with `{ data: null }`.
 *
 * @param {object} [queryOverrides] - Overrides for the mock query result.
 * @param {Partial<PageDatasetState>} [datasetOverrides] - Overrides for the dataset state.
 * @returns {object} A usePageDataset return value.
 */
function createPageDatasetReturn(
  queryOverrides: Parameters<typeof createMockClassQueryResult>[0] = {},
  datasetOverrides?: Partial<PageDatasetState>
) {
  return {
    query: createMockClassQueryResult({
      // Provide default non-null data so shouldRunPipeline is not blocked by
      // null assignmentDefinitionPartials.  Cast is safe because the mock does
      // not validate types at runtime.
      data: [] as unknown as ClassFull | null,
      ...queryOverrides,
    }),
    datasetState: createDatasetState(datasetOverrides),
  };
}

// ===========================================================================
// Common test setup
// ===========================================================================

let queryClient: QueryClient;
let wrapper: ReturnType<typeof createTestWrapper>;

beforeEach(() => {
  queryClient = createTestQueryClient();
  wrapper = createTestWrapper(queryClient);
});

afterEach(() => {
  vi.resetAllMocks();
});

// ===========================================================================
// Surface state tests
// ===========================================================================

describe('surfaceState derivation', () => {
  it('returns loading when the per-class query is in flight and the dataset is not ready and not failed', () => {
    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockUseQuery.mockReturnValue(createMockClassQueryResult({ isPending: true }));
    mockUsePageDataset.mockReturnValue(
      createPageDatasetReturn(
        { isPending: true },
        { isDatasetReady: false, isDatasetTrustworthy: false, hasTrustworthyDataset: false }
      )
    );

    const { result } = renderHook(() => useClassPageData(DEFAULT_CLASS_ID), { wrapper });

    expect(result.current.surfaceState).toEqual({ status: 'loading' });
    expect(result.current.analyserResult).toBeNull();
    expect(result.current.adapterResult).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('returns classNotFound blocking when getABClass returns null and the dataset is trustworthily ready', () => {
    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockUseQuery.mockReturnValue(createMockClassQueryResult({ data: null }));
    mockUsePageDataset.mockReturnValue(createPageDatasetReturn());

    const { result } = renderHook(() => useClassPageData(DEFAULT_CLASS_ID), { wrapper });

    expect(result.current.surfaceState).toEqual({
      status: 'blocking',
      error: { type: 'classNotFound' },
    });
    expect(result.current.error).toEqual({ type: 'classNotFound' });
    expect(result.current.analyserResult).toBeNull();
    expect(result.current.adapterResult).toBeNull();
    expect(result.current.classFullQuery).toBeDefined();
  });

  it('returns classQueryError blocking when the per-class query errors and the dataset is trustworthily ready', () => {
    const queryError = new Error('Failed to fetch class');
    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockUseQuery.mockReturnValue(createMockClassQueryResult({ isError: true, error: queryError }));
    mockUsePageDataset.mockReturnValue(createPageDatasetReturn());

    const { result } = renderHook(() => useClassPageData(DEFAULT_CLASS_ID), { wrapper });

    expect(result.current.surfaceState).toEqual({
      status: 'blocking',
      error: { type: 'classQueryError', cause: queryError },
    });
    expect(result.current.error).toEqual({ type: 'classQueryError', cause: queryError });
    expect(result.current.analyserResult).toBeNull();
    expect(result.current.adapterResult).toBeNull();
    expect(result.current.classFullQuery).toBeDefined();
  });

  it('returns assignmentDefinitionPartialsFailed blocking when the warm-up dataset failed with no query data', () => {
    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockUseQuery.mockReturnValue(createMockClassQueryResult({ data: createClassFull() }));
    mockUsePageDataset.mockReturnValue(
      createPageDatasetReturn(
        { isError: true },
        {
          isDatasetFailed: true,
          isDatasetReady: false,
          isDatasetTrustworthy: false,
          hasTrustworthyDataset: false,
          hasQueryData: false,
          isQueryError: true,
        }
      )
    );

    const { result } = renderHook(() => useClassPageData(DEFAULT_CLASS_ID), { wrapper });

    expect(result.current.surfaceState).toEqual({
      status: 'blocking',
      error: { type: 'assignmentDefinitionPartialsFailed' },
    });
    expect(result.current.error).toEqual({ type: 'assignmentDefinitionPartialsFailed' });
    expect(result.current.analyserResult).toBeNull();
    expect(result.current.adapterResult).toBeNull();
  });

  it('returns assignmentDefinitionPartialsUntrustworthy blocking when the warm-up dataset is untrustworthy but ready', () => {
    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockUseQuery.mockReturnValue(createMockClassQueryResult({ data: createClassFull() }));
    mockUsePageDataset.mockReturnValue(
      createPageDatasetReturn(
        {},
        { isDatasetReady: true, isDatasetTrustworthy: false, hasTrustworthyDataset: false }
      )
    );

    const { result } = renderHook(() => useClassPageData(DEFAULT_CLASS_ID), { wrapper });

    expect(result.current.surfaceState).toEqual({
      status: 'blocking',
      error: { type: 'assignmentDefinitionPartialsUntrustworthy' },
    });
    expect(result.current.error).toEqual({ type: 'assignmentDefinitionPartialsUntrustworthy' });
    expect(result.current.analyserResult).toBeNull();
    expect(result.current.adapterResult).toBeNull();
  });

  it('returns adapterError blocking when adaptClassPageToViewModel throws', () => {
    const adapterError = new TypeError('Duplicate student id: s-1');
    mockAnalyse.mockReturnValue([createAveragingResult()]);
    mockAdaptClassPageToViewModel.mockImplementation(() => {
      throw adapterError;
    });

    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockUseQuery.mockReturnValue(createMockClassQueryResult({ data: createClassFull() }));
    mockUsePageDataset.mockReturnValue(createPageDatasetReturn());

    const { result } = renderHook(() => useClassPageData(DEFAULT_CLASS_ID), { wrapper });

    expect(result.current.surfaceState).toEqual({
      status: 'blocking',
      error: { type: 'adapterError', cause: adapterError },
    });
    expect(result.current.error).toEqual({ type: 'adapterError', cause: adapterError });
    expect(result.current.analyserResult).toBeNull();
    expect(result.current.adapterResult).toBeNull();
  });

  it('returns analyserError blocking when DataAnalysisService.analyse throws', () => {
    const analyserError = new Error('Analysis failed');
    mockAnalyse.mockImplementation(() => {
      throw analyserError;
    });

    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockUseQuery.mockReturnValue(createMockClassQueryResult({ data: createClassFull() }));
    mockUsePageDataset.mockReturnValue(createPageDatasetReturn());

    const { result } = renderHook(() => useClassPageData(DEFAULT_CLASS_ID), { wrapper });

    expect(result.current.surfaceState).toEqual({
      status: 'blocking',
      error: { type: 'analyserError', cause: analyserError },
    });
    expect(result.current.error).toEqual({ type: 'analyserError', cause: analyserError });
    expect(result.current.analyserResult).toBeNull();
    expect(result.current.adapterResult).toBeNull();
  });

  it('returns ready state with non-null adapterResult when all inputs are ready and both analyser and adapter succeed', () => {
    const averagingResult = createAveragingResult();
    const adapterResult = createAdapterResult();

    mockAnalyse.mockReturnValue([averagingResult]);
    mockAdaptClassPageToViewModel.mockReturnValue(adapterResult);

    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockUseQuery.mockReturnValue(createMockClassQueryResult({ data: createClassFull() }));
    mockUsePageDataset.mockReturnValue(createPageDatasetReturn());

    const { result } = renderHook(() => useClassPageData(DEFAULT_CLASS_ID), { wrapper });

    expect(result.current.surfaceState).toEqual({ status: 'ready' });
    expect(result.current.error).toBeNull();
    expect(result.current.analyserResult).toEqual(averagingResult);
    expect(result.current.adapterResult).toEqual(adapterResult);
    expect(result.current.classFull).toEqual(createClassFull());
    expect(result.current.classFullQuery).toBeDefined();
    expect(result.current.assignmentDefinitionPartials).toBeDefined();
  });
});

// ===========================================================================
// Analyser and adapter invocation tests
// ===========================================================================

describe('analyser and adapter synchronous invocation', () => {
  it('calls the analyser synchronously when both classFull and assignmentDefinitionPartials are ready', () => {
    const averagingResult = createAveragingResult();
    const adapterResult = createAdapterResult();

    mockAnalyse.mockReturnValue([averagingResult]);
    mockAdaptClassPageToViewModel.mockReturnValue(adapterResult);

    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockUseQuery.mockReturnValue(createMockClassQueryResult({ data: createClassFull() }));
    mockUsePageDataset.mockReturnValue(createPageDatasetReturn());

    renderHook(() => useClassPageData(DEFAULT_CLASS_ID), { wrapper });

    expect(mockAnalyse).toHaveBeenCalledTimes(1);
  });

  it('calls the adapter synchronously when the analyser result is ready', () => {
    const averagingResult = createAveragingResult();
    const adapterResult = createAdapterResult();

    mockAnalyse.mockReturnValue([averagingResult]);
    mockAdaptClassPageToViewModel.mockReturnValue(adapterResult);

    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockUseQuery.mockReturnValue(createMockClassQueryResult({ data: createClassFull() }));
    mockUsePageDataset.mockReturnValue(createPageDatasetReturn());

    renderHook(() => useClassPageData(DEFAULT_CLASS_ID), { wrapper });

    expect(mockAdaptClassPageToViewModel).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// Memoisation tests
// ===========================================================================

describe('memoisation (referential equality)', () => {
  it('does not re-call the analyser when classFull and assignmentDefinitionPartials are referentially equal', () => {
    const classFull = createClassFull();
    const averagingResult = createAveragingResult();
    const adapterResult = createAdapterResult();

    mockAnalyse.mockReturnValue([averagingResult]);
    mockAdaptClassPageToViewModel.mockReturnValue(adapterResult);

    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockUseQuery.mockReturnValue(createMockClassQueryResult({ data: classFull }));
    mockUsePageDataset.mockReturnValue(createPageDatasetReturn());

    const { rerender } = renderHook(
      (properties: { classId: string }) => useClassPageData(properties.classId),
      { initialProps: { classId: DEFAULT_CLASS_ID }, wrapper }
    );

    expect(mockAnalyse).toHaveBeenCalledTimes(1);
    mockAnalyse.mockClear();

    // Rerender with the same classId — mocks return the same references
    rerender({ classId: DEFAULT_CLASS_ID });

    expect(mockAnalyse).not.toHaveBeenCalled();
  });

  it('does not re-call the adapter when analyserResult and classFull are referentially equal', () => {
    const classFull = createClassFull();
    const averagingResult = createAveragingResult();
    const adapterResult = createAdapterResult();

    mockAnalyse.mockReturnValue([averagingResult]);
    mockAdaptClassPageToViewModel.mockReturnValue(adapterResult);

    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockUseQuery.mockReturnValue(createMockClassQueryResult({ data: classFull }));
    mockUsePageDataset.mockReturnValue(createPageDatasetReturn());

    const { rerender } = renderHook(
      (properties: { classId: string }) => useClassPageData(properties.classId),
      { initialProps: { classId: DEFAULT_CLASS_ID }, wrapper }
    );

    expect(mockAdaptClassPageToViewModel).toHaveBeenCalledTimes(1);
    mockAdaptClassPageToViewModel.mockClear();

    // Rerender with the same classId — mocks return the same references
    rerender({ classId: DEFAULT_CLASS_ID });

    expect(mockAdaptClassPageToViewModel).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Invalidation tests
// ===========================================================================

describe('memoisation invalidation', () => {
  it('re-calls the analyser when classFull changes', () => {
    const initialClassFull = createClassFull({ className: 'Original Class' });
    const updatedClassFull = createClassFull({ className: 'Updated Class' });
    const averagingResult = createAveragingResult();
    const adapterResult = createAdapterResult();

    mockAnalyse.mockReturnValue([averagingResult]);
    mockAdaptClassPageToViewModel.mockReturnValue(adapterResult);

    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockUsePageDataset.mockReturnValue(createPageDatasetReturn());

    // First render with initial classFull
    mockUseQuery.mockReturnValue(createMockClassQueryResult({ data: initialClassFull }));

    const { rerender } = renderHook(
      (properties: { classId: string }) => useClassPageData(properties.classId),
      { initialProps: { classId: DEFAULT_CLASS_ID }, wrapper }
    );

    expect(mockAnalyse).toHaveBeenCalledTimes(1);
    mockAnalyse.mockClear();

    // Change classFull to a different object
    mockUseQuery.mockReturnValue(createMockClassQueryResult({ data: updatedClassFull }));

    rerender({ classId: DEFAULT_CLASS_ID });

    expect(mockAnalyse).toHaveBeenCalledTimes(1);
  });

  it('re-calls the adapter when analyserResult changes', () => {
    const classFull = createClassFull();
    const initialAveragingResult = createAveragingResult({ className: 'First Analysis' });
    const updatedAveragingResult = createAveragingResult({ className: 'Second Analysis' });
    const adapterResult = createAdapterResult();

    mockAdaptClassPageToViewModel.mockReturnValue(adapterResult);

    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockUseQuery.mockReturnValue(createMockClassQueryResult({ data: classFull }));
    mockUsePageDataset.mockReturnValue(createPageDatasetReturn());

    // First render — first call to mockAnalyse returns initial result,
    // subsequent calls return the updated result
    mockAnalyse.mockReturnValueOnce([initialAveragingResult]);
    mockAnalyse.mockReturnValue([updatedAveragingResult]);

    const { rerender } = renderHook(
      (properties: { classId: string }) => useClassPageData(properties.classId),
      { initialProps: { classId: DEFAULT_CLASS_ID }, wrapper }
    );

    expect(mockAdaptClassPageToViewModel).toHaveBeenCalledTimes(1);
    mockAdaptClassPageToViewModel.mockClear();

    // Keep classFull content constant but supply a new reference to trigger re-analysis.
    // The analyser re-runs (classFull reference changed) and returns updatedAveragingResult,
    // which should cause the adapter to re-run
    // (adapter memoisation key = [analyserResult, classFull]).
    mockUseQuery.mockReturnValue(createMockClassQueryResult({ data: createClassFull() }));

    rerender({ classId: DEFAULT_CLASS_ID });

    expect(mockAdaptClassPageToViewModel).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// refetch dual-query contract tests
// ===========================================================================

describe('refetch dual-query contract', () => {
  it('calls refetch on both the per-class and dataset queries when refetch() is invoked', () => {
    const classFull = createClassFull();
    const averagingResult = createAveragingResult();
    const adapterResult = createAdapterResult();
    const queryRefetchMock = vi.fn();
    const adpRefetchMock = vi.fn();

    mockAnalyse.mockReturnValue([averagingResult]);
    mockAdaptClassPageToViewModel.mockReturnValue(adapterResult);

    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockUseQuery.mockReturnValue(
      createMockClassQueryResult({ data: classFull, refetch: queryRefetchMock })
    );
    mockUsePageDataset.mockReturnValue(createPageDatasetReturn({ refetch: adpRefetchMock }));

    const { result } = renderHook(() => useClassPageData(DEFAULT_CLASS_ID), { wrapper });

    queryRefetchMock.mockClear();
    adpRefetchMock.mockClear();

    result.current.refetch();

    expect(queryRefetchMock).toHaveBeenCalledTimes(1);
    expect(adpRefetchMock).toHaveBeenCalledTimes(1);
  });

  it('invokes both query and dataset refetch when assignmentDefinitionPartialsFailed is true and refetch() is called', () => {
    const classFull = createClassFull();
    const queryRefetchMock = vi.fn();
    const adpRefetchMock = vi.fn();

    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockUseQuery.mockReturnValue(
      createMockClassQueryResult({ data: classFull, refetch: queryRefetchMock })
    );
    mockUsePageDataset.mockReturnValue(
      createPageDatasetReturn(
        { refetch: adpRefetchMock, isError: true },
        {
          isDatasetFailed: true,
          isDatasetReady: false,
          isDatasetTrustworthy: false,
          hasTrustworthyDataset: false,
          hasQueryData: false,
          isQueryError: true,
        }
      )
    );

    const { result } = renderHook(() => useClassPageData(DEFAULT_CLASS_ID), { wrapper });

    expect(result.current.surfaceState).toEqual({
      status: 'blocking',
      error: { type: 'assignmentDefinitionPartialsFailed' },
    });

    queryRefetchMock.mockClear();
    adpRefetchMock.mockClear();

    result.current.refetch();

    expect(queryRefetchMock).toHaveBeenCalledTimes(1);
    expect(adpRefetchMock).toHaveBeenCalledTimes(1);
  });

  it('remains stable across renders when neither refetch reference changes', () => {
    const classFull = createClassFull();
    const averagingResult = createAveragingResult();
    const adapterResult = createAdapterResult();
    const queryRefetchMock = vi.fn();
    const adpRefetchMock = vi.fn();

    mockAnalyse.mockReturnValue([averagingResult]);
    mockAdaptClassPageToViewModel.mockReturnValue(adapterResult);

    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockUseQuery.mockReturnValue(
      createMockClassQueryResult({ data: classFull, refetch: queryRefetchMock })
    );
    mockUsePageDataset.mockReturnValue(createPageDatasetReturn({ refetch: adpRefetchMock }));

    const { rerender, result } = renderHook(
      (properties: { classId: string }) => useClassPageData(properties.classId),
      { initialProps: { classId: DEFAULT_CLASS_ID }, wrapper }
    );

    const firstRefetch = result.current.refetch;

    rerender({ classId: DEFAULT_CLASS_ID });

    expect(result.current.refetch).toBe(firstRefetch);
  });

  it('updates to use the new refs when classId changes', () => {
    const classFull = createClassFull();
    const averagingResult = createAveragingResult();
    const adapterResult = createAdapterResult();
    const initialQueryRefetchMock = vi.fn();
    const initialAdpRefetchMock = vi.fn();
    const newClassId = 'class-xyz-789';
    const newQueryRefetchMock = vi.fn();
    const newAdpRefetchMock = vi.fn();

    mockAnalyse.mockReturnValue([averagingResult]);
    mockAdaptClassPageToViewModel.mockReturnValue(adapterResult);

    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockUseQuery.mockReturnValue(
      createMockClassQueryResult({ data: classFull, refetch: initialQueryRefetchMock })
    );
    mockUsePageDataset.mockReturnValue(createPageDatasetReturn({ refetch: initialAdpRefetchMock }));

    const { rerender, result } = renderHook(
      (properties: { classId: string }) => useClassPageData(properties.classId),
      { initialProps: { classId: DEFAULT_CLASS_ID }, wrapper }
    );

    const firstRefetch = result.current.refetch;

    // Update mocks to simulate new query results for a different classId
    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', newClassId] });
    mockUseQuery.mockReturnValue(
      createMockClassQueryResult({ data: classFull, refetch: newQueryRefetchMock })
    );
    mockUsePageDataset.mockReturnValue(createPageDatasetReturn({ refetch: newAdpRefetchMock }));

    rerender({ classId: newClassId });

    // The callback reference must change when the underlying query refs change
    expect(result.current.refetch).not.toBe(firstRefetch);
  });
});

// ===========================================================================
// Blocking precedence test
// ===========================================================================

describe('blocking precedence', () => {
  it('returns blocking status when an error condition exists AND the query is still loading', () => {
    // This test verifies the blocking-precedence logic in isolation, using a
    // synthetic state that React Query would not produce at runtime (isPending
    // and isError are mutually exclusive in React Query v5).
    const queryError = new Error('Network error');

    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockUseQuery.mockReturnValue(
      createMockClassQueryResult({ isPending: true, isError: true, error: queryError })
    );
    mockUsePageDataset.mockReturnValue(
      createPageDatasetReturn(
        { isPending: true },
        { isDatasetReady: false, isDatasetTrustworthy: false, hasTrustworthyDataset: false }
      )
    );

    const { result } = renderHook(() => useClassPageData(DEFAULT_CLASS_ID), { wrapper });

    // Blocking takes precedence over loading
    expect(result.current.surfaceState.status).toBe('blocking');
    expect(result.current.surfaceState).toEqual({
      status: 'blocking',
      error: { type: 'classQueryError', cause: queryError },
    });
  });
});

// ===========================================================================
// Empty analyser response (C1 contract)
// ===========================================================================

describe('empty analyser response', () => {
  it('produces blocking state with analyserError when the analyser returns an empty array', () => {
    mockAnalyse.mockReturnValue([]);

    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockUseQuery.mockReturnValue(createMockClassQueryResult({ data: createClassFull() }));
    mockUsePageDataset.mockReturnValue(createPageDatasetReturn());

    const { result } = renderHook(() => useClassPageData(DEFAULT_CLASS_ID), { wrapper });

    expect(result.current.surfaceState).toEqual({
      status: 'blocking',
      error: { type: 'analyserError', cause: expect.any(Error) },
    });
    expect(result.current.error?.type).toBe('analyserError');
  });

  it('yields null adapterResult and null analyserResult when the analyser returns an empty array', () => {
    mockAnalyse.mockReturnValue([]);

    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockUseQuery.mockReturnValue(createMockClassQueryResult({ data: createClassFull() }));
    mockUsePageDataset.mockReturnValue(createPageDatasetReturn());

    const { result } = renderHook(() => useClassPageData(DEFAULT_CLASS_ID), { wrapper });

    expect(result.current.adapterResult).toBeNull();
    expect(result.current.analyserResult).toBeNull();
  });

  it('non-empty analyser response still works as expected (regression guard)', () => {
    const averagingResult = createAveragingResult();
    const adapterResult = createAdapterResult();

    mockAnalyse.mockReturnValue([averagingResult]);
    mockAdaptClassPageToViewModel.mockReturnValue(adapterResult);

    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockUseQuery.mockReturnValue(createMockClassQueryResult({ data: createClassFull() }));
    mockUsePageDataset.mockReturnValue(createPageDatasetReturn());

    const { result } = renderHook(() => useClassPageData(DEFAULT_CLASS_ID), { wrapper });

    expect(result.current.surfaceState).toEqual({ status: 'ready' });
    expect(result.current.error).toBeNull();
    expect(result.current.analyserResult).toEqual(averagingResult);
    expect(result.current.adapterResult).toEqual(adapterResult);
  });
});
