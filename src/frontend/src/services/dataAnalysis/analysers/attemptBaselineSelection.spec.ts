/**
 * Contract tests for the attempt-baseline selection module
 * (`attemptBaselineSelection.ts`): the shared attempt predicate, the baseline
 * eligibility predicate, and the post-accumulation pool + intersection
 * derivation consumed by the averaging analyser.
 *
 * Attempt semantics (data-shape item 3): a
 * (student, task) observation is an attempt when at least one criterion
 * assessment carries a numeric score. All-raw-`N` items, all-error (`E`) items
 * and absent items are not attempts, and criterion weighting plays no part.
 *
 * Public surface pinned here:
 *
 * - `collectRosterAttemptCandidates(perStudentTaskMetrics, rosterStudentIds)` —
 *   roster student ids carrying at least one attempted task, in unspecified
 *   order (consumers must not rely on the returned order).
 * - `isAttemptBaselineEligible(rosterStudentCount, candidateStudentCount)` —
 *   the two availability conditions of the specification's availability rule
 *   as one predicate.
 * - `deriveAttemptBaseline({ classId, rosterStudentIds, perStudentTaskMetrics })` —
 *   the pool + intersection derivation; throws a descriptive error naming the
 *   class when ineligible or when the pool intersection is empty.
 */

import { describe, expect, it } from 'vitest';
import type { PerStudentTaskMetric, TaskDisplayMetric } from '../dataAnalysis.zod';
import {
  collectRosterAttemptCandidates,
  deriveAttemptBaseline,
  isAttemptBaselineEligible,
} from './attemptBaselineSelection';

/** Class id shared by every derivation fixture in this spec. */
const CLASS_ID = 'c_001';

/** Minimum class size for baseline mode. */
const ROSTER_MINIMUM = 3;

/** Roster size below which baseline mode is unavailable (minimum class size). */
const ROSTER_BELOW_MINIMUM = 2;

/** Roster size comfortably above the minimum class size. */
const ROSTER_ABOVE_MINIMUM = 12;

/** Roster size whose ten-percent bound is exactly 2 (0.1 × 20). */
const ROSTER_EXACT_TENTH = 20;

/** Roster size whose ten-percent bound rounds up to 3 (ceil(0.1 × 21)). */
const ROSTER_CEIL_CASE = 21;

/** Roster size whose ten-percent bound is 3 but which supplies fewer candidates. */
const ROSTER_CAP_CASE = 25;

/** Roster size whose ten-percent bound is exactly 3 (0.1 × 30). */
const ROSTER_THREE_MEMBER_POOL = 30;

/** Candidate count below the pool minimum. */
const SINGLE_CANDIDATE_COUNT = 1;

/** Sparse-evidence scenario: many candidates, one distinct attempt each. */
const SPARSE_CANDIDATE_COUNT = 10;

/** Expected candidates in the roster-scoping fixture (two in-roster submitters). */
const ROSTER_CANDIDATE_COUNT = 2;

/** Structural minimum pool size. */
const POOL_MINIMUM = 2;

/** Pool size after the ten-percent bound rounds up. */
const POOL_CEILED_SIZE = 3;

/** One criterion score shared by the computed-display fixtures. */
const SCORE_MID = 4;

/** Definition-scoped task keys used by the derivation fixtures. */
const TASK_KEY_ONE = 'dk_algebra::t_001';
const TASK_KEY_TWO = 'dk_algebra::t_002';
const TASK_KEY_THREE = 'dk_algebra::t_003';

/** The full three-student roster shared by the derivation and failure fixtures. */
const THREE_STUDENT_ROSTER = ['s_001', 's_002', 's_003'];

/** Computed display metric carrying the shared fixture score at full weight. */
const COMPUTED_DISPLAY: TaskDisplayMetric = {
  state: 'computed',
  value: SCORE_MID,
  totalWeight: 1,
  applicableDataPoints: 1,
  totalDataPoints: 1,
};

/** Display metric for a criterion with one numeric score at zero weight. */
const ZERO_WEIGHT_COMPUTED_DISPLAY: TaskDisplayMetric = {
  state: 'computed',
  value: SCORE_MID,
  totalWeight: 0,
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

/** Zero-padded width of the generated roster ids, giving ids such as `s_001`. */
const ROSTER_ID_PAD_WIDTH = 3;

/**
 * Build an ascending roster of student ids.
 *
 * @param {number} rosterSize - Number of roster students.
 * @returns {string[]} Roster ids `s_001` … `s_{rosterSize}`.
 */
function buildRosterIds(rosterSize: number): string[] {
  return Array.from(
    { length: rosterSize },
    (_unused, index) => `s_${String(index + 1).padStart(ROSTER_ID_PAD_WIDTH, '0')}`
  );
}

describe('collectRosterAttemptCandidates (shared attempt predicate)', () => {
  it('counts a numeric criterion score as the attempt signal', () => {
    const candidates = collectRosterAttemptCandidates(
      [createCellMetric('s_001', TASK_KEY_ONE, { completeness: COMPUTED_DISPLAY })],
      ['s_001']
    );

    expect(candidates).toEqual(['s_001']);
  });

  it('excludes all-raw-N evidence and students with no observed metrics', () => {
    const candidates = collectRosterAttemptCandidates(
      [
        createCellMetric('s_001', TASK_KEY_ONE, { completeness: NOT_ATTEMPTED_DISPLAY }),
        createCellMetric('s_002', TASK_KEY_ONE, { accuracy: NOT_ATTEMPTED_DISPLAY }),
      ],
      THREE_STUDENT_ROSTER
    );

    // s_001 and s_002 only ever observed raw N; s_003 has no (student, task)
    // metric at all — absent submission items are not attempts.
    expect(candidates).toEqual([]);
  });

  it('excludes the E-condition projection from candidacy', () => {
    // All-criteria error evidence is the post-accumulation projection of the
    // E condition; the committed corpus carries it as ASSESSMENT_FAILED and
    // SOURCE_UNREADABLE items.
    const candidates = collectRosterAttemptCandidates(
      [
        createCellMetric('s_001', TASK_KEY_ONE),
        createCellMetric('s_002', TASK_KEY_TWO, { spag: ERROR_DISPLAY }),
      ],
      ['s_001', 's_002']
    );

    expect(candidates).toEqual([]);
  });

  it('counts zero-weight numeric evidence as an attempt', () => {
    const candidates = collectRosterAttemptCandidates(
      [createCellMetric('s_001', TASK_KEY_ONE, { completeness: ZERO_WEIGHT_COMPUTED_DISPLAY })],
      ['s_001']
    );

    // Criterion weighting plays no part in the attempt definition.
    expect(candidates).toEqual(['s_001']);
  });

  it('is roster-scoped and returns the roster students with an attempt', () => {
    const metrics = [
      createCellMetric('s_009', TASK_KEY_ONE, { completeness: COMPUTED_DISPLAY }),
      createCellMetric('s_002', TASK_KEY_TWO, { completeness: COMPUTED_DISPLAY }),
      createCellMetric('s_001', TASK_KEY_ONE, { completeness: COMPUTED_DISPLAY }),
    ];

    const candidates = collectRosterAttemptCandidates(metrics, THREE_STUDENT_ROSTER);

    // The candidate order is unspecified by contract (Set insertion order), so
    // compare membership order-insensitively. s_009 submitted work but is
    // outside the roster; s_003 is rostered with no observations.
    expect(candidates).toHaveLength(ROSTER_CANDIDATE_COUNT);
    expect(candidates.toSorted((a, b) => a.localeCompare(b))).toEqual(['s_001', 's_002']);
  });
});

describe('isAttemptBaselineEligible', () => {
  it('returns false when the roster is below three students', () => {
    expect(isAttemptBaselineEligible(ROSTER_BELOW_MINIMUM, POOL_MINIMUM)).toBe(false);
  });

  it('returns false when fewer than two students attempted work', () => {
    expect(isAttemptBaselineEligible(ROSTER_ABOVE_MINIMUM, SINGLE_CANDIDATE_COUNT)).toBe(false);
  });

  it('returns true at both minimums', () => {
    expect(isAttemptBaselineEligible(ROSTER_MINIMUM, POOL_MINIMUM)).toBe(true);
  });
});

describe('deriveAttemptBaseline — pool sizing', () => {
  it('applies the minimum pool size of two below the ten-percent threshold', () => {
    // Roster 3: ceil(0.1 × 3) = 1, raised to the structural minimum of 2.
    // Both candidates attempted TASK_KEY_ONE; the count tie breaks by ascending
    // student id, so the pool stays ['s_001', 's_002'] and the intersection is
    // TASK_KEY_ONE.
    const metrics = [
      createCellMetric('s_001', TASK_KEY_ONE, { completeness: COMPUTED_DISPLAY }),
      createCellMetric('s_002', TASK_KEY_ONE, { completeness: COMPUTED_DISPLAY }),
    ];

    const derivation = deriveAttemptBaseline({
      classId: CLASS_ID,
      rosterStudentIds: THREE_STUDENT_ROSTER,
      perStudentTaskMetrics: metrics,
    });

    expect(derivation.poolStudentIds).toHaveLength(POOL_MINIMUM);
    expect(derivation.poolStudentIds).toEqual(['s_001', 's_002']);
    expect(derivation.baselineTaskKeys).toEqual([TASK_KEY_ONE]);
  });

  it('rounds the ten-percent bound up with ceil', () => {
    // Roster 21: ceil(2.1) = 3 — the bound rounds up before the minimum
    // applies, and four candidates prove the bound (not the cap) limits it.
    // All four candidates attempted TASK_KEY_ONE; s_001 additionally attempted
    // TASK_KEY_TWO, so it ranks first and the three-member pool intersects on
    // TASK_KEY_ONE.
    const roster = buildRosterIds(ROSTER_CEIL_CASE);
    const candidates = roster.slice(0, POOL_CEILED_SIZE + 1);
    const metrics = [
      ...candidates.map((studentId) =>
        createCellMetric(studentId, TASK_KEY_ONE, { completeness: COMPUTED_DISPLAY })
      ),
      createCellMetric(candidates[0], TASK_KEY_TWO, { completeness: COMPUTED_DISPLAY }),
    ];

    const derivation = deriveAttemptBaseline({
      classId: CLASS_ID,
      rosterStudentIds: roster,
      perStudentTaskMetrics: metrics,
    });

    expect(derivation.poolStudentIds).toHaveLength(POOL_CEILED_SIZE);
    expect(derivation.baselineTaskKeys).toEqual([TASK_KEY_ONE]);
  });

  it('keeps the exact-tenth bound unrounded', () => {
    // Roster 20: 0.1 × 20 = 2 exactly — the bound stays 2 despite three candidates.
    const roster = buildRosterIds(ROSTER_EXACT_TENTH);
    const metrics = roster.slice(0, POOL_CEILED_SIZE).map((studentId) => {
      return createCellMetric(studentId, TASK_KEY_ONE, {
        completeness: COMPUTED_DISPLAY,
      });
    });

    const derivation = deriveAttemptBaseline({
      classId: CLASS_ID,
      rosterStudentIds: roster,
      perStudentTaskMetrics: metrics,
    });

    expect(derivation.poolStudentIds).toHaveLength(POOL_MINIMUM);
  });

  it('caps the pool at the candidate count', () => {
    // Roster 25: ceil(2.5) = 3, but only two candidates exist. Both attempted
    // TASK_KEY_ONE, so the capped two-member pool intersects on TASK_KEY_ONE.
    const roster = buildRosterIds(ROSTER_CAP_CASE);
    const metrics = [
      createCellMetric('s_001', TASK_KEY_ONE, { completeness: COMPUTED_DISPLAY }),
      createCellMetric('s_002', TASK_KEY_ONE, { completeness: COMPUTED_DISPLAY }),
    ];

    const derivation = deriveAttemptBaseline({
      classId: CLASS_ID,
      rosterStudentIds: roster,
      perStudentTaskMetrics: metrics,
    });

    expect(derivation.poolStudentIds).toEqual(['s_001', 's_002']);
    expect(derivation.baselineTaskKeys).toEqual([TASK_KEY_ONE]);
  });
});

describe('deriveAttemptBaseline — ranking and intersection', () => {
  it('ranks by distinct attempted taskKey count and breaks ties by studentId ascending', () => {
    // s_001 attempted three distinct keys (TASK_KEY_ONE observed twice through
    // a shared taskKey — counted once); s_002 and s_003 tie at two; s_004 has
    // one. The pool takes the top two, breaking the tie by student id.
    const metrics = [
      createCellMetric('s_001', TASK_KEY_ONE, { completeness: COMPUTED_DISPLAY }),
      createCellMetric('s_001', TASK_KEY_TWO, { completeness: COMPUTED_DISPLAY }),
      createCellMetric('s_001', TASK_KEY_THREE, { completeness: COMPUTED_DISPLAY }),
      createCellMetric('s_001', TASK_KEY_ONE, { accuracy: COMPUTED_DISPLAY }),
      createCellMetric('s_002', TASK_KEY_ONE, { completeness: COMPUTED_DISPLAY }),
      createCellMetric('s_002', TASK_KEY_TWO, { completeness: COMPUTED_DISPLAY }),
      createCellMetric('s_003', TASK_KEY_TWO, { completeness: COMPUTED_DISPLAY }),
      createCellMetric('s_003', TASK_KEY_THREE, { completeness: COMPUTED_DISPLAY }),
      createCellMetric('s_004', TASK_KEY_ONE, { completeness: COMPUTED_DISPLAY }),
    ];

    const derivation = deriveAttemptBaseline({
      classId: CLASS_ID,
      rosterStudentIds: ['s_001', 's_002', 's_003', 's_004'],
      perStudentTaskMetrics: metrics,
    });

    // Pool membership and array order: s_001 leads on count; s_002 displaces
    // s_003 through the ascending student-id tie-break.
    expect(derivation.poolStudentIds).toEqual(['s_001', 's_002']);
    expect(derivation.baselineTaskKeys).toEqual([TASK_KEY_ONE, TASK_KEY_TWO]);
  });

  it('intersects the attempt sets of every pool member', () => {
    // Roster 30 gives a three-member pool. TASK_KEY_ONE and TASK_KEY_THREE
    // are attempted by all three; TASK_KEY_TWO by two — a majority. A majority
    // rule would admit it, but the baseline requires every member, so it stays outside.
    const metrics = [
      createCellMetric('s_001', TASK_KEY_ONE, { completeness: COMPUTED_DISPLAY }),
      createCellMetric('s_001', TASK_KEY_TWO, { completeness: COMPUTED_DISPLAY }),
      createCellMetric('s_001', TASK_KEY_THREE, { completeness: COMPUTED_DISPLAY }),
      createCellMetric('s_002', TASK_KEY_ONE, { completeness: COMPUTED_DISPLAY }),
      createCellMetric('s_002', TASK_KEY_TWO, { completeness: COMPUTED_DISPLAY }),
      createCellMetric('s_002', TASK_KEY_THREE, { completeness: COMPUTED_DISPLAY }),
      createCellMetric('s_003', TASK_KEY_ONE, { completeness: COMPUTED_DISPLAY }),
      createCellMetric('s_003', TASK_KEY_THREE, { completeness: COMPUTED_DISPLAY }),
    ];

    const derivation = deriveAttemptBaseline({
      classId: CLASS_ID,
      rosterStudentIds: buildRosterIds(ROSTER_THREE_MEMBER_POOL),
      perStudentTaskMetrics: metrics,
    });

    expect(derivation.poolStudentIds).toEqual(['s_001', 's_002', 's_003']);
    expect(derivation.baselineTaskKeys).toEqual([TASK_KEY_ONE, TASK_KEY_THREE]);
  });
});

describe('deriveAttemptBaseline — failures', () => {
  it('throws when fewer than two students attempted work', () => {
    const metrics = [createCellMetric('s_001', TASK_KEY_ONE, { completeness: COMPUTED_DISPLAY })];

    expect(() => {
      return deriveAttemptBaseline({
        classId: CLASS_ID,
        rosterStudentIds: THREE_STUDENT_ROSTER,
        perStudentTaskMetrics: metrics,
      });
    }).toThrow(/c_001/);
  });

  it('throws when the roster is below three students', () => {
    const metrics = [
      createCellMetric('s_001', TASK_KEY_ONE, { completeness: COMPUTED_DISPLAY }),
      createCellMetric('s_002', TASK_KEY_TWO, { completeness: COMPUTED_DISPLAY }),
    ];

    expect(() => {
      return deriveAttemptBaseline({
        classId: CLASS_ID,
        rosterStudentIds: ['s_001', 's_002'],
        perStudentTaskMetrics: metrics,
      });
    }).toThrow(/c_001/);
  });

  it('throws when the pool attempt sets are disjoint', () => {
    // Both pool candidates attempted work, but never the same task: any empty
    // pool intersection throws, naming the class. s_003 also attempted
    // TASK_KEY_ONE, but the intersection runs over pool members only.
    const metrics = [
      createCellMetric('s_001', TASK_KEY_ONE, { completeness: COMPUTED_DISPLAY }),
      createCellMetric('s_002', TASK_KEY_TWO, { completeness: COMPUTED_DISPLAY }),
      createCellMetric('s_003', TASK_KEY_ONE, { completeness: COMPUTED_DISPLAY }),
    ];

    expect(() => {
      return deriveAttemptBaseline({
        classId: CLASS_ID,
        rosterStudentIds: THREE_STUDENT_ROSTER,
        perStudentTaskMetrics: metrics,
      });
    }).toThrow(/c_001/);
  });

  it('throws when a newly assessed class has sparse shared evidence', () => {
    // Ten candidates exist, but each attempted a single different task, so the
    // top two by student id share no usable evidence: any empty pool
    // intersection throws, naming the class.
    const roster = buildRosterIds(SPARSE_CANDIDATE_COUNT);
    const metrics = roster.map((studentId, index) => {
      return createCellMetric(studentId, `dk_sparse::task-${index}`, {
        completeness: COMPUTED_DISPLAY,
      });
    });

    expect(() => {
      return deriveAttemptBaseline({
        classId: CLASS_ID,
        rosterStudentIds: roster,
        perStudentTaskMetrics: metrics,
      });
    }).toThrow(/c_001/);
  });
});
