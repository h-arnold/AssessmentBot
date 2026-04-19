import type { ClassesManagementRow } from './classesManagementViewModel';
import { callApi } from '../../services/apiService';
import { runBatchMutation, type RowMutationResult } from './batchMutationEngine';

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
 * @returns {Promise<RowMutationResult<ClassesManagementRow, unknown>[]>} Batch outcomes.
 */
export async function bulkCreate(
  rows: ClassesManagementRow[],
  options: BulkCreateOptions,
): Promise<RowMutationResult<ClassesManagementRow, unknown>[]> {
  const { cohortKey, yearGroupKey, courseLength = 1 } = options;

  return runBatchMutation(rows, (row) =>
    callApi('upsertABClass', {
      classId: row.classId,
      cohortKey,
      yearGroupKey,
      courseLength,
    }),
  );
}
