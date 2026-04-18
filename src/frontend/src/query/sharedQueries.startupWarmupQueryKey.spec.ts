import { describe, expect, it } from 'vitest';
import {
  getStartupWarmupQueryKey,
  startupWarmupDatasetKeys,
} from './sharedQueries';
import { queryKeys } from './queryKeys';

describe('getStartupWarmupQueryKey', () => {
  it('maps every startup warm-up dataset key to the matching shared query key', () => {
    expect(
      startupWarmupDatasetKeys.map((datasetKey) => [datasetKey, getStartupWarmupQueryKey(datasetKey)])
    ).toEqual([
      ['classPartials', queryKeys.classPartials()],
      ['assignmentDefinitionPartials', queryKeys.assignmentDefinitionPartials()],
      ['cohorts', queryKeys.cohorts()],
      ['yearGroups', queryKeys.yearGroups()],
    ]);
  });
});
