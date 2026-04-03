import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const classesManagementStateMock = vi.fn();

vi.mock('./useClassesManagement', () => ({
  useClassesManagement: classesManagementStateMock,
}));

const representativeRows = [
  {
    classId: 'class-001',
    className: 'Alpha',
    status: 'active',
    cohortLabel: 'Cohort A',
    courseLength: 2,
    yearGroupLabel: 'Year 10',
    active: true,
  },
  {
    classId: 'class-001-suffix',
    className: 'Bravo',
    status: 'inactive',
    cohortLabel: 'Cohort B',
    courseLength: 1,
    yearGroupLabel: 'Year 11',
    active: false,
  },
  {
    classId: 'gc/not-created:2024',
    className: 'Charlie',
    status: 'notCreated',
    cohortLabel: null,
    courseLength: null,
    yearGroupLabel: null,
    active: null,
  },
  {
    classId: 'orphaned::legacy',
    className: 'Delta',
    status: 'orphaned',
    cohortLabel: 'Legacy Cohort',
    courseLength: 3,
    yearGroupLabel: 'Year 12',
    active: false,
  },
] as const;

describe('ClassesTable', () => {
  it('renders representative active/inactive/notCreated/orphaned rows as explicit contracts', async () => {
    classesManagementStateMock.mockReturnValue({
      classesManagementViewState: 'ready',
      classesCount: representativeRows.length,
      errorMessage: null,
      rows: representativeRows,
      selectedRowKeys: [],
    });

    const { ClassesManagementPanel } = await import('./ClassesManagementPanel');

    render(<ClassesManagementPanel />);

    expect(screen.getByRole('table', { name: 'Classes table' })).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('inactive')).toBeInTheDocument();
    expect(screen.getByText('notCreated')).toBeInTheDocument();
    expect(screen.getByText('orphaned')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Delta')).toBeInTheDocument();
  });

  it('uses each row classId as the exact rowKey value (not a prefix heuristic)', async () => {
    classesManagementStateMock.mockReturnValue({
      classesManagementViewState: 'ready',
      classesCount: representativeRows.length,
      errorMessage: null,
      rows: representativeRows,
      selectedRowKeys: [],
    });

    const { ClassesManagementPanel } = await import('./ClassesManagementPanel');

    const { container } = render(<ClassesManagementPanel />);

    const renderedKeys = [...container.querySelectorAll('tbody tr[data-row-key]')].map(
      (row) => (row as HTMLElement).dataset.rowKey ?? '',
    );

    expect(renderedKeys).toEqual(representativeRows.map((row) => row.classId));
    expect(renderedKeys).toContain('class-001-suffix');
  });
});
