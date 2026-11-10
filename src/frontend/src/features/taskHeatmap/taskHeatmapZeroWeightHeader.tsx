import type { ReactNode } from 'react';
import { Tooltip } from 'antd';

import type { AverageContribution } from '@/services/dataAnalysis/dataAnalysis.zod';

export const ZERO_WEIGHT_EXPLANATION =
  'Zero weighting — scores are shown but do not contribute to averages.';
export const ZERO_WEIGHT_GROUP_CLASS = 'task-heatmap-zero-weight-group';
export const ZERO_WEIGHT_TOOLTIP_TARGET_CLASS = 'task-heatmap-zero-weight-tooltip-target';
export const ZERO_WEIGHT_FIRST_CLASS = 'task-heatmap-zero-weight-first';
export const ZERO_WEIGHT_LAST_CLASS = 'task-heatmap-zero-weight-last';

export const BASELINE_OFF_EXPLANATION =
  'Task outside the baseline set — shown, but not included in baseline averages.';
export const BASELINE_CAPTION =
  '† Tasks marked with this symbol are outside the baseline task set. Their values are unchanged; averages exclude them.';
export const BASELINE_MARKER = '†';

/**
 * Select the plain or marked rendering for a task-group heading.
 *
 * A heading is marked when its column is zero-weighted, outside the attempt
 * baseline, or both. One visual language covers both causes (shared group
 * class, tooltip target and edge classes); the tooltip and the accessible
 * labels distinguish them, composing the baseline fact before the zero-weight
 * fact when both apply.
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
  if (averageContribution.includedInAverage && options.includedInAttemptBaseline) {
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
      <Tooltip title={explanation} trigger={['hover', 'focus']}>
        <span
          className={ZERO_WEIGHT_TOOLTIP_TARGET_CLASS}
          role="group"
          tabIndex={0}
          aria-label={`${displayTitle} ${explanation}`}
        >
          {displayTitle}
        </span>
      </Tooltip>
    ),
    className: ZERO_WEIGHT_GROUP_CLASS,
    onHeaderCell: () => {
      return {
        'aria-label': `${displayTitle} — ${explanation}`,
      };
    },
  };
}

/**
 * Select the edge marker class for a metric column in a task group.
 *
 * The zero-weight edge classes apply to every marked column — zero-weighted
 * or outside the attempt baseline — so one visual language carries both
 * causes.
 *
 * @param {number} metricIndex - Metric's zero-based index in the group.
 * @param {number} metricCount - Number of metric columns in the group.
 * @param {AverageContribution} averageContribution - Validated adapter metadata.
 * @param {Readonly<{ includedInAttemptBaseline: boolean }>} options - The column's attempt-baseline membership.
 * @returns {string | undefined} Edge marker class, if this column is an edge of an excluded group.
 */
export function getZeroWeightMetricEdgeClass(
  metricIndex: number,
  metricCount: number,
  averageContribution: AverageContribution,
  options: Readonly<{ includedInAttemptBaseline: boolean }>
): string | undefined {
  if (averageContribution.includedInAverage && options.includedInAttemptBaseline) {
    return undefined;
  }
  if (metricCount === 1 && metricIndex === 0) {
    return `${ZERO_WEIGHT_FIRST_CLASS} ${ZERO_WEIGHT_LAST_CLASS}`;
  }
  if (metricIndex === 0) {
    return ZERO_WEIGHT_FIRST_CLASS;
  }
  if (metricIndex === metricCount - 1) {
    return ZERO_WEIGHT_LAST_CLASS;
  }
  return undefined;
}
