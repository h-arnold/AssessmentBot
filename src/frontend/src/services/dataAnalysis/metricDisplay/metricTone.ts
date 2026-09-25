/**
 * Pure tone resolver for `MetricResult` values.
 *
 * Maps a `MetricResult` plus an optional scoring range to a
 * `MetricToneResolution` describing the Ant Design `Tag` colour, cell style,
 * and a muted flag. The only React import is the type-only `CSSProperties`;
 * no React runtime, antd, I/O, or state dependency.
 *
 * @module metricTone
 */

import type { CSSProperties } from 'react';
import type { MetricResult } from '../dataAnalysis.zod';

export const EXCLUDED_METRIC_ACCESSIBLE_LABEL =
  'Excluded from average: displayed work had zero weighting.';

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
  /**
   * Ant Design `Tag` colour. For `computed` values this is a continuous
   * gradient HSL string (red at the range floor → amber mid → green at the
   * ceiling); for `notAttempted` it is a dark grey (`#434343`); for `error`
   * it is the `errorColor` token; and for `excluded` it is the neutral
   * `'default'` preset.
   */
  color: string;
  /**
   * Ready-to-apply `<td>` presentation attributes. Gradient values carry a
   * light pastel background with a darker, hue-matched text colour so the
   * *entire* cell (not just a pill inside it) carries the band colour. The
   * aggregate-only excluded treatment supplies a stylesheet `className`; other
   * states supply inline CSS properties from {@link METRIC_TONE_CELL_STYLE}.
   */
  cellStyle: CSSProperties & Readonly<{ className?: string }>;
  /** `true` only for `notAttempted`; `excluded` is not muted. */
  muted: boolean;
};

/** Default scoring range: 0 to 5. */
export const DEFAULT_TONE_RANGE: MetricToneRange = { lower: 0, upper: 5 };

/**
 * Spreadsheet-style cell styling keyed by resolved tone colour.
 *
 * Maps each {@link MetricToneColor} to an inline `<td>` style so the *entire*
 * heatmap cell (including its padding area) carries the band colour, rather
 * than a pill inside the cell. The hex values mirror Ant Design's preset
 * palette background/text pairs (the per-component `colorXxxBg`/`colorXxx`
 * shades, which are not exposed as top-level `theme.useToken()` tokens in
 * v6). `notAttempted` uses {@link NOT_ATTEMPTED_CELL_STYLE} with a light grey
 * background and dark grey text; excluded uses the shared stylesheet class
 * rather than a preset style key. The `'default'` entry in this record is the
 * unused fallback.
 */
export const METRIC_TONE_CELL_STYLE: Readonly<Record<MetricToneColor, CSSProperties>> = {
  red: { backgroundColor: '#fff1f0', color: '#cf1322' },
  gold: { backgroundColor: '#fffbe6', color: '#d48806' },
  green: { backgroundColor: '#f6ffed', color: '#389e0d' },
  volcano: { backgroundColor: '#fff2e8', color: '#d4380d' },
  default: {},
};

/** Stylesheet class for the theme-aware aggregate-only excluded treatment. */
const EXCLUDED_CELL_CLASS_NAME = 'metric-tone-excluded-cell';

/**
 * Dark grey used for the `notAttempted` (`N`) state. Chosen deliberately darker
 * than Ant Design's near-white `default` `Tag` so an unattempted cell reads as a
 * clearly grey, low-emphasis marker rather than blending into the table.
 */
const NOT_ATTEMPTED_GREY = '#434343';

/** Maximum hue angle (green endpoint) for the continuous gradient. */
const GRADIENT_MAX_HUE = 120;

/** Non-linearity exponent for the hue curve (t^1.5 biases toward red at low t). */
const GRADIENT_HUE_EXPONENT = 1.5;

/** Base lightness at the endpoints of the gradient (darkest red/green). */
const GRADIENT_LIGHTNESS_BASE = 34;

/** Lightness amplitude for the sinusoidal mid-range boost. */
const GRADIENT_LIGHTNESS_AMPLITUDE = 9;

/**
 * Cell style for the `notAttempted` (`N`) state: a light grey wash with a dark
 * grey value, so the entire cell carries the neutral grey tone (mirroring the
 * gradient treatment used for computed values).
 */
const NOT_ATTEMPTED_CELL_STYLE: CSSProperties = {
  backgroundColor: '#e8e8e8',
  color: NOT_ATTEMPTED_GREY,
};

/**
 * Clamp a number into the inclusive `[0, 1]` range.
 *
 * @param {number} value - The number to clamp.
 * @returns {number} The clamped number.
 */
function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Resolve the normalised position (`0`→range floor, `1`→range ceiling) of a
 * computed value within its scoring range.
 *
 * @param {number} value - The computed numeric value.
 * @param {MetricToneRange} range - The scoring range.
 * @returns {number} The normalised position, clamped to `[0, 1]`.
 */
function resolveNormalisedPosition(value: number, range: MetricToneRange): number {
  const span = range.upper - range.lower;
  if (span <= 0) {
    return 0;
  }
  return clampUnit((value - range.lower) / span);
}

/**
 * Resolve the continuous gradient colour for a computed value.
 *
 * @remarks
 * The hue sweeps red (`0`) → amber (`60`) → green (`120`) as the normalised
 * position moves from floor to ceiling, but is biased toward red at the low
 * end via a `t^1.5` curve so that low scores (a `1` and especially a `2`)
 * read clearly as red rather than orange. Lightness is intentionally lower at
 * the two ends of the range (darkest red at the floor, darkest green at the
 * ceiling) and lighter in the middle, so the visual difference between e.g. a
 * `1` and a `5` is obvious. The darker, saturated fill is chosen so white text
 * on an Ant Design `Tag` stays legible.
 *
 * @param {number} t - The normalised position in `[0, 1]`.
 * @returns {string} An `hsl(...)` colour string for use as a `Tag` colour.
 */
function resolveGradientFill(t: number): string {
  const hue = GRADIENT_MAX_HUE * Math.pow(t, GRADIENT_HUE_EXPONENT);
  const lightness = GRADIENT_LIGHTNESS_BASE + GRADIENT_LIGHTNESS_AMPLITUDE * Math.sin(Math.PI * t);
  return `hsl(${hue.toFixed(1)}, 70%, ${lightness.toFixed(1)}%)`;
}

/**
 * Resolve the continuous gradient cell style for a computed value.
 *
 * @remarks
 * Mirrors Ant Design's preset pastel background / dark text pairs used by the
 * discrete states, but derived from the gradient hue so the *entire* cell
 * carries the band colour. The hue uses the same red-biased `t^1.5` curve as
 * {@link resolveGradientFill}.
 *
 * @param {number} t - The normalised position in `[0, 1]`.
 * @returns {CSSProperties} The inline `<td>` style for the cell.
 */
function resolveGradientCellStyle(t: number): CSSProperties {
  const hue = GRADIENT_MAX_HUE * Math.pow(t, GRADIENT_HUE_EXPONENT);
  return {
    backgroundColor: `hsl(${hue.toFixed(1)}, 75%, 92%)`,
    color: `hsl(${hue.toFixed(1)}, 70%, 32%)`,
  };
}

/**
 * Fail fast on an inverted or degenerate scoring range.
 *
 * @remarks
 * Retained as a named single-caller guard: inlining this branch raises
 * `resolveMetricTone` above the configured complexity limit without creating
 * an independently reusable contract.
 *
 * @param {MetricToneRange} range - The scoring range to validate.
 * @throws {Error} When `range.upper <= range.lower`.
 */
function assertValidRange(range: MetricToneRange): void {
  if (range.upper <= range.lower) {
    throw new Error(
      `resolveMetricTone: degenerate range { lower: ${range.lower}, upper: ${range.upper} } - upper must be greater than lower`
    );
  }
}

/**
 * Resolve a `MetricResult` to a `MetricToneResolution`.
 *
 * @remarks
 * **Pure function contract.** No side effects, no I/O, no antd import, and no
 * React runtime dependency (the module imports `CSSProperties` as a type only).
 * Idempotent and stateless.
 *
 * **Gradient resolution.** The normalised position `t` is computed once per
 * call in the `computed` case and passed to the gradient helpers, avoiding
 * repeated recalculation on every invocation.
 *
 * **Continuous gradient** (applied only when `metric.state === 'computed'`):
 * the value's normalised position `t = (value - lower) / (upper - lower)`
 * (clamped to `[0, 1]`) maps to an `hsl` colour whose hue sweeps red (`0`) →
 * amber (`60`) → green (`120`). Lightness is darker at the range ends (darkest
 * red at the floor, darkest green at the ceiling) and lighter in the middle,
 * making differences between adjacent scores obvious. Discrete states
 * (`notAttempted`, `error`, `excluded`) keep their fixed colour and cell styles
 * — only `computed` values participate in the gradient. `notAttempted` uses
 * dark-grey text (`#434343`) and its own cell background. Excluded uses the
 * valid `'default'` Tag preset and a separate neutral cell style, and is not
 * muted. The shared display formatter renders the visible **Excluded** label.
 *
 * | `value` condition              | Colour (computed)        |
 * | ------------------------------ | ------------------------ |
 * | `value ≈ lower`                | dark red                 |
 * | `value ≈ midpoint`             | amber                    |
 * | `value ≈ upper`                | dark green               |
 *
 * **Range validation.** The function throws an `Error` if `range.upper <= range.lower`
 * to fail fast on an inverted or degenerate range that would silently invert the
 * band logic. The error message includes the supplied range for diagnostics.
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
  range: MetricToneRange = DEFAULT_TONE_RANGE,
  errorColor: MetricToneColor = 'volcano'
): MetricToneResolution {
  assertValidRange(range);

  switch (metric.state) {
    case 'computed': {
      const t = resolveNormalisedPosition(metric.value, range);
      return {
        color: resolveGradientFill(t),
        cellStyle: resolveGradientCellStyle(t),
        muted: false,
      };
    }

    case 'notAttempted': {
      return {
        color: NOT_ATTEMPTED_GREY,
        cellStyle: NOT_ATTEMPTED_CELL_STYLE,
        muted: true,
      };
    }

    case 'error': {
      return {
        color: errorColor,
        cellStyle: resolveDiscreteCellStyle(errorColor),
        muted: false,
      };
    }

    case 'excluded': {
      return {
        color: 'default',
        cellStyle: { className: EXCLUDED_CELL_CLASS_NAME },
        muted: false,
      };
    }
  }
}

/**
 * Resolve the preset cell style for a discrete (non-gradient) tone token.
 *
 * @param {MetricToneColor} token - The discrete tone token.
 * @returns {CSSProperties} The matching preset cell style.
 */
function resolveDiscreteCellStyle(token: MetricToneColor): CSSProperties {
  switch (token) {
    case 'red': {
      return METRIC_TONE_CELL_STYLE.red;
    }
    case 'gold': {
      return METRIC_TONE_CELL_STYLE.gold;
    }
    case 'green': {
      return METRIC_TONE_CELL_STYLE.green;
    }
    case 'volcano': {
      return METRIC_TONE_CELL_STYLE.volcano;
    }
    case 'default': {
      return METRIC_TONE_CELL_STYLE.default;
    }
  }
}
