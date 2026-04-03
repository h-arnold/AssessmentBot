import { useMemo } from 'react';
import type { ClassesManagementRow } from './classesManagementViewModel';

export type SelectedRowKey = string;

/**
 * Removes selected keys that are no longer visible in the current row set.
 *
 * @param {SelectedRowKey[]} selectedRowKeys Controlled selected keys.
 * @param {readonly ClassesManagementRow[]} rows Current visible rows.
 * @returns {SelectedRowKey[]} Pruned selected keys.
 */
export function pruneSelectedRowKeys(
  selectedRowKeys: readonly SelectedRowKey[],
  rows: readonly ClassesManagementRow[],
): SelectedRowKey[] {
  const visibleRowKeys = new Set(rows.map((row) => row.classId));

  return selectedRowKeys.filter((rowKey) => visibleRowKeys.has(rowKey));
}

/**
 * Resolves selected rows by key from a row set.
 *
 * @param {readonly ClassesManagementRow[]} rows Current rows.
 * @param {readonly SelectedRowKey[]} selectedRowKeys Controlled selected keys.
 * @returns {ClassesManagementRow[]} Selected rows.
 */
export function useSelectedRows(
  rows: readonly ClassesManagementRow[],
  selectedRowKeys: readonly SelectedRowKey[],
): ClassesManagementRow[] {
  return useMemo(() => {
    const selectedRowKeySet = new Set(selectedRowKeys);
    return rows.filter((row) => selectedRowKeySet.has(row.classId));
  }, [rows, selectedRowKeys]);
}
