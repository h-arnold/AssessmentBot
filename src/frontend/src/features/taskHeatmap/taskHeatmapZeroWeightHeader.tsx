import type { ReactNode } from 'react';
import { Tooltip } from 'antd';

import type { AverageContribution } from '../../services/dataAnalysis/dataAnalysis.zod';

export const ZERO_WEIGHT_EXPLANATION =
  'Zero weighting — scores are shown but do not contribute to averages.';
export const ZERO_WEIGHT_GROUP_CLASS = 'task-heatmap-zero-weight-group';
export const ZERO_WEIGHT_TOOLTIP_TARGET_CLASS = 'task-heatmap-zero-weight-tooltip-target';
export const ZERO_WEIGHT_FIRST_CLASS = 'task-heatmap-zero-weight-first';
export const ZERO_WEIGHT_LAST_CLASS = 'task-heatmap-zero-weight-last';

/**
 * Select the plain or explanatory rendering for a task-group heading.
 * @param {string} title - Full task title or ID fallback.
 * @param {AverageContribution} averageContribution - Validated adapter metadata.
 * @returns {{ title: ReactNode; className?: string; onHeaderCell?: () => { 'aria-label': string } }} Header presentation properties.
 */
export function buildTaskHeaderPresentation(
  title: string,
  averageContribution: AverageContribution
): Readonly<{
  title: ReactNode;
  className?: string;
  onHeaderCell?: () => { 'aria-label': string };
}> {
  if (averageContribution.includedInAverage) {
    return { title };
  }

  return {
    title: (
      <Tooltip
        title={ZERO_WEIGHT_EXPLANATION}
        trigger={['hover', 'focus']}
      >
        <span
          className={ZERO_WEIGHT_TOOLTIP_TARGET_CLASS}
          role="group"
          tabIndex={0}
          aria-label={`${title} ${ZERO_WEIGHT_EXPLANATION}`}
        >
          {title}
        </span>
      </Tooltip>
    ),
    className: ZERO_WEIGHT_GROUP_CLASS,
    onHeaderCell: () => ({
      'aria-label': `${title} — ${ZERO_WEIGHT_EXPLANATION}`,
    }),
  };
}

/**
 * Select the edge marker class for a metric column in a task group.
 * @param {number} metricIndex - Metric's zero-based index in the group.
 * @param {number} metricCount - Number of metric columns in the group.
 * @param {AverageContribution} averageContribution - Validated adapter metadata.
 * @returns {string | undefined} Edge marker class, if this column is an edge of an excluded group.
 */
export function getZeroWeightMetricEdgeClass(
  metricIndex: number,
  metricCount: number,
  averageContribution: AverageContribution
): string | undefined {
  if (averageContribution.includedInAverage) {
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
