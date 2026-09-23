/** Tests preview-query assembly, refresh, and cascade behaviour of the Heatmaps hook. */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { QueryClient } from '@tanstack/react-query';
import type { ClassFull } from '../../services/googleClassrooms/classDetail/classDetailService.zod';
import { useHeatmapsPageData } from './useHeatmapsPageData';
import type { MergedHeatmapResult } from '../../services/dataAnalysis/heatmapAdapter.merged';
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
  return { ...actual, useQuery: mockUseQuery, useQueries: mockUseQueries };
});

vi.mock('../../hooks/usePageDataset', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, usePageDataset: mockUsePageDataset };
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
  return { ...actual, adaptMetricsToMergedHeatmap: mockAdaptMergedHeatmap };
});

vi.mock('./assembleMergedPreviewData', () => ({
  assembleMergedPreviewData: mockAssembleMergedPreviewData,
}));

/** Installs the dynamic query mock, including React Query's combine callback. */
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
  mockUsePageDataset.mockImplementation((datasetKey: string) => ({
    query: createMockQueryResult<unknown>({
      data:
        datasetKey === 'classPartials'
          ? createClassPartials()
          : createAssignmentDefinitionPartials(),
    }),
    datasetState: createDatasetState(),
  }));
}

describe('useHeatmapsPageData — preview queries and status map', () => {
  it('creates one assignment query per selected assignment only', () => {
    mockWarmupDatasetsReady();
    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockUseQuery.mockReturnValue(
      createMockQueryResult<ClassFull | null>({ data: createClassFull() })
    );
    mockAnalyse.mockReturnValue([createAveragingResult()]);
    mockAdaptMergedHeatmap.mockReturnValue(createMergedResult());
    const { result } = renderHook(() => useHeatmapsPageData(), { wrapper });
    act(() => result.current.selectClass(DEFAULT_CLASS_ID));
    act(() => result.current.changeAssignments(['a1', 'a2']));
    const queriedIds = mockGetAssignmentQueryOptions.mock.calls.map((call) => call[1]);
    expect(queriedIds).toContain('a1');
    expect(queriedIds).toContain('a2');
    expect(mockGetAssignmentQueryOptions).toHaveBeenCalledWith(DEFAULT_CLASS_ID, 'a1');
    expect(mockGetAssignmentQueryOptions).toHaveBeenCalledWith(DEFAULT_CLASS_ID, 'a2');
  });

  it('assembles status entries for every selected duplicate-definition task instance', () => {
    const duplicateClassFull = createClassFull({
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
      ] as unknown as ClassFull['assignments'],
    });
    const duplicateMergedResult: MergedHeatmapResult = {
      classId: DEFAULT_CLASS_ID,
      className: 'Test Class 7A',
      sourceAssignments: [
        { assignmentId: 'a1', definitionKey: 'def1', assignmentName: 'Title def1' },
        { assignmentId: 'a3', definitionKey: 'def1', assignmentName: 'Title def1' },
      ],
      taskColumns: ['a1', 'a3'].map((assignmentId) => ({
        taskKey: 'def1::tA',
        taskId: 'tA',
        taskTitle: 'Task A',
        averageContribution: { effectiveWeight: 1, includedInAverage: true },
        assignmentId,
        definitionKey: 'def1',
        assignmentName: 'Title def1',
      })),
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
    act(() => result.current.selectClass(DEFAULT_CLASS_ID));
    act(() => result.current.changeAssignments(['a1', 'a3']));
    expect(result.current.mergedPreview).not.toBeNull();
    expect(mockAssembleMergedPreviewData).toHaveBeenCalledTimes(1);
    const [inputs, columnOrder] = mockAssembleMergedPreviewData.mock.calls[0] as [
      ReadonlyArray<{ assignmentId: string }>,
      ReadonlyArray<{ taskKey: string; assignmentId: string }>,
    ];
    expect(inputs.map((input) => input.assignmentId)).toEqual(['a1', 'a3']);
    expect(columnOrder.map((column) => column.assignmentId)).toEqual(['a1', 'a3']);
    expect(columnOrder.filter((column) => column.taskKey === 'def1::tA')).toHaveLength(
      duplicateMergedResult.taskColumns.length
    );
  });
});

describe('useHeatmapsPageData — refresh', () => {
  it('refetches class, dataset, and selected assignment queries without unmounting data', () => {
    const classRefetch = vi.fn();
    const adpRefetch = vi.fn();
    const assignmentRefetches = new Map([
      ['a1', vi.fn()],
      ['a2', vi.fn()],
    ]);
    mockUsePageDataset.mockImplementation((datasetKey: string) => ({
      query: {
        ...createMockQueryResult<unknown>({
          data:
            datasetKey === 'classPartials'
              ? createClassPartials()
              : createAssignmentDefinitionPartials(),
        }),
        ...(datasetKey === 'classPartials' ? {} : { refetch: adpRefetch }),
      },
      datasetState: createDatasetState(),
    }));
    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockGetAssignmentQueryOptions.mockImplementation((_classId: string, assignmentId: string) => ({
      queryKey: ['assignment', assignmentId],
    }));
    mockUseQuery.mockImplementation((options: { queryKey: unknown[] }) => {
      if (options.queryKey[0] === 'abClass') {
        return createMockQueryResult<ClassFull | null>({
          data: createClassFull(),
          refetch: classRefetch,
        });
      }
      const refetch = assignmentRefetches.get(String(options.queryKey[1])) ?? vi.fn();
      return createMockQueryResult<ClassFull | null>({ data: null, refetch });
    });
    mockAnalyse.mockReturnValue([createAveragingResult()]);
    mockAdaptMergedHeatmap.mockReturnValue(createMergedResult());
    const { result } = renderHook(() => useHeatmapsPageData(), { wrapper });
    act(() => result.current.selectClass(DEFAULT_CLASS_ID));
    act(() => result.current.changeAssignments(['a1', 'a2']));
    classRefetch.mockClear();
    adpRefetch.mockClear();
    assignmentRefetches.forEach((refetch) => refetch.mockClear());
    const mergedBefore = result.current.mergedResult;
    const selectionBefore = result.current.selection;
    act(() => result.current.refetch());
    expect(classRefetch).toHaveBeenCalledTimes(1);
    expect(adpRefetch).toHaveBeenCalledTimes(1);
    assignmentRefetches.forEach((refetch) => expect(refetch).toHaveBeenCalledTimes(1));
    expect(result.current.mergedResult).toBe(mergedBefore);
    expect(result.current.selection).toBe(selectionBefore);
    expect(result.current.isRefreshing).toBeDefined();
  });
});

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
    act(() => result.current.selectClass(DEFAULT_CLASS_ID));
    act(() => result.current.changeTopics(['t1'], new Map([['a1', 't1']])));
    act(() => result.current.changeAssignments(['a1']));
    expect(result.current.selection.assignmentIds).toEqual(['a1']);
    act(() => result.current.selectClass(null));
    expect(result.current.selection.classId).toBeNull();
    expect(result.current.selection.topicKeys).toEqual([]);
    expect(result.current.selection.assignmentIds).toEqual([]);
  });
});

describe('useHeatmapsPageData — isRefreshing real derivation', () => {
  it('reports refreshing while class query is fetching', () => {
    mockWarmupDatasetsReady();
    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockUseQuery.mockImplementation((options: { queryKey: unknown[] }) =>
      options.queryKey[0] === 'abClass'
        ? createMockQueryResult<ClassFull | null>({ data: createClassFull(), isPending: true })
        : createMockQueryResult<ClassFull | null>({ data: null })
    );
    const { result } = renderHook(() => useHeatmapsPageData(), { wrapper });
    act(() => result.current.selectClass(DEFAULT_CLASS_ID));
    expect(result.current.isRefreshing).toBe(true);
  });

  it('reports refreshing while ADP dataset query is fetching', () => {
    mockUsePageDataset.mockImplementation((datasetKey: string) => ({
      query: createMockQueryResult<unknown>({
        data:
          datasetKey === 'classPartials'
            ? createClassPartials()
            : createAssignmentDefinitionPartials(),
        isPending: datasetKey !== 'classPartials',
      }),
      datasetState: createDatasetState(),
    }));
    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockUseQuery.mockReturnValue(
      createMockQueryResult<ClassFull | null>({ data: createClassFull() })
    );
    mockAnalyse.mockReturnValue([createAveragingResult()]);
    mockAdaptMergedHeatmap.mockReturnValue(createMergedResult());
    const { result } = renderHook(() => useHeatmapsPageData(), { wrapper });
    act(() => result.current.selectClass(DEFAULT_CLASS_ID));
    expect(result.current.isRefreshing).toBe(true);
  });

  it('reports refreshing while a selected-assignment preview query is fetching', () => {
    mockWarmupDatasetsReady();
    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockGetAssignmentQueryOptions.mockImplementation((_classId: string, assignmentId: string) => ({
      queryKey: ['assignment', assignmentId],
    }));
    mockUseQuery.mockImplementation((options: { queryKey: unknown[] }) =>
      options.queryKey[0] === 'abClass'
        ? createMockQueryResult<ClassFull | null>({ data: createClassFull() })
        : createMockQueryResult<ClassFull | null>({ data: null, isPending: true })
    );
    mockAnalyse.mockReturnValue([createAveragingResult()]);
    mockAdaptMergedHeatmap.mockReturnValue(createMergedResult());
    const { result } = renderHook(() => useHeatmapsPageData(), { wrapper });
    act(() => result.current.selectClass(DEFAULT_CLASS_ID));
    act(() => result.current.changeAssignments(['a1']));
    expect(result.current.isRefreshing).toBe(true);
  });

  it('reports not refreshing when no owned query is fetching', () => {
    mockWarmupDatasetsReady();
    mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
    mockUseQuery.mockImplementation((options: { queryKey: unknown[] }) =>
      options.queryKey[0] === 'abClass'
        ? createMockQueryResult<ClassFull | null>({ data: createClassFull() })
        : createMockQueryResult<ClassFull | null>({ data: null })
    );
    mockAnalyse.mockReturnValue([createAveragingResult()]);
    mockAdaptMergedHeatmap.mockReturnValue(createMergedResult());
    const { result } = renderHook(() => useHeatmapsPageData(), { wrapper });
    act(() => result.current.selectClass(DEFAULT_CLASS_ID));
    expect(result.current.isRefreshing).toBe(false);
  });
});
