import { STATUS_ORDER, type ClassesManagementRow } from './classesManagementViewModel';

const NULL_SORT_SENTINEL = -1;

export type ClassesSortableColumnKey =
  | 'status'
  | 'className'
  | 'cohortLabel'
  | 'courseLength'
  | 'yearGroupLabel'
  | 'active';

/**
 * Compares nullable text values using case-insensitive locale ordering.
 *
 * @param {string | null} left Left value.
 * @param {string | null} right Right value.
 * @returns {number} Comparison result for sorting.
 */
function compareNullableText(left: string | null, right: string | null): number {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return NULL_SORT_SENTINEL;
  }

  if (right === null) {
    return 1;
  }

  return left.localeCompare(right, undefined, { sensitivity: 'base' });
}

/**
 * Compares nullable numeric values for deterministic ordering.
 *
 * @param {number | null} left Left value.
 * @param {number | null} right Right value.
 * @returns {number} Comparison result for sorting.
 */
function compareNullableNumber(left: number | null, right: number | null): number {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return NULL_SORT_SENTINEL;
  }

  if (right === null) {
    return 1;
  }

  return left - right;
}

/**
 * Returns the shared comparator for a sortable Classes table column.
 *
 * @param {ClassesSortableColumnKey} columnKey Active sort column.
 * @returns {(left: ClassesManagementRow, right: ClassesManagementRow) => number} Comparator.
 */
export function getClassesTableSortComparator(
  columnKey: ClassesSortableColumnKey,
): (left: ClassesManagementRow, right: ClassesManagementRow) => number {
  switch (columnKey) {
    case 'status': {
      return (left, right) => STATUS_ORDER[left.status] - STATUS_ORDER[right.status];
    }

    case 'className': {
      return (left, right) => left.className.localeCompare(right.className, undefined, { sensitivity: 'base' });
    }

    case 'cohortLabel': {
      return (left, right) => compareNullableText(left.cohortLabel, right.cohortLabel);
    }

    case 'courseLength': {
      return (left, right) => compareNullableNumber(left.courseLength, right.courseLength);
    }

    case 'yearGroupLabel': {
      return (left, right) => compareNullableText(left.yearGroupLabel, right.yearGroupLabel);
    }

    default: {
      return (left, right) =>
        compareNullableNumber(
          left.active === null ? null : Number(left.active),
          right.active === null ? null : Number(right.active),
        );
    }
  }
}
