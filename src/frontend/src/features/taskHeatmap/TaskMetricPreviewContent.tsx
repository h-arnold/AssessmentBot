/**
 * Loading, error, and ready body for one heatmap metric preview.
 *
 * @remarks
 * Preview data assembly is deferred until the popover body mounts.
 */

import { useMemo, type JSX, type RefCallback } from 'react';
import { Alert, Skeleton } from 'antd';

import type { TaskDisplayMetric } from '../../services/dataAnalysis/dataAnalysis.zod';
import type { HeatmapMetricKey } from '../../services/dataAnalysis/metricDisplay/metricDisplayMeta';
import type { CellPreviewData } from './buildCellPreviewLookup';
import { assembleTaskPreviewData } from './assembleTaskPreviewData';
import { TaskPreviewCard, CARD_MAX_WIDTH, type SourceActionElement } from './TaskPreviewCard';
import { APP_GAP_MD } from '../../theme/spacing';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Inputs required to render one metric cell's popover body. The owning cell
 * passes these through unchanged from the column builder.
 */
export interface TaskMetricPreviewContentProperties {
  /** The cell preview data from the lookup. */
  readonly cellData: CellPreviewData | null;
  /** The analyser's metric result for this cell. */
  readonly metricResult: TaskDisplayMetric;
  /** Which metric column this preview is for. */
  readonly metricKey: HeatmapMetricKey;
  /** The heatmap column's task ID. */
  readonly taskId: string;
  /** Whether this column's preview query is pending. */
  readonly isLoading: boolean;
  /** Whether this column's preview query errored or returned null. */
  readonly hasError: boolean;
  /**
   * Optional internal UI hook forwarded to the ready card's source action.
   *
   * @remarks
   * Only the ready state renders an action at all, so the loading skeleton and
   * the error alert leave this hook untouched — which is exactly what tells the
   * owning metric cell that this preview has nothing yet to hand focus to.
   */
  readonly sourceAnchorRef?: RefCallback<SourceActionElement>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Accessible label of the loading skeleton region, announced by the metric
 * cell while the preview query is pending.
 */
export const LOADING_PREVIEW_LABEL = 'Loading task preview';

/** Error alert text shown when the preview fails to load. */
export const PREVIEW_ERROR_TEXT = "Couldn't load task details";

// ---------------------------------------------------------------------------
// TaskMetricPreviewContent component
// ---------------------------------------------------------------------------

/**
 * Build the popover content for a single metric cell.
 *
 * Resolves the per-column status (loading → skeleton, error → alert, else the
 * deferred `TaskPreviewCard`). The skeleton width (400px) mirrors
 * `CARD_MAX_WIDTH` from `TaskPreviewCard.tsx`. The expensive
 * `assembleTaskPreviewData` call stays deferred until this content is actually
 * opened by the popover, and is memoised across re-renders of the ready body.
 *
 * @param {Readonly<TaskMetricPreviewContentProperties>} props - Content inputs.
 * @returns {JSX.Element | null} The popover content (skeleton, alert, or ready card).
 */
export function TaskMetricPreviewContent({
  cellData,
  metricResult,
  metricKey,
  taskId,
  isLoading,
  hasError,
  sourceAnchorRef,
}: Readonly<TaskMetricPreviewContentProperties>): JSX.Element | null {
  const previewData = useMemo(
    () =>
      isLoading || hasError
        ? null
        : assembleTaskPreviewData(cellData, metricResult, metricKey, taskId),
    [cellData, metricResult, metricKey, taskId, isLoading, hasError]
  );

  if (isLoading) {
    return (
      <output
        aria-busy="true"
        aria-label={LOADING_PREVIEW_LABEL}
        style={{ display: 'block', width: CARD_MAX_WIDTH }}
      >
        {/* Title bar — approximates TaskPreviewCard header height */}
        <Skeleton.Input
          active
          size="small"
          style={{ width: 200, height: 24, marginBottom: APP_GAP_MD }}
        />
        {/* Reasoning skeleton — 3 rows matching the card's reasoning section */}
        <Skeleton
          active
          paragraph={{ rows: 3 }}
          title={false}
          style={{ marginBottom: APP_GAP_MD }}
        />
        {/* Artifact image placeholder — approximate height for an image block */}
        <Skeleton.Input active size="small" style={{ width: '100%', height: 120 }} />
      </output>
    );
  }

  if (hasError) {
    return <Alert type="error" showIcon title={PREVIEW_ERROR_TEXT} />;
  }

  return <TaskPreviewCard data={previewData!} sourceAnchorRef={sourceAnchorRef} />;
}
