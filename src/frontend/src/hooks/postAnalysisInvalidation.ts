import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/query/queryKeys';
import { toError } from '@/errors/normaliseUnknownError';
import { logPostAnalysisFailure } from '@/services/dataAnalysis/postAnalysis/postAnalysisDiagnostics';
import type { PostAnalysisContext } from '@/services/dataAnalysis/postAnalysis/postAnalysis.zod';
import type { PostAnalysisTaskOutcome } from '@/services/dataAnalysis/postAnalysis/runPostAnalysisTasks';
import { REFRESH_AB_CLASS_METADATA_TASK_ID } from '@/services/dataAnalysis/postAnalysis/postAnalysisTasks';

/** Completes a confirmed metadata attempt with both required refresh settlements.
 * @param {QueryClient} queryClient - Existing shared server-state owner.
 * @param {PostAnalysisContext} context - Successful source context.
 * @param {PostAnalysisTaskOutcome} outcome - Validated task execution outcome.
 * @returns {Promise<PostAnalysisTaskOutcome>} Refresh-aware outcome, retaining save confirmation.
 * @remarks Inactive queries only become stale. Both errors remain observable;
 * no imperative read, forced refetch or duplicate summary diagnostic is added.
 */
export async function completePostAnalysisInvalidation(
  queryClient: QueryClient,
  context: PostAnalysisContext,
  outcome: PostAnalysisTaskOutcome
): Promise<PostAnalysisTaskOutcome> {
  if (
    outcome.data.taskId !== REFRESH_AB_CLASS_METADATA_TASK_ID ||
    outcome.data.status !== 'succeeded' ||
    !outcome.data.confirmedPersistence
  )
    return outcome;
  const results = await Promise.allSettled(
    [queryKeys.abClass(context.classFull.classId), queryKeys.classPartials()].map(
      async (queryKey) => {
        await queryClient.invalidateQueries({ queryKey }, { throwOnError: true });
      }
    )
  );
  const failures = new Set(
    results.filter((result) => result.status === 'rejected').map((result) => toError(result.reason))
  );
  if (failures.size === 0) return outcome;
  for (const error of failures) logPostAnalysisFailure(outcome.data.taskId, context, error, true);
  return {
    data: { taskId: outcome.data.taskId, status: 'failed', confirmedPersistence: true },
    error: failures.values().next().value!,
  };
}
