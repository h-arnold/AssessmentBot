import type { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

const invalidateQueriesMock = vi.fn(async () => {});
const fetchQueryMock = vi.fn(async () => ({ definitionKey: 'algebra-baseline' }));

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

  const fetchCallCount = 2;
  const invalidateCallCount = 2;
  const assignmentDefinitionPartialsInvalidateCallIndex = 1;
  const selectedDefinitionInvalidateCallIndex = 2;
  const assignmentDefinitionPartialsFetchCallIndex = 1;
  const selectedDefinitionFetchCallIndex = 2;

  const upsertMutationFlows = [
    { flow: 'stage-one-create' },
    { flow: 'final-save' },
    { flow: 'document-reparse' },
  ] as const satisfies ReadonlyArray<{ flow: UpsertMutationFlow }>;

  afterEach(() => {
    invalidateQueriesMock.mockClear();
    fetchQueryMock.mockClear();
    vi.resetModules();
  });

  it.each(upsertMutationFlows)(
    'invalidates then refreshes assignmentDefinitionPartials and the selected full-definition query after %s',
    async ({ flow }) => {
      const module = await loadUpsertMutationCacheModule();
      const runUpsertMutationCacheRefresh = module.runUpsertMutationCacheRefresh as
        | ((options: {
            flow: UpsertMutationFlow;
            definitionKey: string;
            queryClient: Pick<QueryClient, 'invalidateQueries' | 'fetchQuery'>;
          }) => Promise<void>)
        | undefined;

      expect(runUpsertMutationCacheRefresh).toBeTypeOf('function');

      await runUpsertMutationCacheRefresh!({
        flow,
        definitionKey: 'algebra-baseline',
        queryClient: {
          invalidateQueries: invalidateQueriesMock,
          fetchQuery: fetchQueryMock,
        } as Pick<QueryClient, 'invalidateQueries' | 'fetchQuery'>,
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

      expect(fetchQueryMock).toHaveBeenCalledTimes(fetchCallCount);
      expect(fetchQueryMock).toHaveBeenNthCalledWith(
        assignmentDefinitionPartialsFetchCallIndex,
        expect.objectContaining({
          queryKey: ['assignmentDefinitionPartials'],
        })
      );
      expect(fetchQueryMock).toHaveBeenNthCalledWith(
        selectedDefinitionFetchCallIndex,
        expect.objectContaining({
          queryKey: ['assignmentDefinitionByKey', 'algebra-baseline'],
        })
      );

      expect(
        Math.max(...invalidateQueriesMock.mock.invocationCallOrder)
      ).toBeLessThan(Math.min(...fetchQueryMock.mock.invocationCallOrder));
    }
  );
});
