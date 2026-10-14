/** Tests for the Class page data orchestrator hook (`useClassPageData`). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import '../../test/classPage/useClassPageData.mockSetup';
import { useClassPageData } from './useClassPageData';
import {
  DEFAULT_CLASS_ID,
  createClassPageDataWrapper,
  createABClassQueryOptionsFixture,
  createAdapterResult,
  createAveragingResult,
  createClassFull,
  createMockClassQueryResult,
  createPageDatasetReturn,
} from '../../test/classPage/useClassPageDataTestFixtures';
import { useQuery } from '@tanstack/react-query';
import { usePageDataset } from '../../hooks/usePageDataset';
import { getABClassQueryOptions } from '../../query/sharedQueries';
import { DataAnalysisService } from '../../services/dataAnalysis/dataAnalysisService';
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
beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  wrapper = createClassPageDataWrapper(queryClient);
});
afterEach(() => {
  vi.resetAllMocks();
});

// Memoisation and refetch contracts.
describe('memoisation (referential equality)', () => {
  it.each([
    {
      title:
        'does not re-call the analyser when classFull and assignmentDefinitionPartials are referentially equal',
      selectedMock: mockAnalyse,
    },
    {
      title:
        'does not re-call the adapter when analyserResult and classFull are referentially equal',
      selectedMock: mockAdaptClassPageToViewModel,
    },
  ])('$title', ({ selectedMock }) => {
    const classFull = createClassFull();
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

    expect(selectedMock).toHaveBeenCalledTimes(1);
    selectedMock.mockClear();

    // Rerender with the same classId — mocks return the same references
    rerender({ classId: DEFAULT_CLASS_ID });

    expect(selectedMock).not.toHaveBeenCalled();
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

    mockGetABClassQueryOptions.mockReturnValue(createABClassQueryOptionsFixture(DEFAULT_CLASS_ID));
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

    mockGetABClassQueryOptions.mockReturnValue(createABClassQueryOptionsFixture(DEFAULT_CLASS_ID));
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

    mockGetABClassQueryOptions.mockReturnValue(createABClassQueryOptionsFixture(DEFAULT_CLASS_ID));
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

    mockGetABClassQueryOptions.mockReturnValue(createABClassQueryOptionsFixture(DEFAULT_CLASS_ID));
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

    mockGetABClassQueryOptions.mockReturnValue(createABClassQueryOptionsFixture(DEFAULT_CLASS_ID));
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

    mockGetABClassQueryOptions.mockReturnValue(createABClassQueryOptionsFixture(DEFAULT_CLASS_ID));
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
    mockGetABClassQueryOptions.mockReturnValue(createABClassQueryOptionsFixture(newClassId));
    mockUseQuery.mockReturnValue(
      createMockClassQueryResult({ data: classFull, refetch: newQueryRefetchMock })
    );
    mockUsePageDataset.mockReturnValue(createPageDatasetReturn({ refetch: newAdpRefetchMock }));

    rerender({ classId: newClassId });

    // The callback reference must change when the underlying query refs change
    expect(result.current.refetch).not.toBe(firstRefetch);
  });
});
