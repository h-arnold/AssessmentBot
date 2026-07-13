/**
 * Column definitions for the Student Averages table.
 *
 * Exports a pure function that returns five column definitions in fixed order:
 * `studentName`, `completeness`, `accuracy`, `spag`, `average`. The metric
 * columns share a common pattern: coloured-cell rendering (band background via
 * `METRIC_TONE_CELL_STYLE`), band filters using `MetricToneColor` tokens, and
 * `onFilter` via `resolveMetricTone`.
 *
 * @remarks
 * The `MetricToneColor` token set is the filter value set (not the
 * `MetricResult.state` name set). The `onFilter` predicate uses
 * `resolveMetricTone` with the default scoring range `{ lower: 0, upper: 5 }`
 * to compute the cell's band, then compares the band colour string to the
 * filter value.
 *
 * **No React hooks.** The function is pure and called at render time by
 * `StudentAveragesTableCard` inside a `useMemo`.
 *
 * @see SPEC_CLASS_PAGE.md — "studentAveragesTableColumns"
 * @see CLASS_PAGE_LAYOUT.md — "4a. Column Filter Details"
 */

import type { CSSProperties, JSX } from 'react';
import { Typography } from 'antd';
import type { TableColumnsType, TableColumnType } from 'antd';

import type { MetricResult } from '../../services/dataAnalysis/dataAnalysis.zod';
import { getStudentMetric } from './classPageAdapter.zod';
import type { StudentAverageRowModel } from './classPageAdapter.zod';
import { compareStudentNames, METRIC_DISPLAY_META } from './classPageModel';
import type { MetricColumnKey } from './classPageModel';
import {
  resolveMetricTone,
  METRIC_TONE_CELL_STYLE,
} from '../../services/dataAnalysis/metricDisplay/metricTone';
import { MetricIconLabel } from './MetricIconLabel';
import {
  APP_COL_WIDTH_STUDENT_NAME,
  APP_COL_WIDTH_METRIC_PILL,
} from '../../theme/spacing';

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

/**
 * User-controlled filter state for the four metric columns.
 *
 * Each key maps to an array of selected `MetricToneColor` values.
 * An empty array means "no filter for this column" (all rows pass).
 */
export type StudentAveragesTableFilters = Readonly<{
  completeness: readonly string[];
  accuracy: readonly string[];
  spag: readonly string[];
  average: readonly string[];
}>;

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

/** Default scoring range for metric columns (0–5). */
const DEFAULT_TONE_RANGE = { lower: 0, upper: 5 } as const;

/**
 * Filter items for each metric column, matching the `MetricToneColor` token
 * set used by `resolveMetricTone` for rendering, so filter colours and pill
 * colours cannot diverge.
 */
export const METRIC_COLUMN_FILTERS: { text: string; value: string }[] = [
  { text: 'Red (low)', value: 'red' },
  { text: 'Amber (mid)', value: 'gold' },
  { text: 'Green (high)', value: 'green' },
  { text: 'Not Attempted', value: 'default' },
  { text: 'Error', value: 'volcano' },
];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the effective `filteredValue` for a metric column.
 *
 * Returns `undefined` when the filter array is empty (Ant Design v6 treats
 * an empty array as "no filter" but prefers `undefined` for correct rendering).
 *
 * @param {ReadonlyArray<string>} array - The selected filter values.
 * @returns {string[] | undefined} A mutable copy when non-empty, or `undefined`.
 */
function arrayOrUndefined(
  array: readonly string[]
): string[] | undefined {
  return array.length > 0 ? [...array] : undefined;
}

/**
 * Number of decimal places for the Class Page student-average scores.
 * Averaging across tasks yields decimals, so scores are shown to 2 dp
 * (matching the heatmap's coloured-cell rendering but with higher precision).
 */
const CLASS_PAGE_SCORE_PRECISION = 2;

/**
 * Render a metric score as plain text at {@link CLASS_PAGE_SCORE_PRECISION}.
 *
 * @param {MetricResult} metric - The metric result to render.
 * @returns {string} The formatted score, or `N`/`E` for non-computed states.
 */
function renderClassPageScore(metric: MetricResult): string {
  if (metric.state === 'computed') {
    return metric.value.toFixed(CLASS_PAGE_SCORE_PRECISION);
  }
  if (metric.state === 'notAttempted') {
    return 'N';
  }
  return 'E';
}

/**
 * Build a single metric column definition.
 *
 * Renders the score as plain text inside a band-coloured cell (via `onCell`
 * + `METRIC_TONE_CELL_STYLE`), mirroring the Task Heatmap's cell treatment.
 *
 * @param {MetricColumnKey} key - The column key (metric field name).
 * @param {ReadonlyArray<string>} columnFilters - The selected filter values.
 * @returns {TableColumnType<StudentAverageRowModel>} A column definition.
 */
function buildMetricColumn(
  key: MetricColumnKey,
  columnFilters: readonly string[]
): TableColumnType<StudentAverageRowModel> {
  const meta = METRIC_DISPLAY_META.get(key)!;
  return {
    key,
    title: <MetricIconLabel icon={meta.icon} label={meta.label} />,
    width: APP_COL_WIDTH_METRIC_PILL,
    align: 'center',
    sorter: true,
    filters: METRIC_COLUMN_FILTERS,
    filteredValue: arrayOrUndefined(columnFilters),
    onFilter: (value, record): boolean => {
      const metric = getStudentMetric(record.metrics, key);
      const { color } = resolveMetricTone(metric, DEFAULT_TONE_RANGE);
      return color === String(value);
    },
    onCell: (record: StudentAverageRowModel): { style: CSSProperties; 'aria-label': string } => {
      const metric = getStudentMetric(record.metrics, key);
      const { color } = resolveMetricTone(metric, DEFAULT_TONE_RANGE);
      const score = renderClassPageScore(metric);
      const ariaLabel = `${record.studentName}, ${meta.label}: ${score}`;
      return {
        style: METRIC_TONE_CELL_STYLE[color],
        'aria-label': ariaLabel,
      };
    },
    render: (_: unknown, record: StudentAverageRowModel): JSX.Element => (
      <span>{renderClassPageScore(getStudentMetric(record.metrics, key))}</span>
    ),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the five column definitions for the Student Averages table.
 *
 * Columns in fixed order: `studentName`, `completeness`, `accuracy`, `spag`,
 * `average`. The `studentName` column is sortable with locale-aware,
 * case-insensitive comparison and a `studentId` tie-breaker. The four metric
 * columns each have band filters (five `MetricToneColor` values) and a
 * `resolveMetricTone`-based `onFilter` predicate.
 *
 * @param {StudentAveragesTableFilters} filters - The current filter state for
 *   each metric column. Empty arrays mean no filter.
 * @returns {TableColumnsType<StudentAverageRowModel>} Five column definitions.
 */
export function buildStudentAveragesTableColumns(
  filters: StudentAveragesTableFilters
): TableColumnsType<StudentAverageRowModel> {
  return [
    // ── Student Name (no filters) ──────────────────────────────────────
    {
      key: 'studentName',
      title: 'Student Name',
      width: APP_COL_WIDTH_STUDENT_NAME,
      sorter: {
        compare: compareStudentNames,
        multiple: 1,
      },
      defaultSortOrder: 'ascend',
      render: (_: unknown, record: StudentAverageRowModel): JSX.Element => (
        <Typography.Text>{record.studentName}</Typography.Text>
      ),
    },

    // ── Metric columns ─────────────────────────────────────────────────
    buildMetricColumn('completeness', filters.completeness),
    buildMetricColumn('accuracy', filters.accuracy),
    buildMetricColumn('spag', filters.spag),
    buildMetricColumn('average', filters.average),
  ];
}
