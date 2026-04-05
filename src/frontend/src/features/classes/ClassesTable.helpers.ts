import type { TableColumnsType } from 'antd';
import type { FilterValue, SortOrder, SorterResult } from 'antd/es/table/interface';
import type { ClassesManagementRow } from './classesManagementViewModel';
import {
  compareRowsByDefaultPriority,
  type ClassesColumnFilterOption,
  type ClassesFilterColumnKey,
  type ClassesSortableColumnKey,
} from './ClassesTableColumns';

export interface SortState {
  columnKey: ClassesSortableColumnKey;
  order: SortOrder;
}

export interface ClassesTableFilterState {
  status: FilterValue | null;
  cohortLabel: FilterValue | null;
  courseLength: FilterValue | null;
  yearGroupLabel: FilterValue | null;
  active: FilterValue | null;
}

type TableSorterPayload = SorterResult<ClassesManagementRow> | SorterResult<ClassesManagementRow>[];

export const EMPTY_FILTER_STATE: ClassesTableFilterState = {
  status: null,
  cohortLabel: null,
  courseLength: null,
  yearGroupLabel: null,
  active: null,
};

/**
 * Returns rows sorted by the default view-model order contract.
 *
 * @param {readonly ClassesManagementRow[]} rows Rows to sort.
 * @returns {ClassesManagementRow[]} Sorted rows.
 */
export function getDefaultSortedRows(rows: readonly ClassesManagementRow[]): ClassesManagementRow[] {
  return [...rows].toSorted(compareRowsByDefaultPriority);
}

/**
 * Builds deterministic filter options from row values.
 *
 * @param {readonly (string | number | boolean | null)[]} values Raw values.
 * @param {string} [unavailableLabel] Label used for null values.
 * @returns {ClassesColumnFilterOption[]} Filter options.
 */
export function getUniqueSortedFilterOptions(
  values: readonly (string | number | boolean | null)[],
  unavailableLabel = '—',
): ClassesColumnFilterOption[] {
  const uniqueValues = [...new Set(values.map((value) => String(value ?? 'null')))].toSorted((left, right) =>
    left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }),
  );

  return uniqueValues.map((value) => ({
    text: value === 'null' ? unavailableLabel : value,
    value,
  }));
}

/**
 * Builds filter definitions for classes table column controls.
 *
 * @param {readonly ClassesManagementRow[]} rows Source rows.
 * @returns {Partial<Record<ClassesFilterColumnKey, readonly ClassesColumnFilterOption[]>>} Filter definitions.
 */
export function getFilterOptions(rows: readonly ClassesManagementRow[]) {
  return {
    cohortLabel: getUniqueSortedFilterOptions(rows.map((row) => row.cohortLabel)),
    courseLength: getUniqueSortedFilterOptions(rows.map((row) => row.courseLength)),
    yearGroupLabel: getUniqueSortedFilterOptions(rows.map((row) => row.yearGroupLabel)),
    active: [
      { text: 'Yes', value: 'true' },
      { text: 'No', value: 'false' },
      { text: '—', value: 'null' },
    ],
  } satisfies Partial<Record<ClassesFilterColumnKey, readonly ClassesColumnFilterOption[]>>;
}

/**
 * Resolves the primary sorter from an Ant Design onChange payload.
 *
 * @param {TableSorterPayload} sorter Sort payload.
 * @returns {SortState | null} Primary sort state.
 */
export function getPrimarySorter(sorter: TableSorterPayload): SortState | null {
  const normalisedSorter = Array.isArray(sorter) ? sorter[0] : sorter;

  if (normalisedSorter?.columnKey === undefined || normalisedSorter?.order === undefined) {
    return null;
  }

  return {
    columnKey: String(normalisedSorter.columnKey) as ClassesSortableColumnKey,
    order: normalisedSorter.order,
  };
}

/**
 * Normalises table filter payload into deterministic filter state.
 *
 * @param {Record<string, FilterValue | null>} [filters] Next filter payload.
 * @returns {ClassesTableFilterState} Normalised filter state.
 */
export function normaliseFilters(
  filters?: Record<string, FilterValue | null>,
): ClassesTableFilterState {
  if (filters === undefined) {
    return EMPTY_FILTER_STATE;
  }

  return {
    status: filters.status ?? null,
    cohortLabel: filters.cohortLabel ?? null,
    courseLength: filters.courseLength ?? null,
    yearGroupLabel: filters.yearGroupLabel ?? null,
    active: filters.active ?? null,
  };
}

/**
 * Gets selected filter values for a supported filter column key.
 *
 * @param {ClassesTableFilterState} filters Current filters.
 * @param {ClassesFilterColumnKey} columnKey Filter column key.
 * @returns {FilterValue | null} Selected values.
 */
export function getSelectedFilterValues(
  filters: ClassesTableFilterState,
  columnKey: ClassesFilterColumnKey,
): FilterValue | null {
  if (columnKey === 'status') {
    return filters.status;
  }

  if (columnKey === 'cohortLabel') {
    return filters.cohortLabel;
  }

  if (columnKey === 'courseLength') {
    return filters.courseLength;
  }

  if (columnKey === 'yearGroupLabel') {
    return filters.yearGroupLabel;
  }

  return filters.active;
}

/**
 * Checks whether a column key is a supported filter column key.
 *
 * @param {unknown} columnKey Column key value.
 * @returns {columnKey is ClassesFilterColumnKey} Whether the key is filterable.
 */
export function isFilterColumnKey(columnKey: unknown): columnKey is ClassesFilterColumnKey {
  return (
    columnKey === 'status'
    || columnKey === 'cohortLabel'
    || columnKey === 'courseLength'
    || columnKey === 'yearGroupLabel'
    || columnKey === 'active'
  );
}

/**
 * Applies controlled filter and sort state to table columns.
 *
 * @param {TableColumnsType<ClassesManagementRow>} columns Source columns.
 * @param {ClassesTableFilterState} filters Current filters.
 * @param {SortState | null} sortState Current sorter state.
 * @returns {TableColumnsType<ClassesManagementRow>} Controlled columns.
 */
export function getControlledColumns(
  columns: TableColumnsType<ClassesManagementRow>,
  filters: ClassesTableFilterState,
  sortState: SortState | null,
): TableColumnsType<ClassesManagementRow> {
  return columns.map((column) => {
    const columnKey = typeof column.key === 'string' ? column.key : null;

    return {
      ...column,
      filteredValue: isFilterColumnKey(columnKey)
        ? getSelectedFilterValues(filters, columnKey)
        : column.filteredValue,
      sortOrder:
        sortState !== null && columnKey === sortState.columnKey
          ? sortState.order
          : null,
    };
  });
}

/**
 * Applies active column filters to rows.
 *
 * @param {readonly ClassesManagementRow[]} rows Source rows.
 * @param {TableColumnsType<ClassesManagementRow>} columns Current columns.
 * @param {ClassesTableFilterState} filters Current filters.
 * @returns {ClassesManagementRow[]} Filtered rows.
 */
export function applyColumnFilters(
  rows: readonly ClassesManagementRow[],
  columns: TableColumnsType<ClassesManagementRow>,
  filters: ClassesTableFilterState,
): ClassesManagementRow[] {
  return rows.filter((row) =>
    columns.every((column) => {
      const columnKey = column.key;
      if (!isFilterColumnKey(columnKey)) {
        return true;
      }

      const selectedValues = getSelectedFilterValues(filters, columnKey);
      if (selectedValues === null || selectedValues.length === 0 || column.onFilter === undefined) {
        return true;
      }

      return selectedValues.some((value) => column.onFilter?.(value, row));
    }),
  );
}

/**
 * Returns the comparator for a selected column key.
 *
 * @param {ClassesSortableColumnKey} columnKey Active sort column.
 * @returns {(left: ClassesManagementRow, right: ClassesManagementRow) => number} Comparator.
 */
export function getSortComparator(
  columnKey: ClassesSortableColumnKey,
): (left: ClassesManagementRow, right: ClassesManagementRow) => number {
  const statusOrder: Record<ClassesManagementRow['status'], number> = {
    active: 0,
    inactive: 1,
    notCreated: 2,
    orphaned: 3,
  };

  switch (columnKey) {
    case 'status': {
      return (left, right) => statusOrder[left.status] - statusOrder[right.status];
    }

    case 'className': {
      return (left, right) => left.className.localeCompare(right.className, undefined, { sensitivity: 'base' });
    }

    case 'cohortLabel': {
      return (left, right) => (left.cohortLabel ?? '').localeCompare(right.cohortLabel ?? '', undefined, { sensitivity: 'base' });
    }

    case 'courseLength': {
      return (left, right) => (left.courseLength ?? Number.NEGATIVE_INFINITY) - (right.courseLength ?? Number.NEGATIVE_INFINITY);
    }

    case 'yearGroupLabel': {
      return (left, right) => (left.yearGroupLabel ?? '').localeCompare(right.yearGroupLabel ?? '', undefined, { sensitivity: 'base' });
    }

    default: {
      return (left, right) => (left.active === null ? Number.NEGATIVE_INFINITY : Number(left.active))
        - (right.active === null ? Number.NEGATIVE_INFINITY : Number(right.active));
    }
  }
}

/**
 * Applies sorter state and deterministic tie-break ordering.
 *
 * @param {readonly ClassesManagementRow[]} rows Source rows.
 * @param {TableColumnsType<ClassesManagementRow>} columns Current columns.
 * @param {SortState | null} sortState Current sorter state.
 * @returns {ClassesManagementRow[]} Sorted rows.
 */
export function getSortedRows(
  rows: readonly ClassesManagementRow[],
  columns: TableColumnsType<ClassesManagementRow>,
  sortState: SortState | null,
): ClassesManagementRow[] {
  if (sortState === null) {
    return getDefaultSortedRows(rows);
  }

  const hasMatchingColumn = columns.some((column) => column.key === sortState.columnKey);
  if (!hasMatchingColumn) {
    return getDefaultSortedRows(rows);
  }

  return [...rows].toSorted((left, right) => {
    const comparison = getSortComparator(sortState.columnKey)(left, right);
    const directionalComparison = sortState.order === 'ascend' ? comparison : -comparison;
    if (directionalComparison !== 0) {
      return directionalComparison;
    }

    return compareRowsByDefaultPriority(left, right);
  });
}
