import { describe, expect, it } from 'vitest';
import { pruneSelectedRowKeys } from './selectionState';

const rows = [
  {
    classId: 'active-1',
    className: 'Alpha',
    status: 'active',
    cohortLabel: 'Cohort A',
    courseLength: 2,
    yearGroupLabel: 'Year 10',
    active: true,
  },
  {
    classId: 'inactive-1',
    className: 'Bravo',
    status: 'inactive',
    cohortLabel: 'Cohort B',
    courseLength: 1,
    yearGroupLabel: 'Year 11',
    active: false,
  },
] as const;

describe('selectionState', () => {
  it('prunes removed or invisible selected keys after row updates', () => {
    expect(pruneSelectedRowKeys(['active-1', 'inactive-1'], rows)).toEqual(['active-1', 'inactive-1']);
    expect(pruneSelectedRowKeys(['active-1', 'inactive-1'], [rows[0]])).toEqual(['active-1']);
    expect(pruneSelectedRowKeys(['missing'], rows)).toEqual([]);
  });
});
