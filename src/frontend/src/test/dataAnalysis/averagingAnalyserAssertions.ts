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
