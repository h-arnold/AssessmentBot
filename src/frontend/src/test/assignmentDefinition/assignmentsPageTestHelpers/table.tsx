/**
 * Table helpers for AssignmentsPage tests.
 */

import { fireEvent, screen, within } from '@testing-library/react';

/**
 * Gets the assignment definitions table.
 *
 * @returns {Promise<HTMLElement>} The table element.
 */
export async function getAssignmentsTable(): Promise<HTMLElement> {
  return screen.findByRole('table', { name: 'Assignment definitions table' });
}

/**
 * Options for finding a row in the assignments table.
 */
export interface FindRowOptions {
  /** Row name pattern (passed to getByRole 'row' name). */
  name: string | RegExp;
  /** Container to search within (defaults to document). */
  container?: HTMLElement;
}

/**
 * Finds a row in the assignments table by name.
 *
 * @param {FindRowOptions} options Find options.
 * @returns {HTMLElement} The row element.
 */
export function findRowInAssignmentsTable(options: FindRowOptions): HTMLElement {
  const { name, container = document.body } = options;
  return within(container).getByRole('row', { name });
}

/**
 * Finds a row in the assignments table by name and waits for it.
 *
 * @param {FindRowOptions} options Find options.
 * @returns {Promise<HTMLElement>} The row element.
 */
export async function waitForRowInAssignmentsTable(options: FindRowOptions): Promise<HTMLElement> {
  const { name, container = document.body } = options;
  return within(container).findByRole('row', { name });
}

/**
 * Clicks the update button in a specified row.
 *
 * @param {HTMLElement} row The row element containing the update button.
 * @returns {void}
 */
export function clickUpdateButtonInRow(row: HTMLElement): void {
  fireEvent.click(within(row).getByRole('button', { name: /update/i }));
}

/**
 * Finds a row by name and clicks its update button.
 * Consolidates the common pattern of finding a row and clicking update.
 *
 * @param {string | RegExp} rowName Row name pattern.
 * @param {HTMLElement} [container] Optional container to search within.
 * @returns {Promise<HTMLElement>} The row that was clicked.
 */
export async function findRowAndClickUpdate(
  rowName: string | RegExp,
  container?: HTMLElement
): Promise<HTMLElement> {
  const table = container ?? (await getAssignmentsTable());
  const row = findRowInAssignmentsTable({ name: rowName, container: table });
  clickUpdateButtonInRow(row);
  return row;
}

/**
 * Gets the delete button in a specified row.
 *
 * @param {HTMLElement} row The row element.
 * @returns {HTMLElement} The delete button element.
 */
export function getDeleteButtonInRow(row: HTMLElement): HTMLElement {
  return within(row).getByRole('button', { name: /delete/i });
}

/**
 * Finds a row by name and clicks its delete button.
 *
 * @param {string | RegExp} rowName Row name pattern.
 * @param {HTMLElement} [container] Optional container to search within.
 * @returns {Promise<HTMLElement>} The row that was clicked.
 */
export async function findRowAndClickDelete(
  rowName: string | RegExp,
  container?: HTMLElement
): Promise<HTMLElement> {
  const table = container ?? (await getAssignmentsTable());
  const row = findRowInAssignmentsTable({ name: rowName, container: table });
  fireEvent.click(getDeleteButtonInRow(row));
  return row;
}
