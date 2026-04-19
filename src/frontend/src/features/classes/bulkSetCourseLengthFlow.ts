import type { RowMutationResult } from './batchMutationEngine';
import { bulkMetadataUpdate } from './bulkMetadataUpdateFlow';
import type { ClassesManagementRow } from './classesManagementViewModel';

/**
 * Applies a validated course length to each supplied class row via the shared batch mutation engine.
 *
 * @param {ClassesManagementRow[]} rows Rows to update.
 * @param {number} courseLength Selected course length.
 * @returns {Promise<RowMutationResult<ClassesManagementRow, unknown>[]>} Settled row results.
 */
export async function bulkSetCourseLength(
  rows: ClassesManagementRow[],
  courseLength: number,
): Promise<RowMutationResult<ClassesManagementRow, unknown>[]> {
  return bulkMetadataUpdate(rows, { key: 'courseLength', value: courseLength });
}
