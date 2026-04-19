import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ClassesToolbar, type ClassesToolbarProperties } from './ClassesToolbar';
import { statusCoverageRows } from '../../test/classes/classesTestHelpers';

const nonDeleteActionNames = [
  'Create ABClass',
  'Set active',
  'Set inactive',
  'Set cohort',
  'Set year group',
  'Set course length',
] as const;
const metadataActionNames = ['Set cohort', 'Set year group', 'Set course length'] as const;

type ManagementLauncherCase = Readonly<{
  buttonName: string;
  createOverrides: (onClick: () => void) => Partial<ClassesToolbarProperties>;
}>;

const managementLauncherCases: readonly ManagementLauncherCase[] = [
  {
    buttonName: 'Manage Cohorts',
    createOverrides: (onClick) => ({ onManageCohorts: onClick }),
  },
  {
    buttonName: 'Manage Year Groups',
    createOverrides: (onClick) => ({ onManageYearGroups: onClick }),
  },
];

/**
 * Renders the toolbar against the shared classes status-coverage rows.
 *
 * @param {string[]} selectedRowKeys Selected row identifiers.
 * @param {Partial<ClassesToolbarProperties>} [overrides] Toolbar property overrides.
 * @returns {ReturnType<typeof render>} Testing Library render result.
 */
function renderToolbar(selectedRowKeys: string[], overrides: Partial<ClassesToolbarProperties> = {}) {
  const selectedRows = statusCoverageRows.filter((row) => selectedRowKeys.includes(row.classId));

  return render(<ClassesToolbar selectedRows={selectedRows} {...overrides} />);
}

/**
 * Asserts that each named action button is enabled.
 *
 * @param {readonly string[]} actionNames Button labels to verify.
 * @returns {void}
 */
function expectButtonsEnabled(actionNames: readonly string[]) {
  for (const actionName of actionNames) {
    expect(screen.getByRole('button', { name: actionName })).toBeEnabled();
  }
}

/**
 * Asserts that each named action button is disabled.
 *
 * @param {readonly string[]} actionNames Button labels to verify.
 * @returns {void}
 */
function expectButtonsDisabled(actionNames: readonly string[]) {
  for (const actionName of actionNames) {
    expect(screen.getByRole('button', { name: actionName })).toBeDisabled();
  }
}

describe('ClassesToolbar', () => {
  it('enables Delete but disables non-delete actions for orphaned-only selection', () => {
    renderToolbar(['orphaned-1']);

    expect(screen.getByText('Orphaned rows are deletion-only.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete ABClass' })).toBeEnabled();
    expectButtonsDisabled(nonDeleteActionNames);
  });

  it('keeps mixed orphaned and non-orphaned selection behaviour explicit and deterministic', () => {
    renderToolbar(['active-1', 'orphaned-1']);

    expect(screen.getByRole('button', { name: 'Delete ABClass' })).toBeEnabled();
    expectButtonsDisabled(nonDeleteActionNames);
    expect(
      screen.getByText('Mixed selection includes orphaned rows. Delete is the only allowed bulk action.'),
    ).toBeInTheDocument();
  });

  it.each([
    ['a single active existing row', ['active-1']],
    ['a single inactive existing row', ['inactive-1']],
    ['mixed active and inactive existing rows', ['active-1', 'inactive-1']],
  ])('enables metadata edits for %s', (_, selectedRowKeys) => {
    renderToolbar(selectedRowKeys);
    expectButtonsEnabled(metadataActionNames);
  });

  it('keeps metadata edits disabled for notCreated selections', () => {
    renderToolbar(['not-created-1']);
    expectButtonsDisabled(metadataActionNames);
  });

  it('disables conflicting bulk write launchers while keeping adjacent reference-data launchers available', () => {
    renderToolbar(['inactive-1'], { setActiveLoading: true });

    expect(screen.getByRole('button', { name: /set active/i })).toBeDisabled();
    expectButtonsDisabled([
      'Set inactive',
      'Set cohort',
      'Set year group',
      'Set course length',
      'Delete ABClass',
    ]);
    expect(screen.getByRole('button', { name: 'Manage Cohorts' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Manage Year Groups' })).toBeEnabled();
  });

  it.each(managementLauncherCases)('$buttonName launcher remains enabled for any selection', ({
    buttonName,
  }) => {
    const { rerender } = renderToolbar([]);

    expect(screen.getByRole('button', { name: buttonName })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: buttonName })).toBeEnabled();

    rerender(
      <ClassesToolbar selectedRows={statusCoverageRows.filter((row) => ['active-1', 'inactive-1'].includes(row.classId))} />,
    );

    expect(screen.getByRole('button', { name: buttonName })).toBeEnabled();
  });

  it.each(managementLauncherCases)('calls $buttonName handler when clicked', ({
    buttonName,
    createOverrides,
  }) => {
    const onClick = vi.fn();
    renderToolbar([], createOverrides(onClick));

    fireEvent.click(screen.getByRole('button', { name: buttonName }));

    expect(onClick).toHaveBeenCalledOnce();
  });
});
