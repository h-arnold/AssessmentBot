import type { ReactNode } from 'react';
import { Tooltip } from 'antd';

import type { AverageContribution } from '@/services/dataAnalysis/dataAnalysis.zod';

export const ZERO_WEIGHT_EXPLANATION =
  'Zero weighting — scores are shown but do not contribute to averages.';
export const EXCLUDED_COLUMN_GROUP_CLASS = 'task-heatmap-excluded-group';
export const EXCLUDED_COLUMN_TOOLTIP_TARGET_CLASS = 'task-heatmap-excluded-tooltip-target';
export const EXCLUDED_COLUMN_FIRST_CLASS = 'task-heatmap-excluded-first';
export const EXCLUDED_COLUMN_LAST_CLASS = 'task-heatmap-excluded-last';

export const BASELINE_OFF_EXPLANATION =
  'Task outside the baseline set — shown, but not included in baseline averages.';
export const BASELINE_CAPTION =
  '† Tasks marked with this symbol are outside the baseline task set. Their values are unchanged; averages exclude them.';
export const BASELINE_MARKER = '†';

/**
 * Determine whether a task column is unmarked: included in averages and
 * inside the attempt baseline, so it needs none of the excluded-column
 * classes.
 *
 * @param {AverageContribution} averageContribution - Validated adapter metadata.
 * @param {Readonly<{ includedInAttemptBaseline: boolean }>} options - The column's attempt-baseline membership.
 * @returns {boolean} `true` when the column is marked by neither cause.
 */
function isColumnUnmarked(
  averageContribution: AverageContribution,
  options: Readonly<{ includedInAttemptBaseline: boolean }>
): boolean {
  return averageContribution.includedInAverage && options.includedInAttemptBaseline;
}

/**
 * Select the plain or marked rendering for a task-group heading.
 *
 * A heading is marked when its column is zero-weighted, outside the attempt
 * baseline, or both. One visual language covers both causes (shared group
 * class, tooltip target and edge classes); the tooltip and the accessible
 * labels distinguish them, composing the baseline fact before the zero-weight
 * fact when both apply.
 *
 * The tooltip target span is deliberately not focusable: the header cell's
 * `aria-label` (set via `onHeaderCell`) already carries the full composed
 * explanation for assistive technology during table navigation, the visible
 * caption above the table covers the baseline cause, and the hover tooltip
 * remains the visual affordance for pointer users.
 *
 * @param {string} title - Full task title or ID fallback.
 * @param {AverageContribution} averageContribution - Validated adapter metadata.
 * @param {Readonly<{ includedInAttemptBaseline: boolean }>} options - The column's attempt-baseline membership.
 * @returns {{ title: ReactNode; className?: string; onHeaderCell?: () => { 'aria-label': string } }} Header presentation properties.
 */
export function buildTaskHeaderPresentation(
  title: string,
  averageContribution: AverageContribution,
  options: Readonly<{ includedInAttemptBaseline: boolean }>
): Readonly<{
  title: ReactNode;
  className?: string;
  onHeaderCell?: () => { 'aria-label': string };
}> {
  if (isColumnUnmarked(averageContribution, options)) {
    return { title };
  }

  const isZeroWeighted = !averageContribution.includedInAverage;
  const isBaselineOff = !options.includedInAttemptBaseline;

  let explanation = BASELINE_OFF_EXPLANATION;
  if (isZeroWeighted && isBaselineOff) {
    explanation = `${BASELINE_OFF_EXPLANATION} ${ZERO_WEIGHT_EXPLANATION}`;
  } else if (isZeroWeighted) {
    explanation = ZERO_WEIGHT_EXPLANATION;
  }

  const displayTitle = isBaselineOff ? `${title}${BASELINE_MARKER}` : title;

  return {
    title: (
      <Tooltip title={explanation}>
        <span
          className={EXCLUDED_COLUMN_TOOLTIP_TARGET_CLASS}
          aria-label={`${displayTitle} ${explanation}`}
        >
          {displayTitle}
        </span>
      </Tooltip>
    ),
    className: EXCLUDED_COLUMN_GROUP_CLASS,
    onHeaderCell: () => {
      // Semicolon join: both explanations contain em-dashes, so an em-dash
      // join would read as two separate clauses in the accessible label.
      return {
        'aria-label': `${displayTitle}; ${explanation}`,
      };
    },
  };
}

/**
 * Select the edge marker class for a metric column in a task group.
 *
 * The excluded-column edge classes apply to every marked column —
 * zero-weighted or outside the attempt baseline — so one visual language
 * carries both causes.
 *
 * @param {number} metricIndex - Metric's zero-based index in the group.
 * @param {number} metricCount - Number of metric columns in the group.
 * @param {AverageContribution} averageContribution - Validated adapter metadata.
 * @param {Readonly<{ includedInAttemptBaseline: boolean }>} options - The column's attempt-baseline membership.
 * @returns {string | undefined} Edge marker class, if this column is an edge of an excluded group.
 */
export function getExcludedMetricEdgeClass(
  metricIndex: number,
  metricCount: number,
  averageContribution: AverageContribution,
  options: Readonly<{ includedInAttemptBaseline: boolean }>
): string | undefined {
  if (isColumnUnmarked(averageContribution, options)) {
    return undefined;
  }
  if (metricCount === 1 && metricIndex === 0) {
    return `${EXCLUDED_COLUMN_FIRST_CLASS} ${EXCLUDED_COLUMN_LAST_CLASS}`;
  }
  if (metricIndex === 0) {
    return EXCLUDED_COLUMN_FIRST_CLASS;
  }
  if (metricIndex === metricCount - 1) {
    return EXCLUDED_COLUMN_LAST_CLASS;
  }
  return undefined;
}
