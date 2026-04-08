import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGoogleScriptRunApiHandlerMock } from '../../test/googleScriptRunHarness';
import { getClassesTableColumns, UNAVAILABLE_VALUE } from './ClassesTableColumns';
import type { ClassesManagementRow } from './classesManagementViewModel';

const classesManagementStateMock = vi.fn();
const unavailableCellCount = 4;

vi.mock('./useClassesManagement', () => ({
  useClassesManagement: classesManagementStateMock,
}));

/**
 * Renders a component wrapped in a fresh QueryClientProvider for tests that
 * need access to the React Query context.
 *
 * @param {React.ReactElement} ui The component to render.
 * @returns {ReturnType<typeof render>} Testing Library render result.
 */
function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

/**
 * Installs a minimal google script run apiHandler harness for lazy reference-data consumers.
 */
function installGoogleScriptRunHarness() {
  (globalThis as { google?: unknown }).google = {
    script: {
      run: createGoogleScriptRunApiHandlerMock((request, callbacks) => {
        const method = (request as { method?: string }).method ?? 'unknown';

        callbacks.successHandler?.({
          ok: true,
          requestId: 'classes-table-columns-' + method,
          data: [],
        });
      }),
    },
  };
}

/**
 * Removes the temporary google script run apiHandler harness after each test.
 */
function clearGoogleScriptRunHarness() {
  delete (globalThis as { google?: unknown }).google;
}

beforeEach(() => {
  classesManagementStateMock.mockReset();
  installGoogleScriptRunHarness();
});

afterEach(() => {
  clearGoogleScriptRunHarness();
});

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

type FilterPredicate = (value: string | number | boolean, row: ClassesManagementRow) => boolean;

const [statusColumn, classNameColumn, cohortColumn, courseLengthColumn, yearGroupColumn, activeColumn] =
  getClassesTableColumns({
    filterOptions: {
      cohortLabel: [{ text: 'Cohort A', value: 'Cohort A' }],
      courseLength: [{ text: '2', value: '2' }],
      yearGroupLabel: [{ text: 'Year 10', value: 'Year 10' }],
      active: [{ text: 'Yes', value: 'true' }],
    },
  });

describe('ClassesTableColumns', () => {
  it('supports deterministic status and class-name sorting and filtering', () => {
    const statusOnFilter = statusColumn.onFilter as FilterPredicate;
    const statusSorter = statusColumn.sorter as (left: ClassesManagementRow, right: ClassesManagementRow) => number;
    const classNameSorter = classNameColumn.sorter as (left: ClassesManagementRow, right: ClassesManagementRow) => number;

    expect(statusOnFilter('active', activeRow)).toBe(true);
    expect(statusOnFilter('orphaned', activeRow)).toBe(false);
    expect(statusSorter(activeRow, inactiveRow)).toBeLessThan(0);
    expect(classNameSorter(activeRow, inactiveRow)).toBeLessThan(0);
  });

  it('supports cohort/course length/year group/active filter predicates for workstream 3 columns', () => {
    const cohortOnFilter = cohortColumn.onFilter as FilterPredicate;
    const courseLengthOnFilter = courseLengthColumn.onFilter as FilterPredicate;
    const yearGroupOnFilter = yearGroupColumn.onFilter as FilterPredicate;
    const activeOnFilter = activeColumn.onFilter as FilterPredicate;

    expect(cohortOnFilter('Cohort A', activeRow)).toBe(true);
    expect(cohortOnFilter('null', notCreatedRow)).toBe(true);
    expect(courseLengthOnFilter('2', activeRow)).toBe(true);
    expect(courseLengthOnFilter('null', notCreatedRow)).toBe(true);
    expect(yearGroupOnFilter('Year 10', activeRow)).toBe(true);
    expect(yearGroupOnFilter('null', notCreatedRow)).toBe(true);
    expect(activeOnFilter('true', activeRow)).toBe(true);
    expect(activeOnFilter('false', inactiveRow)).toBe(true);
    expect(activeOnFilter('null', notCreatedRow)).toBe(true);
    expect(activeOnFilter(true, activeRow)).toBe(true);
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

  it('exposes the default ordering contract from the canonical view-model module surface', async () => {
    const classesManagementViewModelModule = (await import('./classesManagementViewModel')) as Record<string, unknown>;
    const classesTableColumnsModule = (await import('./ClassesTableColumns')) as Record<string, unknown>;

    expect(classesManagementViewModelModule).toMatchObject({
      STATUS_ORDER: {
        active: 0,
        inactive: 1,
        notCreated: 2,
        orphaned: 3,
      },
    });
    expect(classesManagementViewModelModule).toHaveProperty('compareRowsByDefaultPriority');
    expect(classesTableColumnsModule).not.toHaveProperty('STATUS_ORDER');
    expect(classesTableColumnsModule).not.toHaveProperty('compareRowsByDefaultPriority');
  });

  it('applies status-priority then case-insensitive class-name tie-break ordering', async () => {
    const classesManagementViewModelModule = (await import('./classesManagementViewModel')) as Record<string, unknown>;
    const compareRowsByDefaultPriority = classesManagementViewModelModule.compareRowsByDefaultPriority as
      | ((left: ClassesManagementRow, right: ClassesManagementRow) => number)
      | undefined;
    const unsortedRows = [
      { ...activeRow, classId: 'beta-id', className: 'beta' },
      { ...activeRow, classId: 'alpha-id', className: 'Alpha' },
      { ...activeRow, classId: 'alpha-id-2', className: 'alpha' },
      { ...inactiveRow },
    ];

    expect(typeof compareRowsByDefaultPriority).toBe('function');
    expect(unsortedRows.toSorted(compareRowsByDefaultPriority!).map((row) => row.classId)).toEqual([
      'alpha-id',
      'alpha-id-2',
      'beta-id',
      'inactive-row',
    ]);
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

    renderWithQueryClient(<ClassesManagementPanel />);

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

    renderWithQueryClient(<ClassesManagementPanel />);

    const notCreatedTableRow = screen.getByRole('row', { name: /notcreated\s+zeta/i });
    expect(within(notCreatedTableRow).getByText('notCreated')).toBeInTheDocument();
    expect(within(notCreatedTableRow).getAllByText('—')).toHaveLength(unavailableCellCount);
  });
});
