/**
 * Browser coverage for the Class page's expandable Assignments table.
 *
 * The canonical `medium` class-2 transport views supply six assignments, so the
 * three-row initial depth, newest-first expansion and control behaviour are
 * proved against committed data through the shared Class-page runtime scenario.
 * Only the `getAssignment` prefetch queue is supplied explicitly: its order and
 * size come from the Class page's verified warm-up lifecycle, with no fallback
 * success.
 */

import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  assignmentsTable,
  ASSIGNMENTS_HEADINGS,
  ASSIGNMENTS_TABLE_NAME,
} from './helpers/assignments-table-locators';
import {
  EXPECTED_ASSIGNMENT_TITLES,
  INITIAL_VISIBLE_ROWS,
} from './helpers/assignments-table-expectations';
import {
  classPageAssignmentQueue,
  openErrorClass,
} from './helpers/assessment-error-preview-journeys';
import { createHeatmapScenario, openHeatmapClass } from './helpers/task-heatmap-end-to-end-helpers';
import { installRuntimeMock } from './shared/endToEndRuntimeMocks';

/** Titles in ascending and descending Name order, derived from canonical data. */
const NAME_ASCENDING = [...EXPECTED_ASSIGNMENT_TITLES]
  .toSorted((left, right) => left.localeCompare(right))
  .slice(0, INITIAL_VISIBLE_ROWS);
const NAME_DESCENDING = [...EXPECTED_ASSIGNMENT_TITLES]
  .toSorted((left, right) => right.localeCompare(left))
  .slice(0, INITIAL_VISIBLE_ROWS);

/** Assignment outside the initial three rows, used for history-wide filter probes. */
const HIDDEN_TITLE = EXPECTED_ASSIGNMENT_TITLES.at(INITIAL_VISIBLE_ROWS);
if (HIDDEN_TITLE === undefined) {
  throw new Error('Canonical class must supply an assignment beyond the preview.');
}

/** Assignment whose name button opens the heatmap in the navigation journey. */
const OPENED_TITLE = EXPECTED_ASSIGNMENT_TITLES.at(1);
if (OPENED_TITLE === undefined) {
  throw new Error('Canonical class must supply a second assignment for navigation.');
}

/** Accessible names of the disclosure in its two states. */
const SHOW_ALL_LABEL = 'Show all assignments';
const SHOW_FEWER_LABEL = 'Show fewer assignments';

/** Name-filter search placeholder and confirmation copy. */
const FILTER_SEARCH_PLACEHOLDER = 'Search in filters';
const CONFIRM_LABEL = 'OK';
const RESET_LABEL = 'Reset';

/** Completeness slider bounds and nudges above the canonical zero-valued row. */
const SLIDER_HANDLE_COUNT = 2;
const LOWER_HANDLE_NUDGES = 3;

/**
 * Resolve only data rows, excluding the header and Ant Design's measure row.
 * @param {Locator} table - The Assignments table.
 * @returns {Locator} The data rows.
 */
function dataRows(table: Locator): Locator {
  return table.locator('tbody tr.ant-table-row');
}

/**
 * Read assignment-name buttons from data rows in rendered order. Header sort
 * and filter controls are also buttons in the table, so they must be excluded.
 * @param {Locator} table - The Assignments table.
 * @returns {Promise<string[]>} Trimmed visible names in document order.
 */
async function renderedNames(table: Locator): Promise<string[]> {
  const names = await dataRows(table).getByRole('button').allTextContents();
  return names.map((name) => name.trim());
}

/**
 * Resolve one column header by its accessible name.
 * @param {Locator} table - The Assignments table.
 * @param {string} name - The exact heading.
 * @returns {Locator} The column header.
 */
function columnHeader(table: Locator, name: string): Locator {
  return table.getByRole('columnheader', { name, exact: true });
}

/**
 * Resolve the single open Ant Design filter dropdown.
 * @param {Page} page - The browser page.
 * @returns {Locator} The visible dropdown.
 */
function openFilterDropdown(page: Page): Locator {
  return page.locator('.ant-dropdown:not(.ant-dropdown-hidden)').last();
}

/**
 * Apply a searchable exact-value filter to one column.
 * @param {Page} page - The browser page.
 * @param {Locator} header - The column's header.
 * @param {string} value - The exact filter option.
 * @returns {Promise<void>} Resolves once the filter is confirmed.
 */
async function applyExactFilter(page: Page, header: Locator, value: string): Promise<void> {
  await header.locator('.ant-table-filter-trigger').click();
  const dropdown = openFilterDropdown(page);
  await dropdown.getByPlaceholder(FILTER_SEARCH_PLACEHOLDER).fill(value);
  await dropdown.locator('.ant-dropdown-menu-item', { hasText: value }).first().click();
  await dropdown.getByRole('button', { name: CONFIRM_LABEL }).click();
}

/**
 * Clear a column's filter through its dropdown's Reset action.
 * @param {Page} page - The browser page.
 * @param {Locator} header - The column's header.
 * @returns {Promise<void>} Resolves once the filter is cleared.
 */
async function clearExactFilter(page: Page, header: Locator): Promise<void> {
  await header.locator('.ant-table-filter-trigger').click();
  const dropdown = openFilterDropdown(page);
  await dropdown.getByRole('button', { name: RESET_LABEL }).click();
  await dropdown.getByRole('button', { name: CONFIRM_LABEL }).click();
}

/**
 * Read the disclosure's non-empty `aria-controls` value.
 * @param {Locator} disclosure - The title-bar disclosure button.
 * @returns {Promise<string>} The id of the region the button controls.
 */
async function disclosureControlsId(disclosure: Locator): Promise<string> {
  const controlsId = await disclosure.getAttribute('aria-controls');
  if (controlsId === null || controlsId === '') {
    throw new Error('Expected the disclosure button to name its controlled region.');
  }
  return controlsId;
}

/**
 * Resolve the disclosure's controlled region from its `aria-controls` value.
 * @param {Page} page - Browser page showing the Class page overview.
 * @param {Locator} disclosure - The title-bar disclosure button.
 * @returns {Promise<Locator>} The region the button declares control over.
 */
async function controlledRegion(page: Page, disclosure: Locator): Promise<Locator> {
  return page.locator(`[id="${await disclosureControlsId(disclosure)}"]`);
}

test.describe('Assignments table', () => {
  test('starts with three newest assignments, expands to the full history and collapses', async ({
    page,
  }) => {
    await openErrorClass(page, { getAssignment: classPageAssignmentQueue() });

    const table = assignmentsTable(page);
    await expect(table).toBeVisible();
    const showAll = page.getByRole('button', { name: SHOW_ALL_LABEL });
    const cardHead = page.locator('.ant-card-head').filter({ hasText: ASSIGNMENTS_TABLE_NAME });

    // The disclosure lives in the titled card's head, not in the table body.
    await expect(showAll).toHaveCount(1);
    await expect(cardHead.getByRole('button', { name: SHOW_ALL_LABEL })).toHaveCount(1);
    await expect(showAll).toHaveAttribute('aria-expanded', 'false');
    const initialRegion = await controlledRegion(page, showAll);
    await expect(initialRegion).toBeVisible();
    await expect(initialRegion.getByRole('table', { name: ASSIGNMENTS_TABLE_NAME })).toBeVisible();

    await expect(dataRows(table)).toHaveCount(INITIAL_VISIBLE_ROWS);
    await expect
      .poll(() => renderedNames(table))
      .toEqual(EXPECTED_ASSIGNMENT_TITLES.slice(0, INITIAL_VISIBLE_ROWS));

    const controlsId = await disclosureControlsId(showAll);
    await showAll.click();

    const showFewer = page.getByRole('button', { name: SHOW_FEWER_LABEL });
    await expect(showFewer).toHaveCount(1);
    await expect(showFewer).toHaveAttribute('aria-expanded', 'true');
    await expect(showFewer).toHaveAttribute('aria-controls', controlsId);
    await expect(cardHead.getByRole('button', { name: SHOW_FEWER_LABEL })).toHaveCount(1);
    const expandedRegion = await controlledRegion(page, showFewer);
    await expect(expandedRegion.getByRole('table', { name: ASSIGNMENTS_TABLE_NAME })).toBeVisible();

    await expect(dataRows(table)).toHaveCount(EXPECTED_ASSIGNMENT_TITLES.length);
    await expect.poll(() => renderedNames(table)).toEqual(EXPECTED_ASSIGNMENT_TITLES);

    await showFewer.click();

    const collapsed = page.getByRole('button', { name: SHOW_ALL_LABEL });
    await expect(collapsed).toHaveCount(1);
    await expect(collapsed).toHaveAttribute('aria-expanded', 'false');
    await expect(collapsed).toHaveAttribute('aria-controls', controlsId);
    await expect(dataRows(table)).toHaveCount(INITIAL_VISIBLE_ROWS);
    await expect
      .poll(() => renderedNames(table))
      .toEqual(EXPECTED_ASSIGNMENT_TITLES.slice(0, INITIAL_VISIBLE_ROWS));
  });

  test('opens the heatmap from an assignment-name button but not from a row', async ({ page }) => {
    await openErrorClass(page, { getAssignment: classPageAssignmentQueue() });

    const table = assignmentsTable(page);
    await expect(table).toBeVisible();

    // A cell click is not an entry point: no heatmap heading appears and the
    // overview table stays mounted.
    await dataRows(table).first().getByRole('cell').nth(1).click();
    await expect(page.getByRole('heading', { name: OPENED_TITLE })).toHaveCount(0);
    await expect(table).toBeVisible();

    const openedButton = dataRows(table).getByRole('button', { name: OPENED_TITLE, exact: true });
    await expect(openedButton).toHaveCount(1);
    await openedButton.click();

    await expect(page.getByRole('heading', { name: OPENED_TITLE })).toBeVisible();
    await expect(table).toHaveCount(0);
  });

  test('shows every row without a disclosure when the class has three or fewer assignments', async ({
    page,
  }) => {
    await installRuntimeMock(page, createHeatmapScenario());
    await openHeatmapClass(page);
    const table = assignmentsTable(page);
    await expect(dataRows(table)).toHaveCount(1);
    await expect(page.getByRole('button', { name: /Show (all|fewer) assignments/ })).toHaveCount(0);
  });

  test('exposes sort and filter controls on all six columns', async ({ page }) => {
    await openErrorClass(page, { getAssignment: classPageAssignmentQueue() });
    const table = assignmentsTable(page);
    await expect(table).toBeVisible();

    for (const heading of ASSIGNMENTS_HEADINGS) {
      const header = columnHeader(table, heading);
      await expect(header).toHaveCount(1);
      await expect(header.locator('.ant-table-column-sorters')).toHaveCount(1);
      await expect(header.locator('.ant-table-filter-trigger')).toHaveCount(1);
    }
  });

  test('sorts Name across the full history before the preview and clears back', async ({
    page,
  }) => {
    await openErrorClass(page, { getAssignment: classPageAssignmentQueue() });
    const table = assignmentsTable(page);
    await expect(dataRows(table)).toHaveCount(INITIAL_VISIBLE_ROWS);
    await expect
      .poll(() => renderedNames(table))
      .toEqual(EXPECTED_ASSIGNMENT_TITLES.slice(0, INITIAL_VISIBLE_ROWS));

    const sorter = columnHeader(table, 'Name').locator('.ant-table-column-sorters');
    await sorter.click();
    await expect.poll(() => renderedNames(table)).toEqual(NAME_ASCENDING);

    await sorter.click();
    await expect.poll(() => renderedNames(table)).toEqual(NAME_DESCENDING);

    await sorter.click();
    await expect
      .poll(() => renderedNames(table))
      .toEqual(EXPECTED_ASSIGNMENT_TITLES.slice(0, INITIAL_VISIBLE_ROWS));
  });

  test('filters an exact Name value over the full history without expanding', async ({ page }) => {
    await openErrorClass(page, { getAssignment: classPageAssignmentQueue() });
    const table = assignmentsTable(page);
    const nameHeader = columnHeader(table, 'Name');

    await expect.poll(() => renderedNames(table)).not.toContain(HIDDEN_TITLE);
    await applyExactFilter(page, nameHeader, HIDDEN_TITLE);

    // The filter searched the full history, but the three-row preview rule is
    // unchanged: one match renders and no ineffective disclosure appears.
    await expect.poll(() => renderedNames(table)).toEqual([HIDDEN_TITLE]);
    await expect(page.getByRole('button', { name: /Show (all|fewer) assignments/ })).toHaveCount(0);

    await clearExactFilter(page, nameHeader);
    await expect(dataRows(table)).toHaveCount(INITIAL_VISIBLE_ROWS);
    await expect
      .poll(() => renderedNames(table))
      .toEqual(EXPECTED_ASSIGNMENT_TITLES.slice(0, INITIAL_VISIBLE_ROWS));
    await expect(page.getByRole('button', { name: SHOW_ALL_LABEL })).toHaveCount(1);
  });

  test('applies a metric range filter over the full history while keeping the preview', async ({
    page,
  }) => {
    await openErrorClass(page, { getAssignment: classPageAssignmentQueue() });
    const table = assignmentsTable(page);
    await expect(dataRows(table)).toHaveCount(INITIAL_VISIBLE_ROWS);

    const completenessHeader = columnHeader(table, 'Completeness');
    await completenessHeader.locator('.ant-table-filter-trigger').click();
    const dropdown = openFilterDropdown(page);
    await expect(dropdown.getByRole('slider')).toHaveCount(SLIDER_HANDLE_COUNT);
    await expect(dropdown.getByRole('checkbox', { name: 'Include Not Attempted (N)' })).toHaveCount(
      1
    );
    await expect(dropdown.getByRole('checkbox', { name: 'Include Error (E)' })).toHaveCount(1);
    await expect(dropdown.getByRole('checkbox', { name: 'Include Excluded' })).toHaveCount(1);

    // Raising the lower Completeness bound excludes the canonical zero-valued
    // row outside the preview. The dropdown closes on the slider change.
    await dropdown.getByRole('slider').first().focus();
    for (let step = 0; step < LOWER_HANDLE_NUDGES; step += 1) {
      await page.keyboard.press('ArrowUp');
    }

    await expect
      .poll(() => renderedNames(table))
      .toEqual(EXPECTED_ASSIGNMENT_TITLES.slice(0, INITIAL_VISIBLE_ROWS));
    await expect(page.getByRole('button', { name: SHOW_ALL_LABEL })).toHaveCount(1);

    // Expanding proves the filter was applied before the preview was taken.
    await page.getByRole('button', { name: SHOW_ALL_LABEL }).click();
    await expect(dataRows(table)).toHaveCount(EXPECTED_ASSIGNMENT_TITLES.length - 1);
    await expect.poll(() => renderedNames(table)).not.toContain(HIDDEN_TITLE);

    await page.getByRole('button', { name: SHOW_FEWER_LABEL }).click();
    await expect(dataRows(table)).toHaveCount(INITIAL_VISIBLE_ROWS);
    await expect
      .poll(() => renderedNames(table))
      .toEqual(EXPECTED_ASSIGNMENT_TITLES.slice(0, INITIAL_VISIBLE_ROWS));
  });
});
