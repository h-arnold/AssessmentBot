import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getClassesTableColumns, UNAVAILABLE_VALUE } from './ClassesTableColumns';
import type { ClassesManagementRow } from './classesManagementViewModel';

const classesManagementStateMock = vi.fn();
const unavailableCellCount = 4;

vi.mock('./useClassesManagement', () => ({
  useClassesManagement: classesManagementStateMock,
}));

const rowsForOrdering = [
  {
    classId: 'active-alpha',
    className: 'Alpha',
    status: 'active',
    cohortLabel: 'Cohort A',
    courseLength: 2,
    yearGroupLabel: 'Year 10',
    active: true,
  },
  {
    classId: 'active-beta',
    className: 'beta',
    status: 'active',
    cohortLabel: 'Cohort B',
    courseLength: 2,
    yearGroupLabel: 'Year 10',
    active: true,
  },
  {
    classId: 'inactive-gamma',
    className: 'Gamma',
    status: 'inactive',
    cohortLabel: 'Cohort C',
    courseLength: 1,
    yearGroupLabel: 'Year 11',
    active: false,
  },
  {
    classId: 'not-created-zeta',
    className: 'Zeta',
    status: 'notCreated',
    cohortLabel: null,
    courseLength: null,
    yearGroupLabel: null,
    active: null,
  },
  {
    classId: 'orphaned-omega',
    className: 'Omega',
    status: 'orphaned',
    cohortLabel: 'Legacy',
    courseLength: 3,
    yearGroupLabel: 'Year 12',
    active: false,
  },
] as const;

const notCreatedRow: ClassesManagementRow = {
  classId: 'not-created-row',
  className: 'Zeta',
  status: 'notCreated',
  cohortLabel: null,
  courseLength: null,
  yearGroupLabel: null,
  active: null,
};

const activeRow: ClassesManagementRow = {
  classId: 'active-row',
  className: 'Alpha',
  status: 'active',
  cohortLabel: 'Cohort A',
  courseLength: 2,
  yearGroupLabel: 'Year 10',
  active: true,
};

const inactiveRow: ClassesManagementRow = {
  classId: 'inactive-row',
  className: 'beta',
  status: 'inactive',
  cohortLabel: 'Cohort B',
  courseLength: 1,
  yearGroupLabel: 'Year 11',
  active: false,
};

const [statusColumn, classNameColumn, cohortColumn, courseLengthColumn, yearGroupColumn, activeColumn] =
  getClassesTableColumns();

describe('ClassesTableColumns', () => {
  it('supports deterministic status and class-name sorting and filtering', () => {
    const statusOnFilter = statusColumn.onFilter as (value: string | number | boolean, row: ClassesManagementRow) => boolean;
    const statusSorter = statusColumn.sorter as (left: ClassesManagementRow, right: ClassesManagementRow) => number;
    const classNameSorter = classNameColumn.sorter as (left: ClassesManagementRow, right: ClassesManagementRow) => number;

    expect(statusOnFilter('active', activeRow)).toBe(true);
    expect(statusOnFilter('orphaned', activeRow)).toBe(false);
    expect(statusSorter(activeRow, inactiveRow)).toBeLessThan(0);
    expect(classNameSorter(activeRow, inactiveRow)).toBeLessThan(0);
  });

  it('supports deterministic nullable text and number sorting for not-created rows', () => {
    const cohortSorter = cohortColumn.sorter as (left: ClassesManagementRow, right: ClassesManagementRow) => number;
    const cohortRender = cohortColumn.render as (value: unknown, row: ClassesManagementRow, index: number) => unknown;
    const courseLengthSorter = courseLengthColumn.sorter as (left: ClassesManagementRow, right: ClassesManagementRow) => number;
    const courseLengthRender = courseLengthColumn.render as (value: unknown, row: ClassesManagementRow, index: number) => unknown;
    const yearGroupSorter = yearGroupColumn.sorter as (left: ClassesManagementRow, right: ClassesManagementRow) => number;
    const yearGroupRender = yearGroupColumn.render as (value: unknown, row: ClassesManagementRow, index: number) => unknown;

    expect(cohortSorter(notCreatedRow, activeRow)).toBeLessThan(0);
    expect(cohortSorter(activeRow, notCreatedRow)).toBeGreaterThan(0);
    expect(cohortSorter(notCreatedRow, { ...notCreatedRow, classId: 'not-created-row-2' })).toBe(0);
    expect(cohortRender(null, notCreatedRow, 0)).toBe(UNAVAILABLE_VALUE);
    expect(cohortRender(null, activeRow, 0)).toBe('Cohort A');

    expect(courseLengthSorter(notCreatedRow, activeRow)).toBeLessThan(0);
    expect(courseLengthSorter(activeRow, notCreatedRow)).toBeGreaterThan(0);
    expect(courseLengthSorter(notCreatedRow, { ...notCreatedRow, classId: 'not-created-row-2' })).toBe(0);
    expect(courseLengthRender(null, notCreatedRow, 0)).toBe(UNAVAILABLE_VALUE);
    expect(courseLengthRender(null, activeRow, 0)).toBe(activeRow.courseLength);

    expect(yearGroupSorter(notCreatedRow, activeRow)).toBeLessThan(0);
    expect(yearGroupSorter(activeRow, notCreatedRow)).toBeGreaterThan(0);
    expect(yearGroupSorter(notCreatedRow, { ...notCreatedRow, classId: 'not-created-row-2' })).toBe(0);
    expect(yearGroupRender(null, notCreatedRow, 0)).toBe(UNAVAILABLE_VALUE);
    expect(yearGroupRender(null, activeRow, 0)).toBe('Year 10');
  });

  it('renders active values and orders active booleans deterministically', () => {
    const activeSorter = activeColumn.sorter as (left: ClassesManagementRow, right: ClassesManagementRow) => number;
    const activeRender = activeColumn.render as (value: unknown, row: ClassesManagementRow, index: number) => unknown;

    expect(activeSorter(notCreatedRow, activeRow)).toBeLessThan(0);
    expect(activeSorter(activeRow, notCreatedRow)).toBeGreaterThan(0);
    expect(activeSorter(activeRow, inactiveRow)).toBeGreaterThan(0);
    expect(activeRender(null, notCreatedRow, 0)).toBe(UNAVAILABLE_VALUE);
    expect(activeRender(null, activeRow, 0)).toBe('Yes');
    expect(activeRender(null, inactiveRow, 0)).toBe('No');
  });

  it('renders deterministic user-facing column headers', async () => {
    classesManagementStateMock.mockReturnValue({
      blockingErrorMessage: null,
      classesManagementViewState: 'ready',
      classesCount: rowsForOrdering.length,
      errorMessage: null,
      nonBlockingWarningMessage: null,
      refreshRequiredMessage: null,
      rows: rowsForOrdering,
      selectedRowKeys: [],
      onSelectedRowKeysChange: vi.fn(),
    });

    const { ClassesManagementPanel } = await import('./ClassesManagementPanel');

    render(<ClassesManagementPanel />);

    const table = screen.getByRole('table', { name: 'Classes table' });
    const tableQueries = within(table);

    expect(tableQueries.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument();
    expect(tableQueries.getByRole('columnheader', { name: 'Class name' })).toBeInTheDocument();
    expect(tableQueries.getByRole('columnheader', { name: 'Cohort' })).toBeInTheDocument();
    expect(tableQueries.getByRole('columnheader', { name: 'Course length' })).toBeInTheDocument();
    expect(tableQueries.getByRole('columnheader', { name: 'Year group' })).toBeInTheDocument();
    expect(tableQueries.getByRole('columnheader', { name: 'Active' })).toBeInTheDocument();
  });

  it('renders notCreated unavailable cohort/courseLength/yearGroup/active cells as em dash', async () => {
    classesManagementStateMock.mockReturnValue({
      blockingErrorMessage: null,
      classesManagementViewState: 'ready',
      classesCount: rowsForOrdering.length,
      errorMessage: null,
      nonBlockingWarningMessage: null,
      refreshRequiredMessage: null,
      rows: rowsForOrdering,
      selectedRowKeys: [],
      onSelectedRowKeysChange: vi.fn(),
    });

    const { ClassesManagementPanel } = await import('./ClassesManagementPanel');

    render(<ClassesManagementPanel />);

    const notCreatedRow = screen.getByRole('row', { name: /notcreated\s+zeta/i });
    expect(within(notCreatedRow).getByText('notCreated')).toBeInTheDocument();
    expect(within(notCreatedRow).getAllByText('—')).toHaveLength(unavailableCellCount);
  });

  it('uses deterministic status+className default ordering and reset restores it after filters/sorts', async () => {
    classesManagementStateMock.mockReturnValue({
      blockingErrorMessage: null,
      classesManagementViewState: 'ready',
      classesCount: rowsForOrdering.length,
      errorMessage: null,
      nonBlockingWarningMessage: null,
      refreshRequiredMessage: null,
      rows: rowsForOrdering,
      selectedRowKeys: [],
      onSelectedRowKeysChange: vi.fn(),
    });

    const { ClassesManagementPanel } = await import('./ClassesManagementPanel');

    const { container } = render(<ClassesManagementPanel />);

    expect(
      [...container.querySelectorAll('tbody tr[data-row-key]')].map(
        (row) => (row as HTMLElement).dataset.rowKey
      )
    ).toEqual([
      'active-alpha',
      'active-beta',
      'inactive-gamma',
      'not-created-zeta',
      'orphaned-omega',
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Class name' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset sort and filters' }));

    expect(
      [...container.querySelectorAll('tbody tr[data-row-key]')].map(
        (row) => (row as HTMLElement).dataset.rowKey
      )
    ).toEqual([
      'active-alpha',
      'active-beta',
      'inactive-gamma',
      'not-created-zeta',
      'orphaned-omega',
    ]);
  });
});
