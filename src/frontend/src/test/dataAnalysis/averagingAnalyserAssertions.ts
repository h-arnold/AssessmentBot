/**
 * Shared assertion helpers for averaging-analyser tests.
 *
 * Provides floating-point-tolerant metric comparisons and a state-aware
 * metric result checker for the discriminated-union MetricResult shape.
 *
 * `MetricResult` is imported from the production Zod schema
 * (`dataAnalysis.zod.ts`) rather than being duplicated locally.
 *
 * @module test/dataAnalysis/averagingAnalyserAssertions
 * @see docs/developer/frontend/frontend-testing.md §"Shared test helpers"
 */

import { expect } from 'vitest';
import type { MetricResult } from '../../services/dataAnalysis/dataAnalysis.zod';

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
// State-aware MetricResult assertion
// ---------------------------------------------------------------------------

/**
 * Expected values for a `computed` MetricResult.
 */
interface ComputedMetricResultExpected {
  state: 'computed';
  value: number;
  totalWeight: number;
  applicableDataPoints: number;
  totalDataPoints: number;
}

/**
 * Expected values for a `notAttempted` MetricResult.
 */
interface NotAttemptedMetricResultExpected {
  state: 'notAttempted';
  totalWeight: number;
  totalDataPoints: number;
}

/**
 * Expected values for an `error` MetricResult.
 */
interface ErrorMetricResultExpected {
  state: 'error';
  totalWeight: number;
  totalDataPoints: number;
}

/**
 * Union of expected value shapes for a MetricResult, discriminated by `state`.
 */
export type MetricResultExpected =
  | ComputedMetricResultExpected
  | NotAttemptedMetricResultExpected
  | ErrorMetricResultExpected;

/**
 * Assert that an actual `MetricResult` matches the expected values,
 * branching on `metric.state`.
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
 * - Literal fields (`state`, `value` for non-computed states) are checked
 *   with strict `toBe` equality.
 *
 * @param {MetricResult} actual - The actual metric result from the analyser.
 * @param {MetricResultExpected} expected - The expected metric result values.
 */
export function expectMetricResultStateAware(
  actual: MetricResult,
  expected: MetricResultExpected
): void {
  // Always check state first
  expect(actual.state).toBe(expected.state);

  switch (expected.state) {
    case 'computed': {
      const compExpected = expected as ComputedMetricResultExpected;
      const compActual = actual as Extract<MetricResult, { state: 'computed' }>;
      expect(compActual.value).toBeCloseTo(compExpected.value, FLOAT_TOLERANCE);
      expect(compActual.totalWeight).toBeCloseTo(compExpected.totalWeight, FLOAT_TOLERANCE);
      expect(compActual.applicableDataPoints).toBe(compExpected.applicableDataPoints);
      expect(compActual.totalDataPoints).toBe(compExpected.totalDataPoints);
      break;
    }
    case 'notAttempted': {
      const naExpected = expected as NotAttemptedMetricResultExpected;
      const naActual = actual as Extract<MetricResult, { state: 'notAttempted' }>;
      expect(naActual.value).toBe('N');
      expect(naActual.totalWeight).toBeCloseTo(naExpected.totalWeight, FLOAT_TOLERANCE);
      expect(naActual.applicableDataPoints).toBe(0);
      expect(naActual.totalDataPoints).toBe(naExpected.totalDataPoints);
      break;
    }
    case 'error': {
      const errorExpected = expected as ErrorMetricResultExpected;
      const errorActual = actual as Extract<MetricResult, { state: 'error' }>;
      expect(errorActual.value).toBe('E');
      expect(errorActual.totalWeight).toBeCloseTo(errorExpected.totalWeight, FLOAT_TOLERANCE);
      expect(errorActual.applicableDataPoints).toBe(0);
      expect(errorActual.totalDataPoints).toBe(errorExpected.totalDataPoints);
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Legacy MetricResult assertion — maintained for backward compatibility
// with the old { value: number | null } shape. Tests targeting the new
// discriminated union should prefer expectMetricResultStateAware.
// ---------------------------------------------------------------------------

/**
 * Assert that an actual metric result matches expected values.
 *
 * This variant accepts a `state`-less shape for backward compat. When the
 * actual result has a `state` field it delegates to
 * {@link expectMetricResultStateAware}.
 *
 * @param {Record<string, unknown>} actual - The actual metric result from the analyser.
 * @param {{ value: number | null; totalWeight: number; applicableDataPoints: number; totalDataPoints: number }} expected - The expected metric result values.
 * @param {number | null} expected.value - The expected metric value.
 * @param {number} expected.totalWeight - The expected total weight.
 * @param {number} expected.applicableDataPoints - Expected contributing count.
 * @param {number} expected.totalDataPoints - Expected total count.
 * @deprecated Use {@link expectMetricResultStateAware} for the new
 *   discriminated-union MetricResult shape.
 */
export function expectMetricResult(
  actual: Record<string, unknown>,
  expected: {
    value: number | null;
    totalWeight: number;
    applicableDataPoints: number;
    totalDataPoints: number;
  }
): void {
  if (actual.state !== undefined) {
    // Delegate to state-aware helper for the new shape
    switch (actual.state) {
      case 'computed': {
        expectMetricResultStateAware(actual as unknown as MetricResult, {
          state: 'computed',
          value: expected.value as number,
          totalWeight: expected.totalWeight,
          applicableDataPoints: expected.applicableDataPoints,
          totalDataPoints: expected.totalDataPoints,
        });

        break;
      }
      case 'notAttempted': {
        expectMetricResultStateAware(actual as unknown as MetricResult, {
          state: 'notAttempted',
          totalWeight: expected.totalWeight,
          totalDataPoints: expected.totalDataPoints,
        });

        break;
      }
      case 'error': {
        expectMetricResultStateAware(actual as unknown as MetricResult, {
          state: 'error',
          totalWeight: expected.totalWeight,
          totalDataPoints: expected.totalDataPoints,
        });

        break;
      }
      // No default
    }
    return;
  }

  // Legacy path: no state field, use the old comparison
  const legacyActual = actual as {
    value: number | null;
    totalWeight: number;
    applicableDataPoints: number;
    totalDataPoints: number;
  };
  if (expected.value === null) {
    expect(legacyActual.value).toBeNull();
  } else {
    expect(legacyActual.value).toBeCloseTo(expected.value, FLOAT_TOLERANCE);
  }
  expect(legacyActual.totalWeight).toBeCloseTo(expected.totalWeight, FLOAT_TOLERANCE);
  expect(legacyActual.applicableDataPoints).toBe(expected.applicableDataPoints);
  expect(legacyActual.totalDataPoints).toBe(expected.totalDataPoints);
}
