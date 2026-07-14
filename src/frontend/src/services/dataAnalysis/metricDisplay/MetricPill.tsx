import type { CSSProperties, JSX } from 'react';
import { Tag } from 'antd';
import type { MetricResult } from '../dataAnalysis.zod';
import { resolveMetricTone } from './metricTone';
import type { MetricToneColor } from './metricTone';

/** Default number of decimal places for computed values. */
const DEFAULT_PRECISION = 2;

/**
 * Presentational Ant Design `Tag` for a `MetricResult`.
 *
 * Renders a `MetricResult` as an Ant Design `Tag` with the resolved colour,
 * the formatted display value, and optional emphasis / muted styles. Pure
 * presentational React component; no state, no data fetching, no callbacks.
 *
 * @module MetricPill
 */

type MetricPillProperties = {
  /** The metric value to render. */
  readonly metric: MetricResult;
  /**
   * Optional scoring range passed through to `resolveMetricTone`.
   * Default `{ lower: 0, upper: 5 }`.
   */
  readonly range?: { lower: number; upper: number };
  /**
   * When `true`, applies a larger font size (~1.25x) and bolder weight (600).
   * Used by the `Average` cell in the Class page's `RecentAssignmentCard` and
   * by the `Average` column in the Student Averages table. Does not change
   * the colour, precision, or display value.
   *
   * @default false
   */
  readonly emphasised?: boolean;
  /**
   * When `true`, renders a smaller footprint (font ~12px, padding `2px 4px`)
   * for the dense heatmap matrix while keeping `precision: 2` (the default)
   * and the same `resolveMetricTone` colouring. Mutually exclusive in intent
   * from `emphasised` (a cell is one or the other). The `precision` prop is
   * independently configurable — callers may override it (see the heatmap's
   * `INDIVIDUAL_SCORE_PRECISION = 0`).
   *
   * @default false
   */
  readonly compact?: boolean;
  /**
   * Number of decimal places for `computed` values. Ignored for
   * `notAttempted` and `error` (the literal `'N'` and `'E'` are rendered
   * as-is).
   *
   * @default 2
   */
  readonly precision?: number;
  /**
   * Optional override of the Ant Design `Tag` colour token used for the
   * `error` state. In v1 only `'volcano'` is accepted (the design contract
   * reserves `red` for the lowest band of `computed` values to keep the
   * visual hierarchy clear). The type is widened to `MetricToneColor` so
   * future revisions can swap the error colour without a type break; the
   * v1 default and v1 contract are `'volcano'`.
   *
   * No `MetricPill`-level default - when omitted the default is supplied by
   * `resolveMetricTone` (which owns the `'volcano'` default).
   */
  readonly errorColor?: MetricToneColor;
};

/**
 * Build the CSS style object for a `MetricPill` Tag based on display variant.
 *
 * @param {boolean} muted - When true applies reduced opacity.
 * @param {boolean} emphasised - When true applies larger font and bold weight.
 * @param {boolean} compact - When true applies smaller font and tighter padding.
 * @returns {CSSProperties} The merged style object.
 */
function buildPillStyle(muted: boolean, emphasised: boolean, compact: boolean): CSSProperties {
  const style: CSSProperties = {};

  if (muted) {
    style.opacity = 0.55;
  }

  if (emphasised) {
    style.fontSize = '17.5px';
    style.fontWeight = 600;
  } else if (compact) {
    style.fontSize = '12px';
    style.padding = '2px 4px';
  }

  return style;
}

/**
 * Render a `MetricResult` as an Ant Design `Tag` pill.
 *
 * @remarks
 * **Presentational contract.** This component is a pure rendering layer:
 * - Calls `resolveMetricTone(metric, range, errorColor)` to obtain the colour,
 *   display value, and muted flag.
 * - Formats `computed` values via `metric.value.toFixed(precision)`.
 *   `notAttempted` and `error` states produce the literal `'N'` and `'E'`.
 * - Applies `opacity: 0.55` when the resolution's `muted` flag is `true`
 *   (only `notAttempted` sets muted).
 * - Applies `fontSize: '17.5px'` and `fontWeight: 600` when `emphasised` is
 *   `true`. Merges with the muted opacity style if both are active.
 *
 * **No interactivity.** The pill does not have `onClick`, `cursor: pointer`,
 * or a focus ring. It is purely a labelled badge.
 *
 * **Props.** `metric` is required; `range`, `emphasised`, `precision`, and
 * `errorColor` are optional. `range` and `errorColor` are pass-through
 * defaults to `resolveMetricTone` (no `MetricPill`-level default for
 * `errorColor`).
 *
 * **v1 accessibility gap (signed off).** No `Tooltip` or `aria-label` is
 * rendered in v1. A future iteration may add a `Tooltip` wrapper with
 * screen-reader-friendly copy. See the Class page spec's accessibility notes
 * for the product sign-off on the v1 gap.
 *
 * @param {MetricPillProperties} root0 - Component properties.
 * @param {MetricResult} root0.metric - The metric value to render.
 * @param {{ lower: number; upper: number }} [root0.range] - Optional scoring range passed through to resolveMetricTone.
 * @param {boolean} [root0.emphasised=false] - When true applies larger font and bold weight.
 * @param {number} [root0.precision=2] - Number of decimal places for computed values.
 * @param {MetricToneColor} [root0.errorColor] - Optional error colour override passed through to resolveMetricTone.
 * @returns {JSX.Element} An Ant Design `Tag` element.
 */
export function MetricPill({
  metric,
  range,
  emphasised = false,
  compact = false,
  precision = DEFAULT_PRECISION,
  errorColor,
}: MetricPillProperties): JSX.Element {
  const resolution = resolveMetricTone(metric, range, errorColor);

  const displayText: string = metric.state === 'computed'
    ? metric.value.toFixed(precision)
    : (resolution.displayValue as string);

  const tagStyle: CSSProperties = buildPillStyle(resolution.muted, emphasised, compact);

  return (
    <Tag color={resolution.color} style={tagStyle}>
      {displayText}
    </Tag>
  );
}
