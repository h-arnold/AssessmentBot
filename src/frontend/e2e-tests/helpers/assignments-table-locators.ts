/**
 * Shared locators for the Class page's Assignments table.
 *
 * @remarks
 * Header sort and filter triggers are also buttons inside the table, so every
 * assignment-name lookup is scoped to Ant Design's data rows. A bare
 * `tbody tr` would also match the `aria-hidden` measure row.
 */

import { type Locator, type Page } from '@playwright/test';

/** Accessible name of the panel title and the table region. */
export const ASSIGNMENTS_TABLE_NAME = 'Assignments';

/** Column headings in their fixed display order. */
export const ASSIGNMENTS_HEADINGS = [
  'Name',
  'Completeness',
  'Accuracy',
  'SPaG',
  'Average',
  'Last Assessed',
] as const;

/**
 * Resolve the named Assignments table.
 * @param {Page} page - Browser page showing the Class page overview.
 * @returns {Locator} The named table.
 */
export function assignmentsTable(page: Page): Locator {
  return page.getByRole('table', { name: ASSIGNMENTS_TABLE_NAME });
}

/**
 * Resolve one assignment-name button from a data row of the Assignments table.
 * @param {Page} page - Browser page showing the Class page overview.
 * @param {string} name - Exact assignment-name button label.
 * @returns {Locator} The matching data-row button.
 */
export function assignmentNameButton(page: Page, name: string): Locator {
  return assignmentsTable(page)
    .locator('tbody tr.ant-table-row')
    .getByRole('button', { name, exact: true });
}
