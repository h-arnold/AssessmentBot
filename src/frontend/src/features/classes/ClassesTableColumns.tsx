import type { TableColumnsType } from 'antd';
import type { ClassesManagementRow, ClassesManagementStatus } from './classesManagementViewModel';

export const UNAVAILABLE_VALUE = '—';

const STATUS_ORDER: Record<ClassesManagementStatus, number> = {
  active: 0,
  inactive: 1,
  notCreated: 2,
  orphaned: 3,
};

function compareNullableText(left: string | null, right: string | null): number {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return -1;
  }

  if (right === null) {
    return 1;
  }

  return left.localeCompare(right, undefined, { sensitivity: 'base' });
}

function compareNullableNumber(left: number | null, right: number | null): number {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return -1;
  }

  if (right === null) {
    return 1;
  }

  return left - right;
}

function getNotCreatedAwareValue<TValue>(row: ClassesManagementRow, value: TValue | null): TValue | string {
  if (row.status === 'notCreated' && value === null) {
    return UNAVAILABLE_VALUE;
  }

  return value ?? UNAVAILABLE_VALUE;
}

/**
 * Builds deterministic table columns for classes management.
 *
 * @returns {TableColumnsType<ClassesManagementRow>} Table columns.
 */
export function getClassesTableColumns(): TableColumnsType<ClassesManagementRow> {
  return [
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      sorter: (left, right) => STATUS_ORDER[left.status] - STATUS_ORDER[right.status],
      filters: [
        { text: 'active', value: 'active' },
        { text: 'inactive', value: 'inactive' },
        { text: 'notCreated', value: 'notCreated' },
        { text: 'orphaned', value: 'orphaned' },
      ],
      onFilter: (value, row) => row.status === value,
    },
    {
      title: 'Class name',
      dataIndex: 'className',
      key: 'className',
      sorter: (left, right) => left.className.localeCompare(right.className, undefined, { sensitivity: 'base' }),
      filters: [],
      onFilter: (_value, _row) => true,
    },
    {
      title: 'Cohort',
      dataIndex: 'cohortLabel',
      key: 'cohortLabel',
      render: (_, row) => getNotCreatedAwareValue(row, row.cohortLabel),
      sorter: (left, right) => compareNullableText(left.cohortLabel, right.cohortLabel),
    },
    {
      title: 'Course length',
      dataIndex: 'courseLength',
      key: 'courseLength',
      render: (_, row) => getNotCreatedAwareValue(row, row.courseLength),
      sorter: (left, right) => compareNullableNumber(left.courseLength, right.courseLength),
    },
    {
      title: 'Year group',
      dataIndex: 'yearGroupLabel',
      key: 'yearGroupLabel',
      render: (_, row) => getNotCreatedAwareValue(row, row.yearGroupLabel),
      sorter: (left, right) => compareNullableText(left.yearGroupLabel, right.yearGroupLabel),
    },
    {
      title: 'Active',
      dataIndex: 'active',
      key: 'active',
      render: (_, row) => {
        if (row.status === 'notCreated') {
          return UNAVAILABLE_VALUE;
        }

        return row.active ? 'Yes' : 'No';
      },
      sorter: (left, right) => compareNullableNumber(left.active === null ? null : Number(left.active), right.active === null ? null : Number(right.active)),
    },
  ];
}
