/**
 * Loading, error, and ready body for one heatmap metric preview.
 *
 * @remarks
 * Preview data assembly is deferred until the popover body mounts.
 */

import { useMemo, type JSX, type RefCallback } from 'react';
import { Alert, Skeleton } from 'antd';

import type { TaskDisplayMetric } from '@/services/dataAnalysis/dataAnalysis.zod';
import type { HeatmapMetricKey } from '@/services/dataAnalysis/metricDisplay/metricDisplayMeta';
import type { CellPreviewData } from './buildCellPreviewLookup';
import { assembleTaskPreviewData } from './assembleTaskPreviewData';
import {
  TaskPreviewCard,
  CARD_MAX_WIDTH,
  type SourceActionElement,
  type TaskPreviewData,
} from './TaskPreviewCard';
import { APP_GAP_MD } from '@/theme/spacing';

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
 * Resolve the card data for a known-error fallback whose full fetch has settled.
 *
 * @remarks
 * A pending fetch leaves only the source region loading; a terminal failure
 * resolves it to unavailable so the preview never stays on a perpetual load.
 *
 * @param {TaskPreviewData} previewData - The assembled preview data.
 * @param {Object} status - The owning column's query status.
 * @param {boolean} status.isLoading - Whether the full read is still pending.
 * @param {boolean} status.hasError - Whether the full read terminally failed.
 * @returns {TaskPreviewData} The preview data to render.
 */
function resolveKnownErrorSourceState(
  previewData: TaskPreviewData,
  status: Readonly<{ isLoading: boolean; hasError: boolean }>
): TaskPreviewData {
  if (status.isLoading) {
    return { ...previewData, sourceState: 'loading' };
  }
  if (status.hasError && previewData.sourceState === 'loading') {
    return { ...previewData, sourceState: 'unavailable' };
  }
  return previewData;
}

/**
 * Whole-preview skeleton shown only when no known result can yet be displayed.
 *
 * @remarks
 * The width mirrors `CARD_MAX_WIDTH` so the popover does not resize when the
 * ready card arrives.
 *
 * @returns {JSX.Element} The labelled busy skeleton region.
 */
function WholePreviewSkeleton(): JSX.Element {
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
      <Skeleton active paragraph={{ rows: 3 }} title={false} style={{ marginBottom: APP_GAP_MD }} />
      {/* Artifact image placeholder — approximate height for an image block */}
      <Skeleton.Input active size="small" style={{ width: '100%', height: 120 }} />
    </output>
  );
}

/**
 * Render the whole-preview placeholder when no known result can be shown.
 *
 * @param {Object} status - The owning column's query status.
 * @param {boolean} status.isLoading - Whether the full read is still pending.
 * @param {boolean} status.hasError - Whether the full read terminally failed.
 * @returns {JSX.Element} The skeleton (pending) or the generic error Alert.
 */
function renderWholePreviewPlaceholder(
  status: Readonly<{ isLoading: boolean; hasError: boolean }>
): JSX.Element {
  return status.isLoading ? (
    <WholePreviewSkeleton />
  ) : (
    <Alert type="error" showIcon title={PREVIEW_ERROR_TEXT} />
  );
}

/**
 * Build the popover content for a single metric cell.
 *
 * Resolves the per-column status (loading → skeleton, error → alert, else the
 * deferred `TaskPreviewCard`). The expensive `assembleTaskPreviewData` call
 * stays deferred until this content is actually opened by the popover, and is
 * memoised across re-renders of the ready body.
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
  // A known class-partial `E` is usable card data even while the full read is
  // pending or has terminally failed: the reasoning stays visible, and the
  // assembly resolves the source region to loading/unavailable accordingly.
  const hasKnownError = cellData?.errors[metricKey] != null;
  const isWholePreviewPlaceholder = (isLoading || hasError) && !hasKnownError;

  const previewData = useMemo(() => {
    return isWholePreviewPlaceholder
      ? null
      : assembleTaskPreviewData(cellData, metricResult, metricKey, taskId);
  }, [cellData, metricResult, metricKey, taskId, isWholePreviewPlaceholder]);

  if (isWholePreviewPlaceholder) {
    return renderWholePreviewPlaceholder({ isLoading, hasError });
  }

  if (previewData === null) {
    return <Alert type="error" showIcon title={PREVIEW_ERROR_TEXT} />;
  }

  if (!hasKnownError) {
    return <TaskPreviewCard data={previewData} sourceAnchorRef={sourceAnchorRef} />;
  }

  return (
    <TaskPreviewCard
      data={resolveKnownErrorSourceState(previewData, { isLoading, hasError })}
      sourceAnchorRef={sourceAnchorRef}
    />
  );
}
