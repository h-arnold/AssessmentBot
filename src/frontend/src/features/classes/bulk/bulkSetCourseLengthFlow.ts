import type { RowMutationResult } from './batchMutationEngine';
import type { BatchProgressSnapshot } from './runQueuedBatchMutation';
import { bulkMetadataUpdate } from './bulkMetadataUpdateFlow';
import type { ClassesManagementRow } from '../classesManagementViewModel';

/**
 * Applies a validated course length to each supplied class row via the queued batch mutation engine.
 *
 * @param {ClassesManagementRow[]} rows Rows to update.
 * @param {number} courseLength Selected course length.
 * @param {(snapshot: BatchProgressSnapshot) => void} [onProgress] Optional progress callback.
 * @returns {Promise<RowMutationResult<ClassesManagementRow, unknown>[]>} Settled row results.
 */
export async function bulkSetCourseLength(
  rows: ClassesManagementRow[],
  courseLength: number,
  onProgress?: (snapshot: BatchProgressSnapshot) => void
): Promise<RowMutationResult<ClassesManagementRow, unknown>[]> {
  return bulkMetadataUpdate(rows, { key: 'courseLength', value: courseLength }, onProgress);
}
