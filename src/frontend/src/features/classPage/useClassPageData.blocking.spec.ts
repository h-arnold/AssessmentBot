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

// Blocking precedence and empty analyser responses.
describe('blocking precedence', () => {
  it('returns blocking status when an error condition exists AND the query is still loading', () => {
    // This test verifies the blocking-precedence logic in isolation, using a
    // synthetic state that React Query would not produce at runtime (isPending
    // and isError are mutually exclusive in React Query v5).
    const queryError = new Error('Network error');

    mockGetABClassQueryOptions.mockReturnValue(createABClassQueryOptionsFixture(DEFAULT_CLASS_ID));
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

    mockGetABClassQueryOptions.mockReturnValue(createABClassQueryOptionsFixture(DEFAULT_CLASS_ID));
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

    mockGetABClassQueryOptions.mockReturnValue(createABClassQueryOptionsFixture(DEFAULT_CLASS_ID));
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

    mockGetABClassQueryOptions.mockReturnValue(createABClassQueryOptionsFixture(DEFAULT_CLASS_ID));
    mockUseQuery.mockReturnValue(createMockClassQueryResult({ data: createClassFull() }));
    mockUsePageDataset.mockReturnValue(createPageDatasetReturn());

    const { result } = renderHook(() => useClassPageData(DEFAULT_CLASS_ID), { wrapper });

    expect(result.current.surfaceState).toEqual({ status: 'ready' });
    expect(result.current.error).toBeNull();
    expect(result.current.analyserResult).toEqual(averagingResult);
    expect(result.current.adapterResult).toEqual(adapterResult);
  });
});
