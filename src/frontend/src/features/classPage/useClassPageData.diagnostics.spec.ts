import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider, type UseQueryResult } from '@tanstack/react-query';
import { createElement, StrictMode, type ReactNode } from 'react';
import { z } from 'zod';
import { DataAnalysisResponseSchema } from '../../services/dataAnalysis/dataAnalysis.zod';
import { createHeatmapClassFull } from '../../test/dataAnalysis/heatmapFixtures';
import { createMalformedAnalyserOutput } from '../../test/dataAnalysis/diagnosticsFixtures';
import { useClassPageData } from './useClassPageData';
import type { ClassFull } from '../../services/googleClassrooms/classDetail/classDetailService.zod';

const CLASS_ID = 'class-abc-123';
const STRICT_MODE_DOUBLED_CALL_COUNT = 2;
const DISTINCT_ERROR_TOTAL_LOG_COUNT = 2;

const { mockUseQuery, mockUsePageDataset, mockGetABClassQueryOptions, mockAnalyse } = vi.hoisted(
  () => ({
    mockUseQuery: vi.fn(),
    mockUsePageDataset: vi.fn(),
    mockGetABClassQueryOptions: vi.fn(),
    mockAnalyse: vi.fn(),
  })
);

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useQuery: mockUseQuery,
  };
});

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
  };
});

vi.mock('../../services/dataAnalysis/dataAnalysisService', () => ({
  DataAnalysisService: vi.fn().mockImplementation(function () {
    return { analyse: mockAnalyse };
  }),
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

/**
 * Build a ready class query result for the hook pipeline.
 *
 * @param {ClassFull} classFull - The class payload returned by the query.
 * @returns {UseQueryResult<ClassFull | null, Error>} A ready query result.
 */
function createReadyClassQueryResult(
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

/**
 * Parse the shared malformed analyser output into the error seen by consumers.
 *
 * @returns {z.ZodError} The output-validation error.
 */
function createMalformedOutputZodError(): z.ZodError {
  const parseResult = DataAnalysisResponseSchema.safeParse(createMalformedAnalyserOutput());
  expect(parseResult.success).toBe(false);
  if (parseResult.success) {
    throw new Error('Expected malformed analyser output to fail validation');
  }
  return parseResult.error;
}

/**
 * Render the hook with an isolated query client and ready input data.
 *
 * @param {ClassFull} classFull - The class payload returned by the query.
 * @param {{ strict?: boolean }} [options] - Optional StrictMode wrapper setting.
 * @param {boolean} [options.strict] - Whether to wrap the hook in React StrictMode.
 * @returns {ReturnType<typeof renderHook>} The rendered hook result.
 */
function renderReadyClassPage(classFull: ClassFull, options: { strict?: boolean } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => {
    const tree = createElement(QueryClientProvider, { client: queryClient }, children);
    return options.strict ? createElement(StrictMode, null, tree) : tree;
  };
  mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', CLASS_ID] });
  mockUseQuery.mockReturnValue(createReadyClassQueryResult(classFull));
  mockUsePageDataset.mockReturnValue({
    query: { data: [], refetch: vi.fn() },
    datasetState: {
      hasQueryData: true,
      isQueryError: false,
      isDatasetFailed: false,
      isDatasetReady: true,
      isDatasetTrustworthy: true,
      hasTrustworthyDataset: true,
    },
  });
  return renderHook(() => useClassPageData(CLASS_ID), { wrapper });
}

describe('useClassPageData analyser diagnostics ownership', () => {
  it('logs one structured zodIssues entry for malformed analyser output', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const zodError = createMalformedOutputZodError();
    mockAnalyse.mockImplementation(() => {
      throw zodError;
    });
    const classFull = createHeatmapClassFull({
      classId: CLASS_ID,
      className: 'Test Class 7A',
      assignments: [],
      students: [],
    });

    const { result } = renderReadyClassPage(classFull);

    expect(result.current.surfaceState).toEqual({
      status: 'blocking',
      error: { type: 'analyserError', cause: zodError },
    });
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const [context, rawEntry] = consoleErrorSpy.mock.calls[0]!;
    const entry = rawEntry as {
      level?: unknown;
      metadata?: Record<string, unknown>;
    };
    expect(context).toBe('useClassPageData.runAnalyserStep');
    expect(entry.level).toBe('error');
    expect(entry.metadata).toMatchObject({
      classId: CLASS_ID,
      zodIssues: zodError.issues,
    });
  });

  it('deduplicates the StrictMode rerun while still returning and logging a distinct failure', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const repeatedError = createMalformedOutputZodError();
    mockAnalyse.mockImplementation(() => {
      throw repeatedError;
    });
    const classFull = createHeatmapClassFull({
      classId: CLASS_ID,
      className: 'Test Class 7A',
      assignments: [],
      students: [],
    });

    const { result, rerender } = renderReadyClassPage(classFull, { strict: true });

    expect(mockAnalyse).toHaveBeenCalledTimes(STRICT_MODE_DOUBLED_CALL_COUNT);
    expect(result.current.surfaceState).toEqual({
      status: 'blocking',
      error: { type: 'analyserError', cause: repeatedError },
    });
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

    const distinctParse = z.number().safeParse('distinct analyser failure');
    expect(distinctParse.success).toBe(false);
    if (distinctParse.success) {
      throw new Error('Expected the distinct analyser fixture to fail validation');
    }
    const distinctError = distinctParse.error;
    const callsBeforeRerender = mockAnalyse.mock.calls.length;
    mockAnalyse.mockImplementation(() => {
      throw distinctError;
    });
    mockUseQuery.mockReturnValue(
      createReadyClassQueryResult({ ...classFull, className: 'Updated Test Class' })
    );

    rerender();

    expect(mockAnalyse.mock.calls.length).toBeGreaterThan(callsBeforeRerender);
    expect(result.current.surfaceState).toEqual({
      status: 'blocking',
      error: { type: 'analyserError', cause: distinctError },
    });
    expect(consoleErrorSpy).toHaveBeenCalledTimes(DISTINCT_ERROR_TOTAL_LOG_COUNT);
    const loggedEntries = consoleErrorSpy.mock.calls.map(([context, rawEntry]) => ({
      context,
      entry: rawEntry as {
        level?: unknown;
        metadata?: Record<string, unknown>;
      },
    }));
    expect(loggedEntries.map(({ context }) => context)).toEqual([
      'useClassPageData.runAnalyserStep',
      'useClassPageData.runAnalyserStep',
    ]);
    expect(loggedEntries.map(({ entry }) => entry.level)).toEqual(['error', 'error']);
    expect(loggedEntries.map(({ entry }) => entry.metadata?.zodIssues)).toEqual([
      repeatedError.issues,
      distinctError.issues,
    ]);
  });
});
