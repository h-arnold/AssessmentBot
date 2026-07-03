/**
 * The Student Averages table card for the Class page.
 *
 * Renders an Ant Design `Card` (`size="small"`, title `"Student Averages"`)
 * containing a control row (`Input.Search` on the left, static label on the
 * right) and an Ant Design `Table` with five columns (Student Name,
 * Completeness, Accuracy, SpAG, Average).
 *
 * @remarks
 * **State ownership.** The component owns three pieces of user-controlled
 * state: `searchTerm` (string, initial `''`), `sort` (column / direction,
 * initial `studentName` ascending), and `filters` (metric column band
 * filters, initial all empty).
 *
 * **Memoisation.** `buildClassPageViewModel` is called inside a `useMemo`
 * keyed on `[adapterResult, filters, sort, searchTerm]`.
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
 * @see SPEC_CLASS_PAGE.md — "StudentAveragesTableCard"
 * @see CLASS_PAGE_LAYOUT.md — "4. Student Averages Table Card"
 */

import type { JSX, ChangeEvent } from 'react';
import { useState, useMemo, useCallback } from 'react';
import { Card, Input, Space, Typography, Flex, Table, Empty } from 'antd';
import type { TableColumnsType } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { ClassPageAdapterResult, StudentAverageRowModel } from './classPageAdapter.zod';

import { buildClassPageViewModel } from './classPageModel';
import {
  buildStudentAveragesTableColumns,
  type StudentAveragesTableFilters,
} from './studentAveragesTableColumns';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Valid sort column keys for the Student Averages table. */
type SortColumn = 'studentName' | 'completeness' | 'accuracy' | 'spag' | 'average';

/** Sort state shape passed to the model. */
type SortState = {
  readonly column: SortColumn;
  readonly direction: 'asc' | 'desc';
};

export type StudentAveragesTableCardProperties = {
  readonly adapterResult: ClassPageAdapterResult;
  readonly onStartNewAssessment: () => void;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default sort: student name ascending. */
const DEFAULT_SORT: SortState = { column: 'studentName', direction: 'asc' };

/** Initial filter state: all metric columns unfiltered. */
const INITIAL_FILTERS: StudentAveragesTableFilters = {
  completeness: [],
  accuracy: [],
  spag: [],
  average: [],
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Render the Student Averages table card.
 *
 * @param {StudentAveragesTableCardProperties} properties - Component properties.
 * @param {ClassPageAdapterResult} properties.adapterResult - The adapter's canonical output.
 * @param {() => void} properties.onStartNewAssessment - Callback to start a new assessment.
 * @returns {JSX.Element} The Student Averages table card.
 */
export function StudentAveragesTableCard(
  properties: StudentAveragesTableCardProperties
): JSX.Element {
  const { adapterResult } = properties;

  // ── State ──────────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [filters] = useState<StudentAveragesTableFilters>(INITIAL_FILTERS);

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
   * Handle table sort change.
   *
   * Maps the Ant Design `SorterResult` to the model's sort state vocabulary
   * (`'ascend'` / `'descend'` → `'asc'` / `'desc'`). Resets to the default
   * sort when the sort is cleared (third click) or when the column key is
   * missing.
   */
  const handleTableChange = useCallback(
    (
      _pagination: unknown,
      _filters: unknown,
      sorter: unknown
    ): void => {
      // Normalise to a single sorter
      const singleSorter = Array.isArray(sorter) ? sorter[0] : sorter;

      if (!singleSorter?.order || !singleSorter.columnKey) {
        setSort(DEFAULT_SORT);
        return;
      }

      const sortDirection = singleSorter.order === 'ascend' ? 'asc' : 'desc';
      setSort({
        column: singleSorter.columnKey as SortColumn,
        direction: sortDirection,
      });
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
        locale={{
          emptyText: <Empty description="No students match your search" />,
        }}
      />
    </Card>
  );
}
