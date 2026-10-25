/**
 * Mutable accumulator for computing a weighted metric.
 *
 * @remarks
 * `nCount` is the analyser's internal mechanism for distinguishing
 * `notAttempted` (`nCount > 0`) from `error` (`nCount === 0` and
 * `applicableDataPoints === 0`). It is **not** a raw-score type; explicit
 * error scores are accepted by `AssessmentScore`.
 */
export interface MetricAccumulator {
  weightedSum: number;
  totalWeight: number;
  applicableDataPoints: number;
  totalDataPoints: number;
  nCount: number;
  /** Display evidence is kept independently from contribution evidence. */
  displaySum: number;
  displayCount: number;
  displayNCount: number;
  displayTotalDataPoints: number;
}

/** Accumulator set for all four metrics (completeness, accuracy, spag, overall). */
export interface DataPointAccumulator {
  completeness: MetricAccumulator;
  accuracy: MetricAccumulator;
  spag: MetricAccumulator;
  overall: MetricAccumulator;
}

/** A numeric assessment score, 'N' (not applicable), 'E' (error), or absent. */
export type AssessmentScore = number | 'N' | 'E' | undefined;
