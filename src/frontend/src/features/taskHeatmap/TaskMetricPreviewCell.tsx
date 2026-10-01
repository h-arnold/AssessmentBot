/**
 * Popover trigger for a single heatmap metric cell.
 *
 * Sibling of `TaskMetricPreviewContent.tsx`; both were extracted from
 * `taskHeatmapTableColumns.tsx`, which keeps column construction (shape,
 * sorting, filtering, tier grouping, `<td>` tone and accessible labels) and
 * delegates rendering to this module.
 *
 * @remarks
 * **Deferred assembly.** The popover body is only built once the overlay
 * mounts, via `DeferredPopoverContent`, so `assembleTaskPreviewData` never
 * runs while the Popover is closed. Trigger activation stays pointer-first
 * (`hover` + `click`); controlled focus ownership and Escape restoration are
 * deliberately not implemented here yet.
 */

import type { JSX } from 'react';
import { Popover } from 'antd';

import { DeferredPopoverContent } from './DeferredPopoverContent';
import {
  TaskMetricPreviewContent,
  type TaskMetricPreviewContentProperties,
} from './TaskMetricPreviewContent';
import { APP_GAP_XS } from '../../theme/spacing';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Inputs required to render one metric cell and its deferred popover body. */
export interface TaskMetricPreviewCellProperties extends TaskMetricPreviewContentProperties {
  /** Accessible label shared by the table cell (`onCell`) and this trigger. */
  readonly accessibleLabel: string;
  /** Formatted score text rendered inside the trigger. */
  readonly scoreText: string;
}

// ---------------------------------------------------------------------------
// TaskMetricPreviewCell component
// ---------------------------------------------------------------------------

/**
 * Metric-cell score trigger wrapped in the preview Popover.
 *
 * @remarks
 * Tone mapping stays a `<td>` responsibility (`onCell` in the column module),
 * so this trigger paints no background of its own and carries the shared
 * accessible label rather than restating cell styling.
 *
 * @param {Readonly<TaskMetricPreviewCellProperties>} props - Cell inputs.
 * @returns {JSX.Element} The popover-wrapped score trigger.
 */
export function TaskMetricPreviewCell({
  accessibleLabel,
  scoreText,
  cellData,
  metricResult,
  metricKey,
  taskId,
  isLoading,
  hasError,
}: Readonly<TaskMetricPreviewCellProperties>): JSX.Element {
  return (
    <Popover
      trigger={['hover', 'click']}
      placement="right"
      destroyOnHidden
      content={
        <DeferredPopoverContent
          buildContent={() => (
            <TaskMetricPreviewContent
              cellData={cellData}
              metricResult={metricResult}
              metricKey={metricKey}
              taskId={taskId}
              isLoading={isLoading}
              hasError={hasError}
            />
          )}
        />
      }
    >
      {/* 4px padding (APP_GAP_XS, documented half-unit exception) widens the
          Popover hover/click target around the score without covering the
          whole cell; inline-block is required for padding to take effect. */}
      <span
        tabIndex={0}
        role="button"
        aria-label={accessibleLabel}
        style={{ padding: APP_GAP_XS, display: 'inline-block' }}
        onKeyDown={(event): void => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            (event.currentTarget as HTMLElement).click();
          }
        }}
      >
        {scoreText}
      </span>
    </Popover>
  );
}
