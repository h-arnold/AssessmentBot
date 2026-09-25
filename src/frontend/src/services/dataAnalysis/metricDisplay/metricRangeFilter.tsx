/**
 * Shared numeric range-filter support for metric columns.
 *
 * Provides a custom Ant Design `filterDropdown` (a two-thumb `Slider` bounded by
 * the metric's scoring range, with independent `N` and `E` include toggles plus
 * an aggregate-only `Excluded` toggle) plus the matching `onFilter` predicate,
 * so the Student Averages table and Task Heatmap can filter by score range
 * instead of a fixed colour band. Task-display heatmap filters omit the
 * `Excluded` option because task metrics cannot resolve to that state. The
 * dropdown UI itself lives in `metricRangeFilterDropdown.tsx` (kept separate so
 * fast-refresh is satisfied).
 *
 * @module metricRangeFilter
 */

import type { JSX } from 'react';
import type { FilterDropdownProps } from 'antd/es/table/interface';

import type { MetricResult } from '../dataAnalysis.zod';
import type { MetricToneRange } from './metricTone';
import {
  createDefaultMetricRangeFilterState,
  decodeMetricFilter,
  encodeMetricFilter,
  type MetricRangeFilterFlags,
} from './metricRangeKey';
import { MetricRangeFilterDropdown } from './metricRangeFilterDropdown';

/** Default policy for every non-computed metric state. */
const DEFAULT_NON_COMPUTED_FILTER_FLAGS: MetricRangeFilterFlags =
  createDefaultMetricRangeFilterState(0, 0);

/**
 * Predicate: is a metric within the active filter?
 *
 * Computed values must fall inside the `[min, max]` range. The `N` (`notAttempted`)
 * and `E` (`error`) states are included only when their respective named flag is
 * enabled; otherwise they are hidden while a filter is applied. Aggregate-only
 * `excluded` metrics pass only when their independent `includeExcluded` flag is
 * enabled; they never pass by numeric range.
 *
 * @param {MetricResult} metric - The metric to test.
 * @param {number} min - The inclusive lower bound.
 * @param {number} max - The inclusive upper bound.
 * @param {MetricRangeFilterFlags} [filterFlags] - Named non-computed-state
 *   flags. Omission uses {@link DEFAULT_NON_COMPUTED_FILTER_FLAGS}.
 * @returns {boolean} `true` when the metric passes the filter.
 */
export function metricInRange(
  metric: MetricResult,
  min: number,
  max: number,
  filterFlags: MetricRangeFilterFlags = DEFAULT_NON_COMPUTED_FILTER_FLAGS
): boolean {
  if (metric.state === 'computed') {
    return metric.value >= min && metric.value <= max;
  }

  const includeByState: Record<Exclude<MetricResult['state'], 'computed'>, boolean> = {
    notAttempted: filterFlags.includeNotAttempted,
    excluded: filterFlags.includeExcluded,
    error: filterFlags.includeError,
  };
  return includeByState[metric.state];
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
  /**
   * Optional raw encoded filter key from the parent's filter state. When provided,
   * used directly as `filteredValue` instead of re-encoding from `activeRange`,
   * preserving the N/E/Excluded toggle state from the dropdown.
   */
  activeFilterKey?: string;
  /**
   * Whether the dropdown exposes the aggregate-only **Include Excluded** toggle.
   * Defaults to `true`; task-display heatmap filters pass `false`.
   */
  showExcludedToggle?: boolean;
  /** `Slider` step. Defaults to {@link RANGE_SLIDER_STEP}. */
  step?: number;
};

/** Step interval for the range slider. */
const RANGE_SLIDER_STEP = 0.5;

/** Number of slider handle marks. */
const RANGE_SLIDER_HANDLE_COUNT = 2;

/** Column filter props returned by {@link buildMetricRangeFilter}. */
export type MetricRangeFilterProperties = {
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
 * plus independent `N` and `E` include toggles, and exposes `Excluded` when
 * `showExcludedToggle` is enabled. Selecting a range (or toggling one of these
 * states) writes a single encoded filter key into `selectedKeys` and confirms;
 * **Reset** clears it.
 * `onFilter` decodes that key and applies {@link metricInRange} to each row.
 *
 * @param {MetricRangeFilterOptions<RecordType>} options - Range filter options.
 * @returns {MetricRangeFilterProperties} The column filter props.
 */
export function buildMetricRangeFilter<RecordType>(
  options: MetricRangeFilterOptions<RecordType>
): MetricRangeFilterProperties {
  const {
    range,
    getMetric,
    activeRange,
    activeFilterKey,
    showExcludedToggle = true,
    step = RANGE_SLIDER_STEP,
  } = options;

  let filteredValue: string[] | undefined;
  if (activeFilterKey) {
    filteredValue = [activeFilterKey];
  } else if (activeRange.length === RANGE_SLIDER_HANDLE_COUNT) {
    filteredValue = [
      encodeMetricFilter(
        createDefaultMetricRangeFilterState(activeRange[0], activeRange[1])
      ),
    ];
  }

  const filterDropdown = (properties: FilterDropdownProps): JSX.Element => (
    <MetricRangeFilterDropdown
      {...properties}
      range={range}
      step={step}
      showExcludedToggle={showExcludedToggle}
    />
  );

  const onFilter = (value: unknown, record: unknown): boolean => {
    const decoded = decodeMetricFilter(value);
    if (!decoded) {
      return true;
    }
    return metricInRange(getMetric(record as RecordType), decoded.min, decoded.max, decoded);
  };

  return {
    filterDropdown,
    onFilter,
    filteredValue,
    filterMultiple: false,
  };
}
