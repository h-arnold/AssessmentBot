/**
 * SelectWithAddNew Workflow — browser journey test.
 *
 * Tests the end-to-end workflow of creating reference data entities
 * directly from Select dropdowns via the 'Add new' option.
 *
 * Covers:
 * - SelectWithAddNew integration in BulkCreateModal
 * - Opening modals from 'Add new' clicks
 * - Entity creation and auto-selection
 */

import { expect, test, type Page } from '@playwright/test';
import { waitForSelectPopupReady } from './helpers/select-popup-readiness';
import {
  baseGoogleClassrooms,
  baseCohorts,
  baseYearGroups,
  createSuccessfulClassesScenario,
  openClassesTabWithScenario,
} from './classes-crud.shared';

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Opens the bulk create modal by clicking the Create ABClass button.
 *
 * @param {Page} page - The Playwright page object.
 * @returns {Promise<void>}
 */
async function openBulkCreateModal(page: Page): Promise<void> {
  const createButton = page.getByRole('button', { name: 'Create ABClass' });
  await expect(createButton).toBeVisible();
  await expect(createButton).toBeEnabled();
  await createButton.click();
  await expect(page.getByRole('dialog', { name: /create abclass/i })).toBeVisible();
}

/**
 * Opens a combobox by name and clicks the 'Add new' option.
 *
 * @param {Page} page - The Playwright page object.
 * @param {string} comboboxName - The name of the combobox to open.
 * @param {string} addNewOptionName - The name of the 'Add new' option to click.
 * @returns {Promise<void>}
 */
async function openComboboxAndClickAddNew(
  page: Page,
  comboboxName: string,
  addNewOptionName: string
): Promise<void> {
  const combobox = page.getByRole('combobox', { name: comboboxName });
  await expect(combobox).toBeVisible();
  await combobox.click();

  const addNewOption = page.getByRole('option', { name: addNewOptionName });
  await expect(addNewOption).toBeVisible();
  await waitForSelectPopupReady(addNewOption);
  await addNewOption.click();
}

/**
 * Opens a combobox by name and verifies the 'Add new' option exists.
 *
 * @param {Page} page - The Playwright page object.
 * @param {string} comboboxName - The name of the combobox to open.
 * @param {string} addNewOptionName - The name of the 'Add new' option to verify.
 * @returns {Promise<void>}
 */
async function verifyAddNewOptionExists(
  page: Page,
  comboboxName: string,
  addNewOptionName: string
): Promise<void> {
  const combobox = page.getByRole('combobox', { name: comboboxName });
  await expect(combobox).toBeVisible();
  await expect(combobox).toBeEnabled();
  await combobox.click();

  await expect(page.getByRole('option', { name: addNewOptionName })).toBeVisible();
}

/**
 * Confirms that the selected label (or initial placeholder) remains visible in the create form.
 *
 * @param {Page} page - The Playwright page object.
 * @param {string} label - The visible selected label or placeholder.
 * @returns {Promise<void>}
 */
async function expectCreateFormSelection(page: Page, label: string): Promise<void> {
  const createModal = page.getByRole('dialog', { name: /create abclass/i });
  await expect(createModal).toBeVisible();
  const visibleSelection = createModal.getByText(label, { exact: true }).filter({ visible: true });
  await expect(visibleSelection).toHaveCount(1);
  await expect(visibleSelection).toBeVisible();
  await expect(createModal.getByText(/add new (cohort|year group)/i)).toHaveCount(0);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('SelectWithAddNew Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await openClassesTabWithScenario(page, {
      ...createSuccessfulClassesScenario({
        classPartials: [],
        cohorts: baseCohorts,
        googleClassrooms: baseGoogleClassrooms,
        yearGroups: baseYearGroups,
      }),
      createCohort: [
        {
          kind: 'success',
          data: {
            key: 'new-cohort-1',
            name: 'New Cohort',
            active: true,
            startYear: 2025,
            startMonth: 9,
          },
        },
      ],
      createYearGroup: [
        { kind: 'success', data: { key: 'new-year-group-1', name: 'New Year Group' } },
      ],
      getCohorts: [
        { kind: 'success', data: baseCohorts },
        {
          kind: 'success',
          data: [
            ...baseCohorts,
            {
              key: 'new-cohort-1',
              name: 'New Cohort',
              active: true,
              startYear: 2025,
              startMonth: 9,
            },
          ],
        },
        {
          kind: 'success',
          data: [
            ...baseCohorts,
            {
              key: 'new-cohort-1',
              name: 'New Cohort',
              active: true,
              startYear: 2025,
              startMonth: 9,
            },
          ],
        },
      ],
      getYearGroups: [
        { kind: 'success', data: baseYearGroups },
        {
          kind: 'success',
          data: [...baseYearGroups, { key: 'new-year-group-1', name: 'New Year Group' }],
        },
        {
          kind: 'success',
          data: [...baseYearGroups, { key: 'new-year-group-1', name: 'New Year Group' }],
        },
      ],
    });

    // Wait for the Classes table to be visible
    await expect(page.getByRole('table', { name: /classes/i })).toBeVisible();

    // Select the first notCreated row via checkbox to enable bulk create.
    const classesTable = page.getByRole('table', { name: /classes/i });
    await classesTable.getByRole('checkbox').first().check();

    // Verify the Create ABClass button is now enabled
    await expect(page.getByRole('button', { name: 'Create ABClass' })).toBeEnabled();
  });

  test('Cohort Select has Add new option', async ({ page }) => {
    await openBulkCreateModal(page);
    await verifyAddNewOptionExists(page, 'Cohort', 'Add new cohort');
  });

  test('Year Group Select has Add new option', async ({ page }) => {
    await openBulkCreateModal(page);
    await verifyAddNewOptionExists(page, 'Year group', 'Add new year group');
  });

  test('Clicking Add new cohort opens Manage Cohorts modal', async ({ page }) => {
    await openBulkCreateModal(page);
    await openComboboxAndClickAddNew(page, 'Cohort', 'Add new cohort');
    await expect(page.getByRole('dialog', { name: /manage cohorts/i })).toBeVisible();
  });

  test('Clicking Add new year group opens Manage Year Groups modal', async ({ page }) => {
    await openBulkCreateModal(page);
    await openComboboxAndClickAddNew(page, 'Year group', 'Add new year group');
    await expect(page.getByRole('dialog', { name: /manage year groups/i })).toBeVisible();
  });

  test('Keyboard selection of Add new year group opens its manager', async ({ page }) => {
    await openBulkCreateModal(page);
    const createModal = page.getByRole('dialog', { name: /create abclass/i });
    const yearGroupCombobox = page.getByRole('combobox', { name: 'Year group' });
    await yearGroupCombobox.click();
    for (let index = 0; index < baseYearGroups.length; index += 1) {
      await page.keyboard.press('ArrowDown');
    }

    const activeOptionId = await yearGroupCombobox.getAttribute('aria-activedescendant');
    expect(activeOptionId).not.toBeNull();
    const activeOption = page.locator(`[id="${activeOptionId}"]`);
    await expect(activeOption).toHaveRole('option');
    await expect(activeOption).toHaveAccessibleName('Add new year group');

    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: /manage year groups/i })).toBeVisible();
    await expect(createModal).toBeVisible();
    await expectCreateFormSelection(page, 'Select a year group');
  });

  test('Full workflow: Create cohort via Add new and auto-select', async ({ page }) => {
    await openBulkCreateModal(page);
    await openComboboxAndClickAddNew(page, 'Cohort', 'Add new cohort');

    // Wait for Manage Cohorts modal to open
    const cohortsModal = page.getByRole('dialog', { name: /manage cohorts/i });
    await expect(cohortsModal).toBeVisible();

    // Create a new cohort
    const createCohortButton = cohortsModal.getByRole('button', { name: 'Create cohort' });
    await expect(createCohortButton).toBeVisible();
    await createCohortButton.click();

    const form = page.getByRole('dialog', { name: /create cohort/i });
    await expect(form).toBeVisible();

    await form.getByRole('textbox', { name: /name/i }).fill('New Cohort');

    const okButton = form.getByRole('button', { name: 'OK' });
    await expect(okButton).toBeVisible();
    await okButton.click();

    // Wait for modal to close
    await expect(form).toHaveCount(0);

    // Close the Manage Cohorts modal
    await cohortsModal.getByRole('button', { name: /close/i }).click();
    await expect(cohortsModal).toHaveCount(0);

    // Prove creation auto-selected the cohort before opening its dropdown or
    // performing any selection interaction.
    await expectCreateFormSelection(page, 'New Cohort');

    // The created cohort must also remain available as a dropdown option.
    const cohortSelect = page.getByRole('combobox', { name: 'Cohort' });
    await cohortSelect.click();
    await expect(page.getByRole('option', { name: 'New Cohort', exact: true })).toBeVisible();
  });

  test('Add new cohort can reopen its manager without changing the selected cohort', async ({
    page,
  }) => {
    await openBulkCreateModal(page);
    const createModal = page.getByRole('dialog', { name: /create abclass/i });
    const cohortCombobox = page.getByRole('combobox', { name: 'Cohort' });
    await cohortCombobox.click();
    await page.getByRole('option', { name: 'Cohort 2024', exact: true }).click();
    await expectCreateFormSelection(page, 'Cohort 2024');

    await openComboboxAndClickAddNew(page, 'Cohort', 'Add new cohort');
    const cohortManager = page.getByRole('dialog', { name: /manage cohorts/i });
    await expect(cohortManager).toBeVisible();
    await expect(createModal).toBeVisible();
    await cohortManager.getByRole('button', { name: /close/i }).click();
    await expect(cohortManager).toHaveCount(0);
    await expectCreateFormSelection(page, 'Cohort 2024');

    await openComboboxAndClickAddNew(page, 'Cohort', 'Add new cohort');
    await expect(cohortManager).toBeVisible();
    await expect(cohortManager).toHaveCount(1);
    await expect(createModal).toBeVisible();
    await expectCreateFormSelection(page, 'Cohort 2024');
  });

  test('Add new year group can reopen its manager without selecting the command', async ({
    page,
  }) => {
    await openBulkCreateModal(page);
    const createModal = page.getByRole('dialog', { name: /create abclass/i });
    const yearGroupPlaceholder = 'Select a year group';
    await expectCreateFormSelection(page, yearGroupPlaceholder);

    await openComboboxAndClickAddNew(page, 'Year group', 'Add new year group');
    const yearGroupManager = page.getByRole('dialog', { name: /manage year groups/i });
    await expect(yearGroupManager).toBeVisible();
    await expect(createModal).toBeVisible();
    await yearGroupManager.getByRole('button', { name: /close/i }).click();
    await expect(yearGroupManager).toHaveCount(0);
    await expectCreateFormSelection(page, yearGroupPlaceholder);

    await openComboboxAndClickAddNew(page, 'Year group', 'Add new year group');
    await expect(yearGroupManager).toBeVisible();
    await expect(yearGroupManager).toHaveCount(1);
    await expect(createModal).toBeVisible();
    await expectCreateFormSelection(page, yearGroupPlaceholder);
  });
});
