import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ClassesToolbar } from './ClassesToolbar';
import type { ClassesManagementRow } from './classesManagementViewModel';

const rows: ClassesManagementRow[] = [
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
    yearGroupLabel: 'Year 9',
    active: false,
  },
  {
    classId: 'not-created-1',
    className: 'Charlie',
    status: 'notCreated',
    cohortLabel: null,
    courseLength: null,
    yearGroupLabel: null,
    active: null,
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
];

/**
 * Renders the toolbar for one row-selection scenario.
 *
 * @param {string[]} selectedRowKeys Selected row identifiers.
 * @returns {ReturnType<typeof render>} Testing Library render result.
 */
function renderToolbar(selectedRowKeys: string[]) {
  return render(<ClassesToolbar rows={rows} selectedRowKeys={selectedRowKeys} />);
}

describe('ClassesToolbar', () => {
  it('enables Delete but disables non-delete actions for orphaned-only selection', () => {
    renderToolbar(['orphaned-1']);

    expect(screen.getByText('Orphaned rows are deletion-only.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete ABClass' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Create ABClass' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Set active' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Set inactive' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Set cohort' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Set year group' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Set course length' })).toBeDisabled();
  });

  it('keeps mixed orphaned and non-orphaned selection behaviour explicit and deterministic', () => {
    renderToolbar(['active-1', 'orphaned-1']);

    expect(screen.getByRole('button', { name: 'Delete ABClass' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Create ABClass' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Set active' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Set inactive' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Set cohort' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Set year group' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Set course length' })).toBeDisabled();
    expect(
      screen.getByText('Mixed selection includes orphaned rows. Delete is the only allowed bulk action.')
    ).toBeInTheDocument();
  });

  it('enables cohort, year-group, and course-length edits for a single eligible existing row', () => {
    renderToolbar(['active-1']);

    expect(screen.getByRole('button', { name: 'Set cohort' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Set year group' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Set course length' })).toBeEnabled();
  });

  it('keeps cohort, year-group, and course-length edits disabled for notCreated selections', () => {
    renderToolbar(['not-created-1']);

    expect(screen.getByRole('button', { name: 'Set cohort' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Set year group' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Set course length' })).toBeDisabled();
  });

  it('enables the same edit actions for inactive existing rows', () => {
    renderToolbar(['inactive-1']);

    expect(screen.getByRole('button', { name: 'Set cohort' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Set year group' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Set course length' })).toBeEnabled();
  });

  it('enables the same edit actions for mixed active and inactive existing rows', () => {
    renderToolbar(['active-1', 'inactive-1']);

    expect(screen.getByRole('button', { name: 'Set cohort' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Set year group' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Set course length' })).toBeEnabled();
  });
});
