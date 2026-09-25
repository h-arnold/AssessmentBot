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

const ASCENDING_METRIC_STATES = [
  'computed',
  'notAttempted',
  'excluded',
  'error',
] as const satisfies readonly MetricResult['state'][];

const DESCENDING_METRIC_STATES = ASCENDING_METRIC_STATES.toReversed();

/** Rank lookup for ascending metric column sort: computed → notAttempted → excluded → error. */
export const METRIC_STATE_RANK_ASC: ReadonlyMap<MetricResult['state'], number> = new Map(
  ASCENDING_METRIC_STATES.map((state, rank) => [state, rank])
);

/** Rank lookup for descending metric column sort: error → excluded → notAttempted → computed. */
export const METRIC_STATE_RANK_DESC: ReadonlyMap<MetricResult['state'], number> = new Map(
  DESCENDING_METRIC_STATES.map((state, rank) => [state, rank])
);

/**
 * Return a numeric rank for a `MetricResult` state, used for state-aware
 * metric column sorting.
 *
 * The rank order flips with direction:
 * - `asc`:  computed (0) → notAttempted (1) → excluded (2) → error (3)
 * - `desc`: error (0) → excluded (1) → notAttempted (2) → computed (3)
 *
 * @param {MetricResult} metric - The metric result to rank.
 * @param {'asc' | 'desc'} direction - Sort direction.
 * @returns {number} A numeric rank (lower = earlier in sort order).
 * @throws {Error} When the metric carries a state outside the known union.
 */
export function getMetricStateRank(metric: MetricResult, direction: 'asc' | 'desc'): number {
  const rankMap = direction === 'asc' ? METRIC_STATE_RANK_ASC : METRIC_STATE_RANK_DESC;
  const rank = rankMap.get(metric.state);
  if (rank === undefined) {
    throw new Error(`getMetricStateRank: unknown metric state "${metric.state}"`);
  }
  return rank;
}
