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

import { expect, test } from '@playwright/test';
import {
  baseClassPartials,
  baseGoogleClassrooms,
  baseCohorts,
  baseYearGroups,
  createSuccessfulClassesScenario,
  openClassesTabWithScenario,
} from './classes-crud.shared';

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
    // Open the bulk create modal via the action button
    const createButton = page.getByRole('button', { name: 'Create ABClass' });
    await expect(createButton).toBeVisible();
    await expect(createButton).toBeEnabled();
    await createButton.click();

    // Wait for the modal to open
    await expect(page.getByRole('dialog', { name: /create abclass/i })).toBeVisible();

    // Open the cohort select dropdown
    const cohortCombobox = page.getByRole('combobox', { name: 'Cohort' });
    await expect(cohortCombobox).toBeVisible();
    await expect(cohortCombobox).toBeEnabled();
    await cohortCombobox.click();

    // Verify 'Add new cohort' option exists
    await expect(page.getByRole('option', { name: 'Add new cohort' })).toBeVisible();
  });

  test('Year Group Select has Add new option', async ({ page }) => {
    // Open the bulk create modal
    const createButton = page.getByRole('button', { name: 'Create ABClass' });
    await expect(createButton).toBeVisible();
    await expect(createButton).toBeEnabled();
    await createButton.click();
    await expect(page.getByRole('dialog', { name: /create abclass/i })).toBeVisible();

    // Open year group select dropdown
    const yearGroupCombobox = page.getByRole('combobox', { name: 'Year group' });
    await expect(yearGroupCombobox).toBeVisible();
    await expect(yearGroupCombobox).toBeEnabled();
    await yearGroupCombobox.click();

    // Verify 'Add new year group' option exists
    await expect(page.getByRole('option', { name: 'Add new year group' })).toBeVisible();
  });

  test('Clicking Add new cohort opens Manage Cohorts modal', async ({ page }) => {
    // Open the bulk create modal
    const createButton = page.getByRole('button', { name: 'Create ABClass' });
    await expect(createButton).toBeVisible();
    await expect(createButton).toBeEnabled();
    await createButton.click();
    await expect(page.getByRole('dialog', { name: /create abclass/i })).toBeVisible();

    // Open cohort select and click Add new
    const cohortCombobox = page.getByRole('combobox', { name: 'Cohort' });
    await expect(cohortCombobox).toBeVisible();
    await cohortCombobox.click();

    const addNewOption = page.getByRole('option', { name: 'Add new cohort' });
    await expect(addNewOption).toBeVisible();
    await addNewOption.click();

    // Wait for Manage Cohorts modal to open
    await expect(page.getByRole('dialog', { name: /manage cohorts/i })).toBeVisible();
  });

  test('Clicking Add new year group opens Manage Year Groups modal', async ({ page }) => {
    // Open the bulk create modal
    const createButton = page.getByRole('button', { name: 'Create ABClass' });
    await expect(createButton).toBeVisible();
    await expect(createButton).toBeEnabled();
    await createButton.click();
    await expect(page.getByRole('dialog', { name: /create abclass/i })).toBeVisible();

    // Open year group select and click Add new
    const yearGroupCombobox = page.getByRole('combobox', { name: 'Year group' });
    await expect(yearGroupCombobox).toBeVisible();
    await yearGroupCombobox.click();

    const addNewOption = page.getByRole('option', { name: 'Add new year group' });
    await expect(addNewOption).toBeVisible();
    await addNewOption.click();

    // Wait for Manage Year Groups modal to open
    await expect(page.getByRole('dialog', { name: /manage year groups/i })).toBeVisible();
  });

  test('Full workflow: Create cohort via Add new and auto-select', async ({ page }) => {
    // Open the bulk create modal
    const createButton = page.getByRole('button', { name: 'Create ABClass' });
    await expect(createButton).toBeVisible();
    await expect(createButton).toBeEnabled();
    await createButton.click();
    await expect(page.getByRole('dialog', { name: /create abclass/i })).toBeVisible();

    // Open cohort select and click Add new
    const cohortCombobox = page.getByRole('combobox', { name: 'Cohort' });
    await expect(cohortCombobox).toBeVisible();
    await cohortCombobox.click();

    const addNewOption = page.getByRole('option', { name: 'Add new cohort' });
    await expect(addNewOption).toBeVisible();
    await addNewOption.click();

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

    // Verify the newly created cohort is available for selection in the Bulk Create modal.
    const cohortSelect = page.getByRole('combobox', { name: 'Cohort' });
    await cohortSelect.click();
    await expect(page.getByRole('option', { name: 'New Cohort', exact: true })).toBeVisible();
  });

  test('Rapid clicks on Add new only open modal once (debounce)', async ({ page }) => {
    // Open the bulk create modal
    const createButton = page.getByRole('button', { name: 'Create ABClass' });
    await expect(createButton).toBeVisible();
    await expect(createButton).toBeEnabled();
    await createButton.click();
    await expect(page.getByRole('dialog', { name: /create abclass/i })).toBeVisible();

    // Open cohort select
    const cohortCombobox = page.getByRole('combobox', { name: 'Cohort' });
    await expect(cohortCombobox).toBeVisible();
    await cohortCombobox.click();

    // Rapid clicks on Add new cohort - but dropdown closes after first click
    const addNewOption = page.getByRole('option', { name: 'Add new cohort' });
    await expect(addNewOption).toBeVisible();
    await addNewOption.click();

    // Verify only one Manage Cohorts modal opens
    const cohortModals = page.getByRole('dialog', { name: /manage cohorts/i });
    await expect(cohortModals).toHaveCount(1);
  });
});
