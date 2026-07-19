/**
 * Task Heatmap table component.
 *
 * Renders a grouped-header Ant Design Table from a `HeatmapResult` view model.
 * The first column (Student Name) is sticky with locale-aware sorting and
 * default ascending order. Each task column groups three metric sub-columns
 * (Completeness, Accuracy, SPaG) with score-range filters and a SPEC-ordered metric
 * comparator.
 *
 * The component owns local filter state (keyed by column key) so the score-range
 * filter dropdowns are functional.  Rows are paginated at 50 per page to bound
 * DOM node count on large classes.  `sortedRows`, `hasNoSubmissions`, and
 * `columns` are memoised to avoid redundant recomputation on each render.
 *
 * @see ACTION_PLAN.md §4 — TaskHeatmapTable
 * @see TASK_PREVIEW_CARD_LAYOUT.md — §"1. Popover trigger (metric sub-cell)", §"States", §"Accessibility and motion"
 * @see SPEC.md — §"Rendering rules", §"Sorting, filtering", §"Empty state"
 */

import type { CSSProperties, JSX } from 'react';
import { useMemo, useState } from 'react';
import { Alert, Popover, Skeleton, Table, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import type { FilterValue } from 'antd/es/table/interface';

import type {
  HeatmapResult,
  HeatmapRow,
  HeatmapTaskColumn,
} from '../../services/dataAnalysis/heatmapAdapter';
import type { MetricResult } from '../../services/dataAnalysis/dataAnalysis.zod';
import {
  compareHeatmapStudentName,
  METRIC_STATE_RANK_ASC,
} from './classPageModel';
import {
  METRIC_DISPLAY_META,
  HEATMAP_METRIC_KEYS,
} from '../../services/dataAnalysis/metricDisplay/metricDisplayMeta';
import type { HeatmapMetricKey } from '../../services/dataAnalysis/metricDisplay/metricDisplayMeta';
import {
  resolveMetricTone,
  type MetricToneRange,
} from '../../services/dataAnalysis/metricDisplay/metricTone';
import { buildMetricRangeFilter } from '../../services/dataAnalysis/metricDisplay/metricRangeFilter';
import { decodeFilterToRange } from '../../services/dataAnalysis/metricDisplay/metricRangeKey';
import { MetricIconLabel } from '../../components/MetricIconLabel/MetricIconLabel';
import { TaskPreviewCard } from './TaskPreviewCard';
import { assembleTaskPreviewData } from './assembleTaskPreviewData';
import type { CellPreviewLookup } from './buildCellPreviewLookup';
import {
  APP_COL_WIDTH_STUDENT_NAME,
  APP_COL_WIDTH_METRIC,
  APP_GAP_MD,
  APP_GAP_XS,
} from '../../theme/spacing';

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

/**
 * Number of decimal places for individual student task scores. Individual
 * task scores are always integers, so they are rendered without decimals.
 */
const INDIVIDUAL_SCORE_PRECISION = 0;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Retrieve the display label for a heatmap metric key.
 *
 * @param {HeatmapMetricKey} key - The metric key.
 * @returns {string} The display title.
 */
function getDisplayTitle(key: HeatmapMetricKey): string {
  return METRIC_DISPLAY_META.get(key)!.label;
}

/**
 * Extract a single cell metric by key via direct property access.
 *
 * @param {object} cell - The heatmap cell containing three metric results.
 * @param {MetricResult} cell.completeness - The completeness metric result.
 * @param {MetricResult} cell.accuracy - The accuracy metric result.
 * @param {MetricResult} cell.spag - The SPaG metric result.
 * @param {HeatmapMetricKey} key - The metric key to extract.
 * @returns {MetricResult} The matching metric result.
 */
function getCellMetric(
  cell: { completeness: MetricResult; accuracy: MetricResult; spag: MetricResult },
  key: HeatmapMetricKey,
): MetricResult {
  switch (key) {
    case 'completeness': {
      return cell.completeness;
    }
    case 'accuracy': {
      return cell.accuracy;
    }
    case 'spag': {
      return cell.spag;
    }
  }
}

/**
 * Render the display score text for a metric result.
 *
 * @param {MetricResult} metric - The metric result.
 * @returns {string} The formatted score string.
 */
function renderScore(metric: MetricResult): string {
  if (metric.state === 'computed') {
    return metric.value.toFixed(INDIVIDUAL_SCORE_PRECISION);
  }
  if (metric.state === 'notAttempted') {
    return 'N';
  }
  return 'E';
}

/**
 * SPEC-ordered metric comparator for heatmap table sort.
 *
 * Order: computed (numeric ascending) -> notAttempted -> error.
 * Tie-break within computed by value ascending; ultimate tie-break by
 * `studentId` ascending.
 *
 * @param {MetricResult} aMetric - First metric to compare.
 * @param {MetricResult} bMetric - Second metric to compare.
 * @param {string} aId - First row's studentId for tie-break.
 * @param {string} bId - Second row's studentId for tie-break.
 * @returns {number} Negative if `a < b`, positive if `a > b`, zero if equal.
 */
function heatmapMetricComparator(
  aMetric: MetricResult,
  bMetric: MetricResult,
  aId: string,
  bId: string,
): number {
  const aRank = METRIC_STATE_RANK_ASC.get(aMetric.state) ?? 0;
  const bRank = METRIC_STATE_RANK_ASC.get(bMetric.state) ?? 0;
  if (aRank !== bRank) return aRank - bRank;

  // Both are computed — compare by numeric value ascending
  if (aMetric.state === 'computed' && bMetric.state === 'computed') {
    return aMetric.value - bMetric.value;
  }

  // Tie-break by studentId ascending
  return aId.localeCompare(bId);
}

/**
 * Build a compare function for a single metric sub-column at the given task
 * index.
 *
 * @param {number} taskIndex - The index of the task column.
 * @param {HeatmapMetricKey} metric - The metric key.
 * @returns {(a: HeatmapRow, b: HeatmapRow) => number} A compare function.
 */
function buildMetricSorter(
  taskIndex: number,
  metric: HeatmapMetricKey,
): (a: HeatmapRow, b: HeatmapRow) => number {
  return (a: HeatmapRow, b: HeatmapRow): number =>
    heatmapMetricComparator(
      getCellMetric(a.cells[taskIndex], metric),
      getCellMetric(b.cells[taskIndex], metric),
      a.studentId,
      b.studentId,
    );
}

/**
 * Default scoring range for heatmap metric cells (0–5).
 */
const DEFAULT_TONE_RANGE: MetricToneRange = { lower: 0, upper: 5 };

/**
 * Inline skeleton for the TaskPreviewCard popover during assignment loading.
 *
 * Shape dimensions are hard-coded locally and cross-reference
 * TaskPreviewCard's private constants:
 *   CARD_MAX_WIDTH = 400
 *   CARD_BODY_MAX_HEIGHT = 480
 * Those constants must NOT be refactored out of TaskPreviewCard.tsx.
 *
 * @returns {JSX.Element} A skeleton placeholder matching the card shape.
 */
function TaskPreviewSkeleton(): JSX.Element {
  return (
    <div
      role="status"
      aria-busy="true"
      style={{ width: 400 }}
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
      <Skeleton.Input
        active
        size="small"
        style={{ width: '100%', height: 120 }}
      />
    </div>
  );
}

/**
 * Build the three metric sub-columns (Completeness, Accuracy, SPaG) for a
 * single task group.
 *
 * Extracted to avoid excessive function nesting inside `useMemo`.
 *
 * @param {HeatmapTaskColumn} taskColumn - The task column descriptor.
 * @param {number} taskIndex - The index of the task within the heatmap.
 * @param {Record<string, FilterValue | null>} tableFilters - Current filter state.
 * @param {CellPreviewLookup | null} cellPreviewLookup - Assignment lookup keyed by studentId × taskId.
 * @param {boolean} isAssignmentLoading - Whether the assignment query is still pending.
 * @param {boolean} showAssignmentError - Whether the assignment query errored or returned null.
 * @returns {TableColumnsType<HeatmapRow>} Three metric sub-column definitions.
 */
function buildTaskMetricSubColumns(
  taskColumn: HeatmapTaskColumn,
  taskIndex: number,
  tableFilters: Record<string, FilterValue | null>,
  cellPreviewLookup: CellPreviewLookup | null,
  isAssignmentLoading: boolean,
  showAssignmentError: boolean,
): TableColumnsType<HeatmapRow> {
  return HEATMAP_METRIC_KEYS.map((metric) => {
    const meta = METRIC_DISPLAY_META.get(metric)!;
    const columnKey = `${taskColumn.taskKey}::${metric}`;
    const filterValue = tableFilters[columnKey];
    const rangeFilter = buildMetricRangeFilter<HeatmapRow>({
      range: DEFAULT_TONE_RANGE,
      getMetric: (record): MetricResult => getCellMetric(record.cells[taskIndex], metric),
      activeRange: decodeFilterToRange(filterValue),
      activeFilterKey: filterValue && filterValue.length > 0 && typeof filterValue[0] === 'string'
        ? filterValue[0]
        : undefined,
    });
    return {
      key: columnKey,
      title: <MetricIconLabel icon={meta.icon} label={meta.label} />,
      align: 'center' as const,
      width: APP_COL_WIDTH_METRIC,
      ...rangeFilter,
      sorter: {
        compare: buildMetricSorter(taskIndex, metric),
        multiple: 2,
      },
      onCell: (record: HeatmapRow): { style: CSSProperties; 'aria-label': string } => {
        const m = getCellMetric(record.cells[taskIndex], metric);
        const { cellStyle } = resolveMetricTone(m);
        const score = renderScore(m);
        const ariaLabel = `${record.studentName}, ${taskColumn.taskId}, ${getDisplayTitle(metric)}: ${score}`;
        return {
          style: cellStyle,
          'aria-label': ariaLabel,
        };
      },
      render: (_: unknown, record: HeatmapRow): JSX.Element => {
        const m = getCellMetric(record.cells[taskIndex], metric);
        const cellData = cellPreviewLookup?.get(record.studentId)?.get(taskColumn.taskId) ?? null;
        const previewData = assembleTaskPreviewData(cellData, m, metric, taskColumn.taskId);

        let popoverContent: JSX.Element;
        if (isAssignmentLoading) {
          popoverContent = <TaskPreviewSkeleton />;
        } else if (showAssignmentError) {
          popoverContent = <Alert type="error" showIcon title="Couldn't load task details" />;
        } else {
          popoverContent = <TaskPreviewCard data={previewData} />;
        }

        return (
          <Popover
            trigger={['hover', 'click']}
            placement="right"
            content={popoverContent}
          >
            {/* 4px padding (APP_GAP_XS, documented half-unit exception) widens the
                Popover hover/click target around the score without covering the
                whole cell; inline-block is required for padding to take effect. */}
            <span
              tabIndex={0}
              role="button"
              style={{ padding: APP_GAP_XS, display: 'inline-block' }}
              onKeyDown={(event): void => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  (event.currentTarget as HTMLElement).click();
                }
              }}
            >
              {renderScore(m)}
            </span>
          </Popover>
        );
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Render a heatmap table from the given `HeatmapResult`.
 *
 * @param {Readonly<{ heatmapResult: HeatmapResult }>} props - Component properties.
 * @returns {JSX.Element} The rendered table.
 */
export function TaskHeatmapTable({
  heatmapResult,
  cellPreviewLookup,
  isAssignmentLoading,
  showAssignmentError,
}: Readonly<{
  heatmapResult: HeatmapResult;
  cellPreviewLookup: CellPreviewLookup | null;
  isAssignmentLoading: boolean;
  showAssignmentError: boolean;
}>): JSX.Element {
  const { taskColumns, rows } = heatmapResult;

  // ── Table-level filter state lifted from the onChange callback ──────────
  const [tableFilters, setTableFilters] = useState<Record<string, FilterValue | null>>({});

  // ── Memoised derived values ─────────────────────────────────────────────

  // Pre-sort by student name ascending so the default sort order is applied
  // to the initial render. Ant Design Table applies subsequent sorter changes
  // over the dataSource prop.
  const sortedRows = useMemo(
    () => rows.toSorted(compareHeatmapStudentName),
    [rows],
  );

  // Determine whether every cell across every row is not-attempted (the "no
  // submissions" empty-state variant). The guard includes `taskColumns.length > 0`
  // to prevent a false caption when the assignment has zero tasks.
  const hasNoSubmissions = useMemo(
    () =>
      taskColumns.length > 0 &&
      rows.length > 0 &&
      rows.every((row) =>
        row.cells.every(
          (cell) =>
            cell.completeness.state === 'notAttempted' &&
            cell.accuracy.state === 'notAttempted' &&
            cell.spag.state === 'notAttempted',
        ),
      ),
    [rows, taskColumns],
  );

  const columns: TableColumnsType<HeatmapRow> = useMemo(
    () => [
      // ── Student Name (top-level column, no children) ──────────────
      {
        key: 'studentName',
        title: 'Student Name',
        fixed: 'start',
        width: APP_COL_WIDTH_STUDENT_NAME,
        sorter: { compare: compareHeatmapStudentName, multiple: 1 },
        defaultSortOrder: 'ascend',
        render: (_: unknown, record: HeatmapRow): JSX.Element => (
          <Typography.Text>{record.studentName}</Typography.Text>
        ),
      },

      // ── Per-task group columns ────────────────────────────────────
      ...taskColumns.map((taskColumn, taskIndex) => ({
        key: taskColumn.taskKey,
        title: taskColumn.taskTitle ?? taskColumn.taskId,
        children: buildTaskMetricSubColumns(
          taskColumn,
          taskIndex,
          tableFilters,
          cellPreviewLookup,
          isAssignmentLoading,
          showAssignmentError,
        ),
      })),
    ],
    [taskColumns, tableFilters, cellPreviewLookup, isAssignmentLoading, showAssignmentError],
  );

  return (
    <>
      {hasNoSubmissions && (
        <Typography.Paragraph>No submissions yet</Typography.Paragraph>
      )}
      <Table<HeatmapRow>
        rowKey="studentId"
        columns={columns}
        dataSource={sortedRows}
        pagination={{ pageSize: 50, showSizeChanger: true }}
        size="small"
        bordered
        scroll={{ x: 'max-content' }}
        aria-label="Task Heatmap"
        onChange={(_pagination, filters): void => {
          setTableFilters(filters as Record<string, FilterValue | null>);
        }}
      />
    </>
  );
}
