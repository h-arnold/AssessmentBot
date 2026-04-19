import { callApi } from '../../services/apiService';
import { runBatchMutation, type RowMutationResult } from './batchMutationEngine';
import {
  bulkCourseLengthSchema,
  bulkReferenceKeySchema,
  courseLengthValidationMessage,
} from './bulkEditValidation.zod';
import type { ClassesManagementRow } from './classesManagementViewModel';

type BulkMetadataUpdatePayload = Readonly<
  | {
      key: 'cohortKey';
      value: string;
    }
  | {
      key: 'yearGroupKey';
      value: string;
    }
  | {
      key: 'courseLength';
      value: number;
    }
>;

/**
 * Returns only existing active or inactive rows for metadata updates.
 *
 * @param {ClassesManagementRow[]} rows Candidate rows.
 * @returns {ClassesManagementRow[]} Eligible rows.
 */
export function filterEligibleForBulkMetadataUpdate(rows: ClassesManagementRow[]): ClassesManagementRow[] {
  return rows.filter((row) => row.status === 'active' || row.status === 'inactive');
}

/**
 * Applies one metadata field update to each supplied class row.
 *
 * @param {ClassesManagementRow[]} rows Rows to update.
 * @param {BulkMetadataUpdatePayload} payload Metadata update payload.
 * @returns {Promise<RowMutationResult<ClassesManagementRow, unknown>[]>} Settled row results.
 */
export async function bulkMetadataUpdate(
  rows: ClassesManagementRow[],
  payload: BulkMetadataUpdatePayload,
): Promise<RowMutationResult<ClassesManagementRow, unknown>[]> {
  const updatePayload = getUpdatePayload(payload);

  return runBatchMutation(rows, (row) =>
    callApi('updateABClass', {
      classId: row.classId,
      ...updatePayload,
    }),
  );
}

/**
 * Validates and normalises one metadata update payload before dispatch.
 *
 * @param {BulkMetadataUpdatePayload} payload Proposed metadata update payload.
 * @returns {Record<string, string | number>} Validated update payload.
 */
function getUpdatePayload(payload: BulkMetadataUpdatePayload): Record<string, string | number> {
  if (payload.key === 'courseLength') {
    const parsedCourseLength = bulkCourseLengthSchema.safeParse(payload.value);

    if (!parsedCourseLength.success) {
      throw new Error(courseLengthValidationMessage);
    }

    return { courseLength: parsedCourseLength.data };
  }

  if (payload.key === 'cohortKey') {
    return { cohortKey: bulkReferenceKeySchema.parse(payload.value) };
  }

  return { yearGroupKey: bulkReferenceKeySchema.parse(payload.value) };
}
