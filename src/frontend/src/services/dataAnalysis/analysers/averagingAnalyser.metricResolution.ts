import type { MetricResult, TaskDisplayMetric } from '../dataAnalysis.zod';
import type { MetricAccumulator } from './averagingAnalyser.types';

/**
 * Resolve contribution evidence for an aggregate scope.
 * @param {MetricAccumulator} accumulator - Contribution and display evidence.
 * @returns {MetricResult} The resolved aggregate metric.
 *
 * @remarks
 * Computed and not-attempted aggregate `totalDataPoints` use the larger
 * observation count so retained zero-weight numeric and raw `N` evidence remains
 * visible without changing contribution value, weight, or applicable-point
 * metadata.
 */
export function resolveAggregateMetric(accumulator: MetricAccumulator): MetricResult {
  const totalDataPoints = Math.max(accumulator.totalDataPoints, accumulator.displayTotalDataPoints);
  if (accumulator.applicableDataPoints > 0) {
    return {
      state: 'computed',
      value: accumulator.weightedSum / accumulator.totalWeight,
      totalWeight: accumulator.totalWeight,
      applicableDataPoints: accumulator.applicableDataPoints,
      totalDataPoints,
    };
  }
  if (accumulator.nCount > 0) {
    return {
      state: 'notAttempted',
      value: 'N',
      totalWeight: accumulator.totalWeight,
      applicableDataPoints: 0,
      totalDataPoints,
    };
  }
  if (accumulator.displayTotalDataPoints > 0) {
    return {
      state: 'excluded',
      value: null,
      totalWeight: 0,
      applicableDataPoints: 0,
      totalDataPoints: accumulator.displayTotalDataPoints,
    };
  }
  return {
    state: 'error',
    value: 'E',
    totalWeight: 0,
    applicableDataPoints: 0,
    totalDataPoints: 0,
  };
}

/**
 * Resolve display evidence, retaining numeric zero-weight observations.
 * @param {MetricAccumulator} accumulator - Display evidence accumulator.
 * @returns {TaskDisplayMetric} The resolved display metric.
 */
export function resolveDisplayMetric(accumulator: MetricAccumulator): TaskDisplayMetric {
  if (accumulator.displayCount > 0) {
    return {
      state: 'computed',
      value: accumulator.displaySum / accumulator.displayCount,
      totalWeight: accumulator.totalWeight,
      applicableDataPoints: accumulator.displayCount,
      totalDataPoints: accumulator.displayTotalDataPoints,
    };
  }
  if (accumulator.displayNCount > 0) {
    return {
      state: 'notAttempted',
      value: 'N',
      totalWeight: accumulator.totalWeight,
      applicableDataPoints: 0,
      totalDataPoints: accumulator.displayTotalDataPoints,
    };
  }
  return {
    state: 'error',
    value: 'E',
    totalWeight: 0,
    applicableDataPoints: 0,
    totalDataPoints: 0,
  };
}
