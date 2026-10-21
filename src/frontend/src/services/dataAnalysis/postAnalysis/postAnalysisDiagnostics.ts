import { ApiTransportError } from '@/errors/apiTransportError';
import { logFrontendError } from '@/logging/frontendLogger';
import { CanonicalMetadataTimestampSchema } from '@/services/abClass/abClassMetadata.zod';
import type { PostAnalysisContext } from './postAnalysis.zod';
import { compareAssignmentNewestFirst } from './metadataProjection';
import { REFRESH_AB_CLASS_METADATA_TASK_ID } from './postAnalysisTasks';

/** Logs bounded identifiers only, without analysis, metadata or student snapshots.
 * @param {string} taskId - Failed descriptor identity.
 * @param {PostAnalysisContext} context - Source used to identify the metadata target.
 * @param {Error} error - Normalised technical failure with available correlation.
 * @param {true | undefined} hasConfirmedPersistence - Whether persistence preceded refresh failure.
 * @returns {void} Emits one task-owned diagnostic.
 */
export function logPostAnalysisFailure(
  taskId: string,
  context: PostAnalysisContext,
  error: Error,
  hasConfirmedPersistence?: true
): void {
  const assignments = context.classFull.assignments;
  const target =
    taskId === REFRESH_AB_CLASS_METADATA_TASK_ID
      ? assignments
          .filter(
            (assignment) => CanonicalMetadataTimestampSchema.safeParse(assignment.updatedAt).success
          )
          .toSorted(compareAssignmentNewestFirst)[0]
      : undefined;
  logFrontendError('runPostAnalysisTasks', error, {
    taskId,
    classId: context.classFull.classId,
    ...(hasConfirmedPersistence === true && { confirmedPersistence: hasConfirmedPersistence }),
    ...(target && { assignmentId: target.assignmentId }),
    ...(error instanceof ApiTransportError && {
      requestId: error.requestId,
      errorCode: error.code,
    }),
  });
}
