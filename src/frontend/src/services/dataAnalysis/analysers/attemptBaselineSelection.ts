import type { AveragingResult, PerStudentTaskMetric } from '../dataAnalysis.zod';

/**
 * Ten-percent pool fraction (data-shape item 3).
 */
const BASELINE_POOL_FRACTION = 0.1;

/**
 * Minimum baseline pool size (data-shape item 3).
 */
const BASELINE_POOL_MINIMUM = 2;

/**
 * Minimum roster size for attempt-baseline eligibility (data-shape item 3).
 */
export const BASELINE_ROSTER_MINIMUM = 3;

/** Derivation output: the pool members and the baseline task set. */
interface AttemptBaselineDerivation {
  poolStudentIds: string[];
  baselineTaskKeys: string[];
}

/** Derivation input for one class. */
interface AttemptBaselineDerivationInput {
  classId: string;
  rosterStudentIds: ReadonlyArray<string>;
  perStudentTaskMetrics: ReadonlyArray<PerStudentTaskMetric>;
}

/**
 * The shared attempt predicate (data-shape item 3): whether one per-(student, task)
 * metric is an attempt — at least one criterion assessment carries a numeric
 * score, which the display projection records as a computed criterion.
 * All-raw-`N` items, all-error (`E`) items and absent items are not attempts,
 * and criterion weighting plays no part.
 *
 * @param {PerStudentTaskMetric} metric - The per-(student, task) metric.
 * @returns {boolean} True when the metric is an attempt.
 */
export function isAttemptMetric(metric: PerStudentTaskMetric): boolean {
  return (
    metric.completeness.state === 'computed' ||
    metric.accuracy.state === 'computed' ||
    metric.spag.state === 'computed'
  );
}

/**
 * Collect the roster's attempt candidates (data-shape item 3): roster student ids
 * carrying at least one attempted task, ascending by student id. Roster-scoped:
 * metrics for students outside the roster never become candidates.
 *
 * @param {ReadonlyArray<PerStudentTaskMetric>} perStudentTaskMetrics - Mode-invariant
 *   per-(student, task) metrics projected via `buildPerStudentTaskMetrics`.
 * @param {ReadonlyArray<string>} rosterStudentIds - The class roster's student ids.
 * @returns {string[]} Roster student ids with at least one attempted task, ascending.
 */
export function collectRosterAttemptCandidates(
  perStudentTaskMetrics: ReadonlyArray<PerStudentTaskMetric>,
  rosterStudentIds: ReadonlyArray<string>
): string[] {
  const rosterIds = new Set(rosterStudentIds);
  const candidates = new Set<string>();
  for (const metric of perStudentTaskMetrics) {
    if (!rosterIds.has(metric.studentId) || !isAttemptMetric(metric)) continue;
    candidates.add(metric.studentId);
  }
  return [...candidates].toSorted((a, b) => a.localeCompare(b));
}

/**
 * The two availability conditions of the attempt-baseline availability rule
 * (data-shape item 3) as one predicate: at least 3 students in the class and at
 * least 2 students attempted at least one in-scope task.
 *
 * @param {number} rosterStudentCount - The class roster's size.
 * @param {number} candidateStudentCount - Students with at least one attempt.
 * @returns {boolean} True when attempt-baseline mode is available.
 */
export function isAttemptBaselineEligible(
  rosterStudentCount: number,
  candidateStudentCount: number
): boolean {
  return (
    rosterStudentCount >= BASELINE_ROSTER_MINIMUM && candidateStudentCount >= BASELINE_POOL_MINIMUM
  );
}

/**
 * Collect each student's distinct attempted task keys (data-shape item 3).
 *
 * @param {ReadonlyArray<PerStudentTaskMetric>} perStudentTaskMetrics - The
 *   per-(student, task) metrics.
 * @returns {Map<string, Set<string>>} Attempted task keys per student id.
 */
function collectAttemptedTaskKeysByStudent(
  perStudentTaskMetrics: ReadonlyArray<PerStudentTaskMetric>
): Map<string, Set<string>> {
  const attemptedTaskKeysByStudent = new Map<string, Set<string>>();
  for (const metric of perStudentTaskMetrics) {
    if (!isAttemptMetric(metric)) continue;
    let attemptedTaskKeys = attemptedTaskKeysByStudent.get(metric.studentId);
    if (!attemptedTaskKeys) {
      attemptedTaskKeys = new Set<string>();
      attemptedTaskKeysByStudent.set(metric.studentId, attemptedTaskKeys);
    }
    attemptedTaskKeys.add(metric.taskKey);
  }
  return attemptedTaskKeysByStudent;
}

/**
 * Fetch one student's attempted task keys, failing fast on a missing entry.
 *
 * @remarks
 * Every candidate id comes from {@link collectRosterAttemptCandidates}, so the
 * map built by {@link collectAttemptedTaskKeysByStudent} holds an entry for
 * each of them; a miss is an invariant violation and must throw rather than
 * silently rank or intersect against an empty attempt set.
 *
 * @param {string} studentId - The student whose attempt set to fetch.
 * @param {ReadonlyMap<string, Set<string>>} attemptedTaskKeysByStudent - Attempted keys per student.
 * @returns {ReadonlySet<string>} The student's attempted task keys.
 * @throws {Error} When the student has no entry in the map.
 */
function requireAttemptedTaskKeys(
  studentId: string,
  attemptedTaskKeysByStudent: ReadonlyMap<string, Set<string>>
): ReadonlySet<string> {
  const attemptedTaskKeys = attemptedTaskKeysByStudent.get(studentId);
  if (!attemptedTaskKeys) {
    throw new Error(`deriveAttemptBaseline: student '${studentId}' has no attempted task keys`);
  }
  return attemptedTaskKeys;
}

/**
 * Rank candidates by distinct attempted task-key count (descending), breaking
 * ties by ascending student id (data-shape item 3).
 *
 * @param {ReadonlyArray<string>} candidates - Candidate student ids.
 * @param {ReadonlyMap<string, Set<string>>} attemptedTaskKeysByStudent - Attempted keys per student.
 * @returns {string[]} Ranked candidates.
 */
function rankCandidates(
  candidates: ReadonlyArray<string>,
  attemptedTaskKeysByStudent: ReadonlyMap<string, Set<string>>
): string[] {
  return candidates.toSorted((a, b) => {
    const countDifference =
      requireAttemptedTaskKeys(b, attemptedTaskKeysByStudent).size -
      requireAttemptedTaskKeys(a, attemptedTaskKeysByStudent).size;
    if (countDifference !== 0) return countDifference;
    return a.localeCompare(b);
  });
}

/**
 * Intersect the attempt sets of every pool member (data-shape item 3): a task key is
 * in the baseline set when every pool member attempted it.
 *
 * @param {ReadonlyArray<string>} poolStudentIds - The pool's student ids.
 * @param {ReadonlyMap<string, Set<string>>} attemptedTaskKeysByStudent - Attempted keys per student.
 * @returns {string[]} The intersection, ascending.
 */
function intersectAttemptSets(
  poolStudentIds: ReadonlyArray<string>,
  attemptedTaskKeysByStudent: ReadonlyMap<string, Set<string>>
): string[] {
  const sharedTaskKeys = new Set(
    requireAttemptedTaskKeys(poolStudentIds[0], attemptedTaskKeysByStudent)
  );
  for (const studentId of poolStudentIds) {
    const attemptedTaskKeys = requireAttemptedTaskKeys(studentId, attemptedTaskKeysByStudent);
    for (const taskKey of sharedTaskKeys) {
      if (!attemptedTaskKeys.has(taskKey)) sharedTaskKeys.delete(taskKey);
    }
  }
  return [...sharedTaskKeys].toSorted((a, b) => a.localeCompare(b));
}

/**
 * Whether an empty pool intersection fails at the derivation level.
 *
 * @remarks
 * When the ten-percent bound truncates the pool to the structural minimum
 * while unused candidates remain, an empty intersection means the top-engaged
 * students share no usable evidence and the derivation fails fast. Otherwise
 * (the pool exhausts the candidates, or sits above the structural minimum)
 * the empty intersection is returned and the averaging analyser surfaces the
 * decision-11 descriptive failure naming the class, which protects the
 * baseline schema's non-empty task-key bound before any result is produced.
 *
 * @param {number} poolSize - The derived pool's size.
 * @param {number} candidateCount - The class's candidate count.
 * @returns {boolean} True when the derivation itself must fail.
 */
function isEmptyIntersectionFailure(poolSize: number, candidateCount: number): boolean {
  return poolSize === BASELINE_POOL_MINIMUM && candidateCount > BASELINE_POOL_MINIMUM;
}

/**
 * Derive one class's attempt-baseline pool and baseline task set
 * (decisions 3–5): the pool is the top
 * `min(|candidates|, max(2, ceil(0.1 × roster size)))` candidates ranked by
 * distinct attempted task keys (ties by ascending student id), and the
 * baseline is the intersection of the pool's attempt sets.
 *
 * @param {AttemptBaselineDerivationInput} input - The class id, roster and
 *   per-(student, task) metrics.
 * @returns {AttemptBaselineDerivation} The pool and the baseline task set.
 * @throws {Error} When the class is ineligible (fewer than 2 candidates or
 *   fewer than 3 roster students), or when a pool truncated to the structural
 *   minimum by the ten-percent bound shares no task key despite unused
 *   candidates remaining. Any other empty intersection is returned to the
 *   averaging analyser, which raises the decision-11 descriptive failure
 *   naming the class before any result is produced.
 */
export function deriveAttemptBaseline(
  input: AttemptBaselineDerivationInput
): AttemptBaselineDerivation {
  const candidates = collectRosterAttemptCandidates(
    input.perStudentTaskMetrics,
    input.rosterStudentIds
  );
  if (!isAttemptBaselineEligible(input.rosterStudentIds.length, candidates.length)) {
    throw new Error(
      `deriveAttemptBaseline: class '${input.classId}' is not eligible for attempt-baseline mode: roster size ${input.rosterStudentIds.length} (minimum ${BASELINE_ROSTER_MINIMUM}), students with at least one attempted task ${candidates.length} (minimum ${BASELINE_POOL_MINIMUM})`
    );
  }

  const attemptedTaskKeysByStudent = collectAttemptedTaskKeysByStudent(input.perStudentTaskMetrics);
  const poolSize = Math.min(
    candidates.length,
    Math.max(
      BASELINE_POOL_MINIMUM,
      Math.ceil(BASELINE_POOL_FRACTION * input.rosterStudentIds.length)
    )
  );
  const poolStudentIds = rankCandidates(candidates, attemptedTaskKeysByStudent).slice(0, poolSize);

  const baselineTaskKeys = intersectAttemptSets(poolStudentIds, attemptedTaskKeysByStudent);
  if (
    baselineTaskKeys.length === 0 &&
    isEmptyIntersectionFailure(poolStudentIds.length, candidates.length)
  ) {
    throw new Error(
      `deriveAttemptBaseline: class '${input.classId}' derived an empty attempt baseline: the ${poolStudentIds.length} pooled students attempted no task key in common`
    );
  }
  return { poolStudentIds, baselineTaskKeys };
}

/**
 * Derive the baseline task-key set from a mode-bearing analyser result.
 *
 * @param {AveragingResult} analyserResult - The analysis result carrying the
 *   applied-mode echo and, in baseline mode, the attemptBaseline block.
 * @param {string} context - The caller's function name, prefixed onto thrown
 *   error messages (for example `adaptMetricsToHeatmap`).
 * @returns {ReadonlySet<string> | null} The baseline task-key set in baseline
 *   mode, or `null` in absolute mode (nothing is baseline-restricted).
 * @throws {Error} When the result is missing the required
 *   `appliedAnalysisMode` echo, or when a baseline-mode result omits its
 *   required `attemptBaseline` block.
 *
 * @remarks
 * The `appliedAnalysisMode` echo is the single source of truth for whether a
 * result is baseline-mode (data-shape item 6 in
 * docs/developer/data-shapes/frontend-data-analysis-response.md §
 * Attempt-baseline contract changes). The narrowing
 * is fail-fast: a baseline-mode result without the block is an invariant
 * violation, and an `attemptBaseline?.baselineTaskKeys ?? []` fallback is
 * forbidden because it would silently treat every task as outside the
 * baseline.
 */
export function deriveBaselineTaskKeySet(
  analyserResult: AveragingResult,
  context: string
): ReadonlySet<string> | null {
  const { appliedAnalysisMode } = analyserResult;
  if (appliedAnalysisMode !== 'absolute' && appliedAnalysisMode !== 'topDecileBaseline') {
    throw new Error(
      `${context}: analyser result for class '${analyserResult.classId}' is missing the required appliedAnalysisMode echo`
    );
  }
  if (appliedAnalysisMode !== 'topDecileBaseline') {
    return null;
  }
  const attemptBaseline = analyserResult.attemptBaseline;
  if (!attemptBaseline) {
    throw new Error(
      `${context}: baseline-mode analyser result for class '${analyserResult.classId}' is missing the required attemptBaseline block`
    );
  }
  return new Set(attemptBaseline.baselineTaskKeys);
}
