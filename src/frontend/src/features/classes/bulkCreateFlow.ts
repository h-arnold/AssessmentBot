/**
 * Bulk create flow.
 *
 * Exports the shared ClassTableRow type, ClassStatus type, row-filtering helper,
 * and the bulk-create dispatch function.  Uses the shared batch mutation engine so
 * all dispatch runs through the same path as single-row edits.
 */

import { callApi } from '../../services/apiService';
import { runBatchMutation, type RowMutationResult } from './batchMutationEngine';

/** Represents the lifecycle state of a class row in the table. */
export type ClassStatus = 'notCreated' | 'partial' | 'linked';

/** Represents a single class row in the classes table. */
export type ClassTableRow = {
  /** Unique key for the row — equals classId. */
  rowKey: string;
  /** Derived status indicating how completely the class has been set up. */
  status: ClassStatus;
  /** Google Classroom class identifier. */
  classId: string;
  /** Cohort identifier, or null when not yet assigned. */
  cohortKey: string | null;
  /** Year group key, or null when not yet assigned. */
  yearGroupKey: string | null;
  /** Number of half-terms the course runs; defaults to 1 when not supplied by the backend. */
  courseLength: number;
  /** Whether the class is active, or null when not yet created in AssessmentBot. */
  active: boolean | null;
  /** Human-readable class name. */
  className: string;
};

/** Options for the bulk create operation. */
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
 * @param {ClassTableRow[]} rows All candidate rows.
 * @returns {ClassTableRow[]} The subset eligible for bulk creation.
 */
export function filterBulkCreateRows(rows: ClassTableRow[]): ClassTableRow[] {
  return rows.filter((row) => row.status === 'notCreated');
}

/**
 * Dispatches an upsertABClass call for each supplied row using the shared batch
 * mutation engine.  Uses `cohortKey → cohort`, `yearGroupKey → yearGroup`, and
 * `courseLength` (defaulting to `1` when not provided).
 *
 * @param {ClassTableRow[]} rows Rows to create; an empty array returns immediately.
 * @param {BulkCreateOptions} options Cohort, year group, and optional course length.
 * @returns {Promise<RowMutationResult<ClassTableRow, unknown>[]>} Settled results in submitted-row order.
 */
export async function bulkCreate(
  rows: ClassTableRow[],
  options: BulkCreateOptions,
): Promise<RowMutationResult<ClassTableRow, unknown>[]> {
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
