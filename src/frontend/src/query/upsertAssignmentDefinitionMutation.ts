import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';

export type UpsertAssignmentDefinitionMutationFlow =
  | 'stage-one-create'
  | 'final-save'
  | 'document-reparse';

export type RunUpsertMutationCacheRefreshOptions = Readonly<{
  flow: UpsertAssignmentDefinitionMutationFlow;
  definitionKey: string;
  queryClient: Pick<QueryClient, 'invalidateQueries'>;
}>;

/**
 * Refreshes assignment-definition cache entries after a successful upsert.
 *
 * Per frontend-react-query-and-prefetch.md §7, we use invalidateQueries only.
 * Active useQuery observers will automatically refetch in the background,
 * and any errors will properly propagate to their isError state.
 *
 * @param {RunUpsertMutationCacheRefreshOptions} options Mutation refresh options.
 * @returns {Promise<void>} Resolves when required cache invalidation work completes.
 */
export async function runUpsertMutationCacheRefresh(
  options: RunUpsertMutationCacheRefreshOptions
): Promise<void> {
  const { definitionKey, queryClient } = options;

  await queryClient.invalidateQueries({ queryKey: queryKeys.assignmentDefinitionPartials() });
  await queryClient.invalidateQueries({
    queryKey: queryKeys.assignmentDefinitionByKey(definitionKey),
  });

  // Removed fetchQuery calls as per frontend-react-query-and-prefetch.md §7:
  // fetchQuery after invalidation is anti-pattern. Let React Query's background
  // refetch handle cache updates for active useQuery observers.
}
