import type { TableColumnsType } from 'antd';
import type { Key } from 'react';
import { getClassesTableSortComparator } from './ClassesTable.sorting';
import type { ClassesManagementRow } from './classesManagementViewModel';

export const UNAVAILABLE_VALUE = '—';

export type { ClassesSortableColumnKey } from './ClassesTable.sorting';

export type ClassesFilterColumnKey =
  | 'status'
  | 'cohortLabel'
  | 'courseLength'
  | 'yearGroupLabel'
  | 'active';

export interface ClassesColumnFilterOption {
  text: string;
  value: string;
}

export interface ClassesTableColumnOptions {
  filterOptions?: Partial<Record<ClassesFilterColumnKey, ClassesColumnFilterOption[]>>;
}

/**
 * Converts a filter value to string form for deterministic comparisons.
 *
 * @param {Key | boolean} value Filter value.
 * @returns {string} String value.
 */
function asFilterValue(value: Key | boolean): string {
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  return String(value);
}

/**
 * Resolves the displayed cell value, using em dash for unavailable values.
 *
 * @param {ClassesManagementRow} row Row context.
 * @param {unknown} value Raw column value.
 * @returns {string | number | boolean} Rendered cell value.
 */
function getNotCreatedAwareValue(
  row: ClassesManagementRow,
  value: string | number | boolean | null,
): string | number | boolean {
  if (row.status === 'notCreated' && value === null) {
    return UNAVAILABLE_VALUE;
  }

  return value ?? UNAVAILABLE_VALUE;
}

/**
 * Builds the status column definition.
 *
 * @returns {TableColumnsType<ClassesManagementRow>[number]} Status column.
 */
function createStatusColumn(): TableColumnsType<ClassesManagementRow>[number] {
  return {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    sorter: getClassesTableSortComparator('status'),
    filters: [
      { text: 'active', value: 'active' },
      { text: 'inactive', value: 'inactive' },
      { text: 'notCreated', value: 'notCreated' },
      { text: 'orphaned', value: 'orphaned' },
    ],
    onFilter: (value, row) => row.status === value,
  };
}

/**
 * Builds the class name column definition.
 *
 * @returns {TableColumnsType<ClassesManagementRow>[number]} Class name column.
 */
function createClassNameColumn(): TableColumnsType<ClassesManagementRow>[number] {
  return {
    title: 'Class name',
    dataIndex: 'className',
    key: 'className',
    sorter: getClassesTableSortComparator('className'),
  };
}

/**
 * Builds the cohort column definition.
 *
 * @param {ClassesTableColumnOptions | undefined} options Optional table options.
 * @returns {TableColumnsType<ClassesManagementRow>[number]} Cohort column.
 */
function createCohortColumn(
  options: ClassesTableColumnOptions | undefined,
): TableColumnsType<ClassesManagementRow>[number] {
  return {
    title: 'Cohort',
    dataIndex: 'cohortLabel',
    key: 'cohortLabel',
    render: (_, row) => getNotCreatedAwareValue(row, row.cohortLabel),
    sorter: getClassesTableSortComparator('cohortLabel'),
    filters: options?.filterOptions?.cohortLabel === undefined
      ? undefined
      : [...options.filterOptions.cohortLabel],
    onFilter: (value, row) => asFilterValue(value) === (row.cohortLabel ?? 'null'),
  };
}

/**
 * Builds the course length column definition.
 *
 * @param {ClassesTableColumnOptions | undefined} options Optional table options.
 * @returns {TableColumnsType<ClassesManagementRow>[number]} Course length column.
 */
function createCourseLengthColumn(
  options: ClassesTableColumnOptions | undefined,
): TableColumnsType<ClassesManagementRow>[number] {
  return {
    title: 'Course length',
    dataIndex: 'courseLength',
    key: 'courseLength',
    render: (_, row) => getNotCreatedAwareValue(row, row.courseLength),
    sorter: getClassesTableSortComparator('courseLength'),
    filters: options?.filterOptions?.courseLength === undefined
      ? undefined
      : [...options.filterOptions.courseLength],
    onFilter: (value, row) => asFilterValue(value) === String(row.courseLength ?? 'null'),
  };
}

/**
 * Builds the year group column definition.
 *
 * @param {ClassesTableColumnOptions | undefined} options Optional table options.
 * @returns {TableColumnsType<ClassesManagementRow>[number]} Year group column.
 */
function createYearGroupColumn(
  options: ClassesTableColumnOptions | undefined,
): TableColumnsType<ClassesManagementRow>[number] {
  return {
    title: 'Year group',
    dataIndex: 'yearGroupLabel',
    key: 'yearGroupLabel',
    render: (_, row) => getNotCreatedAwareValue(row, row.yearGroupLabel),
    sorter: getClassesTableSortComparator('yearGroupLabel'),
    filters: options?.filterOptions?.yearGroupLabel === undefined
      ? undefined
      : [...options.filterOptions.yearGroupLabel],
    onFilter: (value, row) => asFilterValue(value) === (row.yearGroupLabel ?? 'null'),
  };
}

/**
 * Builds the active column definition.
 *
 * @param {ClassesTableColumnOptions | undefined} options Optional table options.
 * @returns {TableColumnsType<ClassesManagementRow>[number]} Active column.
 */
function createActiveColumn(
  options: ClassesTableColumnOptions | undefined,
): TableColumnsType<ClassesManagementRow>[number] {
  return {
    title: 'Active',
    dataIndex: 'active',
    key: 'active',
    render: (_, row) => {
      if (row.status === 'notCreated') {
        return UNAVAILABLE_VALUE;
      }

      return row.active ? 'Yes' : 'No';
    },
    sorter: getClassesTableSortComparator('active'),
    filters: options?.filterOptions?.active === undefined
      ? undefined
      : [...options.filterOptions.active],
    onFilter: (value, row) => asFilterValue(value) === String(row.active ?? 'null'),
  };
}

/**
 * Builds deterministic table columns for classes management.
 *
 * @param {ClassesTableColumnOptions} [options] Optional filter options.
 * @returns {TableColumnsType<ClassesManagementRow>} Table columns.
 */
export function getClassesTableColumns(
  options?: ClassesTableColumnOptions,
): TableColumnsType<ClassesManagementRow> {
  return [
    createStatusColumn(),
    createClassNameColumn(),
    createCohortColumn(options),
    createCourseLengthColumn(options),
    createYearGroupColumn(options),
    createActiveColumn(options),
  ];
}
