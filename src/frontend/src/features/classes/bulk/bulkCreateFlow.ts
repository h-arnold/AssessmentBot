import type { ClassesManagementRow } from '../classesManagementViewModel';
import {
  runQueuedBatchMutation,
  type QueuedBatchItem,
  type BatchProgressSnapshot,
} from './runQueuedBatchMutation';
import type { RowMutationResult } from './batchMutationEngine';

export type BulkCreateOptions = {
  cohortKey: string;
  yearGroupKey: string;
  courseLength?: number;
};

/**
 * Returns only rows eligible for bulk creation.
 *
 * @param {ClassesManagementRow[]} rows Candidate rows.
 * @returns {ClassesManagementRow[]} Rows with `notCreated` status.
 */
export function filterBulkCreateRows(rows: ClassesManagementRow[]): ClassesManagementRow[] {
  return rows.filter((row) => row.status === 'notCreated');
}

/**
 * Runs bulk ABClass creation for the supplied rows.
 *
 * @param {ClassesManagementRow[]} rows Rows to create.
 * @param {BulkCreateOptions} options Bulk-create metadata.
 * @param {(snapshot: BatchProgressSnapshot) => void} [onProgress] Optional progress callback.
 * @returns {Promise<RowMutationResult<ClassesManagementRow, unknown>[]>} Batch outcomes.
 */
export async function bulkCreate(
  rows: ClassesManagementRow[],
  options: BulkCreateOptions,
  onProgress?: (snapshot: BatchProgressSnapshot) => void
): Promise<RowMutationResult<ClassesManagementRow, unknown>[]> {
  if (rows.length === 0) {
    return [];
  }

  const { cohortKey, yearGroupKey, courseLength = 1 } = options;

  const items: QueuedBatchItem[] = rows.map((row) => ({
    row,
    method: 'upsertABClass' as const,
    parameters: { classId: row.classId, cohortKey, yearGroupKey, courseLength },
    verb: 'Creating',
    className: row.className,
  }));

  return runQueuedBatchMutation(items, { jobName: 'classesBulkMutation', onProgress });
}
