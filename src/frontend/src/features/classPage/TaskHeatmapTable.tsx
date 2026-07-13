/**
 * Task Heatmap table component.
 *
 * Renders a grouped-header Ant Design Table from a `HeatmapResult` view model.
 * The first column (Student Name) is sticky with locale-aware sorting and
 * default ascending order. Each task column groups three metric sub-columns
 * (Completeness, Accuracy, SPaG) with band filters and a SPEC-ordered metric
 * comparator.
 *
 * @see ACTION_PLAN.md §4 — TaskHeatmapTable
 * @see TASK_HEATMAP_LAYOUT.md — §"3. Table region", §"Cell rendering", §"States"
 * @see SPEC.md — §"Rendering rules", §"Sorting, filtering", §"Empty state"
 */

import type { CSSProperties, JSX } from 'react';
import { Table, Typography } from 'antd';
import type { TableColumnsType } from 'antd';

import type {
  HeatmapResult,
  HeatmapRow,
} from '../../services/dataAnalysis/heatmapAdapter';
import type { MetricResult } from '../../services/dataAnalysis/dataAnalysis.zod';
import {
  compareHeatmapStudentName,
  METRIC_STATE_RANK_ASC,
  METRIC_DISPLAY_META,
  HEATMAP_METRIC_KEYS,
} from './classPageModel';
import type { HeatmapMetricKey } from './classPageModel';
import { METRIC_COLUMN_FILTERS } from './studentAveragesTableColumns';
import {
  resolveMetricTone,
  METRIC_TONE_CELL_STYLE,
} from '../../services/dataAnalysis/metricDisplay/metricTone';
import { MetricIconLabel } from './MetricIconLabel';
import {
  APP_COL_WIDTH_STUDENT_NAME,
  APP_COL_WIDTH_METRIC,
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
 * Build an `onFilter` predicate for a single metric column at the given task
 * index.
 *
 * @param {number} taskIndex - The index of the task column.
 * @param {HeatmapMetricKey} metric - The metric key.
 * @returns {(value: string | number | boolean, record: HeatmapRow) => boolean}
 *   A filter predicate.
 */
function buildMetricOnFilter(
  taskIndex: number,
  metric: HeatmapMetricKey,
): (value: string | number | boolean, record: HeatmapRow) => boolean {
  return (value: string | number | boolean, record: HeatmapRow): boolean => {
    const { color } = resolveMetricTone(
      getCellMetric(record.cells[taskIndex], metric),
    );
    return color === String(value);
  };
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
}: Readonly<{ heatmapResult: HeatmapResult }>): JSX.Element {
  const { taskColumns, rows } = heatmapResult;

  // Pre-sort by student name ascending so the default sort order is applied
  // to the initial render. Ant Design Table applies subsequent sorter changes
  // over the dataSource prop.
  const sortedRows = rows.toSorted(compareHeatmapStudentName);

  // Determine whether every cell across every row is not-attempted (the "no
  // submissions" empty-state variant). The guard includes `taskColumns.length > 0`
  // to prevent a false caption when the assignment has zero tasks.
  const hasNoSubmissions =
    taskColumns.length > 0 &&
    rows.length > 0 &&
    rows.every((row) =>
      row.cells.every(
        (cell) =>
          cell.completeness.state === 'notAttempted' &&
          cell.accuracy.state === 'notAttempted' &&
          cell.spag.state === 'notAttempted',
      ),
    );

  const columns: TableColumnsType<HeatmapRow> = [
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
      title: taskColumn.taskTitle,
      children: HEATMAP_METRIC_KEYS.map((metric) => {
        const meta = METRIC_DISPLAY_META.get(metric)!;
        return {
          key: `${taskColumn.taskKey}::${metric}`,
          title: <MetricIconLabel icon={meta.icon} label={meta.label} />,
          align: 'center' as const,
          width: APP_COL_WIDTH_METRIC,
          filters: METRIC_COLUMN_FILTERS,
          onFilter: buildMetricOnFilter(taskIndex, metric),
          sorter: {
            compare: buildMetricSorter(taskIndex, metric),
            multiple: 2,
          },
          onCell: (record: HeatmapRow): { style: CSSProperties; 'aria-label': string } => {
            const m = getCellMetric(record.cells[taskIndex], metric);
            const { color } = resolveMetricTone(m);
            const score = renderScore(m);
            const ariaLabel = `${record.studentName}, ${taskColumn.taskId}, ${getDisplayTitle(metric)}: ${score}`;
            return {
              style: METRIC_TONE_CELL_STYLE[color],
              'aria-label': ariaLabel,
            };
          },
          render: (_: unknown, record: HeatmapRow): JSX.Element => {
            const m = getCellMetric(record.cells[taskIndex], metric);
            return <span>{renderScore(m)}</span>;
          },
        };
      }),
    })),
  ];

  return (
    <>
      {hasNoSubmissions && (
        <Typography.Paragraph>No submissions yet</Typography.Paragraph>
      )}
      <Table<HeatmapRow>
        rowKey="studentId"
        columns={columns}
        dataSource={sortedRows}
        pagination={false}
        size="small"
        bordered
        scroll={{ x: 'max-content' }}
        aria-label="Task Heatmap"
      />
    </>
  );
}
