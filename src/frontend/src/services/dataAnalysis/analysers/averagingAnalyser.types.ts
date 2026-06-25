import type { MetricResult } from '../dataAnalysis.zod';

/** Mutable accumulator for computing a weighted metric. */
export interface MetricAccumulator {
  weightedSum: number;
  totalWeight: number;
  applicableDataPoints: number;
  totalDataPoints: number;
}

/** Accumulator set for all four metrics (completeness, accuracy, spag, overall). */
export interface DataPointAccumulator {
  completeness: MetricAccumulator;
  accuracy: MetricAccumulator;
  spag: MetricAccumulator;
  overall: MetricAccumulator;
}

/** A nullable numeric assessment score — number, 'N' (not applicable), or absent. */
export type AssessmentScore = number | 'N' | undefined;

/**
 * Create a zeroed-out metric accumulator.
 *
 * @returns {MetricAccumulator} A fresh entry with all fields at zero.
 */
export function createAccumulator(): MetricAccumulator {
  return { weightedSum: 0, totalWeight: 0, applicableDataPoints: 0, totalDataPoints: 0 };
}

/**
 * Create a zeroed-out data-point accumulator set.
 *
 * @returns {DataPointAccumulator} A fresh entry with all sub-accumulators at zero.
 */
export function createDataPointAccumulator(): DataPointAccumulator {
  return {
    completeness: createAccumulator(),
    accuracy: createAccumulator(),
    spag: createAccumulator(),
    overall: createAccumulator(),
  };
}

/**
 * Convert a metric accumulator to its output MetricResult shape.
 *
 * @param {MetricAccumulator} accumulator - The mutable accumulator to convert.
 * @returns {MetricResult} A read-only MetricResult snapshot.
 */
export function accumToMetric(accumulator: MetricAccumulator): MetricResult {
  return {
    value:
      accumulator.applicableDataPoints === 0
        ? null
        : accumulator.weightedSum / accumulator.totalWeight,
    totalWeight: accumulator.totalWeight,
    applicableDataPoints: accumulator.applicableDataPoints,
    totalDataPoints: accumulator.totalDataPoints,
  };
}
