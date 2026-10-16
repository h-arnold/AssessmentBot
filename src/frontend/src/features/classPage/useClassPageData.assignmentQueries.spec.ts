/** Tests for the Class page data orchestrator hook (`useClassPageData`). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import type { ClassFull } from '@/services/googleClassrooms/classDetail/classDetailService.zod';
import '@/test/classPage/useClassPageData.mockSetup';
import { useClassPageData } from './useClassPageData';
import {
  DEFAULT_CLASS_ID,
  createClassPageDataWrapper,
  createABClassQueryOptionsFixture,
  createAdapterResult,
  createAssignment,
  createAveragingResult,
  createClassFull,
  createMockClassQueryResult,
  createPageDatasetReturn,
} from '@/test/classPage/useClassPageDataTestFixtures';
import { useQuery } from '@tanstack/react-query';
import { usePageDataset } from '@/hooks/usePageDataset';
import { getABClassQueryOptions } from '@/query/sharedQueries';
import { DataAnalysisService } from '@/services/dataAnalysis/dataAnalysisService';
import { adaptClassPageToViewModel } from './classPageAdapter';

const mockUseQuery = vi.mocked(useQuery);
const mockUsePageDataset = vi.mocked(usePageDataset);
const mockGetABClassQueryOptions = vi.mocked(getABClassQueryOptions);
const mockAnalyse = vi.mocked(
  DataAnalysisService as unknown as { analyse: typeof DataAnalysisService.prototype.analyse }
).analyse;
const mockAdaptClassPageToViewModel = vi.mocked(adaptClassPageToViewModel);
let queryClient: QueryClient;
let wrapper: ReturnType<typeof createClassPageDataWrapper>;
let querySpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  wrapper = createClassPageDataWrapper(queryClient);
  querySpy = vi.spyOn(queryClient, 'query').mockImplementation(() => Promise.resolve(null));
});
afterEach(() => {
  vi.resetAllMocks();
});

// Assignment query effect behaviour.
const EXPECTED_PREFETCH_COUNT_TOP_3 = 3;
const EXPECTED_PREFETCH_COUNT_SINGLE = 1;
const THIRD_CALL_INDEX = 2;

describe('assignment query effect', () => {
  it.each([
    {
      name: 'calls query for the 3 most recently updated assignments when surfaceState becomes ready',
      assignments: [
        createAssignment('oldest', '2025-01-01T00:00:00.000Z'),
        createAssignment('middle-2', '2025-02-01T00:00:00.000Z'),
        createAssignment('middle-1', '2025-03-01T00:00:00.000Z'),
        createAssignment('newest', '2025-04-01T00:00:00.000Z'),
      ],
      // Top 3 by updatedAt desc: newest, middle-1, middle-2.  oldest is excluded.
      expectedIds: ['newest', 'middle-1', 'middle-2'],
    },
    {
      name: 'uses assignmentId ascending as tie-break when two assignments share the same updatedAt',
      assignments: [
        createAssignment('b-assign', '2025-04-01T00:00:00.000Z'),
        createAssignment('a-assign', '2025-04-01T00:00:00.000Z'),
        createAssignment('c-assign', '2025-03-01T00:00:00.000Z'),
        createAssignment('d-assign', '2025-02-01T00:00:00.000Z'),
      ],
      // Sorted: a-assign, b-assign (tie on updatedAt, a.id < b.id), c-assign, d-assign
      // Top 3: a-assign, b-assign, c-assign
      expectedIds: ['a-assign', 'b-assign', 'c-assign'],
    },
  ])('$name', ({ assignments, expectedIds }) => {
    const averagingResult = createAveragingResult();
    const adapterResult = createAdapterResult();

    mockAnalyse.mockReturnValue([averagingResult]);
    mockAdaptClassPageToViewModel.mockReturnValue(adapterResult);
    mockGetABClassQueryOptions.mockReturnValue(createABClassQueryOptionsFixture(DEFAULT_CLASS_ID));
    mockUseQuery.mockReturnValue(
      createMockClassQueryResult({ data: createClassFull({ assignments }) })
    );
    mockUsePageDataset.mockReturnValue(createPageDatasetReturn());

    renderHook(() => useClassPageData(DEFAULT_CLASS_ID), { wrapper });

    expect(querySpy.mock.calls).toHaveLength(EXPECTED_PREFETCH_COUNT_TOP_3);
    expect(querySpy.mock.calls[0][0]).toMatchObject(
      expect.objectContaining({ queryKey: ['assignment', DEFAULT_CLASS_ID, expectedIds[0]] })
    );
    expect(querySpy.mock.calls[1][0]).toMatchObject(
      expect.objectContaining({ queryKey: ['assignment', DEFAULT_CLASS_ID, expectedIds[1]] })
    );
    expect(querySpy.mock.calls[THIRD_CALL_INDEX][0]).toMatchObject(
      expect.objectContaining({ queryKey: ['assignment', DEFAULT_CLASS_ID, expectedIds[2]] })
    );
  });

  it('calls query once when classFull has only 1 assignment', () => {
    const assignments = [createAssignment('only-assign', '2025-04-01T00:00:00.000Z')];
    const averagingResult = createAveragingResult();
    const adapterResult = createAdapterResult();

    mockAnalyse.mockReturnValue([averagingResult]);
    mockAdaptClassPageToViewModel.mockReturnValue(adapterResult);
    mockGetABClassQueryOptions.mockReturnValue(createABClassQueryOptionsFixture(DEFAULT_CLASS_ID));
    mockUseQuery.mockReturnValue(
      createMockClassQueryResult({ data: createClassFull({ assignments }) })
    );
    mockUsePageDataset.mockReturnValue(createPageDatasetReturn());

    renderHook(() => useClassPageData(DEFAULT_CLASS_ID), { wrapper });

    expect(querySpy.mock.calls).toHaveLength(EXPECTED_PREFETCH_COUNT_SINGLE);
    expect(querySpy.mock.calls[0][0]).toMatchObject(
      expect.objectContaining({ queryKey: ['assignment', DEFAULT_CLASS_ID, 'only-assign'] })
    );
  });

  it('does not call query when classFull has zero assignments', () => {
    const averagingResult = createAveragingResult();
    const adapterResult = createAdapterResult();

    mockAnalyse.mockReturnValue([averagingResult]);
    mockAdaptClassPageToViewModel.mockReturnValue(adapterResult);
    mockGetABClassQueryOptions.mockReturnValue(createABClassQueryOptionsFixture(DEFAULT_CLASS_ID));
    mockUseQuery.mockReturnValue(
      createMockClassQueryResult({ data: createClassFull({ assignments: [] }) })
    );
    mockUsePageDataset.mockReturnValue(createPageDatasetReturn());

    renderHook(() => useClassPageData(DEFAULT_CLASS_ID), { wrapper });

    expect(querySpy).not.toHaveBeenCalled();
  });

  it('logs query rejection without affecting surfaceState or error', () => {
    querySpy.mockRejectedValue(new Error('Query network error'));

    const assignments = [
      createAssignment('a1', '2025-04-01T00:00:00.000Z'),
      createAssignment('a2', '2025-03-01T00:00:00.000Z'),
      createAssignment('a3', '2025-02-01T00:00:00.000Z'),
      createAssignment('a4', '2025-01-01T00:00:00.000Z'),
    ];
    const averagingResult = createAveragingResult();
    const adapterResult = createAdapterResult();

    mockAnalyse.mockReturnValue([averagingResult]);
    mockAdaptClassPageToViewModel.mockReturnValue(adapterResult);
    mockGetABClassQueryOptions.mockReturnValue(createABClassQueryOptionsFixture(DEFAULT_CLASS_ID));
    mockUseQuery.mockReturnValue(
      createMockClassQueryResult({ data: createClassFull({ assignments }) })
    );
    mockUsePageDataset.mockReturnValue(createPageDatasetReturn());

    const { result } = renderHook(() => useClassPageData(DEFAULT_CLASS_ID), { wrapper });

    // Surface state must remain ready and error must stay null even though
    // query rejected — the effect catches and logs the failure
    expect(result.current.surfaceState).toEqual({ status: 'ready' });
    expect(result.current.error).toBeNull();
  });

  it('does not re-fire query on refetch when classId remains the same', () => {
    const assignments = [
      createAssignment('a1', '2025-04-01T00:00:00.000Z'),
      createAssignment('a2', '2025-03-01T00:00:00.000Z'),
      createAssignment('a3', '2025-02-01T00:00:00.000Z'),
      createAssignment('a4', '2025-01-01T00:00:00.000Z'),
    ];
    const classFull = createClassFull({ assignments });
    const averagingResult = createAveragingResult();
    const adapterResult = createAdapterResult();

    mockAnalyse.mockReturnValue([averagingResult]);
    mockAdaptClassPageToViewModel.mockReturnValue(adapterResult);
    mockGetABClassQueryOptions.mockReturnValue(createABClassQueryOptionsFixture(DEFAULT_CLASS_ID));
    mockUseQuery.mockReturnValue(createMockClassQueryResult({ data: classFull }));
    mockUsePageDataset.mockReturnValue(createPageDatasetReturn());

    const { rerender } = renderHook(
      (properties: { classId: string }) => useClassPageData(properties.classId),
      { initialProps: { classId: DEFAULT_CLASS_ID }, wrapper }
    );

    // Effect should have fired exactly 3 times for top-3 assignments
    expect(querySpy.mock.calls).toHaveLength(EXPECTED_PREFETCH_COUNT_TOP_3);

    // Simulate a refetch: fresh classFull (new reference, same classId, same content).
    // A new classFull reference triggers the effect to re-run (classFull is in the
    // dependency array); the guard ref must prevent re-dispatch.
    mockUseQuery.mockReturnValue(
      createMockClassQueryResult({
        data: createClassFull({ assignments: [...assignments] }),
      })
    );
    rerender({ classId: DEFAULT_CLASS_ID });

    // Guard ref prevents re-dispatch for the same classId — count must not increase
    expect(querySpy.mock.calls).toHaveLength(EXPECTED_PREFETCH_COUNT_TOP_3);
  });

  it('does not call query before surfaceState becomes ready', () => {
    // Keep classFull non-null with assignments to verify the effect does NOT
    // fire even when classFull data is available but the page is not yet ready.
    mockGetABClassQueryOptions.mockReturnValue(createABClassQueryOptionsFixture(DEFAULT_CLASS_ID));
    const queryResult = createMockClassQueryResult({
      data: createClassFull({
        assignments: [createAssignment('a1', '2025-04-01T00:00:00.000Z')],
      }),
      isPending: true,
    });
    mockUseQuery.mockReturnValue(queryResult);
    // Set adpQuery.data to null so the pipeline guard blocks execution,
    // keeping surfaceState as 'loading' without needing analyser/adapter mocks.
    mockUsePageDataset.mockReturnValue(
      createPageDatasetReturn(
        { data: null as unknown as ClassFull | null, isPending: true },
        { isDatasetReady: false, isDatasetTrustworthy: false, hasTrustworthyDataset: false }
      )
    );

    const { result } = renderHook(() => useClassPageData(DEFAULT_CLASS_ID), { wrapper });

    expect(result.current.surfaceState.status).toBe('loading');
    expect(querySpy).not.toHaveBeenCalled();
  });
});
