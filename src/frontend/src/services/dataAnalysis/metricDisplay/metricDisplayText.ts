import type { MetricResult } from '../dataAnalysis.zod';

/**
 * State/value projection required to format a metric for display.
 *
 * Accepting this structural projection keeps the formatter reusable by the
 * shared `MetricResult`, the narrower task-display union, and Class-page
 * presentation metrics without creating a feature dependency.
 */
type StateValuePair<Metric> = Metric extends MetricResult ? Pick<Metric, 'state' | 'value'> : never;

type MetricDisplayTextMetric = StateValuePair<MetricResult>;

/**
 * Format a metric result as user-facing display text.
 *
 * Computed values use the requested decimal precision. Every non-computed
 * state uses one shared literal representation, including the aggregate-only
 * `excluded` label.
 *
 * @param {MetricDisplayTextMetric} metric - The metric result to format.
 * @param {number} precision - Decimal places used for a computed value.
 * @returns {string} The metric's display text.
 * @throws {Error} When the metric carries a state outside the known union.
 */
export function formatMetricDisplayText(
  metric: MetricDisplayTextMetric,
  precision: number
): string {
  switch (metric.state) {
    case 'computed': {
      return metric.value.toFixed(precision);
    }
    case 'notAttempted': {
      return 'N';
    }
    case 'excluded': {
      return 'Excluded';
    }
    case 'error': {
      return 'E';
    }
    default: {
      throw new Error('formatMetricDisplayText: unknown metric state');
    }
  }
}
