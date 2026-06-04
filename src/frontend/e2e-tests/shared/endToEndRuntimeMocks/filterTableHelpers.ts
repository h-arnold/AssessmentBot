import { expect, type Page } from '@playwright/test';

// ============================================================================
// Filter Interaction Helpers
// ============================================================================

/**
 * Applies one column filter option using visible controls only.
 *
 * @param {Page} page Playwright page instance.
 * @param {string} columnHeaderName Column header label.
 * @param {string} optionLabel Visible filter option label.
 * @returns {Promise<void>} Resolves when the option is selected.
 */
export async function applyColumnFilterOption(
  page: Page,
  columnHeaderName: string | RegExp,
  optionLabel: string | RegExp
): Promise<void> {
  await page.getByRole('columnheader', { name: columnHeaderName }).getByRole('button').click();

  const activeFilterPopup = page.locator('.ant-dropdown:visible').last();
  await expect(activeFilterPopup).toBeVisible();
  await activeFilterPopup.getByText(optionLabel, { exact: true }).click();

  await page.keyboard.press('Escape');
}

/**
 * Selects one visible Ant Design select option from the active dropdown overlay.
 *
 * @param {Page} page The Playwright page under test.
 * @param {string} optionName The visible option label to choose.
 * @returns {Promise<void>} Resolves once the option is selected.
 */
export async function selectVisibleOption(page: Page, optionName: string): Promise<void> {
  await page
    .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
    .getByText(optionName, { exact: true })
    .click();
}

// ============================================================================
// Table Interaction Helpers
// ============================================================================

/**
 * Locates one assignments table row by exact title cell text.
 *
 * @param {Page} page Playwright page instance.
 * @param {string} assignmentTitle Exact assignment title shown in the first column.
 * @returns {import('@playwright/test').Locator} Row locator scoped to the assignments table.
 */
export function getAssignmentsRowByTitle(
  page: Page,
  assignmentTitle: string
): ReturnType<typeof page.getByRole> {
  const assignmentsTable = page.getByRole('table', { name: 'Assignment definitions table' });
  const titleCell = assignmentsTable
    .locator('tbody tr td:first-child')
    .getByText(assignmentTitle, { exact: true });

  return titleCell.locator('xpath=ancestor::tr');
}

// ============================================================================
// Navigation Helpers
// ============================================================================

/**
 * Navigates to the Assignments page from the root.
 *
 * @param {Page} page Playwright page instance.
 * @returns {Promise<void>} Resolves when navigation is complete.
 */
export async function navigateToAssignmentsPage(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('menuitem', { name: 'Assignments' }).click();
}

/**
 * Default timeout for waiting for page ready state in milliseconds.
 */
const DEFAULT_PAGE_READY_TIMEOUT = 10_000;

/**
 * Waits for the assignments page to be ready (blocking state cleared, loading finished).
 *
 * @param {Page} page Playwright page instance.
 * @param {object} options Wait options.
 * @param {number} options.timeout Timeout in milliseconds (default: DEFAULT_PAGE_READY_TIMEOUT).
 * @returns {Promise<void>} Resolves when page is ready.
 */
export async function waitForAssignmentsPageReady(
  page: Page,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = DEFAULT_PAGE_READY_TIMEOUT } = options;

  await expect(
    page.getByText('Assignment definitions could not be trusted or loaded.')
  ).toHaveCount(0, { timeout });
  await expect(page.getByLabel('Assignments table loading')).toHaveCount(0);
}
