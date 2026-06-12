import { describe, expect, it, vi } from 'vitest';
import { createAppQueryClient } from './queryClient';
import { createStartupWarmupSnapshotForStatus } from '../features/auth/startupWarmupState';

const { getAssignmentTopicsMock, getAssignmentDefinitionMock } = vi.hoisted(() => ({
  getAssignmentTopicsMock: vi.fn(),
  getAssignmentDefinitionMock: vi.fn(),
}));

vi.mock('../services/assignmentTopicsService', () => ({
  getAssignmentTopics: getAssignmentTopicsMock,
}));

vi.mock('../services/assignmentDefinitionService', () => ({
  getAssignmentDefinition: getAssignmentDefinitionMock,
}));

/**
 * Reads a query-key factory from the shared query-key exports.
 *
 * @param {string} factoryName Query-key factory property name.
 * @returns {(...arguments_: unknown[]) => readonly unknown[]} Query-key factory.
 */
async function loadQueryKeyFactory(factoryName: string) {
  const module = await import('./queryKeys');
  const queryKeys = module.queryKeys as Record<string, unknown>;
  const factory = queryKeys[factoryName];

  expect(factory).toBeTypeOf('function');

  return factory as (...arguments_: unknown[]) => readonly unknown[];
}

describe('assignment definition query wiring', () => {
  it('defines shared query keys for assignmentTopics and full definitions by key', async () => {
    const assignmentTopicsKeyFactory = await loadQueryKeyFactory('assignmentTopics');
    const assignmentDefinitionByKeyFactory = await loadQueryKeyFactory('assignmentDefinitionByKey');

    expect(assignmentTopicsKeyFactory()).toEqual(['assignmentTopics']);
    expect(assignmentDefinitionByKeyFactory('algebra-baseline')).toEqual([
      'assignmentDefinitionByKey',
      'algebra-baseline',
    ]);
  });

  it('defines shared query options for assignmentTopics and full-definition reads', async () => {
    getAssignmentTopicsMock.mockResolvedValueOnce([{ key: 'topic-algebra', name: 'Algebra' }]);
    getAssignmentDefinitionMock.mockResolvedValueOnce({
      definitionKey: 'algebra-baseline',
      primaryTitle: 'Algebra Baseline',
    });

    const assignmentTopicsKeyFactory = await loadQueryKeyFactory('assignmentTopics');
    const assignmentDefinitionByKeyFactory = await loadQueryKeyFactory('assignmentDefinitionByKey');

    const sharedQueriesModule = await import('./sharedQueries');
    const sharedQueriesRecord = sharedQueriesModule as Record<string, unknown>;
    const getAssignmentTopicsQueryOptions = sharedQueriesRecord.getAssignmentTopicsQueryOptions as
      | (() => Parameters<ReturnType<typeof createAppQueryClient>['fetchQuery']>[0])
      | undefined;
    const getAssignmentDefinitionQueryOptions =
      sharedQueriesRecord.getAssignmentDefinitionQueryOptions as
        | ((definitionKey: string) => Parameters<ReturnType<typeof createAppQueryClient>['fetchQuery']>[0])
        | undefined;

    expect(getAssignmentTopicsQueryOptions).toBeTypeOf('function');
    expect(getAssignmentDefinitionQueryOptions).toBeTypeOf('function');

    const assignmentTopicsQueryOptions = getAssignmentTopicsQueryOptions!();
    const assignmentDefinitionQueryOptions = getAssignmentDefinitionQueryOptions!('algebra-baseline');

    expect(assignmentTopicsQueryOptions.queryKey).toEqual(assignmentTopicsKeyFactory());
    expect(assignmentDefinitionQueryOptions.queryKey).toEqual(
      assignmentDefinitionByKeyFactory('algebra-baseline')
    );

    const queryClient = createAppQueryClient();

    await expect(queryClient.fetchQuery(assignmentTopicsQueryOptions)).resolves.toEqual([
      { key: 'topic-algebra', name: 'Algebra' },
    ]);
    await expect(
      queryClient.fetchQuery(assignmentDefinitionQueryOptions)
    ).resolves.toEqual({
      definitionKey: 'algebra-baseline',
      primaryTitle: 'Algebra Baseline',
    });
  });

  it('registers assignmentTopics in startup warm-up query-key mapping', async () => {
    const sharedQueriesModule = await import('./sharedQueries');
    const sharedQueriesRecord = sharedQueriesModule as Record<string, unknown>;
    const startupWarmupDatasetKeys = sharedQueriesRecord.startupWarmupDatasetKeys as
      | readonly string[]
      | undefined;
    const getStartupWarmupQueryKey = sharedQueriesRecord.getStartupWarmupQueryKey as
      | ((datasetKey: string) => readonly unknown[])
      | undefined;

    expect(startupWarmupDatasetKeys).toContain('assignmentTopics');
    expect(getStartupWarmupQueryKey).toBeTypeOf('function');
    expect(getStartupWarmupQueryKey!('assignmentTopics')).toEqual(['assignmentTopics']);
  });

  it('includes assignmentTopics in startup warm-up trust snapshots', async () => {
    const readySnapshot = createStartupWarmupSnapshotForStatus('ready');
    const failedSnapshot = createStartupWarmupSnapshotForStatus('failed');

    expect(readySnapshot.datasets.assignmentTopics).toEqual({
      status: 'ready',
      isTrustworthy: true,
    });
    expect(failedSnapshot.datasets.assignmentTopics).toEqual({
      status: 'failed',
      isTrustworthy: false,
    });
  });
});
