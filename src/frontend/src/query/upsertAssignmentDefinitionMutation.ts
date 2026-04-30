import type { QueryClient } from '@tanstack/react-query';
import {
  getAssignmentDefinitionPartialsQueryOptions,
  getAssignmentDefinitionQueryOptions,
} from './sharedQueries';
import { queryKeys } from './queryKeys';

export type UpsertAssignmentDefinitionMutationFlow =
  | 'stage-one-create'
  | 'final-save'
  | 'document-reparse';

export type RunUpsertMutationCacheRefreshOptions = Readonly<{
  flow: UpsertAssignmentDefinitionMutationFlow;
  definitionKey: string;
  queryClient: Pick<QueryClient, 'fetchQuery' | 'invalidateQueries'>;
}>;

/**
 * Refreshes assignment-definition cache entries after a successful upsert.
 *
 * @param {RunUpsertMutationCacheRefreshOptions} options Mutation refresh options.
 * @returns {Promise<void>} Resolves when required cache refresh work completes.
 */
export async function runUpsertMutationCacheRefresh(
  options: RunUpsertMutationCacheRefreshOptions
): Promise<void> {
  const { definitionKey, queryClient } = options;

  await queryClient.invalidateQueries({ queryKey: queryKeys.assignmentDefinitionPartials() });
  await queryClient.invalidateQueries({
    queryKey: queryKeys.assignmentDefinitionByKey(definitionKey),
  });

  await queryClient.fetchQuery(getAssignmentDefinitionPartialsQueryOptions());
  await queryClient.fetchQuery(getAssignmentDefinitionQueryOptions(definitionKey));
}
