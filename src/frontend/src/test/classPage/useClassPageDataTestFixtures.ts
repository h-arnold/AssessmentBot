/** Shared pure fixture builders for useClassPageData test modules. */
import { vi } from 'vitest';
import { createMetricResult } from '../dataAnalysis/fixtures';
import {
  queryOptions,
  QueryClientProvider,
  type QueryClient,
  type QueryStatus,
  type UseQueryResult,
} from '@tanstack/react-query';
import type { ClassPageAdapterResult } from '../../features/classPage/classPageAdapter.zod';
import type { AveragingResult } from '../../services/dataAnalysis/dataAnalysis.zod';
import type {
  AssignmentPartial,
  ClassFull,
} from '../../services/googleClassrooms/classDetail/classDetailService.zod';
import type { PageDatasetState } from '../../hooks/usePageDataset';
import { createElement, type ReactNode } from 'react';
import { getABClass } from '../../services/googleClassrooms/classDetail/classDetailService';
import { queryKeys } from '../../query/queryKeys';

/** Default classId used across tests. */
export const DEFAULT_CLASS_ID = 'class-abc-123';

/**
 * Creates real, data-tagged query options for the mocked class query factory.
 * @param {string} classId - The class identifier.
 * @returns {ReturnType<typeof queryOptions>} Typed query options fixture.
 */
export function createABClassQueryOptionsFixture(classId: string) {
  return queryOptions({
    queryKey: queryKeys.abClass(classId),
    queryFn: () => getABClass({ classId }),
  });
}

/** Creates a query-provider wrapper scoped to a spec's query client.
 * @param {QueryClient} client - Spec-local query client.
 * @returns {Function} Query-provider wrapper.
 */
export function createClassPageDataWrapper(client: QueryClient) {
  return function ClassPageDataTestWrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  };
}

/**
 * Creates a minimal ClassFull fixture.
 *
 * @param {Partial<ClassFull>} [overrides] - Optional overrides.
 * @returns {ClassFull} A ClassFull fixture.
 */
export function createClassFull(overrides?: Partial<ClassFull>): ClassFull {
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
export function createAveragingResult(overrides?: Partial<AveragingResult>): AveragingResult {
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
 * @returns {ClassPageAdapterResult} A ClassPageAdapterResult fixture.
 */
export function createAdapterResult(): ClassPageAdapterResult {
  return {
    recentAssignments: [],
    studentAverages: [],
    classMetrics: {
      completeness: createMetricResult('computed', { value: 4 }),
      accuracy: createMetricResult('computed', { value: 3.5 }),
      spag: createMetricResult('notAttempted'),
      overall: createMetricResult('computed', { value: 3.8 }),
    },
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

/**
 * Build a shared base UseQueryResult mock with all non-override fields set.
 *
 * @param {ClassFull | null | undefined} queryData - The query data payload.
 * @param {Error | null} queryError - The query error object.
 * @param {boolean} isQueryPending - Whether the query is pending.
 * @param {QueryStatus} status - The query status.
 * @param {ReturnType<typeof vi.fn>} refetch - Refetch function mock.
 * @returns {Partial<UseQueryResult<ClassFull | null, Error>>} Partial query-result mock.
 */
function buildBaseQueryResult(
  queryData: ClassFull | null | undefined,
  queryError: Error | null,
  isQueryPending: boolean,
  status: QueryStatus,
  refetch: ReturnType<typeof vi.fn>
) {
  return {
    data: queryData ?? null,
    dataUpdatedAt: 0,
    error: queryError,
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    fetchStatus: isQueryPending ? ('fetching' as const) : ('idle' as const),
    isFetched: !isQueryPending,
    isFetchedAfterMount: !isQueryPending,
    isFetching: isQueryPending,
    isInitialLoading: isQueryPending,
    isLoading: isQueryPending,
    isLoadingError: false,
    isPaused: false,
    isPending: isQueryPending,
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
 * @param {ReturnType<typeof vi.fn>} [overrides.refetch] - Refetch function mock.
 * @returns {UseQueryResult<ClassFull | null, Error>} A mock query result.
 */
export function createMockClassQueryResult(overrides: {
  data?: ClassFull | null;
  isPending?: boolean;
  isError?: boolean;
  error?: Error | null;
  refetch?: ReturnType<typeof vi.fn>;
}): UseQueryResult<ClassFull | null, Error> {
  const isQueryPending = overrides.isPending ?? false;
  const isQueryError = overrides.isError ?? false;
  const queryError = overrides.error ?? null;
  const refetch = overrides.refetch ?? vi.fn();
  const queryData = overrides.data;
  const status = computeStatus(isQueryPending, isQueryError);

  return {
    ...buildBaseQueryResult(queryData, queryError, isQueryPending, status, refetch),
    isError: isQueryError,
    status,
  } as unknown as UseQueryResult<ClassFull | null, Error>;
}

/**
 * Creates a minimal AssignmentPartial fixture for prefetch effect tests.
 * Only assignmentId and updatedAt vary; all other fields use defaults.
 *
 * @param {string} assignmentId - The assignment identifier.
 * @param {string} updatedAt - The ISO timestamp string for sorting.
 * @returns {AssignmentPartial} A minimal assignment fixture.
 */
export function createAssignment(assignmentId: string, updatedAt: string): AssignmentPartial {
  return {
    assignmentId,
    updatedAt,
    createdAt: '2025-01-01T00:00:00.000Z',
    dueDate: null,
    documentType: null,
    submissions: [],
    assignmentDefinitionKey: 'def-key',
  } as unknown as AssignmentPartial;
}

/**
 * Build a PageDatasetState fixture with the given overrides.
 * Defaults to a trustworthily-ready dataset.
 *
 * @param {Partial<PageDatasetState>} [overrides] - Optional overrides for state fields.
 * @returns {PageDatasetState} A PageDatasetState fixture.
 */
export function createDatasetState(overrides?: Partial<PageDatasetState>): PageDatasetState {
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
 * @returns {{ query: UseQueryResult<ClassFull | null, Error>; datasetState: PageDatasetState }} A usePageDataset return value.
 */
export function createPageDatasetReturn(
  queryOverrides: Parameters<typeof createMockClassQueryResult>[0] = {},
  datasetOverrides?: Partial<PageDatasetState>
): { query: UseQueryResult<ClassFull | null, Error>; datasetState: PageDatasetState } {
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

/**
 * Build the minimal ready query result used by diagnostics coverage.
 * @param {ClassFull} classFull - The class payload returned by the query.
 * @returns {UseQueryResult<ClassFull | null, Error>} A ready query result.
 */
export function createReadyClassQueryResult(
  classFull: ClassFull
): UseQueryResult<ClassFull | null, Error> {
  return {
    data: classFull,
    isPending: false,
    isError: false,
    error: null,
    isSuccess: true,
    refetch: vi.fn(),
  } as unknown as UseQueryResult<ClassFull | null, Error>;
}
