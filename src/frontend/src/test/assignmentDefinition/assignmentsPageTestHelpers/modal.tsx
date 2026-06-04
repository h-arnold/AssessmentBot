/**
 * Modal helpers for AssignmentsPage tests.
 */

import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { QueryClient } from '@tanstack/react-query';
import { setupQueryClientWithAssignmentsData, type SetupQueryClientOptions } from './setup';
import { getAssignmentsTable, findRowInAssignmentsTable, clickUpdateButtonInRow } from './table';
import { changeReferenceUrlInModal, getReparseActionRowInModal } from './formFields';
import { assertMetadataAndTaskWeightingsDisabledInModal } from './assertions';

/**
 * Waits for and returns the create assignment modal.
 *
 * @returns {Promise<HTMLElement>} The modal element.
 */
export async function waitForCreateAssignmentModal(): Promise<HTMLElement> {
  return waitFor(() => screen.getByRole('dialog', { name: /create assignment/i }));
}

/**
 * Waits for and returns the update assignment modal.
 *
 * @returns {Promise<HTMLElement>} The modal element.
 */
export async function waitForUpdateAssignmentModal(): Promise<HTMLElement> {
  return waitFor(() => screen.getByRole('dialog', { name: /update assignment/i }));
}

/**
 * Waits for and returns the delete confirmation dialog.
 *
 * @returns {Promise<HTMLElement>} The dialog element.
 */
export async function waitForDeleteDialog(): Promise<HTMLElement> {
  return waitFor(() => screen.getByRole('dialog', { name: 'Delete assignment definition' }));
}

/**
 * Clicks the create assignment button.
 *
 * @returns {void}
 */
export function clickCreateAssignmentButton(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Create assignment' }));
}

// ============================================================================
// Composite Setup Helpers for Update Workflow
// ============================================================================

/**
 * Sets up query client data, finds the specified row, clicks update, and waits for the modal.
 * Consolidates the common pattern: setupQueryClientWithAssignmentsData + getAssignmentsTable +
 * findRowInAssignmentsTable + clickUpdateButtonInRow + waitForUpdateAssignmentModal.
 *
 * @param {QueryClient} queryClient The query client to set up.
 * @param {SetupQueryClientOptions} setupOptions Query data setup options.
 * @param {string | RegExp} [rowName=/algebra foundations/i] Row name pattern to find.
 * @returns {Promise<HTMLElement>} The update assignment modal element.
 */
export async function openUpdateAssignmentModal(
  queryClient: QueryClient,
  setupOptions: SetupQueryClientOptions = {},
  rowName: string | RegExp = /algebra foundations/i
): Promise<HTMLElement> {
  setupQueryClientWithAssignmentsData(queryClient, setupOptions);

  const table = await getAssignmentsTable();
  const row = findRowInAssignmentsTable({ name: rowName, container: table });
  clickUpdateButtonInRow(row);

  return waitForUpdateAssignmentModal();
}

/**
 * Opens update modal and changes the reference URL, then verifies re-parse prompt is shown.
 * Consolidates: openUpdateAssignmentModal + changeReferenceUrlInModal +
 * assertMetadataAndTaskWeightingsDisabledInModal + verify reparse prompt.
 *
 * @param {QueryClient} queryClient The query client to set up.
 * @param {SetupQueryClientOptions} setupOptions Query data setup options.
 * @param {string} [newReferenceUrl='https://docs.google.com/presentation/d/new-ref'] The new reference URL.
 * @param {string | RegExp} [rowName=/algebra foundations/i] Row name pattern to find.
 * @returns {Promise<{ modal: HTMLElement; reparseActionRow: HTMLElement }>} Modal and reparse action row elements.
 */
export async function openUpdateModalAndChangeReferenceUrl(
  queryClient: QueryClient,
  setupOptions: SetupQueryClientOptions = {},
  newReferenceUrl: string = 'https://docs.google.com/presentation/d/new-ref',
  rowName: string | RegExp = /algebra foundations/i
): Promise<{ modal: HTMLElement; reparseActionRow: HTMLElement }> {
  const modal = await openUpdateAssignmentModal(queryClient, setupOptions, rowName);

  await changeReferenceUrlInModal(modal, newReferenceUrl);
  await assertMetadataAndTaskWeightingsDisabledInModal(modal);

  expect(within(modal).getByText(/document changed/i)).toBeInTheDocument();
  const reparseActionRow = getReparseActionRowInModal(modal);
  expect(within(reparseActionRow).getByRole('button', { name: /re-parse/i })).toBeInTheDocument();
  expect(within(reparseActionRow).getByRole('button', { name: /^cancel$/i })).toBeInTheDocument();

  return { modal, reparseActionRow };
}
