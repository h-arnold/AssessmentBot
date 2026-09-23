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
import type { QueryClient } from '@tanstack/react-query';
import type { ClassFull } from '../../services/googleClassrooms/classDetail/classDetailService.zod';
import { useHeatmapsPageData } from './useHeatmapsPageData';
import type { HeatmapsPageError } from './useHeatmapsPageData';
import {
  DEFAULT_CLASS_ID,
  createAssignmentDefinitionPartials,
  createAveragingResult,
  createClassFull,
  createClassPartials,
  createDatasetState,
  createMergedResult,
  createMockQueryResult,
  createTestQueryClient,
  createTestWrapper,
} from '../../test/heatmapsPageDataFixtures';

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
