/**
 * Tests for the Class page hook's analysis-mode parameter, baseline
 * availability, and retention (`useClassPageData`).
 *
 * @remarks
 * Availability follows the shared-helpers register (§9.27 entry 5): the
 * control's availability derives from the last successful analysis result
 * (attempt evidence) plus the current `classFull` (roster), resolving to
 * `'awaiting-data'` whenever either input is absent — never to `'ineligible'`.
 * The reason copy is the single source feeding the header control's tooltip
 * and sr-only description node.
 *
 * The hook is called with its two-argument form
 * `useClassPageData(classId, analysisMode)`. Until the mode parameter lands,
 * these specs fail at runtime (the interim `'absolute'` literal is used
 * regardless of the requested mode) and the two-argument calls are TypeScript
 * errors confined to this spec file — the intended red channels for this
 * suite. Fixtures are local hand-built states; no canonical corpus loading is
 * needed at hook level.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import type { ClassFull } from '@/services/googleClassrooms/classDetail/classDetailService.zod';
import type {
  AnalysisMode,
  AveragingResult,
  PerStudentTaskMetric,
} from '@/services/dataAnalysis/dataAnalysis.zod';
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
import {
  createComputedMetricResult,
  createErrorMetricResult,
  createNotAttemptedMetricResult,
} from '@/test/dataAnalysis/fixtures';

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

// Reason copy pinned by the shared-helpers register (§9.27 entry 5): the hook
// produces the display copy that feeds both the control's tooltip and its
// sr-only description node.
const AWAITING_DATA_REASON = 'Waiting for class data';
const ROSTER_REASON = 'Baseline mode needs at least 3 students in this class';
const ENGAGED_STUDENTS_REASON = 'Baseline mode needs at least 2 students who attempted some work';

/** Smallest roster that satisfies the eligibility rule. */
const ELIGIBLE_ROSTER_COUNT = 3;
/** Roster size below the eligibility rule's minimum of 3 students. */
const BELOW_MINIMUM_ROSTER_COUNT = 2;

/**
 * Creates a roster student with the supplied id.
 *
 * @param {string} studentId - The student identifier.
 * @returns {ClassFull['students'][number]} A roster student fixture.
 */
function createStudent(studentId: string): ClassFull['students'][number] {
  return { id: studentId, name: `Student ${studentId}`, email: `${studentId}@test.example` };
}

/**
 * Creates a roster of sequentially numbered students (`s-1` … `s-count`).
 *
 * @param {number} count - The roster size.
 * @returns {ClassFull['students']} A roster student array fixture.
 */
function createRoster(count: number): ClassFull['students'] {
  return Array.from({ length: count }, (_, index) => createStudent(`s-${index + 1}`));
}

/**
 * Creates a per-(student, task) metric that counts as an attempt: at least one
 * criterion assessment carries a numeric score (a computed criterion).
 *
 * @param {string} studentId - The student identifier.
 * @param {string} taskKey - The attempted task key.
 * @returns {PerStudentTaskMetric} An attempt metric fixture.
 */
function createAttemptMetric(studentId: string, taskKey: string): PerStudentTaskMetric {
  return {
    classId: DEFAULT_CLASS_ID,
    studentId,
    taskKey,
    averageContribution: { effectiveWeight: 1, includedInAverage: true },
    completeness: createComputedMetricResult(),
    accuracy: createComputedMetricResult(),
    spag: createNotAttemptedMetricResult(),
    overall: createComputedMetricResult(),
  };
}

/**
 * Creates a per-(student, task) metric that is not an attempt: every criterion
 * is the all-error `E` condition, so no numeric score exists.
 *
 * @param {string} studentId - The student identifier.
 * @param {string} taskKey - The task key.
 * @returns {PerStudentTaskMetric} A non-attempt metric fixture.
 */
function createNonAttemptMetric(studentId: string, taskKey: string): PerStudentTaskMetric {
  return {
    classId: DEFAULT_CLASS_ID,
    studentId,
    taskKey,
    averageContribution: { effectiveWeight: 1, includedInAverage: true },
    completeness: createErrorMetricResult(),
    accuracy: createErrorMetricResult(),
    spag: createErrorMetricResult(),
    overall: createErrorMetricResult(),
  };
}

/**
 * Seeds the per-class query mocks for the supplied class payload.
 *
 * @param {ClassFull} classFull - The class query payload.
 * @returns {void} Configures the shared mocks.
 */
function seedClassQuery(classFull: ClassFull): void {
  mocks.mockGetABClassQueryOptions.mockReturnValue(
    createABClassQueryOptionsFixture(DEFAULT_CLASS_ID)
  );
  mocks.mockUseQuery.mockReturnValue(createMockClassQueryResult({ data: classFull }));
}

/**
 * Seeds the ready query/dataset mocks and the analysis pipeline for a class.
 *
 * @param {ClassFull} classFull - The class query payload.
 * @param {AveragingResult} averagingResult - The analyser response.
 * @returns {void} Configures the shared mocks.
 */
function seedReadyPipeline(classFull: ClassFull, averagingResult: AveragingResult): void {
  mocks.mockAnalyse.mockReturnValue([averagingResult]);
  mocks.mockAdaptClassPageToViewModel.mockReturnValue(createAdapterResult());
  seedClassQuery(classFull);
  mocks.mockUsePageDataset.mockReturnValue(createPageDatasetReturn());
}

describe('analysis mode parameter', () => {
  it('passes the requested analysis mode into the analysis filter', () => {
    seedReadyPipeline(createClassFull(), createAveragingResult());

    renderHook(() => useClassPageData(DEFAULT_CLASS_ID, 'topDecileBaseline'), { wrapper });

    const analysisInput = mocks.mockAnalyse.mock.calls[0]?.[0];
    expect(analysisInput?.filter.analysisMode).toBe('topDecileBaseline');
  });

  it('re-runs the analysis when the mode toggles without refetching either query', () => {
    const queryRefetch = vi.fn();
    const datasetRefetch = vi.fn();
    const classFull = createClassFull();
    mocks.mockAnalyse.mockReturnValue([createAveragingResult()]);
    mocks.mockAdaptClassPageToViewModel.mockReturnValue(createAdapterResult());
    mocks.mockGetABClassQueryOptions.mockReturnValue(
      createABClassQueryOptionsFixture(DEFAULT_CLASS_ID)
    );
    mocks.mockUseQuery.mockReturnValue(
      createMockClassQueryResult({ data: classFull, refetch: queryRefetch })
    );
    mocks.mockUsePageDataset.mockReturnValue(createPageDatasetReturn({ refetch: datasetRefetch }));

    const { rerender } = renderHook(
      (properties: { analysisMode: AnalysisMode }) =>
        useClassPageData(DEFAULT_CLASS_ID, properties.analysisMode),
      { initialProps: { analysisMode: 'absolute' as AnalysisMode }, wrapper }
    );

    expect(mocks.mockAnalyse).toHaveBeenCalledTimes(1);
    mocks.mockAnalyse.mockClear();

    rerender({ analysisMode: 'topDecileBaseline' });

    // The analysis is recomputed synchronously with the new mode …
    expect(mocks.mockAnalyse).toHaveBeenCalledTimes(1);
    expect(mocks.mockAnalyse.mock.calls[0]?.[0].filter.analysisMode).toBe('topDecileBaseline');
    // … and toggling never re-issues either query.
    expect(queryRefetch).not.toHaveBeenCalled();
    expect(datasetRefetch).not.toHaveBeenCalled();
  });
});

describe('baselineAvailability', () => {
  it('reports ready with no reason on the first successful analysis of an eligible class', () => {
    const classFull = createClassFull({ students: createRoster(ELIGIBLE_ROSTER_COUNT) });
    seedReadyPipeline(
      classFull,
      createAveragingResult({
        perStudentTaskMetrics: [
          createAttemptMetric('s-1', 'task-1'),
          createAttemptMetric('s-2', 'task-2'),
        ],
      })
    );

    const { result } = renderHook(() => useClassPageData(DEFAULT_CLASS_ID, 'absolute'), {
      wrapper,
    });

    expect(result.current.surfaceState.status).toBe('ready');
    expect(result.current.baselineAvailability).toEqual({ status: 'ready', reason: null });
  });

  it('reports awaiting-data while the warm-up dataset is blocked (never ineligible)', () => {
    seedClassQuery(createClassFull({ students: createRoster(BELOW_MINIMUM_ROSTER_COUNT) }));
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

    const { result } = renderHook(() => useClassPageData(DEFAULT_CLASS_ID, 'absolute'), {
      wrapper,
    });

    expect(result.current.surfaceState.status).toBe('blocking');
    // A blocked dataset must never read as an eligibility failure while no
    // successful analysis is possible.
    expect(result.current.baselineAvailability).toEqual({
      status: 'awaiting-data',
      reason: AWAITING_DATA_REASON,
    });
  });

  it('reports awaiting-data when the first analysis throws (never ineligible)', () => {
    mocks.mockAnalyse.mockImplementation(() => {
      throw new Error('baseline derivation failed');
    });
    mocks.mockAdaptClassPageToViewModel.mockReturnValue(createAdapterResult());
    seedClassQuery(createClassFull({ students: createRoster(BELOW_MINIMUM_ROSTER_COUNT) }));
    mocks.mockUsePageDataset.mockReturnValue(createPageDatasetReturn());

    const { result } = renderHook(() => useClassPageData(DEFAULT_CLASS_ID, 'absolute'), {
      wrapper,
    });

    expect(result.current.surfaceState.status).toBe('blocking');
    expect(result.current.baselineAvailability).toEqual({
      status: 'awaiting-data',
      reason: AWAITING_DATA_REASON,
    });
  });

  it('reports awaiting-data when a successful result carries no per-student task metrics', () => {
    // A shape-legal result may omit the optional `perStudentTaskMetrics` field;
    // absence resolves 'awaiting-data' (absence never produces 'ineligible').
    const classFull = createClassFull({ students: createRoster(ELIGIBLE_ROSTER_COUNT) });
    seedReadyPipeline(classFull, createAveragingResult());

    const { result } = renderHook(() => useClassPageData(DEFAULT_CLASS_ID, 'absolute'), {
      wrapper,
    });

    expect(result.current.surfaceState.status).toBe('ready');
    expect(result.current.baselineAvailability).toEqual({
      status: 'awaiting-data',
      reason: AWAITING_DATA_REASON,
    });
  });

  it('reports ineligible with the roster reason when the class has fewer than 3 students', () => {
    const classFull = createClassFull({ students: createRoster(BELOW_MINIMUM_ROSTER_COUNT) });
    seedReadyPipeline(
      classFull,
      createAveragingResult({
        perStudentTaskMetrics: [
          createAttemptMetric('s-1', 'task-1'),
          createAttemptMetric('s-2', 'task-2'),
        ],
      })
    );

    const { result } = renderHook(() => useClassPageData(DEFAULT_CLASS_ID, 'absolute'), {
      wrapper,
    });

    expect(result.current.surfaceState.status).toBe('ready');
    expect(result.current.baselineAvailability).toEqual({
      status: 'ineligible',
      reason: ROSTER_REASON,
    });
  });

  it('reports ineligible with the engaged-students reason when fewer than 2 students attempted work', () => {
    const classFull = createClassFull({ students: createRoster(ELIGIBLE_ROSTER_COUNT) });
    seedReadyPipeline(
      classFull,
      createAveragingResult({
        perStudentTaskMetrics: [
          createAttemptMetric('s-1', 'task-1'),
          // s-2 has submissions but every item is the all-error E condition —
          // not an attempt, so only one candidate exists.
          createNonAttemptMetric('s-2', 'task-1'),
        ],
      })
    );

    const { result } = renderHook(() => useClassPageData(DEFAULT_CLASS_ID, 'absolute'), {
      wrapper,
    });

    expect(result.current.baselineAvailability).toEqual({
      status: 'ineligible',
      reason: ENGAGED_STUDENTS_REASON,
    });
  });
});

describe('availability retention (previous-render pattern)', () => {
  // The green implementation must retain the last successful analysis result
  // with React's documented previous-render state pattern (two useState pairs
  // updated during render, per the shared-helpers register §9.27 entry 5):
  // `react-hooks/refs` and `react-hooks/set-state-in-effect` are lint errors,
  // so neither a ref read during render nor an effect-driven state write can
  // express this contract. The assertions below pin the behaviour that
  // pattern produces.

  it('retains the last successful availability when a later render throws', () => {
    const classFull = createClassFull({ students: createRoster(ELIGIBLE_ROSTER_COUNT) });
    seedReadyPipeline(
      classFull,
      createAveragingResult({
        perStudentTaskMetrics: [
          createAttemptMetric('s-1', 'task-1'),
          createAttemptMetric('s-2', 'task-2'),
        ],
      })
    );

    const { rerender, result } = renderHook(
      () => useClassPageData(DEFAULT_CLASS_ID, 'topDecileBaseline'),
      { wrapper }
    );

    expect(result.current.baselineAvailability).toEqual({ status: 'ready', reason: null });

    // A later render cycle re-runs the analysis and throws (a baseline-mode
    // blocking failure): the content blocks, but the retained evidence keeps
    // the availability the control needs to stay enabled.
    const updatedClassFull = createClassFull({ students: createRoster(ELIGIBLE_ROSTER_COUNT) });
    mocks.mockAnalyse.mockImplementation(() => {
      throw new Error('baseline derivation failed');
    });
    mocks.mockUseQuery.mockReturnValue(createMockClassQueryResult({ data: updatedClassFull }));
    rerender();

    expect(result.current.surfaceState.status).toBe('blocking');
    expect(result.current.baselineAvailability).toEqual({ status: 'ready', reason: null });
  });

  it('lets a newer successful result supersede the retained evidence', () => {
    const classFull = createClassFull({ students: createRoster(ELIGIBLE_ROSTER_COUNT) });
    seedReadyPipeline(
      classFull,
      createAveragingResult({
        perStudentTaskMetrics: [
          createAttemptMetric('s-1', 'task-1'),
          createAttemptMetric('s-2', 'task-2'),
        ],
      })
    );

    const { rerender, result } = renderHook(
      () => useClassPageData(DEFAULT_CLASS_ID, 'topDecileBaseline'),
      { wrapper }
    );

    expect(result.current.baselineAvailability).toEqual({ status: 'ready', reason: null });

    // A newer successful result is the current render's evidence: the
    // retained state supplies attempt evidence only when the current render's
    // result is null.
    const updatedClassFull = createClassFull({ students: createRoster(ELIGIBLE_ROSTER_COUNT) });
    mocks.mockAnalyse.mockReturnValue([
      createAveragingResult({
        perStudentTaskMetrics: [
          createAttemptMetric('s-1', 'task-1'),
          createNonAttemptMetric('s-3', 'task-2'),
        ],
      }),
    ]);
    mocks.mockUseQuery.mockReturnValue(createMockClassQueryResult({ data: updatedClassFull }));
    rerender();

    expect(result.current.surfaceState.status).toBe('ready');
    expect(result.current.baselineAvailability).toEqual({
      status: 'ineligible',
      reason: ENGAGED_STUDENTS_REASON,
    });
  });

  it('clears retained availability on remount', () => {
    const classFull = createClassFull({ students: createRoster(ELIGIBLE_ROSTER_COUNT) });
    seedReadyPipeline(
      classFull,
      createAveragingResult({
        perStudentTaskMetrics: [
          createAttemptMetric('s-1', 'task-1'),
          createAttemptMetric('s-2', 'task-2'),
        ],
      })
    );

    const firstMount = renderHook(() => useClassPageData(DEFAULT_CLASS_ID, 'topDecileBaseline'), {
      wrapper,
    });
    expect(firstMount.result.current.baselineAvailability).toEqual({
      status: 'ready',
      reason: null,
    });

    // Retention becomes active: a later render throws while the class stays mounted.
    const updatedClassFull = createClassFull({ students: createRoster(ELIGIBLE_ROSTER_COUNT) });
    mocks.mockAnalyse.mockImplementation(() => {
      throw new Error('baseline derivation failed');
    });
    mocks.mockUseQuery.mockReturnValue(createMockClassQueryResult({ data: updatedClassFull }));
    firstMount.rerender();
    expect(firstMount.result.current.surfaceState.status).toBe('blocking');
    firstMount.unmount();

    // A remount (a class change) clears the retention: with the analyser still
    // throwing, the fresh mount has no successful result to retain.
    const secondMount = renderHook(() => useClassPageData(DEFAULT_CLASS_ID, 'topDecileBaseline'), {
      wrapper,
    });

    expect(secondMount.result.current.baselineAvailability).toEqual({
      status: 'awaiting-data',
      reason: AWAITING_DATA_REASON,
    });
  });
});
