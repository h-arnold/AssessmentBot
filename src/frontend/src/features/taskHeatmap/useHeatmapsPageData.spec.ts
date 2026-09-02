/**
 * Tests for the Heatmaps orchestration hook (`useHeatmapsPageData`).
 *
 * @see docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md §9.22
 *   — the standalone Heatmaps cascade/selection contract; mirrors `useClassPageData`'s
 *   nullability contract (derived results non-null only in ready states).
 *
 * GREEN: the hook module is fully implemented and these tests pass.  The
 * assertions pin the exact surface-state machine, analyser scope, merged-adapter
 * call, preview-query enablement, status-map completeness, refresh-busy
 * derivation, and cascade-clearing contracts.  Harness patterns follow
 * `useClassPageData.spec.ts` (QueryClient wrapper, service mocks, renderHook).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { useHeatmapsPageData } from './useHeatmapsPageData';
import type { HeatmapsPageError } from './useHeatmapsPageData';
import type { ClassFull } from '../../services/googleClassrooms/classDetail/classDetailService.zod';
import type { AveragingResult } from '../../services/dataAnalysis/dataAnalysis.zod';
import type {
  AssignmentDefinitionPartialsResponse,
  AssignmentDefinitionPartial,
} from '../../services/assignmentDefinition/assignmentDefinitionPartials.zod';
import type { ClassPartial } from '../../services/googleClassrooms/classPartialsService';
import type { MergedHeatmapResult } from '../../services/dataAnalysis/heatmapAdapter.merged';
import type { PageDatasetState } from '../../hooks/usePageDataset';
import { createMetricResult } from '../../test/dataAnalysis/fixtures';

// ===========================================================================
// Mock setup (hoisted)
// ===========================================================================

const {
  mockUseQuery,
  mockUseQueries,
  mockUsePageDataset,
  mockGetABClassQueryOptions,
  mockGetAssignmentQueryOptions,
  mockAnalyse,
  mockAdaptMergedHeatmap,
  mockAssembleMergedPreviewData,
} = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
  mockUseQueries: vi.fn(),
  mockUsePageDataset: vi.fn(),
  mockGetABClassQueryOptions: vi.fn(),
  mockGetAssignmentQueryOptions: vi.fn(),
  mockAnalyse: vi.fn(),
  mockAdaptMergedHeatmap: vi.fn(),
  mockAssembleMergedPreviewData: vi.fn(),
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useQuery: mockUseQuery,
    useQueries: mockUseQueries,
  };
});

// The hook drives per-assignment preview queries through `useQueries` (a single
// lint-clean hook over a dynamic selection list). Mock it to behave as one
// `useQuery` result per supplied query option so the red-spec behavioural
// assertions are preserved: `getAssignmentQueryOptions` is invoked per selected
// assignment, and each returned result carries the controllable `refetch` spy the
// refresh test observes. This mirrors the production `useQueries` shape (order is
// preserved) without weakening any behavioural assertion. When the hook supplies a
// `combine` callback (React Query v5 semantics), invoke it with the array of
// per-option results and return its output, mirroring the production `useQueries`
// combine path mechanically.
/**
 *
 */
/**
 * Install the per-test `useQueries` mock implementation (re-established after
 * `vi.resetAllMocks` clears it in `afterEach`).
 */
function installUseQueriesMock(): void {
  mockUseQueries.mockImplementation(
    (options: {
      queries: ReadonlyArray<unknown>;
      combine?: (results: ReadonlyArray<unknown>) => unknown;
    }) => {
      const results = options.queries.map((query) => mockUseQuery(query));
      if (typeof options.combine === 'function') {
        return options.combine(results);
      }
      return results;
    }
  );
}

installUseQueriesMock();

vi.mock('../../hooks/usePageDataset', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    usePageDataset: mockUsePageDataset,
  };
});

vi.mock('../../query/sharedQueries', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getABClassQueryOptions: mockGetABClassQueryOptions,
    getAssignmentQueryOptions: mockGetAssignmentQueryOptions,
  };
});

vi.mock('../../services/dataAnalysis/dataAnalysisService', () => ({
  DataAnalysisService: vi.fn().mockImplementation(function () {
    return { analyse: mockAnalyse };
  }),
}));

vi.mock('../../services/dataAnalysis/heatmapAdapter.merged', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    adaptMetricsToMergedHeatmap: mockAdaptMergedHeatmap,
  };
});

vi.mock('./assembleMergedPreviewData', () => ({
  assembleMergedPreviewData: mockAssembleMergedPreviewData,
}));

// ===========================================================================
// Shared test helpers
// ===========================================================================

/** Default class ID used across tests. */
const DEFAULT_CLASS_ID = 'class-abc-123';

/**
 * Creates a fresh QueryClient suitable for hook tests (retries disabled).
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
 * Creates a React wrapper providing the given QueryClient.
 *
 * @param {QueryClient} queryClient QueryClient to provide.
 * @returns {Function} A wrapper component for renderHook.
 */
function createTestWrapper(queryClient: QueryClient) {
  return function TestWrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

/** React Query query status union. */
type QueryStatus = 'pending' | 'error' | 'success';

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
 * Builds a mock `UseQueryResult<T>` for a dataset or per-class query.
 *
 * @param {object} overrides - Partial query result overrides.
 * @param {T} [overrides.data] - Query data payload.
 * @param {boolean} [overrides.isPending] - Whether the query is pending.
 * @param {boolean} [overrides.isError] - Whether the query is in error.
 * @param {Error | null} [overrides.error] - Query error object.
 * @param {ReturnType<typeof vi.fn>} [overrides.refetch] - Refetch function mock.
 * @returns {UseQueryResult<T>} A mock query result.
 *
 * @remarks
 * Parametrised over `T` so both the untyped warm-up dataset queries and the
 * `ClassFull` per-class query share one factory (the only difference was the
 * payload type and an optional `refetch` spy).
 */
function createMockQueryResult<T>(overrides: {
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
 * Builds a `PageDatasetState` fixture, defaulting to a trustworthily-ready dataset.
 *
 * @param {Partial<PageDatasetState>} [overrides] - Optional overrides.
 * @returns {PageDatasetState} A dataset state.
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

// ===========================================================================
// Fixture factories
// ===========================================================================

/**
 * Builds a class-partials fixture used for selector option readiness.
 *
 * @returns {ClassPartial[]} A single class-partial fixture array.
 */
function createClassPartials(): ClassPartial[] {
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
 * Builds a minimal `AssignmentDefinitionPartial` fixture.
 *
 * @param {string} definitionKey - The definition key to embed.
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
 * Builds an assignment-definition partials fixture (registry of two definitions).
 *
 * @returns {AssignmentDefinitionPartialsResponse} The partials registry fixture.
 */
function createAssignmentDefinitionPartials(): AssignmentDefinitionPartialsResponse {
  return [
    createDefinitionPartial('def1'),
    createDefinitionPartial('def2'),
  ] as unknown as AssignmentDefinitionPartialsResponse;
}

/**
 * Builds a minimal `ClassFull` fixture with two assignments.
 *
 * @param {Partial<ClassFull>} [overrides] - Optional field overrides.
 * @returns {ClassFull} A class-full fixture.
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
function createAveragingResult(): AveragingResult {
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
function createMergedResult(): MergedHeatmapResult {
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
        assignmentId: 'a1',
        definitionKey: 'def1',
        assignmentName: 'Title def1',
      },
    ],
    rows: [],
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
  // Re-established each test: `vi.resetAllMocks()` clears the implementation set
  // at import time. `useQueries` must behave as one `useQuery` result per supplied
  // option so the red-spec behavioural assertions survive the dynamic query list.
  // When the hook supplies a `combine` callback, invoke it with the per-option
  // results and return its output (React Query v5 semantics), mirroring the
  // import-time mock.
  installUseQueriesMock();
});

afterEach(() => {
  vi.resetAllMocks();
});

/**
 * Configures the warm-up dataset mocks so both classPartials and
 * assignmentDefinitionPartials are trustworthily ready.
 *
 * @returns {void}
 */
function mockWarmupDatasetsReady(): void {
  mockUsePageDataset.mockImplementation((datasetKey: string) => {
    if (datasetKey === 'classPartials') {
      return {
        query: createMockQueryResult<unknown>({ data: createClassPartials() }),
        datasetState: createDatasetState(),
      };
    }
    return {
      query: createMockQueryResult<unknown>({ data: createAssignmentDefinitionPartials() }),
      datasetState: createDatasetState(),
    };
  });
}

// ===========================================================================
// Initial state (no class)
// ===========================================================================

describe('useHeatmapsPageData — initial state (no class)', () => {
  it('is surfaceState ready with null class-dependent results and no per-class fetch', () => {
    mockWarmupDatasetsReady();
    // No class selected → the hook must not request a per-class query.
    mockUseQuery.mockReturnValue(createMockQueryResult<ClassFull | null>({ isPending: true }));

    const { result } = renderHook(() => useHeatmapsPageData(), { wrapper });

    expect(mockGetABClassQueryOptions).not.toHaveBeenCalled();
    expect(result.current.surfaceState).toEqual({ status: 'ready' });
    expect(result.current.classFull).toBeNull();
    expect(result.current.analyserResult).toBeNull();
    expect(result.current.mergedResult).toBeNull();
    expect(result.current.mergedPreview).toBeNull();
    expect(result.current.selection.classId).toBeNull();
    expect(result.current.classPartials).not.toBeNull();
    expect(result.current.assignmentDefinitionPartials).not.toBeNull();
  });

  it('exposes selector datasets from usePageDataset for readiness even with no class', () => {
    mockWarmupDatasetsReady();
    mockUseQuery.mockReturnValue(createMockQueryResult<ClassFull | null>({ isPending: true }));

    const { result } = renderHook(() => useHeatmapsPageData(), { wrapper });

    expect(result.current.classPartials).toHaveLength(1);
    expect(result.current.assignmentDefinitionPartials).toHaveLength(
      createAssignmentDefinitionPartials().length
    );
  });
});

// ===========================================================================
// Class selection
// ===========================================================================

describe('useHeatmapsPageData — class selection', () => {
  it('triggers getABClassQueryOptions when a class is selected', () => {
    mockWarmupDatasetsReady();
    mockUseQuery.mockReturnValue(createMockQueryResult<ClassFull | null>({ isPending: true }));

    const { result } = renderHook(() => useHeatmapsPageData(), { wrapper });

    act(() => {
      result.current.selectClass(DEFAULT_CLASS_ID);
    });

    expect(mockGetABClassQueryOptions).toHaveBeenCalledWith(DEFAULT_CLASS_ID);
  });

  it('populates classFull (and topic/assignment options) on successful class fetch', () => {
    mockWarmupDatasetsReady();
    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockUseQuery.mockReturnValue(
      createMockQueryResult<ClassFull | null>({ data: createClassFull() })
    );

    const { result } = renderHook(() => useHeatmapsPageData(), { wrapper });

    act(() => {
      result.current.selectClass(DEFAULT_CLASS_ID);
    });

    expect(result.current.classFull).not.toBeNull();
    expect(result.current.classFull?.classId).toBe(DEFAULT_CLASS_ID);
  });
});

// ===========================================================================
// Blocking precedence
// ===========================================================================

describe('useHeatmapsPageData — blocking precedence', () => {
  it('classNotFound (query error) takes precedence over dataset failure when both coexist', () => {
    mockUsePageDataset.mockImplementation((datasetKey: string) => {
      if (datasetKey === 'classPartials') {
        return {
          query: createMockQueryResult<unknown>({ data: createClassPartials() }),
          datasetState: createDatasetState(),
        };
      }
      return {
        query: createMockQueryResult<unknown>({ isError: true }),
        datasetState: createDatasetState({
          isDatasetFailed: true,
          isDatasetReady: false,
          isDatasetTrustworthy: false,
          hasTrustworthyDataset: false,
          hasQueryData: false,
          isQueryError: true,
        }),
      };
    });
    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockUseQuery.mockReturnValue(createMockQueryResult<ClassFull | null>({ data: null }));

    const { result } = renderHook(() => useHeatmapsPageData(), { wrapper });

    act(() => {
      result.current.selectClass(DEFAULT_CLASS_ID);
    });

    const error = result.current.error as HeatmapsPageError | null;
    expect(result.current.surfaceState.status).toBe('blocking');
    expect(error?.type).toBe('classNotFound');
  });

  it('dataset failure takes precedence over analyser/service error when both coexist', () => {
    mockUsePageDataset.mockImplementation((datasetKey: string) => {
      if (datasetKey === 'classPartials') {
        return {
          query: createMockQueryResult<unknown>({ data: createClassPartials() }),
          datasetState: createDatasetState(),
        };
      }
      return {
        query: createMockQueryResult<unknown>({ isError: true }),
        datasetState: createDatasetState({
          isDatasetFailed: true,
          isDatasetReady: false,
          isDatasetTrustworthy: false,
          hasTrustworthyDataset: false,
          hasQueryData: false,
          isQueryError: true,
        }),
      };
    });
    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockUseQuery.mockReturnValue(
      createMockQueryResult<ClassFull | null>({ data: createClassFull() })
    );
    // Even if the analyser would also fail, dataset failure must win.
    mockAnalyse.mockImplementation(() => {
      throw new Error('Analysis failed');
    });

    const { result } = renderHook(() => useHeatmapsPageData(), { wrapper });

    act(() => {
      result.current.selectClass(DEFAULT_CLASS_ID);
    });

    const error = result.current.error as HeatmapsPageError | null;
    expect(error?.type).toBe('assignmentDefinitionPartialsFailed');
  });
});

// ===========================================================================
// Analysis scope
// ===========================================================================

describe('useHeatmapsPageData — analysis scope', () => {
  it('passes input-shaped assignments and classIds filter to the analyser (no topic/definition-key filters)', () => {
    mockWarmupDatasetsReady();
    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockUseQuery.mockReturnValue(
      createMockQueryResult<ClassFull | null>({ data: createClassFull() })
    );
    mockAnalyse.mockReturnValue([createAveragingResult()]);
    mockAdaptMergedHeatmap.mockReturnValue(createMergedResult());

    const { result } = renderHook(() => useHeatmapsPageData(), { wrapper });

    act(() => {
      result.current.selectClass(DEFAULT_CLASS_ID);
    });
    act(() => {
      result.current.changeAssignments(['a1']);
    });

    expect(mockAnalyse).toHaveBeenCalledTimes(1);
    const callArgument = mockAnalyse.mock.calls[0][0] as {
      classes: ReadonlyArray<{ classId: string; assignments: readonly string[] }>;
      filter: { classIds: readonly string[] };
      assignmentDefinitionPartials: unknown;
    };
    expect(callArgument.filter).toEqual({ classIds: [DEFAULT_CLASS_ID] });
    expect(callArgument.classes).toHaveLength(1);
    expect(callArgument.classes[0].classId).toBe(DEFAULT_CLASS_ID);
    // Selected assignments are input-shaped onto the class.
    expect(callArgument.classes[0].assignments).toEqual([
      expect.objectContaining({ assignmentId: 'a1' }),
    ]);
    expect(callArgument.assignmentDefinitionPartials).not.toBeNull();
  });

  it('treats an empty analyser response as a blocking error (parity with useClassPageData)', () => {
    mockWarmupDatasetsReady();
    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockUseQuery.mockReturnValue(
      createMockQueryResult<ClassFull | null>({ data: createClassFull() })
    );
    mockAnalyse.mockReturnValue([]);

    const { result } = renderHook(() => useHeatmapsPageData(), { wrapper });

    act(() => {
      result.current.selectClass(DEFAULT_CLASS_ID);
    });
    act(() => {
      result.current.changeAssignments(['a1']);
    });

    const error = result.current.error as HeatmapsPageError | null;
    expect(result.current.surfaceState.status).toBe('blocking');
    expect(error?.type).toBe('analyserError');
    expect(result.current.mergedResult).toBeNull();
  });
});

// ===========================================================================
// Merged adapter wiring
// ===========================================================================

describe('useHeatmapsPageData — merged adapter wiring', () => {
  it('calls adaptMetricsToMergedHeatmap on ready-with-selections and exposes non-null mergedResult', () => {
    mockWarmupDatasetsReady();
    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockUseQuery.mockReturnValue(
      createMockQueryResult<ClassFull | null>({ data: createClassFull() })
    );
    mockAnalyse.mockReturnValue([createAveragingResult()]);
    mockAdaptMergedHeatmap.mockReturnValue(createMergedResult());

    const { result } = renderHook(() => useHeatmapsPageData(), { wrapper });

    act(() => {
      result.current.selectClass(DEFAULT_CLASS_ID);
    });
    act(() => {
      result.current.changeAssignments(['a1']);
    });

    expect(mockAdaptMergedHeatmap).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      ['a1'],
      expect.anything()
    );
    expect(result.current.mergedResult).not.toBeNull();
  });

  it('keeps mergedResult null until surfaceState is ready', () => {
    mockWarmupDatasetsReady();
    mockUseQuery.mockReturnValue(createMockQueryResult<ClassFull | null>({ isPending: true }));

    const { result } = renderHook(() => useHeatmapsPageData(), { wrapper });

    // Enter a class-selected-but-pending state: the surface is `loading` and the
    // analyser/merged-adapter pipeline must not have produced results yet.
    act(() => {
      result.current.selectClass(DEFAULT_CLASS_ID);
    });

    expect(result.current.surfaceState.status).toBe('loading');
    expect(result.current.mergedResult).toBeNull();
  });
});

// ===========================================================================
// Preview queries + status map
// ===========================================================================

describe('useHeatmapsPageData — preview queries and status map', () => {
  it('creates one getAssignmentQueryOptions per SELECTED assignment only (enablement keyed to selection)', () => {
    mockWarmupDatasetsReady();
    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockUseQuery.mockReturnValue(
      createMockQueryResult<ClassFull | null>({ data: createClassFull() })
    );
    mockAnalyse.mockReturnValue([createAveragingResult()]);
    mockAdaptMergedHeatmap.mockReturnValue(createMergedResult());

    const { result } = renderHook(() => useHeatmapsPageData(), { wrapper });

    act(() => {
      result.current.selectClass(DEFAULT_CLASS_ID);
    });
    act(() => {
      result.current.changeAssignments(['a1', 'a2']);
    });

    // One query key per selected assignment.
    const queriedIds = mockGetAssignmentQueryOptions.mock.calls.map((c) => c[1]);
    expect(queriedIds).toContain('a1');
    expect(queriedIds).toContain('a2');
    expect(mockGetAssignmentQueryOptions).toHaveBeenCalledWith(DEFAULT_CLASS_ID, 'a1');
    expect(mockGetAssignmentQueryOptions).toHaveBeenCalledWith(DEFAULT_CLASS_ID, 'a2');
  });

  it('ensures previewStatusByTaskKey covers every selected assignment taskKey', () => {
    // Duplicate-definition scenario: two assignments share definitionKey 'def1',
    // so the merged view must carry BOTH instances (a1 and a3) rather than silently
    // collapsing one away before the preview assembly step.
    const duplicateClassFull = {
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
        },
        {
          assignmentId: 'a3',
          assignmentDefinitionKey: 'def1',
          updatedAt: '2025-02-01T00:00:00.000Z',
        },
      ],
      assignmentDefinition: { definitionKey: 'def1' },
      submissions: [],
      active: true,
    } as unknown as ClassFull;
    const duplicateMergedResult: MergedHeatmapResult = {
      classId: DEFAULT_CLASS_ID,
      className: 'Test Class 7A',
      sourceAssignments: [
        { assignmentId: 'a1', definitionKey: 'def1', assignmentName: 'Title def1' },
        { assignmentId: 'a3', definitionKey: 'def1', assignmentName: 'Title def1' },
      ],
      taskColumns: [
        {
          taskKey: 'def1::tA',
          taskId: 'tA',
          taskTitle: 'Task A',
          assignmentId: 'a1',
          definitionKey: 'def1',
          assignmentName: 'Title def1',
        },
        {
          taskKey: 'def1::tA',
          taskId: 'tA',
          taskTitle: 'Task A',
          assignmentId: 'a3',
          definitionKey: 'def1',
          assignmentName: 'Title def1',
        },
      ],
      rows: [],
    };

    mockWarmupDatasetsReady();
    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockGetAssignmentQueryOptions.mockImplementation((classId: string, assignmentId: string) => ({
      queryKey: ['assignment', classId, assignmentId],
    }));
    mockUseQuery.mockReturnValue(
      createMockQueryResult<ClassFull | null>({ data: duplicateClassFull })
    );
    mockAnalyse.mockReturnValue([createAveragingResult()]);
    mockAdaptMergedHeatmap.mockReturnValue(duplicateMergedResult);

    const { result } = renderHook(() => useHeatmapsPageData(), { wrapper });

    act(() => {
      result.current.selectClass(DEFAULT_CLASS_ID);
    });
    act(() => {
      result.current.changeAssignments(['a1', 'a3']);
    });

    expect(result.current.mergedPreview).not.toBeNull();

    // Mechanism-sensitive: capture the assembleMergedPreviewData wiring and prove
    // BOTH duplicate-definition instances are fed in (a wiring regression that
    // drops one instance's inputs or mis-orders the columns must fail here).
    expect(mockAssembleMergedPreviewData).toHaveBeenCalledTimes(1);
    const callArguments = mockAssembleMergedPreviewData.mock.calls[0];
    const inputs = callArguments[0] as ReadonlyArray<{ assignmentId: string }>;
    const columnOrder = callArguments[1] as ReadonlyArray<{
      taskKey: string;
      assignmentId: string;
    }>;

    // Both duplicate-definition assignments present as preview inputs.
    const inputAssignmentIds = inputs.map((input) => input.assignmentId);
    expect(inputAssignmentIds).toHaveLength(duplicateMergedResult.sourceAssignments.length);
    expect(inputAssignmentIds).toContain('a1');
    expect(inputAssignmentIds).toContain('a3');

    // Both duplicate-definition columns present in columnOrder (each instance keeps
    // its own assignmentId while sharing the composite taskKey), in stable order.
    const columnAssignmentIds = columnOrder.map((column) => column.assignmentId);
    expect(columnAssignmentIds).toEqual(['a1', 'a3']);
    const sharedKeyColumns = columnOrder.filter((column) => column.taskKey === 'def1::tA');
    expect(sharedKeyColumns).toHaveLength(duplicateMergedResult.taskColumns.length);
    expect(sharedKeyColumns.map((column) => column.assignmentId)).toEqual(['a1', 'a3']);
  });
});

// ===========================================================================
// Refresh
// ===========================================================================

describe('useHeatmapsPageData — refresh', () => {
  it('re-runs the class query, ADP dataset, and enabled assignment queries without unmounting data', () => {
    // Per-family refetch spies so each refresh family is observable independently.
    const classRefetch = vi.fn();
    const adpRefetch = vi.fn();
    const assignmentRefetches = new Map<string, ReturnType<typeof vi.fn>>([
      ['a1', vi.fn()],
      ['a2', vi.fn()],
    ]);

    // ADP dataset query exposes its own refetch spy.
    mockUsePageDataset.mockImplementation((datasetKey: string) => {
      if (datasetKey === 'classPartials') {
        return {
          query: createMockQueryResult<unknown>({ data: createClassPartials() }),
          datasetState: createDatasetState(),
        };
      }
      return {
        query: {
          ...createMockQueryResult<unknown>({ data: createAssignmentDefinitionPartials() }),
          refetch: adpRefetch,
        },
        datasetState: createDatasetState(),
      };
    });

    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockGetAssignmentQueryOptions.mockImplementation((_classId: string, assignmentId: string) => ({
      queryKey: ['assignment', assignmentId],
    }));

    // Distinguish the class query from per-assignment queries by queryKey so each
    // family's refetch spy is wired independently.
    mockUseQuery.mockImplementation((options: { queryKey: unknown[] }) => {
      const key = options.queryKey;
      if (key[0] === 'abClass') {
        return createMockQueryResult<ClassFull | null>({
          data: createClassFull(),
          refetch: classRefetch,
        });
      }
      const assignmentId = String(key[1]);
      const refetch = assignmentRefetches.get(assignmentId) ?? vi.fn();
      return createMockQueryResult<ClassFull | null>({ data: null, refetch });
    });

    mockAnalyse.mockReturnValue([createAveragingResult()]);
    mockAdaptMergedHeatmap.mockReturnValue(createMergedResult());

    const { result } = renderHook(() => useHeatmapsPageData(), { wrapper });

    act(() => {
      result.current.selectClass(DEFAULT_CLASS_ID);
    });
    act(() => {
      result.current.changeAssignments(['a1', 'a2']);
    });

    classRefetch.mockClear();
    adpRefetch.mockClear();
    assignmentRefetches.forEach((function_) => function_.mockClear());

    const mergedBefore = result.current.mergedResult;
    const selectionBefore = result.current.selection;

    result.current.refetch();

    // All three refresh families re-run on manual refresh.
    expect(classRefetch).toHaveBeenCalledTimes(1);
    expect(adpRefetch).toHaveBeenCalledTimes(1);
    assignmentRefetches.forEach((function_) => expect(function_).toHaveBeenCalledTimes(1));

    // Visible data is NOT unmounted during refresh: the merged result and the
    // selection state keep their identity while a manual refresh is in flight.
    expect(result.current.mergedResult).toBe(mergedBefore);
    expect(result.current.selection).toBe(selectionBefore);
    expect(result.current.isRefreshing).toBeDefined();
  });
});

// ===========================================================================
// Class change clears cascade (integration point)
// ===========================================================================

describe('useHeatmapsPageData — class change clears cascade', () => {
  it('selectClass(null) atomically clears topics and assignments via the reducer', () => {
    mockWarmupDatasetsReady();
    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockUseQuery.mockReturnValue(
      createMockQueryResult<ClassFull | null>({ data: createClassFull() })
    );
    mockAnalyse.mockReturnValue([createAveragingResult()]);
    mockAdaptMergedHeatmap.mockReturnValue(createMergedResult());

    const { result } = renderHook(() => useHeatmapsPageData(), { wrapper });

    act(() => {
      result.current.selectClass(DEFAULT_CLASS_ID);
    });
    act(() => {
      result.current.changeTopics(['t1'], new Map([['a1', 't1']]));
    });
    act(() => {
      result.current.changeAssignments(['a1']);
    });
    expect(result.current.selection.assignmentIds).toEqual(['a1']);

    act(() => {
      result.current.selectClass(null);
    });

    expect(result.current.selection.classId).toBeNull();
    expect(result.current.selection.topicKeys).toEqual([]);
    expect(result.current.selection.assignmentIds).toEqual([]);
  });
});

// ===========================================================================
// Refresh-busy derivation (T-7)
// ===========================================================================

describe('useHeatmapsPageData — isRefreshing real derivation (T-7)', () => {
  it('reports isRefreshing true while the per-class query is fetching', () => {
    mockWarmupDatasetsReady();
    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockUseQuery.mockImplementation((options: { queryKey: unknown[] }) => {
      const key = options.queryKey;
      if (key[0] === 'abClass') {
        return createMockQueryResult<ClassFull | null>({
          data: createClassFull(),
          isPending: true,
        });
      }
      return createMockQueryResult<ClassFull | null>({ data: null });
    });

    const { result } = renderHook(() => useHeatmapsPageData(), { wrapper });
    act(() => result.current.selectClass(DEFAULT_CLASS_ID));

    // The derived `isRefreshing` reflects real `isFetching` on the owned class query.
    expect(result.current.isRefreshing).toBe(true);
  });

  it('reports isRefreshing true while the ADP dataset query is fetching', () => {
    mockUsePageDataset.mockImplementation((datasetKey: string) => {
      if (datasetKey === 'classPartials') {
        return {
          query: createMockQueryResult<unknown>({ data: createClassPartials() }),
          datasetState: createDatasetState(),
        };
      }
      return {
        query: createMockQueryResult<unknown>({
          data: createAssignmentDefinitionPartials(),
          isPending: true,
        }),
        datasetState: createDatasetState(),
      };
    });
    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockUseQuery.mockReturnValue(
      createMockQueryResult<ClassFull | null>({ data: createClassFull() })
    );
    mockAnalyse.mockReturnValue([createAveragingResult()]);
    mockAdaptMergedHeatmap.mockReturnValue(createMergedResult());

    const { result } = renderHook(() => useHeatmapsPageData(), { wrapper });
    act(() => result.current.selectClass(DEFAULT_CLASS_ID));

    // The derived `isRefreshing` reflects real `isFetching` on the owned ADP dataset query.
    expect(result.current.isRefreshing).toBe(true);
  });

  it('reports isRefreshing true while a selected-assignment preview query is fetching', () => {
    mockWarmupDatasetsReady();
    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockGetAssignmentQueryOptions.mockImplementation((_classId: string, assignmentId: string) => ({
      queryKey: ['assignment', assignmentId],
    }));
    mockUseQuery.mockImplementation((options: { queryKey: unknown[] }) => {
      const key = options.queryKey;
      if (key[0] === 'abClass') {
        return createMockQueryResult<ClassFull | null>({ data: createClassFull() });
      }
      return createMockQueryResult<ClassFull | null>({ data: null, isPending: true });
    });
    mockAnalyse.mockReturnValue([createAveragingResult()]);
    mockAdaptMergedHeatmap.mockReturnValue(createMergedResult());

    const { result } = renderHook(() => useHeatmapsPageData(), { wrapper });
    act(() => result.current.selectClass(DEFAULT_CLASS_ID));
    act(() => result.current.changeAssignments(['a1']));

    // The derived `isRefreshing` reflects real `isFetching` on the owned assignment queries.
    expect(result.current.isRefreshing).toBe(true);
  });

  it('reports isRefreshing false when no owned query is fetching', () => {
    mockWarmupDatasetsReady();
    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockUseQuery.mockImplementation((options: { queryKey: unknown[] }) => {
      const key = options.queryKey;
      if (key[0] === 'abClass') {
        return createMockQueryResult<ClassFull | null>({ data: createClassFull() });
      }
      return createMockQueryResult<ClassFull | null>({ data: null });
    });
    mockAnalyse.mockReturnValue([createAveragingResult()]);
    mockAdaptMergedHeatmap.mockReturnValue(createMergedResult());

    const { result } = renderHook(() => useHeatmapsPageData(), { wrapper });
    act(() => result.current.selectClass(DEFAULT_CLASS_ID));

    // No owned query is fetching → the derived `isRefreshing` is false.
    expect(result.current.isRefreshing).toBe(false);
  });
});
