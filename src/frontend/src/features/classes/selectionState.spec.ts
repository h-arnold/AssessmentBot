import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { pruneSelectedRowKeys, useSelectedRows } from './selectionState';

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
  it('returns selected rows in controlled-key order from visible rows', () => {
    const { result, rerender } = renderHook(
      ({ currentRows, selectedRowKeys }: { currentRows: typeof rows; selectedRowKeys: string[] }) =>
        useSelectedRows(currentRows, selectedRowKeys),
      {
        initialProps: {
          currentRows: rows,
          selectedRowKeys: ['active-1'],
        },
      },
    );

    expect(result.current.map((row) => row.classId)).toEqual(['active-1']);

    rerender({
      currentRows: rows,
      selectedRowKeys: ['inactive-1'],
    });

    expect(result.current.map((row) => row.classId)).toEqual(['inactive-1']);
  });

  it('returns an empty selection when no keys are selected', () => {
    const { result } = renderHook(() => useSelectedRows(rows, []));
    expect(result.current).toEqual([]);
  });

  it('prunes removed or invisible selected keys after row updates', () => {
    expect(pruneSelectedRowKeys(['active-1', 'inactive-1'], rows)).toEqual(['active-1', 'inactive-1']);
    expect(pruneSelectedRowKeys(['active-1', 'inactive-1'], [rows[0]])).toEqual(['active-1']);
    expect(pruneSelectedRowKeys(['missing'], rows)).toEqual([]);
  });
});
