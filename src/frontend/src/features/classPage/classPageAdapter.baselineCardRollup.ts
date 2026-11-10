/**
 * Baseline-mode card-rollup rule for the Class page adapter.
 *
 * @remarks
 * Owns the recent-assignment card half of the attempt-baseline display rules
 * (SPEC decision 8; data-shape item 6): deriving the baseline task-key set
 * from the analyser result's own mode echo (fail-fast narrowing), and rolling
 * up a card's three criterion metrics from baseline-restricted per-task rows
 * with the empty-set `excluded` fallback conversion. Extracted from
 * `classPageAdapter.ts` so the adapter's orchestration and this rule each own
 * one responsibility.
 *
 * The student-averages half needs no rule here: the analyser's per-student
 * rows are already baseline-filtered, so the adapter passes them through.
 *
 * @see docs/plans/issue-305/SPEC.md — decision 8
 * @see docs/developer/data-shapes/frontend-data-analysis-response.md — item 6
 */

import { rollupMetric } from '@/services/dataAnalysis/analysers/rollupMetric';
import { buildTaskKey } from '@/services/dataAnalysis/taskKey';
import type {
  AveragingResult,
  MetricResult,
  PerTaskRow,
} from '@/services/dataAnalysis/dataAnalysis.zod';

/**
 * Derive the card-rollup baseline task-key set from the mode-bearing analyser
 * result.
 *
 * @param {AveragingResult} analyserResult - The analysis result carrying the
 *   applied-mode echo and, in baseline mode, the attemptBaseline block.
 * @returns {ReadonlySet<string> | null} The baseline task-key set in baseline
 *   mode, or `null` in absolute mode (every row rolled up).
 * @throws {Error} When the result is missing the required
 *   `appliedAnalysisMode` echo, or when a baseline-mode result omits its
 *   required `attemptBaseline` block.
 *
 * @remarks
 * The adapter stays a pure function of `analyserResult` and reads the
 * `appliedAnalysisMode` echo as the single source of truth (data-shape item 6;
 * SPEC decision 8). The narrowing is fail-fast: a baseline-mode result without
 * the block is an invariant violation, and an
 * `attemptBaseline?.baselineTaskKeys ?? []` fallback is forbidden because it
 * would silently exclude every task from the card rollups.
 */
export function deriveCardBaselineSet(analyserResult: AveragingResult): ReadonlySet<string> | null {
  const { appliedAnalysisMode } = analyserResult;
  if (appliedAnalysisMode !== 'absolute' && appliedAnalysisMode !== 'topDecileBaseline') {
    throw new Error(
      `adaptClassPageToViewModel: analyser result for class '${analyserResult.classId}' is missing the required appliedAnalysisMode echo`
    );
  }
  if (appliedAnalysisMode !== 'topDecileBaseline') {
    return null;
  }
  const attemptBaseline = analyserResult.attemptBaseline;
  if (!attemptBaseline) {
    throw new Error(
      `adaptClassPageToViewModel: baseline-mode analyser result for class '${analyserResult.classId}' is missing the required attemptBaseline block`
    );
  }
  return new Set(attemptBaseline.baselineTaskKeys);
}

/**
 * Convert a rolled-up criterion metric to the aggregate-only `excluded` state,
 * preserving the resolved observed `totalDataPoints`.
 *
 * @remarks
 * Used only by the baseline-mode empty-filtered-set fallback (SPEC decision 8;
 * data-shape item 6). `computed` and `notAttempted` rollups convert to the
 * `ExcludedMetricSchema` literals; an already-`excluded` zero-weight rollup is
 * left untouched so its weighting cause survives, and a zero-evidence `error`
 * rollup stays `error` (no `excluded` is synthesised without observed
 * evidence).
 *
 * @param {MetricResult} metric - The rolled-up criterion metric.
 * @returns {MetricResult} The converted (or untouched) metric.
 */
function toExcludedPreservingDataPoints(metric: MetricResult): MetricResult {
  if (metric.state !== 'computed' && metric.state !== 'notAttempted') {
    return metric;
  }
  return {
    state: 'excluded',
    value: null,
    totalWeight: 0,
    applicableDataPoints: 0,
    totalDataPoints: metric.totalDataPoints,
  };
}

/** The three card criteria rolled up from per-task rows. */
interface CardCriterionRollups {
  completeness: MetricResult;
  accuracy: MetricResult;
  spag: MetricResult;
}

/**
 * Roll up one criterion across the given per-task rows.
 *
 * @param {PerTaskRow[]} rows - The per-task rows (non-empty).
 * @param {'completeness' | 'accuracy' | 'spag'} criterion - The criterion to roll up.
 * @returns {MetricResult} The rolled-up criterion metric.
 */
function rollupCriterion(
  rows: PerTaskRow[],
  criterion: 'completeness' | 'accuracy' | 'spag'
): MetricResult {
  return rollupMetric(
    rows.map((row) => row[criterion]),
    criterion
  );
}

/**
 * Roll up a card's three criterion metrics from its per-task rows under the
 * baseline-mode card rule (SPEC decision 8; data-shape item 6).
 *
 * @remarks
 * Absolute mode (`baselineTaskSet === null`) rolls up every row. Baseline mode
 * restricts the rollup to rows whose definition-scoped task key is inside the
 * baseline set; when no row is inside it, the unfiltered rows are rolled up
 * per criterion and only `computed` and `notAttempted` results convert to
 * `excluded`, preserving the resolved observed `totalDataPoints`.
 *
 * @param {PerTaskRow[]} rows - The assignment's unfiltered per-task rows (non-empty).
 * @param {ReadonlySet<string> | null} baselineTaskSet - The baseline task-key
 *   set in baseline mode, or `null` in absolute mode.
 * @returns {CardCriterionRollups} The rolled-up criterion metrics.
 */
export function rollupCardCriteria(
  rows: PerTaskRow[],
  baselineTaskSet: ReadonlySet<string> | null
): CardCriterionRollups {
  if (baselineTaskSet === null) {
    return {
      completeness: rollupCriterion(rows, 'completeness'),
      accuracy: rollupCriterion(rows, 'accuracy'),
      spag: rollupCriterion(rows, 'spag'),
    };
  }
  const baselineRows = rows.filter((row) =>
    baselineTaskSet.has(buildTaskKey(row.definitionKey, row.taskId))
  );
  if (baselineRows.length > 0) {
    return {
      completeness: rollupCriterion(baselineRows, 'completeness'),
      accuracy: rollupCriterion(baselineRows, 'accuracy'),
      spag: rollupCriterion(baselineRows, 'spag'),
    };
  }
  const unfiltered = {
    completeness: rollupCriterion(rows, 'completeness'),
    accuracy: rollupCriterion(rows, 'accuracy'),
    spag: rollupCriterion(rows, 'spag'),
  };
  return {
    completeness: toExcludedPreservingDataPoints(unfiltered.completeness),
    accuracy: toExcludedPreservingDataPoints(unfiltered.accuracy),
    spag: toExcludedPreservingDataPoints(unfiltered.spag),
  };
}
