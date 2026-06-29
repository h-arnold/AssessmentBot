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
