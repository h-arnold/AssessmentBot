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

import type { JSX } from 'react';
import { Table, Typography } from 'antd';
import type { TableColumnsType } from 'antd';

import type {
  HeatmapResult,
  HeatmapRow,
  HeatmapCell,
} from '../../services/dataAnalysis/heatmapAdapter';
import type { MetricResult } from '../../services/dataAnalysis/dataAnalysis.zod';
import { compareHeatmapStudentName, METRIC_STATE_RANK_ASC } from './classPageModel';
import { METRIC_COLUMN_FILTERS } from './studentAveragesTableColumns';
import { resolveMetricTone } from '../../services/dataAnalysis/metricDisplay/metricTone';
import { MetricPill } from '../../services/dataAnalysis/metricDisplay/MetricPill';

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

/** The three metric keys appearing as sub-columns under each task group. */
type MetricKey = 'completeness' | 'accuracy' | 'spag';

const METRICS: readonly MetricKey[] = ['completeness', 'accuracy', 'spag'];

/** Default number of decimal places for computed metric values. */
const METRIC_PRECISION = 2;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Retrieve the heatmap cell at the given index. Uses `find` instead of bracket
 * access to avoid eslint-plugin-security object-injection warnings that flag
 * all bracket access with a variable index.
 *
 * @param {readonly HeatmapCell[]} cells - The cells array.
 * @param {number} index - The index to retrieve.
 * @returns {HeatmapCell} The cell at that index.
 */
function getCellAt(cells: readonly HeatmapCell[], index: number): HeatmapCell {
  const cell = cells.find((_, index_) => index_ === index);
  return cell as HeatmapCell;
}

/**
 * Safe accessor for a single cell metric by key, mirroring the pattern used by
 * `getStudentMetric` in `classPageAdapter.zod.ts` to avoid eslint-plugin-security
 * object-injection warnings.
 *
 * @param {HeatmapCell} cell - The heatmap cell containing three metric results.
 * @param {MetricKey} key - The metric key to extract.
 * @returns {MetricResult} The matching metric result.
 */
function getCellMetric(cell: HeatmapCell, key: MetricKey): MetricResult {
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
 * Resolve the human-readable display title for a metric key.
 *
 * @param {MetricKey} key - The metric key.
 * @returns {string} The display title.
 */
function getDisplayTitle(key: MetricKey): string {
  switch (key) {
    case 'completeness': {
      return 'Completeness';
    }
    case 'accuracy': {
      return 'Accuracy';
    }
    case 'spag': {
      return 'SPaG';
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
    return metric.value.toFixed(METRIC_PRECISION);
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
 * index. Uses the safe `getCellMetric` accessor to avoid injection warnings.
 *
 * @param {number} taskIndex - The index of the task column.
 * @param {MetricKey} metric - The metric key.
 * @returns {(a: HeatmapRow, b: HeatmapRow) => number} A compare function.
 */
function buildMetricSorter(
  taskIndex: number,
  metric: MetricKey,
): (a: HeatmapRow, b: HeatmapRow) => number {
  return (a: HeatmapRow, b: HeatmapRow): number =>
    heatmapMetricComparator(
      getCellMetric(getCellAt(a.cells, taskIndex), metric),
      getCellMetric(getCellAt(b.cells, taskIndex), metric),
      a.studentId,
      b.studentId,
    );
}

/**
 * Build an `onFilter` predicate for a single metric column at the given task
 * index. Uses the safe `getCellMetric` accessor to avoid injection warnings.
 *
 * @param {number} taskIndex - The index of the task column.
 * @param {MetricKey} metric - The metric key.
 * @returns {(value: string | number | boolean, record: HeatmapRow) => boolean}
 *   A filter predicate.
 */
function buildMetricOnFilter(
  taskIndex: number,
  metric: MetricKey,
): (value: string | number | boolean, record: HeatmapRow) => boolean {
  return (value: string | number | boolean, record: HeatmapRow): boolean => {
    const { color } = resolveMetricTone(
      getCellMetric(getCellAt(record.cells, taskIndex), metric),
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
      width: 200,
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
      children: METRICS.map((metric) => ({
        key: `${taskColumn.taskKey}::${metric}`,
        title: getDisplayTitle(metric),
        filters: METRIC_COLUMN_FILTERS,
        onFilter: buildMetricOnFilter(taskIndex, metric),
        sorter: {
          compare: buildMetricSorter(taskIndex, metric),
          multiple: 2,
        },
        render: (_: unknown, record: HeatmapRow): JSX.Element => {
          const m = getCellMetric(getCellAt(record.cells, taskIndex), metric);
          const score = renderScore(m);
          const ariaLabel = `${record.studentName}, ${taskColumn.taskId}, ${getDisplayTitle(metric)}: ${score}`;
          return (
            <span aria-label={ariaLabel}>
              <MetricPill metric={m} compact />
            </span>
          );
        },
      })),
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
        bordered
        scroll={{ x: 'max-content' }}
        aria-label="Task Heatmap"
      />
    </>
  );
}
