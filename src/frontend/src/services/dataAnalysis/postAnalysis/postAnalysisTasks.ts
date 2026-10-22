import { CanonicalMetadataTimestampSchema } from '@/services/abClass/abClassMetadata.zod';
import type { PostAnalysisContext } from './postAnalysis.zod';
import type { PostAnalysisTaskDescriptor } from './runPostAnalysisTasks';
import { getMetadataRefreshDecision } from './metadataProjection';
import { refreshABClassMetadata } from './refreshABClassMetadata';

export const REFRESH_AB_CLASS_METADATA_TASK_ID = 'refreshABClassMetadata';

/** Builds the production metadata descriptor without starting work.
 * @param {() => string} now - Clock read only when preparing a changed write.
 * @returns {readonly PostAnalysisTaskDescriptor[]} Stable descriptor list for one mount.
 */
export function createPostAnalysisTaskDescriptors(
  now: () => string
): readonly PostAnalysisTaskDescriptor[] {
  return [
    {
      id: REFRESH_AB_CLASS_METADATA_TASK_ID,
      getAttemptKey: getMetadataAttemptKey,
      async run(context) {
        const outcome = await refreshABClassMetadata(context, now);
        return outcome.status === 'saved'
          ? { status: 'succeeded', confirmedPersistence: true }
          : outcome;
      },
    },
  ];
}

/** Keys source versions independently of metadata, scores or live weightings.
 * @param {PostAnalysisContext['classFull']['assignments']} assignments - Source assignments.
 * @returns {string} Mount-local identity, including invalid source versions.
 * @remarks Invalid timestamps must fail inside the task, not prevent later tasks
 * from running. Their raw ID/time signature deduplicates that failed attempt.
 */
export function sourceVersionSignature(
  assignments: PostAnalysisContext['classFull']['assignments']
): string {
  return JSON.stringify(
    assignments.map(({ assignmentId, updatedAt }) => [assignmentId, updatedAt])
  );
}

/** Builds the metadata task's class/source-version attempt identity.
 * @param {PostAnalysisContext} context - Complete source context.
 * @returns {string} Stable attempt identity.
 */
function getMetadataAttemptKey(context: PostAnalysisContext): string {
  const { classFull } = context;
  if (
    classFull.assignments.some(
      (assignment) => !CanonicalMetadataTimestampSchema.safeParse(assignment.updatedAt).success
    )
  ) {
    return JSON.stringify([classFull.classId, sourceVersionSignature(classFull.assignments)]);
  }
  const decision = getMetadataRefreshDecision({ ...classFull, metadata: null });
  return JSON.stringify([
    classFull.classId,
    decision.status === 'changed' ? sourceVersionSignature([decision.target]) : 'noAssignments',
  ]);
}
