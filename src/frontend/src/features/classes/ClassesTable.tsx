import { Button, Card, Space, Table, type TableProps } from 'antd';
import { useMemo, useState } from 'react';
import {
  applyColumnFilters,
  EMPTY_FILTER_STATE,
  getControlledColumns,
  getFilterOptions,
  getPrimarySorter,
  getSortedRows,
  normaliseFilters,
  type ClassesTableFilterState,
  type SortState,
} from './ClassesTable.helpers';
import {
  getClassesTableColumns,
} from './ClassesTableColumns';
import { ClassesNoActiveClassroomsEmptyState } from './ClassesEmptyStates';
import type { ClassesManagementRow } from './classesManagementViewModel';

export interface ClassesTableProperties {
  rows: readonly ClassesManagementRow[];
  selectedRowKeys: readonly string[];
  onSelectedRowKeysChange: (selectedRowKeys: string[]) => void;
  selectionFrozen?: boolean;
}

/**
 * Renders the classes table and deterministic sort/filter controls.
 *
 * @param {Readonly<ClassesTableProperties>} properties Table inputs.
 * @returns {JSX.Element} Table card.
 */
export function ClassesTable(properties: Readonly<ClassesTableProperties>) {
  const [filters, setFilters] = useState<ClassesTableFilterState>(EMPTY_FILTER_STATE);
  const [sortState, setSortState] = useState<SortState | null>(null);

  const filterOptions = useMemo(() => getFilterOptions(properties.rows), [properties.rows]);
  const baseColumns = useMemo(
    () => getClassesTableColumns({ filterOptions }),
    [filterOptions],
  );
  const columns = useMemo(
    () => getControlledColumns(baseColumns, filters, sortState),
    [baseColumns, filters, sortState],
  );

  const visibleRows = useMemo(() => {
    const filteredRows = applyColumnFilters(properties.rows, baseColumns, filters);
    return getSortedRows(filteredRows, baseColumns, sortState);
  }, [baseColumns, filters, properties.rows, sortState]);

  const rowSelection: TableProps<ClassesManagementRow>['rowSelection'] = {
    selectedRowKeys: properties.selectedRowKeys as string[],
    getCheckboxProps: () => ({ disabled: properties.selectionFrozen === true }),
    getTitleCheckboxProps: () => ({ disabled: properties.selectionFrozen === true }),
    onChange: (selectedKeys) => {
      if (properties.selectionFrozen === true) {
        return;
      }

      properties.onSelectedRowKeysChange(selectedKeys as string[]);
    },
  };

  const hasActiveGoogleClassroom = properties.rows.some(
    (row) => row.status === 'active' || row.status === 'inactive' || row.status === 'notCreated',
  );

  return (
    <Card
      size="small"
      title="Classes table"
      extra={(
        <Space>
          <Button
            onClick={() => {
              setFilters(EMPTY_FILTER_STATE);
              setSortState(null);
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
        locale={{
          emptyText: hasActiveGoogleClassroom ? undefined : <ClassesNoActiveClassroomsEmptyState />,
        }}
        pagination={false}
        rowKey="classId"
        rowSelection={rowSelection}
        onChange={(_, nextFilters, sorter) => {
          setFilters(normaliseFilters(nextFilters));
          setSortState(getPrimarySorter(sorter));
        }}
      />
    </Card>
  );
}
