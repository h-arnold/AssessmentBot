import { callApi } from '../../services/apiService';
import { runBatchMutation, type RowMutationResult } from './batchMutationEngine';
import {
  bulkCourseLengthSchema,
  courseLengthValidationMessage,
} from './bulkEditValidation.zod';
import type { ClassesManagementRow } from './classesManagementViewModel';

/**
 * Returns only existing active or inactive rows for bulk course-length editing.
 *
 * @param {ClassesManagementRow[]} rows Candidate rows.
 * @returns {ClassesManagementRow[]} Eligible rows.
 */
export function filterEligibleForBulkSetCourseLength(rows: ClassesManagementRow[]): ClassesManagementRow[] {
  return rows.filter((row) => row.status === 'active' || row.status === 'inactive');
}

/**
 * Validates and normalises the supplied course length.
 *
 * @param {number} courseLength Proposed course length.
 * @returns {number} Validated course length.
 */
function parseCourseLength(courseLength: number): number {
  const parsedCourseLength = bulkCourseLengthSchema.safeParse(courseLength);

  if (!parsedCourseLength.success) {
    throw new Error(courseLengthValidationMessage);
  }

  return parsedCourseLength.data;
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
  const parsedCourseLength = parseCourseLength(courseLength);

  return runBatchMutation(rows, (row) =>
    callApi('updateABClass', {
      classId: row.classId,
      courseLength: parsedCourseLength,
    }),
  );
}
