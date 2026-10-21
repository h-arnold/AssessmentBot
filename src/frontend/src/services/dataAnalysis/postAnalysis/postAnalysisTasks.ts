import { CanonicalMetadataTimestampSchema } from '@/services/abClass/abClassMetadata.zod';
import type { PostAnalysisContext } from './postAnalysis.zod';
import type { PostAnalysisTaskDescriptor } from './runPostAnalysisTasks';
import { getMetadataRefreshDecision } from './metadataProjection';
import { refreshABClassMetadata } from './refreshABClassMetadata';

/** The production registry contains only the metadata task. */
export class PostAnalysisTaskRegistry {
  readonly tasks: readonly PostAnalysisTaskDescriptor[];

  /** Builds descriptors without starting work.
   * @param {() => string} now - Clock read only when preparing a changed write.
   */
  constructor(now: () => string) {
    this.tasks = [
      {
        id: 'refreshABClassMetadata',
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
}

/** Keys source versions independently of metadata, scores or live weightings.
 * @param {PostAnalysisContext} context - Complete cached source class.
 * @returns {string} Mount-local identity, including invalid source versions.
 * @remarks Invalid timestamps must fail inside the task, not prevent later tasks
 * from running. Their raw ID/time signature deduplicates that failed attempt.
 */
function getMetadataAttemptKey(context: PostAnalysisContext): string {
  const { classFull } = context;
  if (
    classFull.assignments.some(
      (assignment) => !CanonicalMetadataTimestampSchema.safeParse(assignment.updatedAt).success
    )
  ) {
    return JSON.stringify([
      classFull.classId,
      classFull.assignments.map(({ assignmentId, updatedAt }) => [assignmentId, updatedAt]),
    ]);
  }
  const decision = getMetadataRefreshDecision({ ...classFull, metadata: null });
  return JSON.stringify([
    classFull.classId,
    decision.status === 'changed'
      ? [decision.target.assignmentId, decision.target.updatedAt]
      : 'noAssignments',
  ]);
}
