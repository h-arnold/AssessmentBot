import { Button, Card, Select, Space, Table, type TableProps } from 'antd';
import { useMemo, useState } from 'react';
import type { ClassesManagementRow, ClassesManagementStatus } from './classesManagementViewModel';
import { getClassesTableColumns } from './ClassesTableColumns';

const STATUS_ORDER: Readonly<Record<ClassesManagementStatus, number>> = {
  active: 0,
  inactive: 1,
  notCreated: 2,
  orphaned: 3,
};

function getDefaultSortedRows(rows: readonly ClassesManagementRow[]): ClassesManagementRow[] {
  return [...rows].sort((left, right) => {
    const statusComparison = STATUS_ORDER[left.status] - STATUS_ORDER[right.status];
    if (statusComparison !== 0) {
      return statusComparison;
    }

    const classNameComparison = left.className.localeCompare(right.className, undefined, { sensitivity: 'base' });
    if (classNameComparison !== 0) {
      return classNameComparison;
    }

    return left.classId.localeCompare(right.classId);
  });
}

export interface ClassesTableProps {
  rows: readonly ClassesManagementRow[];
  selectedRowKeys: readonly string[];
  onSelectedRowKeysChange: (selectedRowKeys: string[]) => void;
}

/**
 * Renders the classes table and deterministic sort/filter controls.
 *
 * @param {ClassesTableProps} props Table inputs.
 * @returns {JSX.Element} Table card.
 */
export function ClassesTable(props: ClassesTableProps) {
  const [statusFilter, setStatusFilter] = useState<ClassesManagementStatus | 'all'>('all');
  const [classNameSortOrder, setClassNameSortOrder] = useState<'default' | 'asc' | 'desc'>('default');

  const defaultRows = useMemo(() => getDefaultSortedRows(props.rows), [props.rows]);

  const visibleRows = useMemo(() => {
    const statusFilteredRows = statusFilter === 'all'
      ? defaultRows
      : defaultRows.filter((row) => row.status === statusFilter);

    if (classNameSortOrder === 'default') {
      return statusFilteredRows;
    }

    return [...statusFilteredRows].sort((left, right) => {
      const comparison = left.className.localeCompare(right.className, undefined, { sensitivity: 'base' });
      if (comparison !== 0) {
        return classNameSortOrder === 'asc' ? comparison : -comparison;
      }

      return left.classId.localeCompare(right.classId);
    });
  }, [classNameSortOrder, defaultRows, statusFilter]);

  const columns = useMemo(() => getClassesTableColumns(), []);

  const rowSelection: TableProps<ClassesManagementRow>['rowSelection'] = {
    selectedRowKeys: [...props.selectedRowKeys],
    onChange: (selectedKeys) => props.onSelectedRowKeysChange(selectedKeys as string[]),
    getCheckboxProps: (record) => ({
      'aria-label': `Select row ${record.classId}`,
    }),
  };

  return (
    <Card
      size="small"
      title="Classes table"
      extra={(
        <Space>
          <Select
            aria-label="Status filter"
            value={statusFilter}
            options={[
              { label: 'all', value: 'all' },
              { label: 'active', value: 'active' },
              { label: 'inactive', value: 'inactive' },
              { label: 'notCreated', value: 'notCreated' },
              { label: 'orphaned', value: 'orphaned' },
            ]}
            onChange={(value) => setStatusFilter(value)}
            style={{ minWidth: 160 }}
          />
          <Button
            onClick={() => {
              if (classNameSortOrder === 'default') {
                setClassNameSortOrder('asc');
                return;
              }

              if (classNameSortOrder === 'asc') {
                setClassNameSortOrder('desc');
                return;
              }

              setClassNameSortOrder('default');
            }}
          >
            Class name
          </Button>
          <Button
            onClick={() => {
              setStatusFilter('all');
              setClassNameSortOrder('default');
            }}
          >
            Reset sort and filters
          </Button>
        </Space>
      )}
    >
      <Table<ClassesManagementRow>
        aria-label="Classes table"
        columns={columns}
        dataSource={visibleRows}
        pagination={false}
        rowKey="classId"
        rowSelection={rowSelection}
      />
    </Card>
  );
}
