import { describe, expect, it } from 'vitest';
import { getStartupWarmupQueryOptions } from './sharedQueries';
import { queryKeys } from './queryKeys';

describe('getStartupWarmupQueryOptions', () => {
  it('resolves the classPartials dataset key to a query-options object with the expected queryKey', () => {
    const result = getStartupWarmupQueryOptions('classPartials');

    expect(result).not.toBeNull();
    expect(result.queryKey).toEqual(queryKeys.classPartials());
  });

  it('resolves the assignmentDefinitionPartials dataset key to a query-options object with the expected queryKey', () => {
    const result = getStartupWarmupQueryOptions('assignmentDefinitionPartials');

    expect(result).not.toBeNull();
    expect(result.queryKey).toEqual(queryKeys.assignmentDefinitionPartials());
  });

  it('resolves the assignmentTopics dataset key to a query-options object with the expected queryKey', () => {
    const result = getStartupWarmupQueryOptions('assignmentTopics');

    expect(result).not.toBeNull();
    expect(result.queryKey).toEqual(queryKeys.assignmentTopics());
  });

  it('resolves the cohorts dataset key to a query-options object with the expected queryKey', () => {
    const result = getStartupWarmupQueryOptions('cohorts');

    expect(result).not.toBeNull();
    expect(result.queryKey).toEqual(queryKeys.cohorts());
  });

  it('resolves the yearGroups dataset key to a query-options object with the expected queryKey', () => {
    const result = getStartupWarmupQueryOptions('yearGroups');

    expect(result).not.toBeNull();
    expect(result.queryKey).toEqual(queryKeys.yearGroups());
  });

  it('throws for an unknown dataset key', () => {
    expect(() => getStartupWarmupQueryOptions('reports' as never)).toThrow(
      'Unknown startup warm-up dataset key: reports.'
    );
  });

  it('returns a query-options object with both queryKey and queryFn defined', () => {
    const result = getStartupWarmupQueryOptions('classPartials');

    expect(result.queryKey).toBeDefined();
    expect(result.queryFn).toBeDefined();
    expect(typeof result.queryFn).toBe('function');
  });
});
