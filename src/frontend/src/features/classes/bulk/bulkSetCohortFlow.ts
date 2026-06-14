import type { Cohort } from '../../../services/referenceData/referenceData.zod';
import type { RowMutationResult } from './batchMutationEngine';
import type { BatchProgressSnapshot } from './runQueuedBatchMutation';
import { bulkMetadataUpdate } from './bulkMetadataUpdateFlow';
import type { ClassesManagementRow } from '../classesManagementViewModel';

/**
 * Builds select options from active cohorts only.
 *
 * @param {Cohort[]} cohorts Available cohort records.
 * @returns {Array<{ label: string; value: string }>} Active cohort options.
 */
export function getActiveCohortOptions(cohorts: Cohort[]): Array<{ label: string; value: string }> {
  return cohorts
    .filter((cohort) => cohort.active)
    .map((cohort) => ({
      label: cohort.name,
      value: cohort.key,
    }));
}

/**
 * Applies a cohort key to each supplied class row via the queued batch mutation engine.
 *
 * @param {ClassesManagementRow[]} rows Rows to update.
 * @param {string} cohortKey Selected cohort key.
 * @param {(snapshot: BatchProgressSnapshot) => void} [onProgress] Optional progress callback.
 * @returns {Promise<RowMutationResult<ClassesManagementRow, unknown>[]>} Settled row results.
 */
export async function bulkSetCohort(
  rows: ClassesManagementRow[],
  cohortKey: string,
  onProgress?: (snapshot: BatchProgressSnapshot) => void
): Promise<RowMutationResult<ClassesManagementRow, unknown>[]> {
  return bulkMetadataUpdate(rows, { key: 'cohortKey', value: cohortKey }, onProgress);
}
