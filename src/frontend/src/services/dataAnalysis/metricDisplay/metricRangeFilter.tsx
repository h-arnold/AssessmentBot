/**
 * Shared numeric range-filter support for metric columns.
 *
 * Provides a custom Ant Design `filterDropdown` (a two-thumb `Slider` bounded by
 * the metric's scoring range, with `N` / `E` include toggles) plus the matching
 * `onFilter` predicate, so the Student Averages table and the Task Heatmap can
 * filter by score range instead of a fixed colour band. The dropdown UI itself
 * lives in `metricRangeFilterDropdown.tsx` (kept separate so fast-refresh is
 * satisfied).
 *
 * @module metricRangeFilter
 */

import type { JSX } from 'react';
import type { FilterDropdownProps } from 'antd/es/table/interface';

import type { MetricResult } from '../dataAnalysis.zod';
import type { MetricToneRange } from './metricTone';
import { decodeMetricFilter, encodeMetricFilter } from './metricRangeKey';
import { MetricRangeFilterDropdown } from './metricRangeFilterDropdown';

/**
 * Predicate: is a metric within the active filter?
 *
 * Computed values must fall inside the `[min, max]` range. The `N` (`notAttempted`)
 * and `E` (`error`) states are included only when their respective toggle is
 * enabled; otherwise they are hidden while a filter is applied.
 *
 * @param {MetricResult} metric - The metric to test.
 * @param {number} min - The inclusive lower bound.
 * @param {number} max - The inclusive upper bound.
 * @param {boolean} [includeNotAttempted=false] - Keep `notAttempted` rows.
 * @param {boolean} [includeError=false] - Keep `error` rows.
 * @returns {boolean} `true` when the metric passes the filter.
 */
export function metricInRange(
  metric: MetricResult,
  min: number,
  max: number,
  includeNotAttempted = false,
  includeError = false
): boolean {
  if (metric.state === 'notAttempted') {
    return includeNotAttempted;
  }
  if (metric.state === 'error') {
    return includeError;
  }
  return metric.value >= min && metric.value <= max;
}

/** Options for {@link buildMetricRangeFilter}. */
export type MetricRangeFilterOptions<RecordType> = {
  /** The scoring range bounding the `Slider`. */
  range: MetricToneRange;
  /**
   * Extractor returning the metric column's `MetricResult` for a given row.
   * Allows the same filter to serve both the Student Averages (`getStudentMetric`)
   * and Heatmap (`getCellMetric`) row shapes.
   */
  getMetric: (record: RecordType) => MetricResult;
  /**
   * The currently active range as `[min, max]` (or `[]` for no filter), typically
   * sourced from the parent's filter state.
   */
  activeRange: readonly number[];
  /** `Slider` step. Defaults to `0.5`. */
  step?: number;
};

/** Column filter props returned by {@link buildMetricRangeFilter}. */
export type MetricRangeFilterProps = {
  filterDropdown: (properties: FilterDropdownProps) => JSX.Element;
  onFilter: (value: unknown, record: unknown) => boolean;
  filteredValue: string[] | undefined;
  filterMultiple: false;
};

/**
 * Build the Ant Design column filter props for a numeric score-range filter.
 *
 * @remarks
 * The `filterDropdown` renders a two-thumb `Slider` over `range.lower..range.upper`
 * plus `N` / `E` include toggles. Selecting a range (or toggling `N`/`E`) writes a
 * single encoded filter key into `selectedKeys` and confirms; **Reset** clears it.
 * `onFilter` decodes that key and applies {@link metricInRange} to each row.
 *
 * @param {MetricRangeFilterOptions<RecordType>} options - Range filter options.
 * @returns {MetricRangeFilterProps} The column filter props.
 */
export function buildMetricRangeFilter<RecordType>(
  options: MetricRangeFilterOptions<RecordType>
): MetricRangeFilterProps {
  const { range, getMetric, activeRange, step = 0.5 } = options;

  const filteredValue: string[] | undefined =
    activeRange.length === 2
      ? [
          encodeMetricFilter({
            min: activeRange[0],
            max: activeRange[1],
            includeNotAttempted: false,
            includeError: false,
          }),
        ]
      : undefined;

  const filterDropdown = (properties: FilterDropdownProps): JSX.Element => (
    <MetricRangeFilterDropdown {...properties} range={range} step={step} />
  );

  const onFilter = (value: unknown, record: unknown): boolean => {
    const decoded = decodeMetricFilter(value);
    if (!decoded) {
      return true;
    }
    return metricInRange(
      getMetric(record as RecordType),
      decoded.min,
      decoded.max,
      decoded.includeNotAttempted,
      decoded.includeError
    );
  };

  return {
    filterDropdown,
    onFilter,
    filteredValue,
    filterMultiple: false,
  };
}
