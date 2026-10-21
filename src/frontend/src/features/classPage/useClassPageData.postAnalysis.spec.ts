/**
 * Consumer integration: `useClassPageData` binds the shared post-analysis hook.
 *
 * @remarks
 * These specs prove only the feature binding, not the shared hook lifecycle.
 * The shared hook is spied (not the real owner) so the ordered runner, replay,
 * invalidation and feedback contracts remain owned by the existing
 * `hooks/usePostAnalysisTasks.*` suites. The assertions pin:
 *
 * - the hook receives the complete unsliced class, the live definition partials
 *   and the validated averaging result after a successful ready run;
 * - failed/skipped/loading/adaptation-blocking surfaces pass `null` instead of a
 *   successful context;
 * - the shared production registry is passed with a stable identity and a
 *   metadata-only task list, so future independent tasks are not tied to
 *   feature-local eligibility.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import type { PostAnalysisContext } from '@/services/dataAnalysis/postAnalysis/postAnalysis.zod';
import type { PostAnalysisTaskDescriptor } from '@/services/dataAnalysis/postAnalysis/runPostAnalysisTasks';
import '@/test/classPage/useClassPageData.mockSetup';
import { useClassPageData } from './useClassPageData';
import {
  DEFAULT_CLASS_ID,
  createABClassQueryOptionsFixture,
  createAdapterResult,
  createAssignment,
  createAveragingResult,
  createClassFull,
  createClassPageDataWrapper,
  createMockClassQueryResult,
  createPageDatasetReturn,
} from '@/test/classPage/useClassPageDataTestFixtures';
import { createUseClassPageDataMockHandles } from '@/test/classPage/useClassPageDataMockHandles';

const mocks = createUseClassPageDataMockHandles();
let queryClient: QueryClient;
let wrapper: ReturnType<typeof createClassPageDataWrapper>;

/** Typed view of one shared post-analysis hook invocation. */
type PostAnalysisCall = readonly [
  PostAnalysisContext | null,
  readonly PostAnalysisTaskDescriptor[],
  string | null,
];

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  wrapper = createClassPageDataWrapper(queryClient);
});

afterEach(() => {
  vi.resetAllMocks();
});

/** Configures a trustworthily ready per-class query for the supplied class.
 * @param {ReturnType<typeof createClassFull>} classFull - The complete class.
 * @returns {void} Configures the per-class query mock.
 */
function mockReadyClassQuery(classFull: ReturnType<typeof createClassFull>): void {
  mocks.mockGetABClassQueryOptions.mockReturnValue(
    createABClassQueryOptionsFixture(DEFAULT_CLASS_ID)
  );
  mocks.mockUseQuery.mockReturnValue(createMockClassQueryResult({ data: classFull }));
}

/** Build a ready class with two distinct assignment instances.
 * @returns {ReturnType<typeof createClassFull>} The unsliced class fixture.
 */
function createReadyClass() {
  return createClassFull({
    assignments: [
      createAssignment('assignment-1', '2026-10-01T00:00:00.000Z'),
      createAssignment('assignment-2', '2026-10-02T00:00:00.000Z'),
    ],
  });
}

describe('useClassPageData shared post-analysis binding', () => {
  it('invokes the shared hook with the unsliced class, live definitions and validated result after averaging', () => {
    const classFull = createReadyClass();
    const averagingResult = createAveragingResult();
    mocks.mockAnalyse.mockReturnValue([averagingResult]);
    mocks.mockAdaptClassPageToViewModel.mockReturnValue(createAdapterResult());
    mockReadyClassQuery(classFull);
    const dataset = createPageDatasetReturn();
    mocks.mockUsePageDataset.mockReturnValue(dataset);

    const { result } = renderHook(() => useClassPageData(DEFAULT_CLASS_ID), { wrapper });

    expect(result.current.surfaceState).toEqual({ status: 'ready' });
    expect(mocks.mockUsePostAnalysisTasks).toHaveBeenCalledTimes(1);
    const [context, tasks] = mocks.mockUsePostAnalysisTasks.mock.calls[0] as PostAnalysisCall;
    expect(mocks.mockUsePostAnalysisTasks.mock.calls[0][2]).toBe(DEFAULT_CLASS_ID);
    expect(context).not.toBeNull();
    const source = context!;
    // The post-task source is the complete unsliced class, not a display slice.
    expect(source.classFull).toEqual(classFull);
    expect(source.classFull.assignments).toHaveLength(classFull.assignments.length);
    expect(source.classFull.assignments.map((assignment) => assignment.assignmentId)).toEqual([
      'assignment-1',
      'assignment-2',
    ]);
    expect(source.assignmentDefinitionPartials).toEqual(dataset.query.data);
    expect(source.averagingResult).toEqual(averagingResult);
    expect(tasks.map((task) => task.id)).toEqual(['refreshABClassMetadata']);
  });

  it('reuses the successful post-analysis context when its inputs are unchanged', () => {
    mocks.mockAnalyse.mockReturnValue([createAveragingResult()]);
    mocks.mockAdaptClassPageToViewModel.mockReturnValue(createAdapterResult());
    mockReadyClassQuery(createReadyClass());
    mocks.mockUsePageDataset.mockReturnValue(createPageDatasetReturn());

    const { rerender } = renderHook(() => useClassPageData(DEFAULT_CLASS_ID), { wrapper });
    const [firstContext, firstTasks] = mocks.mockUsePostAnalysisTasks.mock
      .lastCall as PostAnalysisCall;
    expect(firstContext).not.toBeNull();

    rerender();

    const [lastContext, lastTasks] = mocks.mockUsePostAnalysisTasks.mock
      .lastCall as PostAnalysisCall;
    expect(lastContext).toBe(firstContext);
    expect(lastTasks).toBe(firstTasks);
  });

  it('passes null while the per-class query is still loading', () => {
    mocks.mockGetABClassQueryOptions.mockReturnValue(
      createABClassQueryOptionsFixture(DEFAULT_CLASS_ID)
    );
    mocks.mockUseQuery.mockReturnValue(createMockClassQueryResult({ isPending: true }));
    mocks.mockUsePageDataset.mockReturnValue(createPageDatasetReturn());

    const { result } = renderHook(() => useClassPageData(DEFAULT_CLASS_ID), { wrapper });

    expect(result.current.surfaceState).toEqual({ status: 'loading' });
    expect(mocks.mockUsePostAnalysisTasks).toHaveBeenCalledTimes(1);
    expect(mocks.mockUsePostAnalysisTasks.mock.calls[0][0]).toBeNull();
  });

  it('passes null when the averaging analysis fails', () => {
    mocks.mockAnalyse.mockImplementation(() => {
      throw new Error('analysis failed');
    });
    mockReadyClassQuery(createReadyClass());
    mocks.mockUsePageDataset.mockReturnValue(createPageDatasetReturn());

    const { result } = renderHook(() => useClassPageData(DEFAULT_CLASS_ID), { wrapper });

    expect(result.current.surfaceState.status).toBe('blocking');
    expect(result.current.error?.type).toBe('analyserError');
    expect(mocks.mockUsePostAnalysisTasks).toHaveBeenCalledTimes(1);
    expect(mocks.mockUsePostAnalysisTasks.mock.calls[0][0]).toBeNull();
  });

  it('passes null when adaptation blocks the ready surface', () => {
    mocks.mockAnalyse.mockReturnValue([createAveragingResult()]);
    mocks.mockAdaptClassPageToViewModel.mockImplementation(() => {
      throw new Error('adapter failed');
    });
    mockReadyClassQuery(createReadyClass());
    mocks.mockUsePageDataset.mockReturnValue(createPageDatasetReturn());

    const { result } = renderHook(() => useClassPageData(DEFAULT_CLASS_ID), { wrapper });

    expect(result.current.surfaceState.status).toBe('blocking');
    expect(result.current.error?.type).toBe('adapterError');
    expect(mocks.mockUsePostAnalysisTasks).toHaveBeenCalledTimes(1);
    expect(mocks.mockUsePostAnalysisTasks.mock.calls[0][0]).toBeNull();
  });

  it('passes a stable shared production registry across rerenders', () => {
    mocks.mockAnalyse.mockReturnValue([createAveragingResult()]);
    mocks.mockAdaptClassPageToViewModel.mockReturnValue(createAdapterResult());
    mockReadyClassQuery(createReadyClass());
    mocks.mockUsePageDataset.mockReturnValue(createPageDatasetReturn());

    const { rerender } = renderHook(() => useClassPageData(DEFAULT_CLASS_ID), { wrapper });

    const firstTasks = (mocks.mockUsePostAnalysisTasks.mock.calls[0] as PostAnalysisCall)[1];
    expect(firstTasks.map((task) => task.id)).toEqual(['refreshABClassMetadata']);
    expect(firstTasks[0].getAttemptKey).toBeTypeOf('function');

    rerender();

    const lastTasks = (mocks.mockUsePostAnalysisTasks.mock.lastCall as PostAnalysisCall)[1];
    expect(lastTasks).toBe(firstTasks);
  });
});
