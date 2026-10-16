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
  createAveragingResult,
  createClassFull,
  createMockClassQueryResult,
  createPageDatasetReturn,
} from '@/test/classPage/useClassPageDataTestFixtures';
import { createUseClassPageDataMockHandles } from '@/test/classPage/useClassPageDataMockHandles';

const mocks = createUseClassPageDataMockHandles();
let queryClient: QueryClient;
let wrapper: ReturnType<typeof createClassPageDataWrapper>;
beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  wrapper = createClassPageDataWrapper(queryClient);
});
afterEach(() => {
  vi.resetAllMocks();
});

// Surface-state and synchronous pipeline behaviour.
describe('surfaceState derivation', () => {
  it('returns loading when the per-class query is in flight and the dataset is not ready and not failed', () => {
    mocks.mockGetABClassQueryOptions.mockReturnValue(
      createABClassQueryOptionsFixture(DEFAULT_CLASS_ID)
    );
    mocks.mockUseQuery.mockReturnValue(createMockClassQueryResult({ isPending: true }));
    mocks.mockUsePageDataset.mockReturnValue(
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
    mocks.mockGetABClassQueryOptions.mockReturnValue(
      createABClassQueryOptionsFixture(DEFAULT_CLASS_ID)
    );
    mocks.mockUseQuery.mockReturnValue(createMockClassQueryResult({ data: null }));
    mocks.mockUsePageDataset.mockReturnValue(createPageDatasetReturn());

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
    mocks.mockGetABClassQueryOptions.mockReturnValue(
      createABClassQueryOptionsFixture(DEFAULT_CLASS_ID)
    );
    mocks.mockUseQuery.mockReturnValue(
      createMockClassQueryResult({ isError: true, error: queryError })
    );
    mocks.mockUsePageDataset.mockReturnValue(createPageDatasetReturn());

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
    mocks.mockGetABClassQueryOptions.mockReturnValue(
      createABClassQueryOptionsFixture(DEFAULT_CLASS_ID)
    );
    mocks.mockUseQuery.mockReturnValue(createMockClassQueryResult({ data: createClassFull() }));
    mocks.mockUsePageDataset.mockReturnValue(
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
    mocks.mockGetABClassQueryOptions.mockReturnValue(
      createABClassQueryOptionsFixture(DEFAULT_CLASS_ID)
    );
    mocks.mockUseQuery.mockReturnValue(createMockClassQueryResult({ data: createClassFull() }));
    mocks.mockUsePageDataset.mockReturnValue(
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
    mocks.mockAnalyse.mockReturnValue([createAveragingResult()]);
    mocks.mockAdaptClassPageToViewModel.mockImplementation(() => {
      throw adapterError;
    });

    mocks.mockGetABClassQueryOptions.mockReturnValue(
      createABClassQueryOptionsFixture(DEFAULT_CLASS_ID)
    );
    mocks.mockUseQuery.mockReturnValue(createMockClassQueryResult({ data: createClassFull() }));
    mocks.mockUsePageDataset.mockReturnValue(createPageDatasetReturn());

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
    mocks.mockAnalyse.mockImplementation(() => {
      throw analyserError;
    });

    mocks.mockGetABClassQueryOptions.mockReturnValue(
      createABClassQueryOptionsFixture(DEFAULT_CLASS_ID)
    );
    mocks.mockUseQuery.mockReturnValue(createMockClassQueryResult({ data: createClassFull() }));
    mocks.mockUsePageDataset.mockReturnValue(createPageDatasetReturn());

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

    mocks.mockAnalyse.mockReturnValue([averagingResult]);
    mocks.mockAdaptClassPageToViewModel.mockReturnValue(adapterResult);

    mocks.mockGetABClassQueryOptions.mockReturnValue(
      createABClassQueryOptionsFixture(DEFAULT_CLASS_ID)
    );
    mocks.mockUseQuery.mockReturnValue(createMockClassQueryResult({ data: createClassFull() }));
    mocks.mockUsePageDataset.mockReturnValue(createPageDatasetReturn());

    const { result } = renderHook(() => useClassPageData(DEFAULT_CLASS_ID), { wrapper });

    expect(result.current.surfaceState).toEqual({ status: 'ready' });
    expect(result.current.error).toBeNull();
    expect(result.current.analyserResult).toEqual(averagingResult);
    expect(result.current.adapterResult).toEqual(adapterResult);
    expect(result.current.classFull).toEqual(createClassFull());
    expect(result.current.classFullQuery).toBeDefined();
    expect(result.current.assignmentDefinitionPartials).toBeDefined();
  });

  it('returns loading when isDatasetReady is true but adapterResult is null (pipeline not yet run)', () => {
    mocks.mockGetABClassQueryOptions.mockReturnValue(
      createABClassQueryOptionsFixture(DEFAULT_CLASS_ID)
    );
    mocks.mockUseQuery.mockReturnValue(createMockClassQueryResult({ data: createClassFull() }));
    // Dataset reports ready but the query data is null, so assignmentDefinitionPartials
    // is null and the pipeline has not produced an adapterResult.
    mocks.mockUsePageDataset.mockReturnValue(
      createPageDatasetReturn(
        { data: null as unknown as ClassFull | null },
        { isDatasetReady: true, isDatasetTrustworthy: true }
      )
    );

    const { result } = renderHook(() => useClassPageData(DEFAULT_CLASS_ID), { wrapper });

    expect(result.current.surfaceState).toEqual({ status: 'loading' });
    expect(result.current.adapterResult).toBeNull();
    expect(result.current.analyserResult).toBeNull();
    expect(result.current.error).toBeNull();
  });
});

describe('analyser and adapter synchronous invocation', () => {
  it('calls the analyser synchronously when both classFull and assignmentDefinitionPartials are ready', () => {
    const averagingResult = createAveragingResult();
    const adapterResult = createAdapterResult();

    mocks.mockAnalyse.mockReturnValue([averagingResult]);
    mocks.mockAdaptClassPageToViewModel.mockReturnValue(adapterResult);

    mocks.mockGetABClassQueryOptions.mockReturnValue(
      createABClassQueryOptionsFixture(DEFAULT_CLASS_ID)
    );
    mocks.mockUseQuery.mockReturnValue(createMockClassQueryResult({ data: createClassFull() }));
    mocks.mockUsePageDataset.mockReturnValue(createPageDatasetReturn());

    renderHook(() => useClassPageData(DEFAULT_CLASS_ID), { wrapper });

    expect(mocks.mockAnalyse).toHaveBeenCalledTimes(1);
  });

  it('calls the adapter synchronously when the analyser result is ready', () => {
    const averagingResult = createAveragingResult();
    const adapterResult = createAdapterResult();

    mocks.mockAnalyse.mockReturnValue([averagingResult]);
    mocks.mockAdaptClassPageToViewModel.mockReturnValue(adapterResult);

    mocks.mockGetABClassQueryOptions.mockReturnValue(
      createABClassQueryOptionsFixture(DEFAULT_CLASS_ID)
    );
    mocks.mockUseQuery.mockReturnValue(createMockClassQueryResult({ data: createClassFull() }));
    mocks.mockUsePageDataset.mockReturnValue(createPageDatasetReturn());

    renderHook(() => useClassPageData(DEFAULT_CLASS_ID), { wrapper });

    expect(mocks.mockAdaptClassPageToViewModel).toHaveBeenCalledTimes(1);
  });
});
