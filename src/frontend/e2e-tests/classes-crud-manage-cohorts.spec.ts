/**
 * Classes CRUD — Manage Cohorts browser journey tests.
 *
 * Covers the visible browser interactions for the cohort management modal:
 * - Manage Cohorts button visibility in the Classes tab toolbar
 * - Opening the management modal and viewing the cohort list
 * - Empty state when no cohorts exist
 * - Create cohort flow
 * - Edit cohort flow
 * - Active-state toggle
 * - Delete cohort flow (successful)
 * - Blocked delete (IN_USE) — modal stays open with inline Alert
 */

import { expect, test } from '@playwright/test';
import {
  baseClassPartials,
  baseGoogleClassrooms,
  baseYearGroups,
  createSuccessfulClassesScenario,
  openClassesTabWithScenario,
} from './classes-crud.shared';
import {
  deleteReferenceDataRowAndExpectBlocked,
  deleteReferenceDataRowAndExpectRemoval,
} from './helpers/classes-crud-delete-flow';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const manageCohortsCohorts = [
  {
    key: 'cohort-2025',
    name: 'Cohort 2025',
    active: true,
    startYear: 2025,
    startMonth: 9,
  },
  {
    key: 'cohort-2024',
    name: 'Cohort 2024',
    active: false,
    startYear: 2024,
    startMonth: 9,
  },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Opens the Classes tab with a baseline scenario suitable for cohort management tests.
 *
 * @param {import('@playwright/test').Page} page Playwright page.
 * @param {object} [overrides] Scenario overrides applied after the baseline scenario.
 * @returns {Promise<void>} Resolves once the Classes tab is active.
 */
async function openClassesTabWithCohortManagementScenario(
  page: Parameters<typeof openClassesTabWithScenario>[0],
  overrides: Partial<Parameters<typeof openClassesTabWithScenario>[1]> = {},
) {
  await openClassesTabWithScenario(page, {
    ...createSuccessfulClassesScenario({
      classPartials: baseClassPartials,
      cohorts: manageCohortsCohorts,
      googleClassrooms: baseGoogleClassrooms,
      yearGroups: baseYearGroups,
    }),
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Classes CRUD — Manage Cohorts', () => {
  test('shows a Manage Cohorts button in the Classes tab toolbar', async ({ page }) => {
    await openClassesTabWithCohortManagementScenario(page);

    await expect(page.getByRole('button', { name: 'Manage Cohorts' })).toBeVisible();
  });

  test('opens the cohort management modal when Manage Cohorts is clicked', async ({ page }) => {
    await openClassesTabWithCohortManagementScenario(page);

    await page.getByRole('button', { name: 'Manage Cohorts' }).click();

    await expect(page.getByRole('dialog', { name: /manage cohorts/i })).toBeVisible();
  });

  test('lists cohorts with name, start year, start month, and active state in the management modal', async ({
    page,
  }) => {
    await openClassesTabWithCohortManagementScenario(page);
    await page.getByRole('button', { name: 'Manage Cohorts' }).click();

    const modal = page.getByRole('dialog', { name: /manage cohorts/i });
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Cohort 2025')).toBeVisible();
    await expect(modal.getByText('Cohort 2024')).toBeVisible();
    // Active cohort should have its Switch on; inactive should have it off.
    const rows = modal.getByRole('row');
    // One header row plus one data row per cohort.
    const expectedRowCount = manageCohortsCohorts.length + 1;
    await expect(rows).toHaveCount(expectedRowCount);
  });

  test('shows empty state and a Create cohort button when no cohorts exist', async ({ page }) => {
    await openClassesTabWithScenario(page, {
      ...createSuccessfulClassesScenario({
        classPartials: baseClassPartials,
        cohorts: [],
        googleClassrooms: baseGoogleClassrooms,
        yearGroups: baseYearGroups,
      }),
    });

    await page.getByRole('button', { name: 'Manage Cohorts' }).click();

    const modal = page.getByRole('dialog', { name: /manage cohorts/i });
    await expect(modal).toBeVisible();
    await expect(modal.getByText(/no cohorts/i)).toBeVisible();
    await expect(modal.getByRole('button', { name: /create cohort/i })).toBeVisible();
  });

  test('creates a new cohort and shows it in the list', async ({ page }) => {
    const newCohort = {
      key: 'cohort-2026',
      name: 'Cohort 2026',
      active: true,
      startYear: 2026,
      startMonth: 9,
    };

    await openClassesTabWithScenario(page, {
      ...createSuccessfulClassesScenario({
        classPartials: baseClassPartials,
        cohorts: manageCohortsCohorts,
        googleClassrooms: baseGoogleClassrooms,
        yearGroups: baseYearGroups,
      }),
      createCohort: [{ kind: 'success', data: newCohort }],
      // getCohorts called again after create to refresh the list
      getCohorts: [
        { kind: 'success', data: manageCohortsCohorts },
        { kind: 'success', data: [...manageCohortsCohorts, newCohort] },
      ],
    });

    await page.getByRole('button', { name: 'Manage Cohorts' }).click();
    const modal = page.getByRole('dialog', { name: /manage cohorts/i });
    await expect(modal).toBeVisible();

    await modal.getByRole('button', { name: /create cohort/i }).click();
    const form = page.getByRole('dialog', { name: /create cohort/i });
    await expect(form).toBeVisible();

    await form.getByRole('textbox', { name: /name/i }).fill('Cohort 2026');
    await form.getByRole('button', { name: /ok|save|create/i }).click();

    await expect(form).toHaveCount(0);
    await expect(modal.getByText('Cohort 2026')).toBeVisible();
  });

  test('fails closed in the modal when a successful cohort create cannot refresh trustworthy cohort data', async ({ page }) => {
    const newCohort = {
      key: 'cohort-2026',
      name: 'Cohort 2026',
      active: true,
      startYear: 2026,
      startMonth: 9,
    };

    await openClassesTabWithScenario(page, {
      ...createSuccessfulClassesScenario({
        classPartials: baseClassPartials,
        cohorts: manageCohortsCohorts,
        googleClassrooms: baseGoogleClassrooms,
        yearGroups: baseYearGroups,
      }),
      createCohort: [{ kind: 'success', data: newCohort }],
      getCohorts: [
        { kind: 'success', data: manageCohortsCohorts },
        { kind: 'transportFailure', message: 'Cohorts refresh failed.' },
      ],
    });

    await page.getByRole('button', { name: 'Manage Cohorts' }).click();
    const modal = page.getByRole('dialog', { name: /manage cohorts/i });
    await expect(modal).toBeVisible();

    await modal.getByRole('button', { name: /create cohort/i }).click();
    const form = page.getByRole('dialog', { name: /create cohort/i });
    await expect(form).toBeVisible();

    await form.getByRole('textbox', { name: /name/i }).fill('Cohort 2026');
    await form.getByRole('button', { name: /ok|save|create/i }).click();

    await expect(modal.getByRole('alert')).toContainText('Unable to load cohorts right now.');
    await expect(modal.getByRole('button', { name: /create cohort/i })).toHaveCount(0);
    await expect(modal.getByRole('table', { name: /cohorts/i })).toHaveCount(0);
  });

  test('edits an existing cohort and shows the updated name', async ({ page }) => {
    const updatedCohort = {
      key: 'cohort-2025',
      name: 'Cohort 2025 Revised',
      active: true,
      startYear: 2025,
      startMonth: 9,
    };

    await openClassesTabWithScenario(page, {
      ...createSuccessfulClassesScenario({
        classPartials: baseClassPartials,
        cohorts: manageCohortsCohorts,
        googleClassrooms: baseGoogleClassrooms,
        yearGroups: baseYearGroups,
      }),
      updateCohort: [{ kind: 'success', data: updatedCohort }],
      getCohorts: [
        { kind: 'success', data: manageCohortsCohorts },
        {
          kind: 'success',
          data: [updatedCohort, manageCohortsCohorts[1]],
        },
      ],
    });

    await page.getByRole('button', { name: 'Manage Cohorts' }).click();
    const modal = page.getByRole('dialog', { name: /manage cohorts/i });
    await expect(modal).toBeVisible();

    // Click the Edit button on the first cohort row (Cohort 2025).
    const cohort2025Row = modal.getByRole('row', { name: /cohort 2025/i });
    await cohort2025Row.getByRole('button', { name: /edit/i }).click();

    const form = page.getByRole('dialog', { name: /edit cohort/i });
    await expect(form).toBeVisible();
    await expect(form.getByRole('textbox', { name: /name/i })).not.toHaveValue('');

    await form.getByRole('textbox', { name: /name/i }).fill('Cohort 2025 Revised');
    await form.getByRole('button', { name: /ok|save|update/i }).click();

    await expect(form).toHaveCount(0);
    await expect(modal.getByText('Cohort 2025 Revised')).toBeVisible();
  });

  test('toggles the active state of a cohort via its row Switch', async ({ page }) => {
    const toggledCohort = {
      key: 'cohort-2025',
      name: 'Cohort 2025',
      active: false,
      startYear: 2025,
      startMonth: 9,
    };

    await openClassesTabWithScenario(page, {
      ...createSuccessfulClassesScenario({
        classPartials: baseClassPartials,
        cohorts: manageCohortsCohorts,
        googleClassrooms: baseGoogleClassrooms,
        yearGroups: baseYearGroups,
      }),
      updateCohort: [{ kind: 'success', data: toggledCohort }],
      getCohorts: [
        { kind: 'success', data: manageCohortsCohorts },
        {
          kind: 'success',
          data: [toggledCohort, manageCohortsCohorts[1]],
        },
      ],
    });

    await page.getByRole('button', { name: 'Manage Cohorts' }).click();
    const modal = page.getByRole('dialog', { name: /manage cohorts/i });
    await expect(modal).toBeVisible();

    const cohort2025Row = modal.getByRole('row', { name: /cohort 2025/i });
    const activeSwitch = cohort2025Row.getByRole('switch');
    await expect(activeSwitch).toBeChecked();

    await activeSwitch.click();

    await expect(activeSwitch).not.toBeChecked();
  });

  test('deletes a cohort and removes it from the list', async ({ page }) => {
    await openClassesTabWithScenario(page, {
      ...createSuccessfulClassesScenario({
        classPartials: baseClassPartials,
        cohorts: manageCohortsCohorts,
        googleClassrooms: baseGoogleClassrooms,
        yearGroups: baseYearGroups,
      }),
      deleteCohort: [{ kind: 'success', data: undefined }],
      getCohorts: [
        { kind: 'success', data: manageCohortsCohorts },
        { kind: 'success', data: [manageCohortsCohorts[1]] },
      ],
    });

    await deleteReferenceDataRowAndExpectRemoval(page, {
      managementButtonName: 'Manage Cohorts',
      managementDialogName: /manage cohorts/i,
      rowName: /cohort 2025/i,
      deleteDialogName: /delete cohort/i,
      removedText: 'Cohort 2025',
      remainingText: 'Cohort 2024',
    });
  });

  test('keeps the delete dialog open with an inline Alert when delete is blocked because the cohort is in use', async ({
    page,
  }) => {
    await openClassesTabWithScenario(page, {
      ...createSuccessfulClassesScenario({
        classPartials: baseClassPartials,
        cohorts: manageCohortsCohorts,
        googleClassrooms: baseGoogleClassrooms,
        yearGroups: baseYearGroups,
      }),
      deleteCohort: [
        {
          kind: 'failureEnvelope',
          code: 'IN_USE',
          message: 'Cohort is in use by one or more classes and cannot be deleted.',
        },
      ],
    });

    await deleteReferenceDataRowAndExpectBlocked(page, {
      managementButtonName: 'Manage Cohorts',
      managementDialogName: /manage cohorts/i,
      rowName: /cohort 2025/i,
      deleteDialogName: /delete cohort/i,
    });
  });

  test('closes the management modal via its close control', async ({ page }) => {
    await openClassesTabWithCohortManagementScenario(page);

    await page.getByRole('button', { name: 'Manage Cohorts' }).click();
    const modal = page.getByRole('dialog', { name: /manage cohorts/i });
    await expect(modal).toBeVisible();

    await modal.getByRole('button', { name: /close/i }).click();

    await expect(modal).toHaveCount(0);
  });
});
