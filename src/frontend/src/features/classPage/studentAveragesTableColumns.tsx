/**
 * Column definitions for the Student Averages table.
 *
 * Exports a pure function that returns six column definitions in fixed order:
 * `forename`, `surname`, `completeness`, `accuracy`, `spag`, `average`. The
 * Forename and Surname columns derive their display values from the stored
 * single-string `studentName` via the shared `splitStudentName` helper (first
 * token = forename, remainder = surname). The metric columns share a common
 * pattern: gradient coloured-cell rendering (via
 * `resolveMetricTone(...).cellStyle`), and a numeric score-range filter via
 * `buildMetricRangeFilter`.
 *
 * @remarks
 * The `MetricToneColor` token set covers discrete `notAttempted` (`'default'`)
 * and `error` (`errorColor`) states only. Computed values render on a continuous
 * gradient and are filtered by score range, not by colour band. The `onFilter`
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
import type { FilterValue } from 'antd/es/table/interface';

import type { MetricResult } from '../../services/dataAnalysis/dataAnalysis.zod';
import { getStudentMetric } from './classPageAdapter.zod';
import type { StudentAverageRowModel } from './classPageAdapter.zod';
import { compareStudentNamePart, splitStudentName } from '../../utils/splitStudentName';
import { METRIC_DISPLAY_META } from '../../services/dataAnalysis/metricDisplay/metricDisplayMeta';
import type { MetricColumnKey } from '../../services/dataAnalysis/metricDisplay/metricDisplayMeta';
import {
  resolveMetricTone,
  DEFAULT_TONE_RANGE,
} from '../../services/dataAnalysis/metricDisplay/metricTone';
import { buildMetricRangeFilter } from '../../services/dataAnalysis/metricDisplay/metricRangeFilter';
import { decodeFilterToRange } from '../../services/dataAnalysis/metricDisplay/metricRangeKey';
import { MetricIconLabel } from '../../components/MetricIconLabel/MetricIconLabel';
import { APP_COL_WIDTH_FORENAME, APP_COL_WIDTH_SURNAME, APP_COL_WIDTH_METRIC_PILL } from '../../theme/spacing';

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

/**
 * User-controlled filter state for the four metric columns.
 *
 * Each key stores the raw encoded filter key from Ant Design's filter state,
 * or an empty array when the column is unfiltered (all rows pass). The encoded
 * key preserves the N/E toggle state set by the dropdown.
 */
export type StudentAveragesTableFilters = Readonly<{
  completeness: readonly string[];
  accuracy: readonly string[];
  spag: readonly string[];
  average: readonly string[];
}>;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

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
 * Renders the score as plain text inside a gradient-coloured cell (via `onCell`
 * + `resolveMetricTone(...).cellStyle`), mirroring the Task Heatmap's cell
 * treatment, and exposes a numeric score-range filter.
 *
 * @param {MetricColumnKey} key - The column key (metric field name).
 * @param {readonly string[]} columnFilters - The raw encoded filter keys, or an
 *   empty array when the column is unfiltered.
 * @returns {TableColumnType<StudentAverageRowModel>} A column definition.
 */
function buildMetricColumn(
  key: MetricColumnKey,
  columnFilters: readonly string[]
): TableColumnType<StudentAverageRowModel> {
  const meta = METRIC_DISPLAY_META.get(key)!;
  const activeRange: readonly number[] =
    columnFilters.length > 0 ? decodeFilterToRange([columnFilters[0]!] as FilterValue) : [];
  const activeFilterKey: string | undefined = activeRange.length > 0 ? columnFilters[0] : undefined;
  const rangeFilter = buildMetricRangeFilter<StudentAverageRowModel>({
    range: DEFAULT_TONE_RANGE,
    getMetric: (record): MetricResult => getStudentMetric(record.metrics, key),
    activeRange,
    activeFilterKey,
  });
  return {
    key,
    title: <MetricIconLabel icon={meta.icon} label={meta.label} />,
    width: APP_COL_WIDTH_METRIC_PILL,
    align: 'center',
    sorter: true,
    ...rangeFilter,
    onCell: (record: StudentAverageRowModel): { style: CSSProperties; 'aria-label': string } => {
      const metric = getStudentMetric(record.metrics, key);
      const { cellStyle } = resolveMetricTone(metric, DEFAULT_TONE_RANGE);
      const score = renderClassPageScore(metric);
      const ariaLabel = `${record.studentName}, ${meta.label}: ${score}`;
      return {
        style: cellStyle,
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
 * Build the six column definitions for the Student Averages table.
 *
 * Columns in fixed order: `forename`, `surname`, `completeness`, `accuracy`,
 * `spag`, `average`. Neither split column carries a `defaultSortOrder`: the
 * initial order always comes from the view model, whose missing/cleared sort
 * resolves to full-name ascending. A static default indicator on Forename
 * would both misrepresent that ordering and make Ant Design re-sort the
 * model-ordered rows by derived forename on mount. Each split column sorts
 * by its own derived value with a `studentId` tie-break once the user sorts.
 * The four metric columns each have a numeric score-range filter (via
 * `buildMetricRangeFilter`) and a `resolveMetricTone`-based gradient
 * `cellStyle`.
 *
 * @param {StudentAveragesTableFilters} filters - The current filter state for
 *   each metric column. Empty arrays mean no filter.
 * @returns {TableColumnsType<StudentAverageRowModel>} Six column definitions.
 */
export function buildStudentAveragesTableColumns(
  filters: StudentAveragesTableFilters
): TableColumnsType<StudentAverageRowModel> {
  return [
    // ── Forename (no filters) ────────────────────────────────────────
    // No `defaultSortOrder`: the initial full-name order comes from the
    // view model (see `buildClassPageViewModel`), and a static indicator
    // here would re-sort by derived forename on mount.
    {
      key: 'forename',
      title: 'Forename',
      width: APP_COL_WIDTH_FORENAME,
      sorter: {
        compare: (a: StudentAverageRowModel, b: StudentAverageRowModel): number =>
          compareStudentNamePart('forename', a, b),
        multiple: 1,
      },
      render: (_: unknown, record: StudentAverageRowModel): JSX.Element => (
        <Typography.Text>{splitStudentName(record.studentName).forename}</Typography.Text>
      ),
    },

    // ── Surname (no filters) ─────────────────────────────────────────
    {
      key: 'surname',
      title: 'Surname',
      width: APP_COL_WIDTH_SURNAME,
      sorter: {
        compare: (a: StudentAverageRowModel, b: StudentAverageRowModel): number =>
          compareStudentNamePart('surname', a, b),
        multiple: 1,
      },
      render: (_: unknown, record: StudentAverageRowModel): JSX.Element => (
        <Typography.Text>{splitStudentName(record.studentName).surname}</Typography.Text>
      ),
    },

    // ── Metric columns ─────────────────────────────────────────────────
    buildMetricColumn('completeness', filters.completeness),
    buildMetricColumn('accuracy', filters.accuracy),
    buildMetricColumn('spag', filters.spag),
    buildMetricColumn('average', filters.average),
  ];
}
