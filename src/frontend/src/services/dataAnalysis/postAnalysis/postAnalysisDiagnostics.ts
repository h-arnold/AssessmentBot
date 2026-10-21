import { ApiTransportError } from '@/errors/apiTransportError';
import { logFrontendError } from '@/logging/frontendLogger';
import { CanonicalMetadataTimestampSchema } from '@/services/abClass/abClassMetadata.zod';
import type { PostAnalysisContext } from './postAnalysis.zod';

/** Logs bounded identifiers only, without analysis, metadata or student snapshots.
 * @param {string} taskId - Failed descriptor identity.
 * @param {PostAnalysisContext} context - Source used to identify the metadata target.
 * @param {Error} error - Normalised technical failure with available correlation.
 * @returns {void} Emits one task-owned diagnostic.
 */
export function logPostAnalysisFailure(
  taskId: string,
  context: PostAnalysisContext,
  error: Error
): void {
  const assignments = context.classFull.assignments;
  const target =
    taskId === 'refreshABClassMetadata'
      ? assignments
          .filter(
            (assignment) => CanonicalMetadataTimestampSchema.safeParse(assignment.updatedAt).success
          )
          .toSorted((a, b) => {
            return (
              b.updatedAt!.localeCompare(a.updatedAt!) ||
              a.assignmentId.localeCompare(b.assignmentId)
            );
          })[0]
      : undefined;
  logFrontendError('runPostAnalysisTasks', error, {
    taskId,
    classId: context.classFull.classId,
    ...(target && { assignmentId: target.assignmentId }),
    ...(error instanceof ApiTransportError && {
      requestId: error.requestId,
      errorCode: error.code,
    }),
  });
}
