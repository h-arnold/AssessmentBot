import {
  runQueuedBatchMutation,
  type QueuedBatchItem,
  type BatchProgressSnapshot,
} from './runQueuedBatchMutation';
import type { RowMutationResult } from './batchMutationEngine';
import {
  bulkCourseLengthSchema,
  bulkReferenceKeySchema,
  courseLengthValidationMessage,
} from './bulkEditValidation.zod';
import type { ClassesManagementRow } from '../classesManagementViewModel';

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
export function filterEligibleForBulkMetadataUpdate(
  rows: ClassesManagementRow[]
): ClassesManagementRow[] {
  return rows.filter((row) => row.status === 'active' || row.status === 'inactive');
}

/**
 * Returns the user-facing progress verb for a metadata payload key.
 *
 * @param {BulkMetadataUpdatePayload['key']} payloadKey The metadata field key.
 * @returns {string} The progress verb.
 */
function getVerbForKey(payloadKey: BulkMetadataUpdatePayload['key']): string {
  switch (payloadKey) {
    case 'cohortKey': {
      return 'Setting cohort for';
    }
    case 'yearGroupKey': {
      return 'Setting year group for';
    }
    case 'courseLength': {
      return 'Setting course length for';
    }
  }
}

/**
 * Applies one metadata field update to each supplied class row via the
 * queued batch mutation engine.
 *
 * @param {ClassesManagementRow[]} rows Rows to update.
 * @param {BulkMetadataUpdatePayload} payload Metadata update payload.
 * @param {(snapshot: BatchProgressSnapshot) => void} [onProgress] Optional progress callback.
 * @returns {Promise<RowMutationResult<ClassesManagementRow, unknown>[]>} Settled row results.
 */
export async function bulkMetadataUpdate(
  rows: ClassesManagementRow[],
  payload: BulkMetadataUpdatePayload,
  onProgress?: (snapshot: BatchProgressSnapshot) => void
): Promise<RowMutationResult<ClassesManagementRow, unknown>[]> {
  const verb = getVerbForKey(payload.key);
  const updatePayload = getUpdatePayload(payload);

  const items: QueuedBatchItem[] = rows.map((row) => ({
    row,
    method: 'updateABClass' as const,
    parameters: { classId: row.classId, ...updatePayload },
    verb,
    className: row.className,
  }));

  return runQueuedBatchMutation(items, { jobName: 'classesBulkMutation', onProgress });
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
