import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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

describe('ClassesTableColumns', () => {
  it('renders deterministic user-facing column headers', async () => {
    classesManagementStateMock.mockReturnValue({
      blockingErrorMessage: null,
      classesManagementViewState: 'ready',
      classesCount: rowsForOrdering.length,
      errorMessage: null,
      hideRowsForRefreshRequired: false,
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
      hideRowsForRefreshRequired: false,
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
      hideRowsForRefreshRequired: false,
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
