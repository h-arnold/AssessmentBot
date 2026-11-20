/**
 * Contract tests for the typed `AttemptBaselineUnavailableError` thrown by
 * `deriveAttemptBaseline`. These cases pin the three documented unavailability
 * conditions (roster below three, fewer than two attempt candidates, empty pool
 * intersection) with their unchanged messages, and confirm that unrelated
 * invariant failures stay plain `Error` values.
 *
 * The local fixtures below are copied minimally from
 * `attemptBaselineSelection.spec.ts` so this sibling spec stays self-contained;
 * no production or shared helper module is introduced.
 */

import { describe, expect, it } from 'vitest';
import type { PerStudentTaskMetric, TaskDisplayMetric } from '../dataAnalysis.zod';
import {
  AttemptBaselineUnavailableError,
  deriveAttemptBaseline,
  deriveBaselineTaskKeySet,
} from './attemptBaselineSelection';

/** Class id shared by every derivation fixture in this spec. */
const CLASS_ID = 'c_001';

/** One criterion score shared by the computed-display fixtures. */
const SCORE_MID = 4;

/** Definition-scoped task keys used by the derivation fixtures. */
const TASK_KEY_ONE = 'dk_algebra::t_001';
const TASK_KEY_TWO = 'dk_algebra::t_002';

/** The full three-student roster shared by the unavailability fixtures. */
const THREE_STUDENT_ROSTER = ['s_001', 's_002', 's_003'];

/** Computed display metric carrying the shared fixture score at full weight. */
const COMPUTED_DISPLAY: TaskDisplayMetric = {
  state: 'computed',
  value: SCORE_MID,
  totalWeight: 1,
  applicableDataPoints: 1,
  totalDataPoints: 1,
};

/** Raw not-attempted display evidence: observed, never an attempt. */
const NOT_ATTEMPTED_DISPLAY: TaskDisplayMetric = {
  state: 'notAttempted',
  value: 'N',
  totalWeight: 1,
  applicableDataPoints: 0,
  totalDataPoints: 1,
};

/** Error display evidence: the projection of the `E` condition, never an attempt. */
const ERROR_DISPLAY: TaskDisplayMetric = {
  state: 'error',
  value: 'E',
  totalWeight: 0,
  applicableDataPoints: 0,
  totalDataPoints: 0,
};

/** Per-criterion display overrides for {@link createCellMetric}. */
interface CellCriteria {
  completeness?: TaskDisplayMetric;
  accuracy?: TaskDisplayMetric;
  spag?: TaskDisplayMetric;
}

/**
 * Build one schema-valid per-(student, task) metric fixture.
 *
 * Criteria default to error evidence (the `E`-condition projection), so a test
 * opts into attempts explicitly; the display overall follows the criteria and
 * is never read by the module under test.
 *
 * @param {string} studentId - Owning student.
 * @param {string} taskKey - Definition-scoped task key.
 * @param {CellCriteria} criteria - Optional per-criterion display overrides.
 * @returns {PerStudentTaskMetric} The metric fixture.
 */
function createCellMetric(
  studentId: string,
  taskKey: string,
  criteria: CellCriteria = {}
): PerStudentTaskMetric {
  const completeness = criteria.completeness ?? ERROR_DISPLAY;
  const accuracy = criteria.accuracy ?? ERROR_DISPLAY;
  const spag = criteria.spag ?? ERROR_DISPLAY;
  const hasComputed = [completeness, accuracy, spag].some((metric) => metric.state === 'computed');
  const hasNotAttempted = [completeness, accuracy, spag].some(
    (metric) => metric.state === 'notAttempted'
  );
  let overall = ERROR_DISPLAY;
  if (hasComputed) {
    overall = COMPUTED_DISPLAY;
  } else if (hasNotAttempted) {
    overall = NOT_ATTEMPTED_DISPLAY;
  }
  return {
    classId: CLASS_ID,
    studentId,
    taskKey,
    averageContribution: { effectiveWeight: 1, includedInAverage: true },
    completeness,
    accuracy,
    spag,
    overall,
  };
}
/** Exact unavailability message for the below-minimum-roster condition. */
const ROSTER_UNAVAILABLE_MESSAGE =
  "deriveAttemptBaseline: class 'c_001' is not eligible for attempt-baseline mode: roster size 2 (minimum 3), students with at least one attempted task 2 (minimum 2)";

/** Exact unavailability message for the below-minimum-candidates condition. */
const CANDIDATES_UNAVAILABLE_MESSAGE =
  "deriveAttemptBaseline: class 'c_001' is not eligible for attempt-baseline mode: roster size 3 (minimum 3), students with at least one attempted task 1 (minimum 2)";

/** Exact unavailability message for the empty pool intersection condition. */
const EMPTY_INTERSECTION_MESSAGE =
  "deriveAttemptBaseline: class 'c_001' derived an empty attempt baseline: the 2 pooled students attempted no task key in common";

/**
 * Run a throwing callback and return the thrown value for identity/type checks.
 *
 * @param {() => void} callback - Callback expected to throw.
 * @returns {unknown} The thrown value, or undefined when nothing was thrown.
 */
function captureThrown(callback: () => void): unknown {
  try {
    callback();
  } catch (error: unknown) {
    return error;
  }
  return undefined;
}

/**
 * Assert one value is the documented typed unavailability error.
 *
 * @param {unknown} error - The captured thrown value.
 * @param {string} message - The unchanged descriptive message.
 */
function expectTypedUnavailable(error: unknown, message: string): void {
  expect(error).toBeInstanceOf(Error);
  expect(error).toBeInstanceOf(AttemptBaselineUnavailableError);
  expect((error as Error).message).toBe(message);
}

describe('deriveAttemptBaseline — typed unavailability error', () => {
  it('throws AttemptBaselineUnavailableError with the unchanged message when the roster is below three students', () => {
    const metrics = [
      createCellMetric('s_001', TASK_KEY_ONE, { completeness: COMPUTED_DISPLAY }),
      createCellMetric('s_002', TASK_KEY_TWO, { completeness: COMPUTED_DISPLAY }),
    ];

    const error = captureThrown(() => {
      return deriveAttemptBaseline({
        classId: CLASS_ID,
        rosterStudentIds: ['s_001', 's_002'],
        perStudentTaskMetrics: metrics,
      });
    });

    expectTypedUnavailable(error, ROSTER_UNAVAILABLE_MESSAGE);
  });

  it('throws AttemptBaselineUnavailableError with the unchanged message when fewer than two students attempted work', () => {
    const metrics = [createCellMetric('s_001', TASK_KEY_ONE, { completeness: COMPUTED_DISPLAY })];

    const error = captureThrown(() => {
      return deriveAttemptBaseline({
        classId: CLASS_ID,
        rosterStudentIds: THREE_STUDENT_ROSTER,
        perStudentTaskMetrics: metrics,
      });
    });

    expectTypedUnavailable(error, CANDIDATES_UNAVAILABLE_MESSAGE);
  });

  it('throws AttemptBaselineUnavailableError with the unchanged message when the pool intersection is empty', () => {
    const metrics = [
      createCellMetric('s_001', TASK_KEY_ONE, { completeness: COMPUTED_DISPLAY }),
      createCellMetric('s_002', TASK_KEY_TWO, { completeness: COMPUTED_DISPLAY }),
      createCellMetric('s_003', TASK_KEY_ONE, { completeness: COMPUTED_DISPLAY }),
    ];

    const error = captureThrown(() => {
      return deriveAttemptBaseline({
        classId: CLASS_ID,
        rosterStudentIds: THREE_STUDENT_ROSTER,
        perStudentTaskMetrics: metrics,
      });
    });

    expectTypedUnavailable(error, EMPTY_INTERSECTION_MESSAGE);
  });

  it('keeps the requireAttemptedTaskKeys invariant violation as a plain Error, not the typed error', () => {
    // Algorithmic-boundary probe: the two module passes over the metrics
    // (candidacy, then per-student attempt sets) normally see identical data,
    // so an invariant miss is unreachable with a fixed array. A local iterator
    // seam makes the second pass omit a first-pass candidate, exercising the
    // `requireAttemptedTaskKeys` fail-fast without any fixture/corpus edit.
    const attemptMetrics: PerStudentTaskMetric[] = [
      createCellMetric('s_001', TASK_KEY_ONE, { completeness: COMPUTED_DISPLAY }),
      createCellMetric('s_002', TASK_KEY_ONE, { completeness: COMPUTED_DISPLAY }),
    ];
    const mapMetrics: PerStudentTaskMetric[] = [
      createCellMetric('s_002', TASK_KEY_ONE, { completeness: COMPUTED_DISPLAY }),
    ];
    let iterationCount = 0;
    const inconsistentMetrics = new Proxy(attemptMetrics, {
      get(target, property, receiver) {
        if (property === Symbol.iterator) {
          iterationCount += 1;
          const source = iterationCount === 1 ? attemptMetrics : mapMetrics;
          return function* (): Generator<PerStudentTaskMetric> {
            yield* source;
          };
        }
        return Reflect.get(target, property, receiver);
      },
    });

    const error = captureThrown(() => {
      return deriveAttemptBaseline({
        classId: CLASS_ID,
        rosterStudentIds: THREE_STUDENT_ROSTER,
        perStudentTaskMetrics: inconsistentMetrics,
      });
    });

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(
      "deriveAttemptBaseline: student 's_001' has no attempted task keys"
    );
    expect(error).not.toBeInstanceOf(AttemptBaselineUnavailableError);
  });

  it('does not classify unrelated invariant errors as the typed unavailability error', () => {
    // The typed error is reserved for the three documented derive failures;
    // the sibling mode-echo invariant stays a plain Error.
    const displayMetric = createCellMetric('s_001', TASK_KEY_ONE).overall;
    const malformedResult = {
      classId: CLASS_ID,
      className: null,
      perStudent: [],
      perTask: [],
      perClass: {
        completeness: displayMetric,
        accuracy: displayMetric,
        spag: displayMetric,
        overall: displayMetric,
      },
      appliedCriterionWeightings: { completeness: 0.4, accuracy: 0.4, spag: 0.2 },
      appliedAnalysisMode: 'unknown',
    } as unknown as Parameters<typeof deriveBaselineTaskKeySet>[0];

    const error = captureThrown(() => deriveBaselineTaskKeySet(malformedResult, 'typedErrorSpec'));

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(AttemptBaselineUnavailableError);
  });
});
