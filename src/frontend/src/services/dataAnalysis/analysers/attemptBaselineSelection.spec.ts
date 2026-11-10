/**
 * Red-first contract for the planned attempt-baseline selection module
 * (`attemptBaselineSelection.ts`): the shared attempt predicate, the baseline
 * eligibility predicate, and the post-accumulation pool + intersection
 * derivation consumed by the averaging analyser.
 *
 * Attempt semantics (attempt-baseline specification decision 3): a
 * (student, task) observation is an attempt when at least one criterion
 * assessment carries a numeric score. All-raw-`N` items, all-error (`E`) items
 * and absent items are not attempts, and criterion weighting plays no part.
 *
 * The module does not exist yet, so this spec loads it dynamically through a
 * computed specifier: the import rejection is the intended red phase, and the
 * computed specifier keeps the type-check gate green until the module lands.
 * The planned public surface pinned here:
 *
 * - `collectRosterAttemptCandidates(perStudentTaskMetrics, rosterStudentIds)` —
 *   the shared attempt predicate: roster student ids carrying at least one
 *   attempted task, ascending by student id.
 * - `isAttemptBaselineEligible(rosterStudentCount, candidateStudentCount)` —
 *   the two availability conditions of the specification's availability rule
 *   as one predicate.
 * - `deriveAttemptBaseline({ classId, rosterStudentIds, perStudentTaskMetrics })` —
 *   the pool + intersection derivation; throws a descriptive error naming the
 *   class when ineligible or when the pool intersection is empty.
 */

import { describe, expect, it } from 'vitest';
import type { PerStudentTaskMetric, TaskDisplayMetric } from '../dataAnalysis.zod';

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

/** The planned module surface this spec pins (see the file header). */
interface AttemptBaselineSelectionModule {
  collectRosterAttemptCandidates(
    perStudentTaskMetrics: ReadonlyArray<PerStudentTaskMetric>,
    rosterStudentIds: ReadonlyArray<string>
  ): string[];
  isAttemptBaselineEligible(rosterStudentCount: number, candidateStudentCount: number): boolean;
  deriveAttemptBaseline(input: {
    classId: string;
    rosterStudentIds: ReadonlyArray<string>;
    perStudentTaskMetrics: ReadonlyArray<PerStudentTaskMetric>;
  }): { poolStudentIds: string[]; baselineTaskKeys: string[] };
}

/** Computed module specifier: keeps the type-check gate green while the module is missing. */
const SELECTION_MODULE_SPECIFIER = './attemptBaselineSelection';

/**
 * Load the module under test dynamically.
 *
 * While the module does not exist yet, every test fails on this import — the
 * intended red phase. The computed specifier keeps the static type-check gate
 * green because TypeScript cannot resolve a non-literal import path.
 *
 * @returns {Promise<AttemptBaselineSelectionModule>} The loaded selection module.
 */
async function loadSelectionModule(): Promise<AttemptBaselineSelectionModule> {
  return (await import(SELECTION_MODULE_SPECIFIER)) as AttemptBaselineSelectionModule;
}

describe('collectRosterAttemptCandidates (shared attempt predicate)', () => {
  it('counts a numeric criterion score as the attempt signal', async () => {
    const selection = await loadSelectionModule();
    const candidates = selection.collectRosterAttemptCandidates(
      [createCellMetric('s_001', TASK_KEY_ONE, { completeness: COMPUTED_DISPLAY })],
      ['s_001']
    );

    expect(candidates).toEqual(['s_001']);
  });

  it('excludes all-raw-N evidence and students with no observed metrics', async () => {
    const selection = await loadSelectionModule();
    const candidates = selection.collectRosterAttemptCandidates(
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

  it('excludes the E-condition projection from candidacy', async () => {
    const selection = await loadSelectionModule();
    // All-criteria error evidence is the post-accumulation projection of the
    // E condition; the committed corpus carries it as ASSESSMENT_FAILED and
    // SOURCE_UNREADABLE items.
    const candidates = selection.collectRosterAttemptCandidates(
      [
        createCellMetric('s_001', TASK_KEY_ONE),
        createCellMetric('s_002', TASK_KEY_TWO, { spag: ERROR_DISPLAY }),
      ],
      ['s_001', 's_002']
    );

    expect(candidates).toEqual([]);
  });

  it('counts zero-weight numeric evidence as an attempt', async () => {
    const selection = await loadSelectionModule();
    const candidates = selection.collectRosterAttemptCandidates(
      [createCellMetric('s_001', TASK_KEY_ONE, { completeness: ZERO_WEIGHT_COMPUTED_DISPLAY })],
      ['s_001']
    );

    // Criterion weighting plays no part in the attempt definition.
    expect(candidates).toEqual(['s_001']);
  });

  it('is roster-scoped and returns candidates in ascending studentId order', async () => {
    const selection = await loadSelectionModule();
    const metrics = [
      createCellMetric('s_009', TASK_KEY_ONE, { completeness: COMPUTED_DISPLAY }),
      createCellMetric('s_002', TASK_KEY_TWO, { completeness: COMPUTED_DISPLAY }),
      createCellMetric('s_001', TASK_KEY_ONE, { completeness: COMPUTED_DISPLAY }),
    ];

    const candidates = selection.collectRosterAttemptCandidates(metrics, THREE_STUDENT_ROSTER);

    // s_009 submitted work but is outside the roster; s_003 is rostered with
    // no observations.
    expect(candidates).toEqual(['s_001', 's_002']);
  });
});

describe('isAttemptBaselineEligible', () => {
  it('returns false when the roster is below three students', async () => {
    const selection = await loadSelectionModule();
    expect(selection.isAttemptBaselineEligible(ROSTER_BELOW_MINIMUM, POOL_MINIMUM)).toBe(false);
  });

  it('returns false when fewer than two students attempted work', async () => {
    const selection = await loadSelectionModule();
    expect(selection.isAttemptBaselineEligible(ROSTER_ABOVE_MINIMUM, SINGLE_CANDIDATE_COUNT)).toBe(
      false
    );
  });

  it('returns true at both minimums', async () => {
    const selection = await loadSelectionModule();
    expect(selection.isAttemptBaselineEligible(ROSTER_MINIMUM, POOL_MINIMUM)).toBe(true);
  });
});

describe('deriveAttemptBaseline — pool sizing', () => {
  it('applies the minimum pool size of two below the ten-percent threshold', async () => {
    const selection = await loadSelectionModule();
    // Roster 3: ceil(0.1 × 3) = 1, raised to the structural minimum of 2.
    const metrics = [
      createCellMetric('s_001', TASK_KEY_ONE, { completeness: COMPUTED_DISPLAY }),
      createCellMetric('s_002', TASK_KEY_TWO, { completeness: COMPUTED_DISPLAY }),
    ];

    const derivation = selection.deriveAttemptBaseline({
      classId: CLASS_ID,
      rosterStudentIds: THREE_STUDENT_ROSTER,
      perStudentTaskMetrics: metrics,
    });

    expect(derivation.poolStudentIds).toHaveLength(POOL_MINIMUM);
    expect(derivation.poolStudentIds).toEqual(['s_001', 's_002']);
  });

  it('rounds the ten-percent bound up with ceil', async () => {
    const selection = await loadSelectionModule();
    // Roster 21: ceil(2.1) = 3 — the bound rounds up before the minimum
    // applies, and four candidates prove the bound (not the cap) limits it.
    const roster = buildRosterIds(ROSTER_CEIL_CASE);
    const metrics = roster.slice(0, POOL_CEILED_SIZE + 1).map((studentId, index) => {
      return createCellMetric(studentId, index === 0 ? TASK_KEY_ONE : TASK_KEY_TWO, {
        completeness: COMPUTED_DISPLAY,
      });
    });

    const derivation = selection.deriveAttemptBaseline({
      classId: CLASS_ID,
      rosterStudentIds: roster,
      perStudentTaskMetrics: metrics,
    });

    expect(derivation.poolStudentIds).toHaveLength(POOL_CEILED_SIZE);
  });

  it('keeps the exact-tenth bound unrounded', async () => {
    const selection = await loadSelectionModule();
    // Roster 20: 0.1 × 20 = 2 exactly — the bound stays 2 despite three candidates.
    const roster = buildRosterIds(ROSTER_EXACT_TENTH);
    const metrics = roster.slice(0, POOL_CEILED_SIZE).map((studentId) => {
      return createCellMetric(studentId, TASK_KEY_ONE, {
        completeness: COMPUTED_DISPLAY,
      });
    });

    const derivation = selection.deriveAttemptBaseline({
      classId: CLASS_ID,
      rosterStudentIds: roster,
      perStudentTaskMetrics: metrics,
    });

    expect(derivation.poolStudentIds).toHaveLength(POOL_MINIMUM);
  });

  it('caps the pool at the candidate count', async () => {
    const selection = await loadSelectionModule();
    // Roster 25: ceil(2.5) = 3, but only two candidates exist.
    const roster = buildRosterIds(ROSTER_CAP_CASE);
    const metrics = [
      createCellMetric('s_001', TASK_KEY_ONE, { completeness: COMPUTED_DISPLAY }),
      createCellMetric('s_002', TASK_KEY_TWO, { completeness: COMPUTED_DISPLAY }),
    ];

    const derivation = selection.deriveAttemptBaseline({
      classId: CLASS_ID,
      rosterStudentIds: roster,
      perStudentTaskMetrics: metrics,
    });

    expect(derivation.poolStudentIds).toEqual(['s_001', 's_002']);
  });
});

describe('deriveAttemptBaseline — ranking and intersection', () => {
  it('ranks by distinct attempted taskKey count and breaks ties by studentId ascending', async () => {
    const selection = await loadSelectionModule();
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

    const derivation = selection.deriveAttemptBaseline({
      classId: CLASS_ID,
      rosterStudentIds: ['s_001', 's_002', 's_003', 's_004'],
      perStudentTaskMetrics: metrics,
    });

    // Pool membership and array order: s_001 leads on count; s_002 displaces
    // s_003 through the ascending student-id tie-break.
    expect(derivation.poolStudentIds).toEqual(['s_001', 's_002']);
    expect(derivation.baselineTaskKeys).toEqual([TASK_KEY_ONE, TASK_KEY_TWO]);
  });

  it('intersects the attempt sets of every pool member', async () => {
    const selection = await loadSelectionModule();
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

    const derivation = selection.deriveAttemptBaseline({
      classId: CLASS_ID,
      rosterStudentIds: buildRosterIds(ROSTER_THREE_MEMBER_POOL),
      perStudentTaskMetrics: metrics,
    });

    expect(derivation.poolStudentIds).toEqual(['s_001', 's_002', 's_003']);
    expect(derivation.baselineTaskKeys).toEqual([TASK_KEY_ONE, TASK_KEY_THREE]);
  });
});

describe('deriveAttemptBaseline — failures', () => {
  it('throws when fewer than two students attempted work', async () => {
    const selection = await loadSelectionModule();
    const metrics = [createCellMetric('s_001', TASK_KEY_ONE, { completeness: COMPUTED_DISPLAY })];

    expect(() => {
      return selection.deriveAttemptBaseline({
        classId: CLASS_ID,
        rosterStudentIds: THREE_STUDENT_ROSTER,
        perStudentTaskMetrics: metrics,
      });
    }).toThrow(/c_001/);
  });

  it('throws when the roster is below three students', async () => {
    const selection = await loadSelectionModule();
    const metrics = [
      createCellMetric('s_001', TASK_KEY_ONE, { completeness: COMPUTED_DISPLAY }),
      createCellMetric('s_002', TASK_KEY_TWO, { completeness: COMPUTED_DISPLAY }),
    ];

    expect(() => {
      return selection.deriveAttemptBaseline({
        classId: CLASS_ID,
        rosterStudentIds: ['s_001', 's_002'],
        perStudentTaskMetrics: metrics,
      });
    }).toThrow(/c_001/);
  });

  it('throws when the pool attempt sets are disjoint', async () => {
    const selection = await loadSelectionModule();
    // Ordinary trigger (a): both pool candidates attempted work, but never the
    // same task. s_003 also attempted TASK_KEY_ONE, but the intersection runs
    // over pool members only.
    const metrics = [
      createCellMetric('s_001', TASK_KEY_ONE, { completeness: COMPUTED_DISPLAY }),
      createCellMetric('s_002', TASK_KEY_TWO, { completeness: COMPUTED_DISPLAY }),
      createCellMetric('s_003', TASK_KEY_ONE, { completeness: COMPUTED_DISPLAY }),
    ];

    expect(() => {
      return selection.deriveAttemptBaseline({
        classId: CLASS_ID,
        rosterStudentIds: THREE_STUDENT_ROSTER,
        perStudentTaskMetrics: metrics,
      });
    }).toThrow(/c_001/);
  });

  it('throws when a newly assessed class has sparse shared evidence', async () => {
    const selection = await loadSelectionModule();
    // Ordinary trigger (b): ten candidates exist, but each attempted a single
    // different task, so the top two by student id share no usable evidence.
    const roster = buildRosterIds(SPARSE_CANDIDATE_COUNT);
    const metrics = roster.map((studentId, index) => {
      return createCellMetric(studentId, `dk_sparse::task-${index}`, {
        completeness: COMPUTED_DISPLAY,
      });
    });

    expect(() => {
      return selection.deriveAttemptBaseline({
        classId: CLASS_ID,
        rosterStudentIds: roster,
        perStudentTaskMetrics: metrics,
      });
    }).toThrow(/c_001/);
  });
});
