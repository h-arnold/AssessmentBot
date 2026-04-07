import { callApi } from '../../services/apiService';
import type { YearGroup } from '../../services/referenceData.zod';
import { runBatchMutation, type RowMutationResult } from './batchMutationEngine';
import { bulkReferenceKeySchema } from './bulkEditValidation.zod';
import type { ClassesManagementRow } from './classesManagementViewModel';

/**
 * Returns only existing active or inactive rows for bulk year-group editing.
 *
 * @param {ClassesManagementRow[]} rows Candidate rows.
 * @returns {ClassesManagementRow[]} Eligible rows.
 */
export function filterEligibleForBulkSetYearGroup(rows: ClassesManagementRow[]): ClassesManagementRow[] {
  return rows.filter((row) => row.status === 'active' || row.status === 'inactive');
}

/**
 * Builds select options using stable year-group keys as option values.
 *
 * @param {YearGroup[]} yearGroups Available year-group records.
 * @returns {Array<{ label: string; value: string }>} Year-group options.
 */
export function getYearGroupOptions(yearGroups: YearGroup[]): Array<{ label: string; value: string }> {
  return yearGroups.map((yearGroup) => ({
    label: yearGroup.name,
    value: yearGroup.key,
  }));
}

/**
 * Applies a year-group key to each supplied class row via the shared batch mutation engine.
 *
 * @param {ClassesManagementRow[]} rows Rows to update.
 * @param {string} yearGroupKey Selected year-group key.
 * @returns {Promise<RowMutationResult<ClassesManagementRow, unknown>[]>} Settled row results.
 */
export async function bulkSetYearGroup(
  rows: ClassesManagementRow[],
  yearGroupKey: string,
): Promise<RowMutationResult<ClassesManagementRow, unknown>[]> {
  const parsedYearGroupKey = bulkReferenceKeySchema.parse(yearGroupKey);

  return runBatchMutation(rows, (row) =>
    callApi('updateABClass', {
      classId: row.classId,
      yearGroupKey: parsedYearGroupKey,
    }),
  );
}
