import { describe, expect, it } from 'vitest';
import { getClassesTableColumns } from './ClassesTableColumns';
import * as classesTableHelpers from './ClassesTable.helpers';
import type { ClassesManagementRow } from './classesManagementViewModel';

const rows: ClassesManagementRow[] = [
  {
    classId: 'active-a',
    className: 'Alpha',
    status: 'active',
    cohortLabel: 'Cohort A',
    courseLength: 2,
    yearGroupLabel: 'Year 10',
    active: true,
  },
  {
    classId: 'active-b',
    className: 'alpha',
    status: 'active',
    cohortLabel: 'Cohort B',
    courseLength: 1,
    yearGroupLabel: 'Year 11',
    active: false,
  },
  {
    classId: 'inactive-c',
    className: 'Charlie',
    status: 'inactive',
    cohortLabel: 'Cohort C',
    courseLength: 3,
    yearGroupLabel: 'Year 12',
    active: false,
  },
  {
    classId: 'not-created',
    className: 'Delta',
    status: 'notCreated',
    cohortLabel: null,
    courseLength: null,
    yearGroupLabel: null,
    active: null,
  },
];

describe('ClassesTable helper coverage', () => {
  it('normalises sorter/filter state and recognises filter keys', () => {
    expect(classesTableHelpers.getPrimarySorter({ columnKey: 'className', order: 'ascend' })).toEqual({
      columnKey: 'className',
      order: 'ascend',
    });
    expect(classesTableHelpers.getPrimarySorter([])).toBeNull();

    expect(classesTableHelpers.normaliseFilters()).toEqual({
      status: null,
      cohortLabel: null,
      courseLength: null,
      yearGroupLabel: null,
      active: null,
    });

    expect(
      classesTableHelpers.normaliseFilters({
        status: ['active'],
        cohortLabel: ['Cohort A'],
        courseLength: ['2'],
        yearGroupLabel: ['Year 10'],
        active: ['true'],
      }),
    ).toEqual({
      status: ['active'],
      cohortLabel: ['Cohort A'],
      courseLength: ['2'],
      yearGroupLabel: ['Year 10'],
      active: ['true'],
    });

    expect(classesTableHelpers.isFilterColumnKey('status')).toBe(true);
    expect(classesTableHelpers.isFilterColumnKey('className')).toBe(false);
  });

  it('applies controlled columns and deterministic filtering/sorting branches', () => {
    const baseColumns = getClassesTableColumns({
      filterOptions: {
        cohortLabel: [{ text: 'Cohort A', value: 'Cohort A' }],
        courseLength: [{ text: '2', value: '2' }],
        yearGroupLabel: [{ text: 'Year 10', value: 'Year 10' }],
        active: [{ text: 'Yes', value: 'true' }],
      },
    });

    const controlledColumns = classesTableHelpers.getControlledColumns(
      baseColumns,
      {
        status: ['active'],
        cohortLabel: null,
        courseLength: null,
        yearGroupLabel: null,
        active: null,
      },
      {
        columnKey: 'className',
        order: 'descend',
      },
    );

    const statusColumn = controlledColumns.find((column) => column.key === 'status');
    const classNameColumn = controlledColumns.find((column) => column.key === 'className');

    expect(statusColumn?.filteredValue).toEqual(['active']);
    expect(classNameColumn?.sortOrder).toBe('descend');

    const filteredRows = classesTableHelpers.applyColumnFilters(
      rows,
      baseColumns,
      {
        status: ['active'],
        cohortLabel: null,
        courseLength: null,
        yearGroupLabel: null,
        active: null,
      },
    );
    expect(filteredRows.map((row) => row.classId)).toEqual(['active-a', 'active-b']);

    const unknownColumns = [{ title: 'Unknown', key: 'unknown' }];
    expect(
      classesTableHelpers.getSortedRows(rows, unknownColumns, {
        columnKey: 'className',
        order: 'ascend',
      }).map((row) => row.classId),
    ).toEqual(classesTableHelpers.getDefaultSortedRows(rows).map((row) => row.classId));
  });

  it('sorts via every comparator branch and deterministic tie-break', () => {
    expect(classesTableHelpers.getSortComparator('status')(rows[0], rows[2])).toBeLessThan(0);
    expect(classesTableHelpers.getSortComparator('className')(rows[0], rows[1])).toBe(0);
    expect(classesTableHelpers.getSortComparator('cohortLabel')(rows[0], rows[3])).toBeGreaterThan(0);
    expect(classesTableHelpers.getSortComparator('courseLength')(rows[3], rows[0])).toBeLessThan(0);
    expect(classesTableHelpers.getSortComparator('yearGroupLabel')(rows[0], rows[3])).toBeGreaterThan(0);
    expect(classesTableHelpers.getSortComparator('active')(rows[0], rows[3])).toBeGreaterThan(0);

    const classNameSortedRows = classesTableHelpers.getSortedRows(
      rows,
      getClassesTableColumns(),
      {
        columnKey: 'className',
        order: 'ascend',
      },
    );

    expect(classNameSortedRows.map((row) => row.classId)).toEqual([
      'active-a',
      'active-b',
      'inactive-c',
      'not-created',
    ]);
  });

  it('builds filter option values deterministically', () => {
    expect(classesTableHelpers.getUniqueSortedFilterOptions(['10', null, '2']).map((option) => option.value)).toEqual([
      '2',
      '10',
      'null',
    ]);

    expect(classesTableHelpers.getFilterOptions(rows)).toEqual({
      cohortLabel: [
        { text: 'Cohort A', value: 'Cohort A' },
        { text: 'Cohort B', value: 'Cohort B' },
        { text: 'Cohort C', value: 'Cohort C' },
        { text: '—', value: 'null' },
      ],
      courseLength: [
        { text: '1', value: '1' },
        { text: '2', value: '2' },
        { text: '3', value: '3' },
        { text: '—', value: 'null' },
      ],
      yearGroupLabel: [
        { text: '—', value: 'null' },
        { text: 'Year 10', value: 'Year 10' },
        { text: 'Year 11', value: 'Year 11' },
        { text: 'Year 12', value: 'Year 12' },
      ],
      active: [
        { text: 'Yes', value: 'true' },
        { text: 'No', value: 'false' },
        { text: '—', value: 'null' },
      ],
    });
  });
});
