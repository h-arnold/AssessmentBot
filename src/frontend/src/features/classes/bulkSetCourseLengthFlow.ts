import type { RowMutationResult } from './batchMutationEngine';
import { bulkMetadataUpdate, filterEligibleForBulkMetadataUpdate } from './bulkMetadataUpdateFlow';
import type { ClassesManagementRow } from './classesManagementViewModel';

/**
 * Returns only existing active or inactive rows for bulk course-length editing.
 *
 * @param {ClassesManagementRow[]} rows Candidate rows.
 * @returns {ClassesManagementRow[]} Eligible rows.
 */
export function filterEligibleForBulkSetCourseLength(rows: ClassesManagementRow[]): ClassesManagementRow[] {
  return filterEligibleForBulkMetadataUpdate(rows);
}

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
