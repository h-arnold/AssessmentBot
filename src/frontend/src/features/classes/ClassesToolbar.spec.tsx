import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ClassesToolbar } from './ClassesToolbar';
import { statusCoverageRows } from './classesTestHelpers';

const nonDeleteActionNames = [
  'Create ABClass',
  'Set active',
  'Set inactive',
  'Set cohort',
  'Set year group',
  'Set course length',
] as const;
const metadataActionNames = ['Set cohort', 'Set year group', 'Set course length'] as const;

/**
 * Renders the toolbar against the shared classes status-coverage rows.
 *
 * @param {string[]} selectedRowKeys Selected row identifiers.
 * @returns {void}
 */
function renderToolbar(selectedRowKeys: string[]) {
  render(<ClassesToolbar rows={statusCoverageRows} selectedRowKeys={selectedRowKeys} />);
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
});
