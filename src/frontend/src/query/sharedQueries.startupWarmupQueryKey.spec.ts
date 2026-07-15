import { describe, expect, it } from 'vitest';
import {
  getStartupWarmupQueryKey,
  startupWarmupDatasetKeys,
  startupWarmupQueryKeys,
} from './sharedQueries';
import { queryKeys } from './queryKeys';

describe('getStartupWarmupQueryKey', () => {
  it('maps every startup warm-up dataset key to the matching shared query key', () => {
    expect(
      startupWarmupDatasetKeys.map((datasetKey) => [
        datasetKey,
        getStartupWarmupQueryKey(datasetKey),
      ])
    ).toEqual([
      ['classPartials', queryKeys.classPartials()],
      ['assignmentDefinitionPartials', queryKeys.assignmentDefinitionPartials()],
      ['assignmentTopics', queryKeys.assignmentTopics()],
      ['cohorts', queryKeys.cohorts()],
      ['yearGroups', queryKeys.yearGroups()],
    ]);
  });

  it('fails fast when the dataset key is not one of the shared warm-up keys', () => {
    expect(() => getStartupWarmupQueryKey('reports' as never)).toThrow(
      'Unknown startup warm-up dataset key: reports.'
    );
  });

  it('does not include any assignment-prefixed query key in startupWarmupQueryKeys', () => {
    const firstElements = startupWarmupQueryKeys.map((key) => key[0]);
    expect(firstElements).not.toContain('assignment');
  });
});
