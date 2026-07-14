/**
 * The Student Averages table card for the Class page.
 *
 * Renders an Ant Design `Card` (`size="small"`, title `"Student Averages"`)
 * containing a control row (`Input.Search` on the left, static label on the
 * right) and an Ant Design `Table` with five columns (Student Name,
 * Completeness, Accuracy, SPaG, Average).
 *
 * @remarks
 * **State ownership.** The component owns three pieces of user-controlled
 * state: `searchTerm` (string, initial `''`), `sort` (column / direction,
 * initial `studentName` ascending), and `filters` (metric column band
 * filters, initial all empty).
 *
 * **Filtering.** The `onChange` callback stores the raw encoded filter keys
 * (score ranges with N/E toggle flags) into the typed `StudentAveragesTableFilters`
 * state, which is passed to `buildMetricRangeFilter` as `activeFilterKey`. This
 * preserves the "Include Not Attempted (N)" and "Include Error (E)" toggle state
 * across renders.
 *
 * **Memoisation.** `buildClassPageViewModel` is called inside a `useMemo`
 * keyed on `[adapterResult, searchTerm, sort]`, and the model is called with
 * `filters: { searchTerm }`.
 * `buildStudentAveragesTableColumns` is called inside a `useMemo` keyed on
 * `[filters]`.
 *
 * **Sort mapping (`onChange`).** The `sorter` argument is
 * `SorterResult<StudentAverageRowModel> | SorterResult<StudentAverageRowModel>[]`.
 * If it is an array, the first element is used. When `sorter.order` is `null`
 * or `undefined` (clear-sort on third click), or `sorter.columnKey` is
 * missing, the sort resets to the default (`studentName` ascending).
 *
 * **Clear-sort handling.** Ant Design v6 calls `onChange` with
 * `sorter.order === null` when the user clears the sort by clicking the
 * sorted column header a third time. The component detects this and resets
 * to the default sort.
 *
 * **Search input (v1 workaround).** The component uses `Space.Compact` with a
 * plain `Input` and `SearchOutlined` prefix instead of Ant Design's
 * `Input.Search`, because Ant Design v6.3.1 always renders a `<button>` in
 * `Input.Search` regardless of the `enterButton` prop, which contradicts the
 * layout spec's requirement that no submit button is rendered (filters apply
 * on keystroke). The workaround produces the same visual result (search icon,
 * no submit button, updates on keystroke) and the same accessible role.
 *
 * @see SPEC_CLASS_PAGE.md — "StudentAveragesTableCard"
 * @see CLASS_PAGE_LAYOUT.md — "4. Student Averages Table Card"
 */

import type { JSX, ChangeEvent } from 'react';
import { useState, useMemo, useCallback } from 'react';
import { Card, Input, Space, Typography, Flex, Table, Empty } from 'antd';
import type { TableColumnsType, TablePaginationConfig } from 'antd';
import type { FilterValue, SorterResult } from 'antd/es/table/interface';
import { SearchOutlined } from '@ant-design/icons';
import type { ClassPageAdapterResult, StudentAverageRowModel } from './classPageAdapter.zod';
import { pageContent } from '../../pages/pageContent';

import { buildClassPageViewModel, DEFAULT_SORT } from './classPageModel';
import type { MetricColumnKey } from '../../services/dataAnalysis/metricDisplay/metricDisplayMeta';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

import {
  buildStudentAveragesTableColumns,
  type StudentAveragesTableFilters,
} from './studentAveragesTableColumns';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Valid sort column keys for the Student Averages table. */
type SortColumn = 'studentName' | MetricColumnKey;

/** Sort state shape passed to the model. */
type SortState = {
  readonly column: SortColumn;
  readonly direction: 'asc' | 'desc';
};

export type StudentAveragesTableCardProperties = {
  readonly adapterResult: ClassPageAdapterResult;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Initial filter state: all metric columns unfiltered. */
const INITIAL_FILTERS: StudentAveragesTableFilters = {
  completeness: [],
  accuracy: [],
  spag: [],
  average: [],
};

/**
 * Module-level locale constant for the Table's empty state.
 *
 * Extracted to prevent recreating a new `<Empty>` React element on every
 * render, which would cause Ant Design's `Table` to re-evaluate its
 * internal rendering of the empty state.
 */
const EMPTY_LOCALE = {
  emptyText: <Empty description={pageContent.classDetail.searchEmpty} />,
} as const;

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Safely extract string values from an Ant Design `FilterValue`.
 *
 * Returns an empty array when the value is `null`, `undefined`, or contains
 * no string elements. This avoids unchecked `as string[]` casts across the
 * filter-state boundary.
 *
 * @param {FilterValue | null | undefined} fv - The raw filter value from
 *   Ant Design's table `onChange`.
 * @returns {readonly string[]} The string elements of the filter value, or
 *   an empty array.
 */
function extractFilterKeys(fv: FilterValue | null | undefined): readonly string[] {
  if (!fv) return [];
  return fv.filter((v): v is string => typeof v === 'string');
}

/**
 * Normalise a single or array `SorterResult` to a typed `SortState`.
 *
 * Returns the default sort when the sort is cleared (third click) or when the
 * column key is missing.
 *
 * @param {SorterResult<StudentAverageRowModel> | SorterResult<StudentAverageRowModel>[]} sorter -
 *   The sorter result from Ant Design's `onChange`.
 * @returns {SortState} The normalised sort state.
 */
function normaliseSorter(
  sorter: SorterResult<StudentAverageRowModel> | SorterResult<StudentAverageRowModel>[]
): SortState {
  const singleSorter = Array.isArray(sorter) ? sorter[0] : sorter;
  if (!singleSorter?.order || !singleSorter.columnKey) {
    return DEFAULT_SORT;
  }
  const sortDirection = singleSorter.order === 'ascend' ? 'asc' : 'desc';
  return {
    column: singleSorter.columnKey as SortColumn,
    direction: sortDirection,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Render the Student Averages table card.
 *
 * @param {StudentAveragesTableCardProperties} properties - Component properties.
 * @param {ClassPageAdapterResult} properties.adapterResult - The adapter's canonical output.
 * @returns {JSX.Element} The Student Averages table card.
 */
export function StudentAveragesTableCard(
  properties: StudentAveragesTableCardProperties
): JSX.Element {
  const { adapterResult } = properties;

  // ── State ──────────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [filters, setFilters] = useState<StudentAveragesTableFilters>(INITIAL_FILTERS);

  // ── Memoised derived values ────────────────────────────────────────────

  const viewModel = useMemo(
    () =>
      buildClassPageViewModel({
        adapterResult,
        filters: { searchTerm },
        sort,
      }),
    [adapterResult, searchTerm, sort]
  );

  const columns: TableColumnsType<StudentAverageRowModel> = useMemo(
    () => buildStudentAveragesTableColumns(filters),
    [filters]
  );

  // ── Event handlers ─────────────────────────────────────────────────────

  /**
   * Handle search input change.
   *
   * Reads `event.target.value` and updates the search term state.
   *
   * @param {ChangeEvent<HTMLInputElement>} event - The input change event.
   */
  const handleSearchChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      setSearchTerm(event.target.value);
    },
    []
  );

  /**
   * Handle table sort and filter change.
   *
   * Maps the Ant Design `SorterResult` to the model's sort state vocabulary
   * (`'ascend'` / `'descend'` → `'asc'` / `'desc'`). Resets to the default
   * sort when the sort is cleared (third click) or when the column key is
   * missing.
   *
   * Also stores the raw encoded filter keys from Ant Design's `filters` object
   * into the typed `StudentAveragesTableFilters` state so N/E toggle state set
   * by the dropdown is preserved across renders.
   */
  const handleTableChange = useCallback(
    (
      _pagination: TablePaginationConfig,
      filtersArgument: Record<string, FilterValue | null>,
      sorter: SorterResult<StudentAverageRowModel> | SorterResult<StudentAverageRowModel>[]
    ): void => {
      // Store raw encoded keys so the N/E toggle state from the dropdown
      // is preserved across renders via activeFilterKey in buildMetricColumn.
      setFilters({
        completeness: extractFilterKeys(filtersArgument.completeness),
        accuracy: extractFilterKeys(filtersArgument.accuracy),
        spag: extractFilterKeys(filtersArgument.spag),
        average: extractFilterKeys(filtersArgument.average),
      });

      setSort(normaliseSorter(sorter));
    },
    []
  );

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <Card size="small" title="Student Averages">
      <Flex justify="space-between" align="center">
        <Space.Compact className="ant-input-search">
          <Input
            type="search"
            placeholder="Search by name"
            onChange={handleSearchChange}
            prefix={<SearchOutlined />}
          />
        </Space.Compact>
        <Typography.Text type="secondary">
          Viewing: Overall Class Averages
        </Typography.Text>
      </Flex>

      <Table<StudentAverageRowModel>
        dataSource={viewModel.studentAverages}
        columns={columns}
        rowKey="studentId"
        pagination={false}
        size="small"
        scroll={{ x: 'max-content' }}
        onChange={handleTableChange}
        locale={EMPTY_LOCALE}
      />
    </Card>
  );
}
