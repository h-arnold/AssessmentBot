/**
 * Consumer integration: `useHeatmapsPageData` binds the shared post-analysis hook.
 *
 * @remarks
 * These specs prove only the feature binding, not the shared hook lifecycle.
 * The shared hook is spied (not the real owner) so the ordered runner, replay,
 * invalidation and feedback contracts remain owned by the existing
 * `hooks/usePostAnalysisTasks.*` suites. The assertions pin:
 *
 * - the hook receives the complete unsliced class even though the analyser is
 *   driven with the selected assignment slice, plus the live definition
 *   partials and the validated averaging result;
 * - failed/skipped/loading/adaptation-blocking surfaces pass `null` instead of
 *   a successful context;
 * - the shared production registry is passed with a stable identity and a
 *   metadata-only task list, so future independent tasks are not tied to
 *   feature-local eligibility.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, type RenderHookResult } from '@testing-library/react';
import type { QueryClient } from '@tanstack/react-query';
import type { StartupWarmupDatasetKey } from '@/query/sharedQueries';
import type { ClassFull } from '@/services/googleClassrooms/classDetail/classDetailService.zod';
import type { PostAnalysisContext } from '@/services/dataAnalysis/postAnalysis/postAnalysis.zod';
import type { PostAnalysisTaskDescriptor } from '@/services/dataAnalysis/postAnalysis/runPostAnalysisTasks';
import { usePostAnalysisTasks } from '@/hooks/usePostAnalysisTasks';
import { useHeatmapsPageData } from './useHeatmapsPageData';
import {
  DEFAULT_CLASS_ID,
  createAveragingResult,
  createClassFull,
  createMockQueryResult,
  createTestWrapper,
} from '@/test/heatmapsPageDataFixtures';
import {
  createHeatmapMergedResult as createMergedResult,
  createTestQueryClient,
} from '@/test/dataAnalysis/heatmapFixtures';
import { createReadyHeatmapsDatasetResult } from '@/test/taskHeatmap/hookMockFactories';

const mockUsePostAnalysisTasks = vi.mocked(usePostAnalysisTasks);
const readyDatasetResults = {
  classPartials: createReadyHeatmapsDatasetResult('classPartials'),
  assignmentDefinitionPartials: createReadyHeatmapsDatasetResult('assignmentDefinitionPartials'),
} satisfies Pick<
  Record<StartupWarmupDatasetKey, ReturnType<typeof createReadyHeatmapsDatasetResult>>,
  'classPartials' | 'assignmentDefinitionPartials'
>;

const {
  mockUseQuery,
  mockUseQueries,
  mockUsePageDataset,
  mockGetABClassQueryOptions,
  mockGetAssignmentQueryOptions,
  mockAnalyse,
  mockAdaptMergedHeatmap,
  mockAssembleMergedPreviewData,
} = vi.hoisted(() => {
  return {
    mockUseQuery: vi.fn(),
    mockUseQueries: vi.fn(),
    mockUsePageDataset: vi.fn(),
    mockGetABClassQueryOptions: vi.fn(),
    mockGetAssignmentQueryOptions: vi.fn(),
    mockAnalyse: vi.fn(),
    mockAdaptMergedHeatmap: vi.fn(),
    mockAssembleMergedPreviewData: vi.fn(),
  };
});

vi.mock('@/hooks/usePostAnalysisTasks', () => {
  return {
    usePostAnalysisTasks: vi.fn(() => ({ outcomes: [] })),
  };
});

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useQuery: mockUseQuery,
    useQueries: mockUseQueries,
  };
});

vi.mock('@/hooks/usePageDataset', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, usePageDataset: mockUsePageDataset };
});

vi.mock('@/query/sharedQueries', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getABClassQueryOptions: mockGetABClassQueryOptions,
    getAssignmentQueryOptions: mockGetAssignmentQueryOptions,
  };
});

vi.mock('@/services/dataAnalysis/dataAnalysisService', () => {
  return {
    DataAnalysisService: vi.fn().mockImplementation(function () {
      return { analyse: mockAnalyse };
    }),
  };
});

vi.mock('@/services/dataAnalysis/heatmapAdapter.merged', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, adaptMetricsToMergedHeatmap: mockAdaptMergedHeatmap };
});

vi.mock('@/features/taskHeatmap/assembleMergedPreviewData', () => {
  return {
    assembleMergedPreviewData: mockAssembleMergedPreviewData,
  };
});

/** Installs the per-test dynamic query mock, including React Query's combine callback. */
function installUseQueriesMock(): void {
  mockUseQueries.mockImplementation(
    (options: {
      queries: ReadonlyArray<unknown>;
      combine?: (results: ReadonlyArray<unknown>) => unknown;
    }) => {
      const results = options.queries.map((query) => mockUseQuery(query));
      return typeof options.combine === 'function' ? options.combine(results) : results;
    }
  );
}

let queryClient: QueryClient;
let wrapper: ReturnType<typeof createTestWrapper>;

beforeEach(() => {
  queryClient = createTestQueryClient();
  wrapper = createTestWrapper(queryClient);
  installUseQueriesMock();
});

afterEach(() => {
  vi.resetAllMocks();
});

/** Configures both selector datasets as trustworthily ready. */
function mockWarmupDatasetsReady(): void {
  mockUsePageDataset.mockImplementation(
    (datasetKey: StartupWarmupDatasetKey) =>
      readyDatasetResults[datasetKey as keyof typeof readyDatasetResults]
  );
}

/** Render view type for the Heatmaps hook integration specs. */
type HeatmapsView = RenderHookResult<ReturnType<typeof useHeatmapsPageData>, void>;

/** Typed view of one shared post-analysis hook invocation. */
type PostAnalysisCall = readonly [
  PostAnalysisContext | null,
  readonly PostAnalysisTaskDescriptor[],
];

/** Selects the default class and one assignment, leaving the surface ready.
 * @param {HeatmapsView} view - The rendered hook view to drive.
 * @returns {Promise<void>} Resolves after the selection commits.
 */
async function selectClassAndAssignment(view: HeatmapsView): Promise<void> {
  await act(async () => {
    view.result.current.selectClass(DEFAULT_CLASS_ID);
  });
  await act(async () => {
    view.result.current.changeAssignments(['a1']);
  });
}

/** Configures a ready class query with a stable null-data preview result.
 * @param {ClassFull} classFull - The complete unsliced class payload.
 * @returns {void} Nothing.
 */
function mockReadyClassWithPreview(classFull: ClassFull): void {
  mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
  mockGetAssignmentQueryOptions.mockReturnValue({ queryKey: ['assignment', 'a1'] });
  mockUseQuery.mockReturnValue(createMockQueryResult<ClassFull | null>({ data: classFull }));
  mockUseQueries.mockReturnValue({
    previewResults: [{ assignmentId: 'a1', isPending: false, isError: false, data: null }],
    rawResults: [],
  });
}

describe('useHeatmapsPageData shared post-analysis binding', () => {
  it('invokes the shared hook with the unsliced class, live definitions and validated result after averaging', async () => {
    const classFull = createClassFull();
    const averagingResult = createAveragingResult();
    mockWarmupDatasetsReady();
    mockReadyClassWithPreview(classFull);
    mockAnalyse.mockReturnValue([averagingResult]);
    mockAdaptMergedHeatmap.mockReturnValue(createMergedResult());

    const result = renderHook(() => useHeatmapsPageData(), { wrapper });
    await selectClassAndAssignment(result);

    expect(result.result.current.surfaceState).toEqual({ status: 'ready' });
    const [context, tasks] = mockUsePostAnalysisTasks.mock.lastCall as PostAnalysisCall;
    const source = context!;
    // The analyser ran on the selected slice; the post-task source must be the
    // complete unsliced class, never the narrowed selection.
    expect(source.classFull).toEqual(classFull);
    expect(source.classFull.assignments).toHaveLength(classFull.assignments.length);
    expect(source.classFull.assignments.map((assignment) => assignment.assignmentId)).toEqual([
      'a1',
      'a2',
    ]);
    expect(source.assignmentDefinitionPartials).not.toBeNull();
    expect(source.averagingResult).toEqual(averagingResult);
    expect(tasks.map((task) => task.id)).toEqual(['refreshABClassMetadata']);
  });

  it('reuses the successful post-analysis context when its inputs are unchanged', async function testContextIdentity() {
    mockWarmupDatasetsReady();
    mockReadyClassWithPreview(createClassFull());
    mockAnalyse.mockReturnValue([createAveragingResult()]);
    mockAdaptMergedHeatmap.mockReturnValue(createMergedResult());

    const result = renderHook(() => useHeatmapsPageData(), { wrapper });
    await selectClassAndAssignment(result);
    const [firstContext, firstTasks] = mockUsePostAnalysisTasks.mock.lastCall as PostAnalysisCall;
    expect(firstContext).not.toBeNull();

    await act(async () => {
      result.rerender();
    });

    const [lastContext, lastTasks] = mockUsePostAnalysisTasks.mock.lastCall as PostAnalysisCall;
    expect(lastContext).toBe(firstContext);
    expect(lastTasks).toBe(firstTasks);
  });

  it('passes null while the selected class query is still loading', async () => {
    mockWarmupDatasetsReady();
    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockUseQuery.mockReturnValue(createMockQueryResult<ClassFull | null>({ isPending: true }));

    const result = renderHook(() => useHeatmapsPageData(), { wrapper });
    await act(async () => {
      result.result.current.selectClass(DEFAULT_CLASS_ID);
    });

    expect(result.result.current.surfaceState).toEqual({ status: 'loading' });
    expect(mockUsePostAnalysisTasks.mock.lastCall?.[0]).toBeNull();
  });

  it('passes null when the averaging analysis fails', async () => {
    mockWarmupDatasetsReady();
    mockReadyClassWithPreview(createClassFull());
    mockAnalyse.mockImplementation(() => {
      throw new Error('analysis failed');
    });

    const result = renderHook(() => useHeatmapsPageData(), { wrapper });
    await selectClassAndAssignment(result);

    expect(result.result.current.surfaceState.status).toBe('blocking');
    expect(result.result.current.error?.type).toBe('analyserError');
    expect(mockUsePostAnalysisTasks.mock.lastCall?.[0]).toBeNull();
  });

  it('passes null when adaptation blocks the ready surface', async () => {
    mockWarmupDatasetsReady();
    mockReadyClassWithPreview(createClassFull());
    mockAnalyse.mockReturnValue([createAveragingResult()]);
    mockAdaptMergedHeatmap.mockImplementation(() => {
      throw new Error('adapter failed');
    });

    const result = renderHook(() => useHeatmapsPageData(), { wrapper });
    await selectClassAndAssignment(result);

    expect(result.result.current.surfaceState.status).toBe('blocking');
    expect(result.result.current.error?.type).toBe('adapterError');
    expect(mockUsePostAnalysisTasks.mock.lastCall?.[0]).toBeNull();
  });

  it('keeps descriptive summary analysis read-only by sourcing the task from the averaging result', async () => {
    const averagingResult = createAveragingResult();
    mockWarmupDatasetsReady();
    mockReadyClassWithPreview(createClassFull());
    mockAnalyse.mockReturnValue([averagingResult]);
    mockAdaptMergedHeatmap.mockReturnValue(createMergedResult());

    const result = renderHook(() => useHeatmapsPageData(), { wrapper });
    await selectClassAndAssignment(result);

    const context = (mockUsePostAnalysisTasks.mock.lastCall as PostAnalysisCall)[0];
    expect(context!.averagingResult).toEqual(averagingResult);
    expect(context!.averagingResult.perClass).toBeDefined();
  });

  it('passes a stable shared production registry across rerenders', async () => {
    mockWarmupDatasetsReady();
    mockReadyClassWithPreview(createClassFull());
    mockAnalyse.mockReturnValue([createAveragingResult()]);
    mockAdaptMergedHeatmap.mockReturnValue(createMergedResult());

    const result = renderHook(() => useHeatmapsPageData(), { wrapper });
    await selectClassAndAssignment(result);

    const firstTasks = (mockUsePostAnalysisTasks.mock.lastCall as PostAnalysisCall)[1];
    expect(firstTasks.map((task) => task.id)).toEqual(['refreshABClassMetadata']);
    expect(firstTasks[0].getAttemptKey).toBeTypeOf('function');

    await act(async () => {
      result.rerender();
    });

    const lastTasks = (mockUsePostAnalysisTasks.mock.lastCall as PostAnalysisCall)[1];
    expect(lastTasks).toBe(firstTasks);
  });
});
