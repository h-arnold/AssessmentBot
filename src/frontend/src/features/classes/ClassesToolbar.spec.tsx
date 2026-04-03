import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const classesManagementStateMock = vi.fn();

vi.mock('./useClassesManagement', () => ({
  useClassesManagement: classesManagementStateMock,
}));

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
    classId: 'orphaned-1',
    className: 'Legacy',
    status: 'orphaned',
    cohortLabel: 'Legacy Cohort',
    courseLength: 3,
    yearGroupLabel: 'Year 12',
    active: false,
  },
] as const;

describe('ClassesToolbar', () => {
  it('enables Delete but disables non-delete actions for orphaned-only selection', async () => {
    classesManagementStateMock.mockReturnValue({
      classesManagementViewState: 'ready',
      classesCount: rows.length,
      errorMessage: null,
      rows,
      selectedRowKeys: ['orphaned-1'],
    });

    const { ClassesManagementPanel } = await import('./ClassesManagementPanel');

    render(<ClassesManagementPanel />);

    expect(screen.getByText('Orphaned rows are deletion-only.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete ABClass' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Create ABClass' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Set active' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Set inactive' })).toBeDisabled();
  });

  it('keeps mixed orphaned/non-orphaned selection behaviour explicit and deterministic', async () => {
    classesManagementStateMock.mockReturnValue({
      classesManagementViewState: 'ready',
      classesCount: rows.length,
      errorMessage: null,
      rows,
      selectedRowKeys: ['active-1', 'orphaned-1'],
    });

    const { ClassesManagementPanel } = await import('./ClassesManagementPanel');

    render(<ClassesManagementPanel />);

    expect(screen.getByRole('button', { name: 'Delete ABClass' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Create ABClass' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Set active' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Set inactive' })).toBeDisabled();
    expect(screen.getByText('Mixed selection includes orphaned rows. Delete is the only allowed bulk action.')).toBeInTheDocument();
  });
});
