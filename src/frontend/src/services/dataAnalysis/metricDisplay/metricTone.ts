/**
 * Pure tone resolver for `MetricResult` values.
 *
 * Maps a `MetricResult` plus an optional scoring range to a
 * `MetricToneResolution` describing the Ant Design `Tag` colour, the raw display
 * value, and a muted flag. No React / antd / I/O / state imports.
 *
 * @module metricTone
 */

import type { MetricResult } from '../dataAnalysis.zod';

/**
 * Ant Design `Tag` preset colour tokens supported by `metricTone` and
 * `MetricPill`. The literal union is exported so the column filter in the
 * Class page can use it as the filter value set.
 *
 * Any future revision to this type is a cross-spec breaking change — it must be
 * reviewed against every consumer that branches on the colour.
 */
export type MetricToneColor = 'red' | 'gold' | 'green' | 'default' | 'volcano';

/**
 * Scoring‑range boundaries for the red / amber / green band calculation.
 */
export type MetricToneRange = { lower: number; upper: number };

/**
 * Resolved tone for a single metric, ready for presentational consumption.
 */
export type MetricToneResolution = {
  /** Ant Design `Tag` colour token. */
  color: MetricToneColor;
  /**
   * Raw display value:
   * - `computed` -> the numeric `metric.value`
   * - `notAttempted` -> `'N'`
   * - `error` -> `'E'`
   */
  displayValue: number | 'N' | 'E';
  /** `true` for `notAttempted`, `false` otherwise. */
  muted: boolean;
};

/** Default scoring range: 0 to 5. */
const DEFAULT_RANGE: MetricToneRange = { lower: 0, upper: 5 };

/** Quartile weight applied to the boundary closer to its own end of the range. */
const QUARTILE_WEIGHT = 3;

/** Quartile denominator for the midpoint-rule band boundary calculation. */
const QUARTILE_DENOMINATOR = 4;

/**
 * Resolve a computed metric value to a band colour using the given range.
 *
 * @remarks
 * The amber/green boundary uses `>=` per the spec boundary rule (`value >= amberGreenBoundary` yields
 * `green`). A prior implementation used `>` which misclassified the exact boundary value as `gold`.
 *
 * @param {number} value - The computed numeric value.
 * @param {MetricToneRange} range - The scoring range boundaries.
 * @returns {MetricToneColor} The band colour for the value.
 */
function resolveComputedColor(value: number, range: MetricToneRange): MetricToneColor {
  const redAmberBoundary = (QUARTILE_WEIGHT * range.lower + range.upper) / QUARTILE_DENOMINATOR;
  const amberGreenBoundary = (range.lower + QUARTILE_WEIGHT * range.upper) / QUARTILE_DENOMINATOR;

  if (value < redAmberBoundary) {
    return 'red';
  }

  if (value >= amberGreenBoundary) {
    return 'green';
  }

  return 'gold';
}

/**
 * Resolve a `MetricResult` to a `MetricToneResolution`.
 *
 * @remarks
 * **Pure function contract.** No side effects, no I/O, no React / antd imports.
 * Idempotent and stateless.
 *
 * **Band boundary formulas** (applied only when `metric.state === 'computed'`):
 * ```
 * redAmberBoundary   = (3·range.lower + range.upper) / 4
 * amberGreenBoundary = (range.lower + 3·range.upper) / 4
 * ```
 * | `value` condition                                | Colour  |
 * | ------------------------------------------------ | ------- |
 * | `value < redAmberBoundary`                       | `red`   |
 * | `redAmberBoundary ≤ value < amberGreenBoundary`  | `gold`  |
 * | `value ≥ amberGreenBoundary`                      | `green` |
 *
 * **Range validation.** The function throws an `Error` if `range.upper <= range.lower`
 * to fail fast on an inverted or degenerate range that would silently invert the
 * band logic. The error message includes the supplied range for diagnostics.
 *
 * **Cross-spec `MetricToneColor` contract.** The `MetricToneColor` union is shared
 * between this resolver and `MetricPill` (and the Class page column filter). Any
 * future revision (adding/removing a colour token) is a cross-spec breaking change
 * and must be reviewed against every consumer that branches on the colour.
 *
 * @param {MetricResult} metric - The discriminated-union `MetricResult` value.
 * @param {MetricToneRange} [range] - Scoring range `{ lower, upper }`. Default `{ lower: 0, upper: 5 }`.
 * @param {MetricToneColor} [errorColor] - Ant Design `Tag` colour token for the `error` state.
 *                     Default `'volcano'`. `red` is reserved for the lowest band
 *                     of `computed` values to keep the visual hierarchy clear.
 * @returns {MetricToneResolution} The resolved tone.
 */
export function resolveMetricTone(
  metric: MetricResult,
  range: MetricToneRange = DEFAULT_RANGE,
  errorColor: MetricToneColor = 'volcano'
): MetricToneResolution {
  if (range.upper <= range.lower) {
    throw new Error(
      `resolveMetricTone: degenerate range { lower: ${range.lower}, upper: ${range.upper} } - upper must be greater than lower`
    );
  }

  switch (metric.state) {
    case 'computed': {
      return {
        color: resolveComputedColor(metric.value, range),
        displayValue: metric.value,
        muted: false,
      };
    }

    case 'notAttempted': {
      return {
        color: 'default',
        displayValue: 'N',
        muted: true,
      };
    }

    case 'error': {
      return {
        color: errorColor,
        displayValue: 'E',
        muted: false,
      };
    }
  }
}
