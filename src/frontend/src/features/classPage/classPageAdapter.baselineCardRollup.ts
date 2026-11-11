/**
 * Baseline-mode card-rollup rule for the Class page adapter.
 *
 * @remarks
 * Owns the recent-assignment card half of the attempt-baseline display rules
 * (data-shape item 6): deriving the baseline task-key set
 * from the analyser result's own mode echo (fail-fast narrowing), and rolling
 * up a card's three criterion metrics from baseline-restricted per-task rows
 * with the empty-set `excluded` fallback conversion. Extracted from
 * `classPageAdapter.ts` so the adapter's orchestration and this rule each own
 * one responsibility.
 *
 * The student-averages half needs no rule here: the analyser's per-student
 * rows are already baseline-filtered, so the adapter passes them through.
 *
 * @see docs/developer/data-shapes/frontend-data-analysis-response.md —
 *   Attempt-baseline contract changes (items 4 and 6)
 */

import { rollupMetric } from '@/services/dataAnalysis/analysers/rollupMetric';
import { buildTaskKey } from '@/services/dataAnalysis/taskKey';
import { convertToBaselineExcluded } from '@/services/dataAnalysis/analysers/averagingAnalyser.rows';
import type { MetricResult, PerTaskRow } from '@/services/dataAnalysis/dataAnalysis.zod';

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
 * Roll up a card's three criterion metrics across the given per-task rows.
 *
 * @param {PerTaskRow[]} rows - The per-task rows to roll up (non-empty).
 * @returns {CardCriterionRollups} The rolled-up criterion metrics.
 */
function rollCriteria(rows: PerTaskRow[]): CardCriterionRollups {
  return {
    completeness: rollupCriterion(rows, 'completeness'),
    accuracy: rollupCriterion(rows, 'accuracy'),
    spag: rollupCriterion(rows, 'spag'),
  };
}

/**
 * Roll up a card's three criterion metrics from its per-task rows under the
 * baseline-mode card rule (data-shape item 6).
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
    return rollCriteria(rows);
  }
  const baselineRows = rows.filter((row) =>
    baselineTaskSet.has(buildTaskKey(row.definitionKey, row.taskId))
  );
  if (baselineRows.length > 0) {
    return rollCriteria(baselineRows);
  }
  const unfiltered = rollCriteria(rows);
  return {
    completeness: convertToBaselineExcluded(unfiltered.completeness),
    accuracy: convertToBaselineExcluded(unfiltered.accuracy),
    spag: convertToBaselineExcluded(unfiltered.spag),
  };
}
