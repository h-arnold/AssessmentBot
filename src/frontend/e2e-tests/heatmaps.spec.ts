import { expect, test, type Page } from '@playwright/test';
import { pageContent } from '../src/pages/pageContent';
import { installRuntimeMock, selectVisibleOption } from './shared/endToEndRuntimeMocks';
import {
  createHeatmapScenario,
  HEATMAP_ASSIGNMENT_DISPLAY_TITLE,
  HEATMAP_CLASS_NAME,
  HEATMAP_SECOND_ASSIGNMENT_DISPLAY_TITLE,
} from './helpers/task-heatmap-end-to-end-helpers';
import { stickyTableBody, stickyTableHeaderHolder } from './helpers/sticky-table-locators';
import {
  ASSIGNMENTS_CONTROL_INDEX,
  CLASS_CONTROL_INDEX,
  TOPICS_CONTROL_INDEX,
} from './helpers/shell-controls';

const HEATMAPS_LABEL = pageContent.heatmaps.heading;
const TOPIC_LABEL = 'Earth';
/** Search query matching only the distinct second-assignment option label. */
const HEATMAP_SEARCH_QUERY = 'Spreadsheet';

/**
 * Navigate to the standalone Heatmaps page.
 *
 * @param {Page} page The Playwright page under test.
 */
async function openHeatmaps(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('menuitem', { name: HEATMAPS_LABEL }).click();
  await expect(page.getByRole('heading', { level: 2, name: HEATMAPS_LABEL })).toBeVisible();
}

/**
 * Select the fixture class and wait for dependent controls to enable.
 *
 * @param {Page} page The Playwright page under test.
 */
async function selectClass(page: Page): Promise<void> {
  await page.getByRole('combobox').nth(CLASS_CONTROL_INDEX).click();
  await selectVisibleOption(page, HEATMAP_CLASS_NAME);
  await expect(page.getByRole('combobox').nth(TOPICS_CONTROL_INDEX)).toBeEnabled();
  await expect(page.getByRole('combobox').nth(ASSIGNMENTS_CONTROL_INDEX)).toBeEnabled();
}

test.describe('Heatmaps builder', () => {
  test('builds a merged heatmap after selecting a class, topic, and assignments', async ({
    page,
  }) => {
    await installRuntimeMock(page, createHeatmapScenario({ multipleAssignments: true }));
    await openHeatmaps(page);
    await selectClass(page);

    await page.getByRole('combobox').nth(TOPICS_CONTROL_INDEX).click();
    await selectVisibleOption(page, TOPIC_LABEL);
    await page.getByRole('combobox').nth(ASSIGNMENTS_CONTROL_INDEX).click();
    await selectVisibleOption(page, HEATMAP_ASSIGNMENT_DISPLAY_TITLE);
    await page.getByRole('combobox').nth(ASSIGNMENTS_CONTROL_INDEX).click();
    await selectVisibleOption(page, HEATMAP_ASSIGNMENT_DISPLAY_TITLE, 1);

    const header = stickyTableHeaderHolder(page);
    await expect(header).toBeVisible();
    await expect(header.getByRole('columnheader', { name: 'Forename' })).toHaveCount(1);
    await expect(header.getByRole('columnheader', { name: 'Surname' })).toHaveCount(1);
    const studentTwoRow = stickyTableBody(page)
      .locator('tbody tr.ant-table-row')
      .filter({ has: page.locator('[aria-label^="Student Two,"]') });
    await expect(studentTwoRow.locator('td').nth(0)).toHaveText('Student');
    await expect(studentTwoRow.locator('td').nth(1)).toHaveText('Two');
    await expect(
      header.getByRole('columnheader', { name: HEATMAP_ASSIGNMENT_DISPLAY_TITLE })
    ).toHaveCount(1);
    await expect(header.getByRole('columnheader', { name: /shared definition/ })).toHaveCount(1);
    await expect(header.getByRole('columnheader', { name: 'Task 1' })).toHaveCount(1);
    await expect(
      stickyTableBody(page).getByRole('button', {
        name: 'Student Two, Task 1, Completeness: 5',
        exact: true,
      })
    ).toHaveCount(1);
  });

  test('gates dependent selectors until a class is selected and exposes the reason', async ({
    page,
  }) => {
    await installRuntimeMock(page, createHeatmapScenario());
    await openHeatmaps(page);

    await expect(page.getByRole('combobox').nth(TOPICS_CONTROL_INDEX)).toBeDisabled();
    await expect(page.getByRole('combobox').nth(ASSIGNMENTS_CONTROL_INDEX)).toBeDisabled();
    await expect(page.getByText('Select a class first')).toHaveCount(1);

    await selectClass(page);
    await expect(page.getByRole('combobox').nth(TOPICS_CONTROL_INDEX)).toBeEnabled();
    await expect(page.getByRole('combobox').nth(ASSIGNMENTS_CONTROL_INDEX)).toBeEnabled();
  });

  test('clears dependent selections when the class is cleared', async ({ page }) => {
    await installRuntimeMock(page, createHeatmapScenario());
    await openHeatmaps(page);
    await selectClass(page);
    await page.getByRole('combobox').nth(TOPICS_CONTROL_INDEX).click();
    await selectVisibleOption(page, TOPIC_LABEL);
    await page.getByRole('combobox').nth(ASSIGNMENTS_CONTROL_INDEX).click();
    await selectVisibleOption(page, HEATMAP_ASSIGNMENT_DISPLAY_TITLE);
    await expect(
      page
        .locator('.ant-select-selection-item')
        .filter({ hasText: HEATMAP_ASSIGNMENT_DISPLAY_TITLE })
    ).toHaveCount(1);

    await page.getByRole('combobox').nth(CLASS_CONTROL_INDEX).click();
    await page.keyboard.press('Escape');
    // Clearing is exposed by the Select's clear button, not by an option choice.
    await page.locator('.ant-select').nth(CLASS_CONTROL_INDEX).locator('.ant-select-clear').click();

    await expect(page.getByRole('combobox').nth(TOPICS_CONTROL_INDEX)).toBeDisabled();
    await expect(page.getByRole('combobox').nth(ASSIGNMENTS_CONTROL_INDEX)).toBeDisabled();
    await expect(page.getByText(pageContent.heatmaps.noClassEmpty)).toHaveCount(1);
  });

  test('renders no-class and no-assignment empty states verbatim', async ({ page }) => {
    await installRuntimeMock(page, createHeatmapScenario());
    await openHeatmaps(page);
    await expect(page.getByText(pageContent.heatmaps.noClassEmpty)).toHaveCount(1);

    await selectClass(page);
    await expect(page.getByText(pageContent.heatmaps.noAssignmentsEmpty)).toHaveCount(1);
  });

  test('renders a retryable blocked state when the class query fails', async ({ page }) => {
    await installRuntimeMock(page, createHeatmapScenario({ classFailure: true }));
    await openHeatmaps(page);
    await page.getByRole('combobox').nth(CLASS_CONTROL_INDEX).click();
    await selectVisibleOption(page, HEATMAP_CLASS_NAME);

    await expect(page.getByText('We could not load this class')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  });

  test('refresh is present and remains non-erroring after a class is selected', async ({
    page,
  }) => {
    await installRuntimeMock(page, createHeatmapScenario());
    await openHeatmaps(page);
    await selectClass(page);

    const refresh = page.getByRole('button', { name: 'Refresh' });
    await expect(refresh).toBeVisible();
    await expect(refresh).toBeEnabled();
    await refresh.click();
    await expect(page.getByRole('heading', { level: 2, name: HEATMAP_CLASS_NAME })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('opens a cell preview from the merged table', async ({ page }) => {
    await installRuntimeMock(page, createHeatmapScenario());
    await openHeatmaps(page);
    await selectClass(page);
    await page.getByRole('combobox').nth(ASSIGNMENTS_CONTROL_INDEX).click();
    await selectVisibleOption(page, HEATMAP_ASSIGNMENT_DISPLAY_TITLE);

    const cell = page.getByRole('button', {
      name: 'Student Two, Task 1, Completeness: 5',
      exact: true,
    });
    await expect(cell).toHaveCount(1);
    await cell.hover();
    const popover = page.locator('.ant-popover');
    await expect(popover).toBeVisible();
    await expect(popover.getByText('Reasoning', { exact: true })).toHaveCount(1);
    await expect(popover.getByText('Student Response', { exact: true })).toHaveCount(1);
  });

  test('selects all assignments from the dropdown header with and without a search query', async ({
    page,
  }) => {
    await installRuntimeMock(
      page,
      createHeatmapScenario({
        multipleAssignments: true,
        distinctSecondAssignmentTitle: true,
      })
    );
    await openHeatmaps(page);
    await selectClass(page);

    const assignmentsCombobox = page.getByRole('combobox').nth(ASSIGNMENTS_CONTROL_INDEX);
    const assignmentsDropdown = page.locator(
      '.ant-select-dropdown:not(.ant-select-dropdown-hidden)'
    );
    const selectedAssignmentTags = page
      .locator('.ant-select')
      .nth(ASSIGNMENTS_CONTROL_INDEX)
      .locator('.ant-select-selection-item');

    // Both fixture options are listed before any header interaction.
    await assignmentsCombobox.click();
    await expect(
      assignmentsDropdown
        .locator('.ant-select-item-option')
        .filter({ hasText: HEATMAP_ASSIGNMENT_DISPLAY_TITLE })
    ).toHaveCount(1);
    await expect(
      assignmentsDropdown
        .locator('.ant-select-item-option')
        .filter({ hasText: HEATMAP_SECOND_ASSIGNMENT_DISPLAY_TITLE })
    ).toHaveCount(1);

    const selectAll = assignmentsDropdown.getByRole('checkbox', { name: 'Select all assignments' });
    const selectNone = assignmentsDropdown.getByRole('button', { name: 'Select none assignments' });
    await expect(selectAll).toBeVisible();
    await expect(selectNone).toBeVisible();

    // Select all with no active query unions every shown option into the
    // selection and keeps the dropdown open.
    await selectAll.click();
    await expect(assignmentsDropdown).toBeVisible();
    await expect(
      selectedAssignmentTags.filter({ hasText: HEATMAP_ASSIGNMENT_DISPLAY_TITLE })
    ).toHaveCount(1);
    await expect(
      selectedAssignmentTags.filter({ hasText: HEATMAP_SECOND_ASSIGNMENT_DISPLAY_TITLE })
    ).toHaveCount(1);

    // Select none clears the whole assignment selection.
    await selectNone.click();
    await expect(assignmentsDropdown).toBeVisible();
    await expect(
      selectedAssignmentTags.filter({ hasText: HEATMAP_ASSIGNMENT_DISPLAY_TITLE })
    ).toHaveCount(0);
    await expect(
      selectedAssignmentTags.filter({ hasText: HEATMAP_SECOND_ASSIGNMENT_DISPLAY_TITLE })
    ).toHaveCount(0);

    // With an active query, select all unions only the query-matching options
    // into the existing selection and keeps both the query and the dropdown.
    await expect(assignmentsCombobox).toBeEnabled();
    await expect(assignmentsCombobox).toBeFocused();
    await page.keyboard.type(HEATMAP_SEARCH_QUERY);
    await expect(
      assignmentsDropdown
        .locator('.ant-select-item-option')
        .filter({ hasText: HEATMAP_ASSIGNMENT_DISPLAY_TITLE })
    ).toHaveCount(0);
    await expect(assignmentsCombobox).toHaveValue(HEATMAP_SEARCH_QUERY);

    await selectAll.click();
    await expect(assignmentsDropdown).toBeVisible();
    await expect(
      selectedAssignmentTags.filter({ hasText: HEATMAP_SECOND_ASSIGNMENT_DISPLAY_TITLE })
    ).toHaveCount(1);
    await expect(
      selectedAssignmentTags.filter({ hasText: HEATMAP_ASSIGNMENT_DISPLAY_TITLE })
    ).toHaveCount(0);
    await expect(assignmentsCombobox).toHaveValue(HEATMAP_SEARCH_QUERY);
  });
});
