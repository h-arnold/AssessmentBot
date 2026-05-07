import type { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

const invalidateQueriesMock = vi.fn(async () => {});
// Removed fetchQueryMock as per frontend-react-query-and-prefetch.md §7:
// fetchQuery after invalidation is anti-pattern. invalidateQueries triggers background
// refetch for active useQuery observers, which properly propagates errors to isError state.

/**
 * Loads the upsert-assignment-definition mutation cache helper module under test.
 *
 * @returns {Promise<Record<string, unknown>>} Imported helper module.
 */
async function loadUpsertMutationCacheModule(): Promise<Record<string, unknown>> {
  return import('./upsertAssignmentDefinitionMutation');
}

describe('upsertAssignmentDefinition mutation cache orchestration', () => {
  type UpsertMutationFlow = 'stage-one-create' | 'final-save' | 'document-reparse';

  const invalidateCallCount = 2;
  const assignmentDefinitionPartialsInvalidateCallIndex = 1;
  const selectedDefinitionInvalidateCallIndex = 2;

  const upsertMutationFlows = [
    { flow: 'stage-one-create' },
    { flow: 'final-save' },
    { flow: 'document-reparse' },
  ] as const satisfies ReadonlyArray<{ flow: UpsertMutationFlow }>;

  afterEach(() => {
    invalidateQueriesMock.mockClear();
    vi.resetModules();
  });

  it.each(upsertMutationFlows)(
    'invalidates assignmentDefinitionPartials and the selected full-definition query after %s',
    async ({ flow }) => {
      const module = await loadUpsertMutationCacheModule();
      const runUpsertMutationCacheRefresh = module.runUpsertMutationCacheRefresh as
        | ((options: {
            flow: UpsertMutationFlow;
            definitionKey: string;
            queryClient: Pick<QueryClient, 'invalidateQueries'>;
          }) => Promise<void>)
        | undefined;

      expect(runUpsertMutationCacheRefresh).toBeTypeOf('function');

      await runUpsertMutationCacheRefresh!({
        flow,
        definitionKey: 'algebra-baseline',
        queryClient: {
          invalidateQueries: invalidateQueriesMock,
        } as Pick<QueryClient, 'invalidateQueries'>,
      });

      expect(invalidateQueriesMock).toHaveBeenCalledTimes(invalidateCallCount);
      expect(invalidateQueriesMock).toHaveBeenNthCalledWith(
        assignmentDefinitionPartialsInvalidateCallIndex,
        expect.objectContaining({
          queryKey: ['assignmentDefinitionPartials'],
        })
      );
      expect(invalidateQueriesMock).toHaveBeenNthCalledWith(
        selectedDefinitionInvalidateCallIndex,
        expect.objectContaining({
          queryKey: ['assignmentDefinitionByKey', 'algebra-baseline'],
        })
      );
      expect(invalidateQueriesMock).not.toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ['assignmentDefinitionPartials'],
          refetchType: 'none',
        })
      );

      // Removed fetchQuery assertions as per frontend-react-query-and-prefetch.md §7:
      // invalidateQueries alone triggers background refetch for active useQuery observers.
      // No explicit fetchQuery needed - React Query handles it automatically.
    }
  );
});
