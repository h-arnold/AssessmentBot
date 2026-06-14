import type { YearGroup } from '../../../services/referenceData/referenceData.zod';
import type { RowMutationResult } from './batchMutationEngine';
import type { BatchProgressSnapshot } from './runQueuedBatchMutation';
import { bulkMetadataUpdate } from './bulkMetadataUpdateFlow';
import type { ClassesManagementRow } from '../classesManagementViewModel';

/**
 * Builds select options using stable year-group keys as option values.
 *
 * @param {YearGroup[]} yearGroups Available year-group records.
 * @returns {Array<{ label: string; value: string }>} Year-group options.
 */
export function getYearGroupOptions(
  yearGroups: YearGroup[]
): Array<{ label: string; value: string }> {
  return yearGroups.map((yearGroup) => ({
    label: yearGroup.name,
    value: yearGroup.key,
  }));
}

/**
 * Applies a year-group key to each supplied class row via the queued batch mutation engine.
 *
 * @param {ClassesManagementRow[]} rows Rows to update.
 * @param {string} yearGroupKey Selected year-group key.
 * @param {(snapshot: BatchProgressSnapshot) => void} [onProgress] Optional progress callback.
 * @returns {Promise<RowMutationResult<ClassesManagementRow, unknown>[]>} Settled row results.
 */
export async function bulkSetYearGroup(
  rows: ClassesManagementRow[],
  yearGroupKey: string,
  onProgress?: (snapshot: BatchProgressSnapshot) => void
): Promise<RowMutationResult<ClassesManagementRow, unknown>[]> {
  return bulkMetadataUpdate(rows, { key: 'yearGroupKey', value: yearGroupKey }, onProgress);
}
