import type { YearGroup } from '../../services/referenceData.zod';
import type { RowMutationResult } from './batchMutationEngine';
import { bulkMetadataUpdate } from './bulkMetadataUpdateFlow';
import type { ClassesManagementRow } from './classesManagementViewModel';

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
  return bulkMetadataUpdate(rows, { key: 'yearGroupKey', value: yearGroupKey });
}
