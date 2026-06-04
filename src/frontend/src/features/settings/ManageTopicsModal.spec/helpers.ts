/**
 * Reusable test helper functions extracted from the ManageTopicsModal spec.
 *
 * These helpers provide page-object-style access to common modal elements
 * and reusable assertion utilities shared between CRUD and edge-case spec files.
 */

import { fireEvent, screen, within } from '@testing-library/react';
import { expect } from 'vitest';

// ---------------------------------------------------------------------------
// Table constants
// ---------------------------------------------------------------------------

/** Topics table has 3 columns: Name, Year Groups, Actions */
export const TOPICS_TABLE_COLUMN_COUNT = 3;

// ---------------------------------------------------------------------------
// Table access helpers
// ---------------------------------------------------------------------------

/**
 * Finds the topics data table within the given modal dialog.
 *
 * @param {HTMLElement} dialog The Manage Topics modal dialog element.
 * @returns {Promise<HTMLElement>} A promise resolving to the topics table element.
 */
export async function findTopicsTable(dialog: HTMLElement): Promise<HTMLElement> {
  return within(dialog).findByRole('table', { name: /topics/i });
}

/**
 * Returns all topic data rows from the table (excluding the header row).
 *
 * @param {HTMLElement} table The topics table element.
 * @returns {HTMLElement[]} All topic rows (excluding the header).
 */
export function getTopicRows(table: HTMLElement): HTMLElement[] {
  return within(table).getAllByRole('row').slice(1);
}

/**
 * Gets a topic row from the table by matching its name text.
 *
 * @param {HTMLElement} table The topics table element.
 * @param {string | RegExp} nameOrRegex The topic name text or regex to match.
 * @returns {HTMLElement} The matching row element.
 */
export function getTopicRow(table: HTMLElement, nameOrRegex: string | RegExp): HTMLElement {
  return within(table).getByRole('row', { name: nameOrRegex });
}

// ---------------------------------------------------------------------------
// Action button helpers
// ---------------------------------------------------------------------------

/**
 * Clicks the Edit button in the given topic row.
 *
 * @param {HTMLElement} row The topic table row element.
 */
export function clickEditOnRow(row: HTMLElement): void {
  fireEvent.click(within(row).getByRole('button', { name: /edit/i }));
}

/**
 * Clicks the Delete button in the given topic row.
 *
 * @param {HTMLElement} row The topic table row element.
 */
export function clickDeleteOnRow(row: HTMLElement): void {
  fireEvent.click(within(row).getByRole('button', { name: /delete/i }));
}

/**
 * Clicks the Create Topic button in the given dialog.
 *
 * @param {HTMLElement} dialog The Manage Topics modal dialog element.
 */
export function clickCreateTopicButton(dialog: HTMLElement): void {
  fireEvent.click(within(dialog).getByRole('button', { name: /create topic/i }));
}

// ---------------------------------------------------------------------------
// Column/cell helpers
// ---------------------------------------------------------------------------

/**
 * Returns the Year Groups cell for the given topic row.
 *
 * @param {HTMLElement} row The topic table row element.
 * @returns {HTMLElement} The year groups cell.
 */
export function getYearGroupsCell(row: HTMLElement): HTMLElement {
  return within(row).getByRole('cell', { name: /year groups/i });
}

/**
 * Returns all column headers from the topics table.
 *
 * @param {HTMLElement} table The topics table element.
 * @returns {HTMLElement[]} All columnheader elements.
 */
export function getColumnHeaders(table: HTMLElement): HTMLElement[] {
  return within(table).getAllByRole('columnheader');
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

/**
 * Asserts that every topic row has Edit and Delete action buttons.
 *
 * @param {HTMLElement} table The topics table element.
 */
export function expectRowsHaveActions(table: HTMLElement): void {
  const rows = getTopicRows(table);
  for (const row of rows) {
    expect(within(row).getByRole('button', { name: /edit/i })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: /delete/i })).toBeInTheDocument();
  }
}

/**
 * Asserts that the given dialog contains a data-testid for the create action icon.
 *
 * @param {HTMLElement} dialog The Manage Topics modal dialog element.
 */
export function expectCreateActionIcon(dialog: HTMLElement): void {
  expect(within(dialog).getByTestId('reference-data-create-action-icon')).toBeInTheDocument();
}

/**
 * Asserts that the modal dialog is not rendered (open is false).
 */
export function expectModalNotRendered(): void {
  expect(screen.queryByRole('dialog', { name: 'Manage Topics' })).not.toBeInTheDocument();
}
