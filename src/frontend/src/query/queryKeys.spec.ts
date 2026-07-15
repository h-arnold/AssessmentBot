import { describe, expect, it } from 'vitest';
import { queryKeys } from './queryKeys';

describe('queryKeys', () => {
  it('queryKeys.assignment returns the expected tuple shape', () => {
    expect(queryKeys.assignment('courseA', 'assign1')).toEqual([
      'assignment',
      'courseA',
      'assign1',
    ]);
  });
});
