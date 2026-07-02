/**
 * Mutable accumulator for computing a weighted metric.
 *
 * @remarks
 * `nCount` is the analyser's internal mechanism for distinguishing
 * `notAttempted` (`nCount > 0`) from `error` (`nCount === 0` and
 * `applicableDataPoints === 0`). It is **not** a raw-score type and the
 * `'E'` literal does not appear in `AssessmentScore`.
 */
export interface MetricAccumulator {
  weightedSum: number;
  totalWeight: number;
  applicableDataPoints: number;
  totalDataPoints: number;
  nCount: number;
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
