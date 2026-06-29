/**
 * Shared assertion helpers for averaging-analyser tests.
 *
 * Provides floating-point-tolerant metric comparisons and a
 * MetricResult-schema invariant checker.
 *
 * @module test/dataAnalysis/averagingAnalyserAssertions
 * @see docs/developer/frontend/frontend-testing.md §"Shared test helpers"
 */

import { expect } from 'vitest';

// ---------------------------------------------------------------------------
// Floating-point tolerance
// ---------------------------------------------------------------------------

/**
 * Floating-point tolerance (decimal places) passed to `toBeCloseTo`.
 *
 * The analyser accumulates integer scores via multiplication and division;
 * a tolerance of 10 decimal places is sufficient for all current weighted-
 * average computations without spurious drift failures.
 */
export const FLOAT_TOLERANCE = 10;

// ---------------------------------------------------------------------------
// expectMetricResult — deep numeric comparison with tolerance
// ---------------------------------------------------------------------------

/**
 * Assert that an actual `MetricResult` matches the expected values.
 *
 * Numeric fields (`value`, `totalWeight`) are compared with `toBeCloseTo` to
 * tolerate floating-point drift from weighted-sum arithmetic.
 *
 * @remarks
 * The floating-point tolerance strategy:
 * - `value` and `totalWeight` are checked via {@link FLOAT_TOLERANCE}-decimal-place
 *   `toBeCloseTo` to accept minor IEEE-754 rounding in weighted-averages.
 * - `applicableDataPoints` and `totalDataPoints` are integer counts checked
 *   with strict `toBe` equality.
 *
 * @param {Object} actual - The actual metric result from the analyser.
 * @param {number|null} actual.value - The metric value (`null` when no data contributes).
 * @param {number} actual.totalWeight - The total weight of contributing data points.
 * @param {number} actual.applicableDataPoints - Count of contributing data points.
 * @param {number} actual.totalDataPoints - Total data points in the group.
 * @param {Object} expected - The expected metric result values.
 * @param {number|null} expected.value - The expected metric value (`null` when none contribute).
 * @param {number} expected.totalWeight - The expected total weight.
 * @param {number} expected.applicableDataPoints - Expected contributing count.
 * @param {number} expected.totalDataPoints - Expected total count.
 */
export function expectMetricResult(
  actual: {
    value: number | null;
    totalWeight: number;
    applicableDataPoints: number;
    totalDataPoints: number;
  },
  expected: {
    value: number | null;
    totalWeight: number;
    applicableDataPoints: number;
    totalDataPoints: number;
  }
): void {
  if (expected.value === null) {
    expect(actual.value).toBeNull();
  } else {
    expect(actual.value).toBeCloseTo(expected.value, FLOAT_TOLERANCE);
  }
  expect(actual.totalWeight).toBeCloseTo(expected.totalWeight, FLOAT_TOLERANCE);
  expect(actual.applicableDataPoints).toBe(expected.applicableDataPoints);
  expect(actual.totalDataPoints).toBe(expected.totalDataPoints);
}

// ---------------------------------------------------------------------------
// checkMetricInvariant — MetricResultSchema structural invariant
// ---------------------------------------------------------------------------

/**
 * Assert that a single `MetricResult` satisfies the schema invariant:
 * `value === null` iff `applicableDataPoints === 0`.
 *
 * @remarks
 * This invariant ensures the analyser never produces a MetricResult where
 * `value` is non-null but `applicableDataPoints` is zero (which would
 * imply a weighted average of no data) or vice versa.
 *
 * @param {Object} metric - The metric result to check.
 * @param {number|null} metric.value - The metric value (`null` or a number).
 * @param {number} metric.applicableDataPoints - Count of contributing data points.
 */
export function checkMetricInvariant(metric: {
  value: number | null;
  applicableDataPoints: number;
}): void {
  if (metric.value === null) {
    expect(metric.applicableDataPoints).toBe(0);
  } else {
    expect(metric.applicableDataPoints).toBeGreaterThan(0);
  }
}
