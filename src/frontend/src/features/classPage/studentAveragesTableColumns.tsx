/**
 * Column definitions for the Student Averages table.
 *
 * Exports a pure function that returns five column definitions in fixed order:
 * `studentName`, `completeness`, `accuracy`, `spag`, `average`. The metric
 * columns share a common pattern: `MetricPill` rendering, band filters using
 * `MetricToneColor` tokens, and `onFilter` via `resolveMetricTone`.
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

import type { JSX } from 'react';
import { Typography } from 'antd';
import type { TableColumnsType, TableColumnType } from 'antd';
import { getStudentMetric } from './classPageAdapter.zod';
import type { StudentAverageRowModel } from './classPageAdapter.zod';
import { compareStudentNames } from './classPageModel';
import { resolveMetricTone } from '../../services/dataAnalysis/metricDisplay/metricTone';
import { MetricPill } from '../../services/dataAnalysis/metricDisplay/MetricPill';

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

/** The four metric column keys used in the table. */
type MetricColumnKey = 'completeness' | 'accuracy' | 'spag' | 'average';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the effective `filteredValue` for a metric column.
 *
 * Returns `undefined` when the filter array is empty (Ant Design v6 treats
 * an empty array as "no filter" but prefers `undefined` for correct rendering).
 *
 * @param {ReadonlyArray<MetricToneColor>} array - The selected filter values.
 * @returns {MetricToneColor[] | undefined} A mutable copy when non-empty, or `undefined`.
 */
function arrayOrUndefined(
  array: readonly string[]
): string[] | undefined {
  return array.length > 0 ? [...array] : undefined;
}

/**
 * Build a single metric column definition.
 *
 * @param {'completeness' | 'accuracy' | 'spag' | 'average'} key - The column key (metric field name).
 * @param {string} title - The column header title.
 * @param {ReadonlyArray<string>} columnFilters - The selected filter values.
 * @param {boolean} [emphasised] - When true, renders the MetricPill with emphasised styling.
 * @returns {TableColumnType<StudentAverageRowModel>} A column definition.
 */
function buildMetricColumn(
  key: MetricColumnKey,
  title: string,
  columnFilters: readonly string[],
  emphasised?: boolean
): TableColumnType<StudentAverageRowModel> {
  return {
    key,
    title,
    sorter: true,
    filters: METRIC_COLUMN_FILTERS,
    filteredValue: arrayOrUndefined(columnFilters),
    onFilter: (value, record): boolean => {
      const metric = getStudentMetric(record.metrics, key);
      const { color } = resolveMetricTone(metric, DEFAULT_TONE_RANGE);
      return color === String(value);
    },
    render: (_: unknown, record: StudentAverageRowModel): JSX.Element => (
      <MetricPill metric={getStudentMetric(record.metrics, key)} emphasised={emphasised} />
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
    buildMetricColumn('completeness', 'Completeness', filters.completeness),
    buildMetricColumn('accuracy', 'Accuracy', filters.accuracy),
    buildMetricColumn('spag', 'SpAG', filters.spag),
    buildMetricColumn('average', 'Average', filters.average, true),
  ];
}
