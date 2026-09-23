import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { vi } from 'vitest';
import type { ClassFull } from '../services/googleClassrooms/classDetail/classDetailService.zod';
import type { AveragingResult } from '../services/dataAnalysis/dataAnalysis.zod';
import type {
  AssignmentDefinitionPartialsResponse,
  AssignmentDefinitionPartial,
} from '../services/assignmentDefinition/assignmentDefinitionPartials.zod';
import type { ClassPartial } from '../services/googleClassrooms/classPartialsService';
import type { MergedHeatmapResult } from '../services/dataAnalysis/heatmapAdapter.merged';
import type { PageDatasetState } from '../hooks/usePageDataset';
import { createMetricResult } from './dataAnalysis/fixtures';

/** Default class ID used across Heatmaps page-data tests. */
export const DEFAULT_CLASS_ID = 'class-abc-123';

/**
 * Creates a fresh QueryClient suitable for hook tests (retries disabled).
 *
 * @returns {QueryClient} A test QueryClient.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

/**
 * Creates a React wrapper providing the given QueryClient.
 *
 * @param {QueryClient} queryClient QueryClient to provide.
 * @returns {Function} A wrapper component for renderHook.
 */
export function createTestWrapper(queryClient: QueryClient) {
  return function TestWrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

type QueryStatus = 'pending' | 'error' | 'success';

/**
 * Computes the React Query status from pending and error flags.
 *
 * @param {boolean} isPending Whether the query is pending.
 * @param {boolean} isError Whether the query is in error.
 * @returns {QueryStatus} The corresponding query status.
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
 * Builds a mock `UseQueryResult<T>` for a dataset or per-class query.
 *
 * @param {object} overrides Partial query result overrides.
 * @param {T} [overrides.data] Query data payload.
 * @param {boolean} [overrides.isPending] Whether the query is pending.
 * @param {boolean} [overrides.isError] Whether the query is in error.
 * @param {Error | null} [overrides.error] Query error object.
 * @param {ReturnType<typeof vi.fn>} [overrides.refetch] Refetch function mock.
 * @returns {UseQueryResult<T>} A mock query result.
 */
export function createMockQueryResult<T>(overrides: {
  data?: T;
  isPending?: boolean;
  isError?: boolean;
  error?: Error | null;
  refetch?: ReturnType<typeof vi.fn>;
}): UseQueryResult<T> {
  const isPending = overrides.isPending ?? false;
  const isError = overrides.isError ?? false;
  const status = computeStatus(isPending, isError);
  const data = overrides.data ?? null;
  const error = overrides.error ?? null;
  const refetch = overrides.refetch ?? vi.fn();
  const fetchStatus = isPending ? ('fetching' as const) : ('idle' as const);
  return {
    data: data as T,
    dataUpdatedAt: 0,
    error,
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    fetchStatus,
    isFetched: !isPending,
    isFetchedAfterMount: !isPending,
    isFetching: isPending,
    isInitialLoading: isPending,
    isLoading: isPending,
    isLoadingError: false,
    isPaused: false,
    isPending,
    isPlaceholderData: false,
    isRefetchError: false,
    isRefetching: false,
    isStale: false,
    isSuccess: status === 'success',
    refetch,
    promise: Promise.resolve(data as T),
    status,
  } as unknown as UseQueryResult<T>;
}

/**
 * Builds a PageDatasetState fixture, defaulting to a trustworthily-ready dataset.
 *
 * @param {Partial<PageDatasetState>} [overrides] Optional state overrides.
 * @returns {PageDatasetState} A dataset state.
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
 * Builds a class-partials fixture used for selector option readiness.
 *
 * @returns {ClassPartial[]} A single class-partial fixture array.
 */
export function createClassPartials(): ClassPartial[] {
  return [
    {
      classId: DEFAULT_CLASS_ID,
      className: 'Test Class 7A',
      cohortKey: null,
      courseLength: 1,
      yearGroupKey: 'yg-7',
      classOwner: null,
      teachers: [],
      active: true,
    } as unknown as ClassPartial,
  ];
}

/**
 * Builds a minimal assignment-definition partial fixture.
 *
 * @param {string} definitionKey Definition key to embed.
 * @returns {AssignmentDefinitionPartial} A definition-partial fixture.
 */
function createDefinitionPartial(definitionKey: string): AssignmentDefinitionPartial {
  return {
    definitionKey,
    primaryTitle: `Title ${definitionKey}`,
    primaryTopic: 'Topic A',
    primaryTopicKey: 't1',
    tasks: [{ taskId: 'tA', taskTitle: 'Task A' }],
  } as unknown as AssignmentDefinitionPartial;
}

/**
 * Builds the assignment-definition partials fixture (registry of two definitions).
 *
 * @returns {AssignmentDefinitionPartialsResponse} The partials registry fixture.
 */
export function createAssignmentDefinitionPartials(): AssignmentDefinitionPartialsResponse {
  return [
    createDefinitionPartial('def1'),
    createDefinitionPartial('def2'),
  ] as unknown as AssignmentDefinitionPartialsResponse;
}

/**
 * Builds a minimal `ClassFull` fixture with two assignments.
 *
 * @param {Partial<ClassFull>} [overrides] Optional class-field overrides.
 * @returns {ClassFull} A class-full fixture.
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
    students: [{ id: 's-1', name: 'Student One', email: 's1@test.com' }],
    assignments: [
      {
        assignmentId: 'a1',
        assignmentDefinitionKey: 'def1',
        updatedAt: '2025-01-01T00:00:00.000Z',
      } as unknown as ClassFull['assignments'][number],
      {
        assignmentId: 'a2',
        assignmentDefinitionKey: 'def2',
        updatedAt: '2025-02-01T00:00:00.000Z',
      } as unknown as ClassFull['assignments'][number],
    ],
    // The same fixture doubles as `AssignmentFull` for the per-assignment preview
    // query mock; `buildCellPreviewLookup` requires an embedded `assignmentDefinition`
    // (and `submissions`) so the loud fail-fast path in `useHeatmapsPageData` is not
    // tripped by the test data.
    assignmentDefinition: { definitionKey: 'def1' },
    submissions: [],
    active: true,
    ...overrides,
  } as unknown as ClassFull;
}

/**
 * Builds a minimal `AveragingResult` fixture for the default class.
 *
 * @returns {AveragingResult} An averaging-result fixture.
 */
export function createAveragingResult(): AveragingResult {
  return {
    classId: DEFAULT_CLASS_ID,
    className: 'Test Class 7A',
    perStudent: [],
    perStudentTaskMetrics: [
      {
        classId: DEFAULT_CLASS_ID,
        studentId: 's-1',
        taskKey: 'def1::tA',
        completeness: createMetricResult('computed', { value: 4 }),
        accuracy: createMetricResult('computed', { value: 3 }),
        spag: createMetricResult('notAttempted'),
      },
    ],
    perClass: {
      completeness: createMetricResult('computed', { value: 4 }),
      accuracy: createMetricResult('computed', { value: 3 }),
      spag: createMetricResult('notAttempted'),
      overall: createMetricResult('computed', { value: 3.5 }),
    },
    appliedCriterionWeightings: { completeness: 0.4, accuracy: 0.4, spag: 0.2 },
  } as unknown as AveragingResult;
}

/**
 * Builds a minimal `MergedHeatmapResult` fixture for the default class.
 *
 * @returns {MergedHeatmapResult} A merged-heatmap-result fixture.
 */
export function createMergedResult(): MergedHeatmapResult {
  return {
    classId: DEFAULT_CLASS_ID,
    className: 'Test Class 7A',
    sourceAssignments: [
      { assignmentId: 'a1', definitionKey: 'def1', assignmentName: 'Title def1' },
    ],
    taskColumns: [
      {
        taskKey: 'def1::tA',
        taskId: 'tA',
        taskTitle: 'Task A',
        averageContribution: { effectiveWeight: 1, includedInAverage: true },
        assignmentId: 'a1',
        definitionKey: 'def1',
        assignmentName: 'Title def1',
      },
    ],
    rows: [],
  };
}
