/**
 * Encode/decode helpers for the numeric score-range filter keys.
 *
 * Kept in a standalone, component-free module so both the filter builder and
 * the dropdown component can share them without violating the fast-refresh
 * "only export components" rule.
 *
 * The full filter state (range bounds plus the `N` / `E` include toggles) is
 * packed into a single string key because Ant Design's `filteredValue` /
 * `selectedKeys` only carry flat keys.
 *
 * @module metricRangeKey
 */

import type { FilterValue } from 'antd/es/table/interface';

/** Separator used to encode the filter state into a single filter key. */
const RANGE_KEY_SEPARATOR = '|';

/** Expected number of range parts when parsing a range key. */
const RANGE_KEY_PART_COUNT = 2;

/** Full filter state stored in a single Ant Design filter key. */
export type MetricRangeFilterState = {
  /** Inclusive lower bound of the score range. */
  min: number;
  /** Inclusive upper bound of the score range. */
  max: number;
  /** When `true`, `notAttempted` (`N`) rows are kept while a filter is active. */
  includeNotAttempted: boolean;
  /** When `true`, `error` (`E`) rows are kept while a filter is active. */
  includeError: boolean;
};

/**
 * Encode a filter state into a single string key for Ant Design's
 * `filteredValue` / `selectedKeys` (which only carry flat keys).
 *
 * @param {MetricRangeFilterState} state - The filter state to encode.
 * @returns {string} The encoded filter key.
 */
export function encodeMetricFilter(state: MetricRangeFilterState): string {
  return [state.min, state.max, state.includeNotAttempted ? 1 : 0, state.includeError ? 1 : 0].join(
    RANGE_KEY_SEPARATOR
  );
}

/**
 * Parse a `0`/`1` flag from a split key part (missing part → `false`).
 *
 * @param {string | undefined} value - The raw key part.
 * @returns {boolean} `true` only for the literal `'1'`.
 */
function parseFlag(value: string | undefined): boolean {
  return value === '1';
}

/**
 * Decode an Ant Design filter value back to a numeric range `[min, max]`,
 * or `[]` when the column is unfiltered.
 *
 * @param {FilterValue | null} filterValue - The raw filter value from onChange.
 * @returns {number[]} A two-element range array, or empty when unfiltered.
 */
export function decodeFilterToRange(filterValue: FilterValue | null): number[] {
  if (!filterValue || filterValue.length === 0) return [];
  const decoded = decodeMetricFilter(filterValue[0]);
  return decoded ? [decoded.min, decoded.max] : [];
}

/**
 * Decode a filter key back into a {@link MetricRangeFilterState}.
 *
 * @param {unknown} key - The encoded key (expected string).
 * @returns {MetricRangeFilterState | null} The decoded state, or `null` when
 *   the key is not a valid encoded range.
 */
export function decodeMetricFilter(key?: unknown): MetricRangeFilterState | null {
  if (typeof key !== 'string' || !key.includes(RANGE_KEY_SEPARATOR)) {
    return null;
  }
  const parts = key.split(RANGE_KEY_SEPARATOR);
  if (parts.length < RANGE_KEY_PART_COUNT) {
    return null;
  }
  const min = Number(parts[0]);
  const max = Number(parts[1]);
  if (Number.isNaN(min) || Number.isNaN(max)) {
    return null;
  }
  return {
    min,
    max,
    includeNotAttempted: parseFlag(parts[2]),
    includeError: parseFlag(parts[3]),
  };
}
