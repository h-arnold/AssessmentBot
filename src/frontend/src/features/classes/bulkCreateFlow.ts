/**
 * Bulk create flow.
 *
 * Exports the bulk-create filtering helper and dispatch function for the
 * canonical ClassesManagementRow contract owned by classesManagementViewModel.
 */

import type { ClassesManagementRow } from './classesManagementViewModel';
import { callApi } from '../../services/apiService';
import { runBatchMutation, type RowMutationResult } from './batchMutationEngine';

/**
 * Options for the bulk create operation.
 */
export type BulkCreateOptions = {
  /** Cohort identifier to assign to each created class. */
  cohortKey: string;
  /** Year group key to assign to each created class. */
  yearGroupKey: string;
  /** Course length in half-terms; defaults to 1 when omitted. */
  courseLength?: number;
};

/**
 * Returns only the rows that have `notCreated` status.
 *
 * @param {ClassesManagementRow[]} rows All candidate rows.
 * @returns {ClassesManagementRow[]} The subset eligible for bulk creation.
 */
export function filterBulkCreateRows(rows: ClassesManagementRow[]): ClassesManagementRow[] {
  return rows.filter((row) => row.status === 'notCreated');
}

/**
 * Dispatches an upsertABClass call for each supplied row using the shared batch
 * mutation engine. Uses `cohortKey → cohort`, `yearGroupKey → yearGroup`, and
 * `courseLength` (defaulting to `1` when not provided).
 *
 * @param {ClassesManagementRow[]} rows Rows to create; an empty array returns immediately.
 * @param {BulkCreateOptions} options Cohort, year group, and optional course length.
 * @returns {Promise<RowMutationResult<ClassesManagementRow, unknown>[]>} Settled results in submitted-row order.
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
