/**
 * Popover body for a single heatmap metric cell.
 *
 * Sibling of `TaskMetricPreviewCell.tsx`; both were extracted from
 * `taskHeatmapTableColumns.tsx` so the column module keeps only column
 * construction (shape, sorting, filtering, tier grouping, `<td>` tone and
 * accessible labels) while this module owns the three preview states:
 * loading skeleton, error alert, or the ready `TaskPreviewCard`.
 *
 * @remarks
 * **Deferred assembly.** `assembleTaskPreviewData` still runs only when this
 * content actually renders. A function-valued Ant Design `content` prop is not
 * sufficient on its own, because Ant evaluates it while the Popover is merely
 * rendered, so the cell mounts this body behind `DeferredPopoverContent`, at
 * the overlay's open-state mount boundary.
 *
 * @see `DeferredPopoverContent.tsx`
 * @see `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
 */

import type { JSX } from 'react';
import { Alert, Skeleton } from 'antd';

import type { TaskDisplayMetric } from '../../services/dataAnalysis/dataAnalysis.zod';
import type { HeatmapMetricKey } from '../../services/dataAnalysis/metricDisplay/metricDisplayMeta';
import type { CellPreviewData } from './buildCellPreviewLookup';
import { assembleTaskPreviewData } from './assembleTaskPreviewData';
import { TaskPreviewCard, CARD_MAX_WIDTH } from './TaskPreviewCard';
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
}

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
 * opened by the popover (see the module remarks).
 *
 * @param {Readonly<TaskMetricPreviewContentProperties>} props - Content inputs.
 * @returns {JSX.Element} The popover content (skeleton, alert, or TaskPreviewCard).
 */
export function TaskMetricPreviewContent({
  cellData,
  metricResult,
  metricKey,
  taskId,
  isLoading,
  hasError,
}: Readonly<TaskMetricPreviewContentProperties>): JSX.Element {
  if (isLoading) {
    return (
      <output
        aria-busy="true"
        aria-label="Loading task preview"
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
    return <Alert type="error" showIcon title="Couldn't load task details" />;
  }

  // Defer the expensive assembleTaskPreviewData call until the popover opens.
  const previewData = assembleTaskPreviewData(cellData, metricResult, metricKey, taskId);
  return <TaskPreviewCard data={previewData} />;
}
