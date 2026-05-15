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
import { mockCohorts, mockYearGroups } from '../src/test/assignmentDefinition/sharedTestFixtures';
import { googleScriptRunApiHandlerFactorySource } from '../src/test/googleScriptRunHarness';

// ---------------------------------------------------------------------------
// Runtime Mock
// ---------------------------------------------------------------------------

/**
 * Installs a browser-side `google.script.run` mock for reference data CRUD.
 *
 * @param {import('@playwright/test').Page} page Playwright page.
 * @returns {Promise<void>} A promise that resolves once the init script is installed.
 */
async function mockReferenceDataCrudRuntime(
  page: Parameters<typeof mockReferenceDataCrudRuntime>[0]
) {
  await page.addInitScript(`
    (() => {
      const createGoogleScriptRunApiHandlerMock = ${googleScriptRunApiHandlerFactorySource};

      function sendSuccess(handler, data, requestId) {
        if (handler !== undefined) {
          handler({ ok: true, requestId, data });
        }
      }

      function sendError(handler, message, requestId) {
        if (handler !== undefined) {
          handler({ ok: false, requestId, error: message });
        }
      }

      globalThis.google = {
        script: {
          run: createGoogleScriptRunApiHandlerMock((request, callbacks) => {
            const method = request?.method;

            if (method === 'getAuthorisationStatus') {
              sendSuccess(callbacks.successHandler, true, 'req-auth-status');
              return;
            }

            if (method === 'getABClassPartials') {
              sendSuccess(callbacks.successHandler, [], 'req-class-partials');
              return;
            }

            if (method === 'getBackendConfig') {
              sendSuccess(callbacks.successHandler, {}, 'req-backend-config');
              return;
            }

            if (method === 'getCohorts') {
              sendSuccess(callbacks.successHandler, ${JSON.stringify(mockCohorts)}, 'req-cohorts');
              return;
            }

            if (method === 'getYearGroups') {
              sendSuccess(callbacks.successHandler, ${JSON.stringify(mockYearGroups)}, 'req-year-groups');
              return;
            }

            if (method === 'createCohort') {
              const newCohort = { key: 'new-cohort-1', name: 'New Cohort', active: true, startYear: 2025, startMonth: 9 };
              sendSuccess(callbacks.successHandler, newCohort, 'req-create-cohort');
              return;
            }

            if (method === 'createYearGroup') {
              const newYearGroup = { key: 'new-year-group-1', name: 'New Year Group' };
              sendSuccess(callbacks.successHandler, newYearGroup, 'req-create-year-group');
              return;
            }

            callbacks.failureHandler?.(new Error('No mocked response configured for method: ' + String(method)));
          }),
        },
      };
    })();
  `);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('SelectWithAddNew Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await mockReferenceDataCrudRuntime(page);
    await page.goto('/classes');
  });

  test('Cohort Select has Add new option', async ({ page }) => {
    // Open the bulk create modal via the action button
    await page.getByRole('button', { name: /create abclass/i }).click();

    // Wait for the modal to open
    await expect(page.getByRole('dialog', { name: /create abclass/i })).toBeVisible();

    // Open the cohort select dropdown
    await page.getByRole('combobox', { name: 'Cohort' }).click();

    // Verify 'Add new cohort' option exists with PlusOutlined icon
    await expect(page.getByText('Add new cohort')).toBeVisible();
  });

  test('Year Group Select has Add new option', async ({ page }) => {
    // Open the bulk create modal
    await page.getByRole('button', { name: /create abclass/i }).click();
    await expect(page.getByRole('dialog', { name: /create abclass/i })).toBeVisible();

    // Open the year group select dropdown
    await page.getByRole('combobox', { name: 'Year group' }).click();

    // Verify 'Add new year group' option exists
    await expect(page.getByText('Add new year group')).toBeVisible();
  });

  test('Clicking Add new cohort opens Manage Cohorts modal', async ({ page }) => {
    // Open the bulk create modal
    await page.getByRole('button', { name: /create abclass/i }).click();
    await expect(page.getByRole('dialog', { name: /create abclass/i })).toBeVisible();

    // Open cohort select and click Add new
    await page.getByRole('combobox', { name: 'Cohort' }).click();
    await page.getByText('Add new cohort').click();

    // Wait for Manage Cohorts modal to open
    await expect(page.getByRole('dialog', { name: /manage cohorts/i })).toBeVisible();
  });

  test('Clicking Add new year group opens Manage Year Groups modal', async ({ page }) => {
    // Open the bulk create modal
    await page.getByRole('button', { name: /create abclass/i }).click();
    await expect(page.getByRole('dialog', { name: /create abclass/i })).toBeVisible();

    // Open year group select and click Add new
    await page.getByRole('combobox', { name: 'Year group' }).click();
    await page.getByText('Add new year group').click();

    // Wait for Manage Year Groups modal to open
    await expect(page.getByRole('dialog', { name: /manage year groups/i })).toBeVisible();
  });

  test('Full workflow: Create cohort via Add new and auto-select', async ({ page }) => {
    // Open the bulk create modal
    await page.getByRole('button', { name: /create abclass/i }).click();
    await expect(page.getByRole('dialog', { name: /create abclass/i })).toBeVisible();

    // Open cohort select and click Add new
    await page.getByRole('combobox', { name: 'Cohort' }).click();
    await page.getByText('Add new cohort').click();

    // Wait for Manage Cohorts modal to open
    await expect(page.getByRole('dialog', { name: /manage cohorts/i })).toBeVisible();

    // Create a new cohort
    await page.getByRole('button', { name: /create cohort/i }).click();
    await page.getByRole('textbox', { name: /name/i }).fill('New Cohort');
    await page.getByRole('button', { name: /ok/i }).click();

    // Wait for modal to close and cohort to be selected in the original modal
    await expect(page.getByRole('dialog', { name: /manage cohorts/i })).not.toBeVisible();

    // Verify the new cohort is selected in the Bulk Create modal
    // Note: This verifies the onEntityCreated callback wired the selection
    const cohortSelect = page.getByRole('combobox', { name: 'Cohort' });
    await expect(cohortSelect).toHaveValue('new-cohort-1');
  });

  test('Rapid clicks on Add new only open modal once (debounce)', async ({ page }) => {
    // Open the bulk create modal
    await page.getByRole('button', { name: /create abclass/i }).click();
    await expect(page.getByRole('dialog', { name: /create abclass/i })).toBeVisible();

    // Open cohort select
    await page.getByRole('combobox', { name: 'Cohort' }).click();

    // Rapid clicks on Add new cohort
    const addNewOption = page.getByText('Add new cohort');
    await addNewOption.click();
    await addNewOption.click();
    await addNewOption.click();

    // Verify only one Manage Cohorts modal opens
    const cohortModals = page.getByRole('dialog', { name: /manage cohorts/i });
    await expect(cohortModals).toHaveCount(1);
  });
});
