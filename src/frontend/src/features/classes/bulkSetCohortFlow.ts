import { callApi } from '../../services/apiService';
import type { Cohort } from '../../services/referenceData.zod';
import { runBatchMutation, type RowMutationResult } from './batchMutationEngine';
import { bulkReferenceKeySchema } from './bulkEditValidation.zod';
import type { ClassTableRow } from './bulkCreateFlow';

/**
 * Returns only existing active or inactive rows for bulk cohort editing.
 *
 * @param {ClassTableRow[]} rows Candidate rows.
 * @returns {ClassTableRow[]} Eligible rows.
 */
export function filterEligibleForBulkSetCohort(rows: ClassTableRow[]): ClassTableRow[] {
  return rows.filter((row) => row.status === 'linked' && row.active !== null);
}

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
 * Applies a cohort key to each supplied class row via the shared batch mutation engine.
 *
 * @param {ClassTableRow[]} rows Rows to update.
 * @param {string} cohortKey Selected cohort key.
 * @returns {Promise<RowMutationResult<ClassTableRow, unknown>[]>} Settled row results.
 */
export async function bulkSetCohort(
  rows: ClassTableRow[],
  cohortKey: string,
): Promise<RowMutationResult<ClassTableRow, unknown>[]> {
  const parsedCohortKey = bulkReferenceKeySchema.parse(cohortKey);

  return runBatchMutation(rows, (row) =>
    callApi('updateABClass', {
      classId: row.classId,
      cohortKey: parsedCohortKey,
    }),
  );
}
