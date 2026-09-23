import type { MetricResult } from '../dataAnalysis.zod';
import type { MetricAccumulator } from './averagingAnalyser.types';

/**
 * Resolve contribution evidence for an aggregate scope.
 * @param {MetricAccumulator} accumulator - Contribution and display evidence.
 * @returns {MetricResult} The resolved aggregate metric.
 */
export function resolveAggregateMetric(accumulator: MetricAccumulator): MetricResult {
  if (accumulator.applicableDataPoints > 0) {
    return {
      state: 'computed',
      value: accumulator.weightedSum / accumulator.totalWeight,
      totalWeight: accumulator.totalWeight,
      applicableDataPoints: accumulator.applicableDataPoints,
      totalDataPoints: accumulator.totalDataPoints,
    };
  }
  if (accumulator.nCount > 0) {
    return {
      state: 'notAttempted',
      value: 'N',
      totalWeight: accumulator.totalWeight,
      applicableDataPoints: 0,
      totalDataPoints: accumulator.totalDataPoints,
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
 * @returns {MetricResult} The resolved display metric.
 */
export function resolveDisplayMetric(accumulator: MetricAccumulator): MetricResult {
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
