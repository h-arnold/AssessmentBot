/**
 * Metric-state ranking helpers for shared metric display sorting.
 *
 * @remarks
 * This module hosts the canonical rank lookups over `MetricResult['state']`
 * used by state-aware metric column sorting. Its sole direct consumer is the
 * shared comparator composition in `./metricComparator`; both features reach
 * it indirectly through that helper, so ranking semantics stay in this shared
 * services-layer module rather than migrating back into a feature folder.
 */

import type { MetricResult } from '../dataAnalysis.zod';

const HIGHEST_METRIC_STATE_RANK = 2;

/** Rank lookup for ascending metric column sort: computed → notAttempted → error. */
export const METRIC_STATE_RANK_ASC: ReadonlyMap<MetricResult['state'], number> = new Map([
  ['computed', 0],
  ['notAttempted', 1],
  ['error', HIGHEST_METRIC_STATE_RANK],
]);

/** Rank lookup for descending metric column sort: error → notAttempted → computed. */
export const METRIC_STATE_RANK_DESC: ReadonlyMap<MetricResult['state'], number> = new Map([
  ['error', 0],
  ['notAttempted', 1],
  ['computed', HIGHEST_METRIC_STATE_RANK],
]);

/**
 * Return a numeric rank for a `MetricResult` state, used for state-aware
 * metric column sorting.
 *
 * The rank order flips with direction:
 * - `asc`:  computed (0) → notAttempted (1) → error (2)
 * - `desc`: error (0) → notAttempted (1) → computed (2)
 *
 * @param {MetricResult} metric - The metric result to rank.
 * @param {'asc' | 'desc'} direction - Sort direction.
 * @returns {number} A numeric rank (lower = earlier in sort order).
 */
export function getMetricStateRank(metric: MetricResult, direction: 'asc' | 'desc'): number {
  const rankMap = direction === 'asc' ? METRIC_STATE_RANK_ASC : METRIC_STATE_RANK_DESC;
  return rankMap.get(metric.state) ?? 0;
}
