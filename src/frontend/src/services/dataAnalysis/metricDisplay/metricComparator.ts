/**
 * Shared state-aware metric comparator for metric column sorting.
 *
 * @remarks
 * This module hosts the canonical composition used by state-aware metric
 * column sorting: rank by `getMetricStateRank` (direction-aware), then compare
 * numeric values within the computed band, then tie-break ascending by row id.
 * Its consumers are the Class page overview table (via `classPageModel`) and
 * the Task Heatmap table; keep it here in the shared services layer so the
 * ordering semantics are not duplicated or drifted per feature.
 *
 * @see SPEC.md decisions 3-4 — shared services-layer placement
 */

import type { MetricResult } from '../dataAnalysis.zod';
import { getMetricStateRank } from './metricStateRank';

/**
 * Compare two metric results for a metric column sort.
 *
 * Ordering, in precedence order:
 * 1. State rank via `getMetricStateRank`, honouring `direction`
 *    (`asc`: computed → notAttempted → error; `desc`: error → notAttempted →
 *    computed).
 * 2. Within the computed band, numeric `value` ordered by `direction`.
 * 3. Ultimate tie-break: row id ascending, regardless of direction.
 *
 * @param {MetricResult} aMetric - The first metric result to compare.
 * @param {MetricResult} bMetric - The second metric result to compare.
 * @param {string} aId - The first row's stable identifier, used for the tie-break.
 * @param {string} bId - The second row's stable identifier, used for the tie-break.
 * @param {'asc' | 'desc'} direction - Sort direction applied to state ranks and values.
 * @returns {number} Negative if `a` sorts first, positive if `b` sorts first,
 *   and zero only when both metrics and identifiers are equal.
 */
export function compareMetricsByStateRank(
  aMetric: MetricResult,
  bMetric: MetricResult,
  aId: string,
  bId: string,
  direction: 'asc' | 'desc'
): number {
  const rankDiff = getMetricStateRank(aMetric, direction) - getMetricStateRank(bMetric, direction);
  if (rankDiff !== 0) return rankDiff;

  // Same state band — order numerically when both results are computed
  if (aMetric.state === 'computed' && bMetric.state === 'computed') {
    const valueDiff = aMetric.value - bMetric.value;
    if (valueDiff !== 0) return direction === 'asc' ? valueDiff : -valueDiff;
  }

  // Ultimate tie-break by row id ascending
  return aId.localeCompare(bId);
}
