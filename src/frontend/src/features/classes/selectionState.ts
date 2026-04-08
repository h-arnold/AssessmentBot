import type { ClassesManagementRow } from './classesManagementViewModel';

/**
 * Removes selected keys that are no longer visible in the current row set.
 *
 * @param {readonly string[]} selectedRowKeys Controlled selected keys.
 * @param {readonly ClassesManagementRow[]} rows Current visible rows.
 * @returns {string[]} Pruned selected keys.
 */
export function pruneSelectedRowKeys(
  selectedRowKeys: readonly string[],
  rows: readonly ClassesManagementRow[],
): string[] {
  const visibleRowKeys = new Set(rows.map((row) => row.classId));

  return selectedRowKeys.filter((rowKey) => visibleRowKeys.has(rowKey));
}
