import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../query/queryKeys';
import { runMutationWithRequiredClassPartialsRefresh, type RequiredClassPartialsRefreshOutcome } from './queryInvalidation';

export type BulkMutationOrchestrationOptions<TResult> = Readonly<{
  clearFeedback: () => void;
  handleOutcome: (outcome: RequiredClassPartialsRefreshOutcome<TResult>) => Promise<void>;
  mutate: () => Promise<TResult>;
  queryClient: QueryClient;
  setSubmitting: (value: boolean) => void;
}>;

/**
 * Runs the shared bulk-mutation orchestration skeleton.
 *
 * Clears feedback, runs the required class-partials refresh wrapper,
 * invalidates class-partials, hands off the outcome, and always clears
 * submitting.
 *
 * @template TResult Mutation result payload type.
 * @param {BulkMutationOrchestrationOptions<TResult>} options Shared orchestration dependencies.
 * @returns {Promise<void>} Completion signal.
 */
export async function runBulkMutationOrchestration<TResult>(options: BulkMutationOrchestrationOptions<TResult>): Promise<void> {
  options.setSubmitting(true);
  options.clearFeedback();

  try {
    const outcome = await runMutationWithRequiredClassPartialsRefresh({ mutate: options.mutate, queryClient: options.queryClient });
    await options.queryClient.invalidateQueries({ queryKey: queryKeys.classPartials(), refetchType: 'none' });
    await options.handleOutcome(outcome);
  } finally {
    options.setSubmitting(false);
  }
}
