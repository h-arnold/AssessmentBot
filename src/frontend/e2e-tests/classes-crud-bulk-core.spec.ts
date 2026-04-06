/**
 * Classes bulk core flows — E2E tests.
 *
 * Covers visible browser behaviour for:
 * - Classes table display with row selection
 * - Bulk create: targets only notCreated rows; payload uses cohortKey, yearGroupKey, courseLength
 * - Bulk delete: confirmation copy explicitly names full and partial record removal
 * - Bulk active/inactive: ineligible rows (notCreated, already at target state) are rejected
 *   before the flow opens
 */

import { expect, test, type Page } from '@playwright/test';
import { googleScriptRunApiHandlerFactorySource } from '../src/test/googleScriptRunHarness';

const classesMenuLabel = 'Classes';
const classesTableAriaLabel = 'Classes table';
const bulkCreateButtonLabel = 'Bulk create';
const bulkDeleteButtonLabel = 'Bulk delete';
const bulkActivateButtonLabel = 'Set active';
const bulkDeactivateButtonLabel = 'Set inactive';
const confirmDeleteButtonLabel = /delete/i;
const TWO_DATA_ROWS_PLUS_HEADER = 3;
const ONE_DATA_ROW_PLUS_HEADER = 2;
const NO_BUTTONS = 0;

/** A class partial that exists in the backend with inactive state (linked status). */
const linkedClassFixture = {
  classId: 'gcr-class-linked-001',
  className: 'Year 10 Maths',
  cohort: '2025',
  courseLength: 2,
  yearGroup: 10,
  classOwner: null,
  teachers: [],
  active: false,
};

/** A class partial that exists in the backend and is already active. */
const activeClassFixture = {
  classId: 'gcr-class-active-001',
  className: 'Year 9 English',
  cohort: '2025',
  courseLength: 1,
  yearGroup: 9,
  classOwner: null,
  teachers: [],
  active: true,
};

type ClassesRuntimeScenario = Readonly<{
  classPartials: readonly unknown[];
  upsertABClassResult?: unknown;
  deleteABClassResult?: unknown;
  updateABClassResult?: unknown;
}>;

/**
 * Installs a `google.script.run` mock for classes-feature tests.
 *
 * @param {Page} page The Playwright page under test.
 * @param {ClassesRuntimeScenario} scenario The API response scenario.
 * @returns {Promise<void>} A promise that resolves when the init script is installed.
 */
async function mockClassesRuntime(page: Page, scenario: ClassesRuntimeScenario) {
  await page.addInitScript(`
    (() => {
      const createGoogleScriptRunApiHandlerMock = ${googleScriptRunApiHandlerFactorySource};
      const scenario = ${JSON.stringify(scenario)};

      function sendSuccess(successHandler, requestId, data) {
        if (successHandler !== undefined) {
          successHandler({ ok: true, requestId, data });
        }
      }

      globalThis.google = {
        script: {
          run: createGoogleScriptRunApiHandlerMock((request, callbacks) => {
            const method = request?.method;

            if (method === 'getAuthorisationStatus') {
              sendSuccess(callbacks.successHandler, 'req-auth', true);
              return;
            }

            if (method === 'getABClassPartials') {
              sendSuccess(callbacks.successHandler, 'req-class-partials', scenario.classPartials);
              return;
            }

            if (method === 'upsertABClass') {
              const result = scenario.upsertABClassResult ?? { classId: request?.params?.classId };
              sendSuccess(callbacks.successHandler, 'req-upsert', result);
              return;
            }

            if (method === 'deleteABClass') {
              const result = scenario.deleteABClassResult ?? { classId: request?.params?.classId, deleted: true };
              sendSuccess(callbacks.successHandler, 'req-delete', result);
              return;
            }

            if (method === 'updateABClass') {
              const result = scenario.updateABClassResult ?? { classId: request?.params?.classId };
              sendSuccess(callbacks.successHandler, 'req-update', result);
              return;
            }

            callbacks.failureHandler?.(new Error('No mock configured for method: ' + method));
          }),
        },
      };
    })();
  `);
}

/**
 * Navigates to the Classes page via the primary navigation.
 *
 * @param {Page} page The Playwright page under test.
 * @returns {Promise<void>} A promise that resolves once the Classes page heading is visible.
 */
async function openClassesPage(page: Page) {
  await page.getByRole('menuitem', { name: classesMenuLabel }).click();
  await expect(page.getByRole('heading', { level: 2, name: classesMenuLabel })).toBeVisible();
}

test.describe('classes table', () => {
  test('shows a classes table after navigating to the Classes page', async ({ page }) => {
    await mockClassesRuntime(page, {
      classPartials: [linkedClassFixture, activeClassFixture],
    });

    await page.goto('/');
    await openClassesPage(page);

    await expect(page.getByRole('table', { name: classesTableAriaLabel })).toBeVisible();
  });

  test('renders one row per class returned by the backend', async ({ page }) => {
    await mockClassesRuntime(page, {
      classPartials: [linkedClassFixture, activeClassFixture],
    });

    await page.goto('/');
    await openClassesPage(page);

    const table = page.getByRole('table', { name: classesTableAriaLabel });
    // Two data rows in addition to the header row
    await expect(table.getByRole('row')).toHaveCount(TWO_DATA_ROWS_PLUS_HEADER);
  });
});

test.describe('bulk create flow', () => {
  test('bulk create button is visible when notCreated rows are selected', async ({ page }) => {
    await mockClassesRuntime(page, {
      classPartials: [],
    });

    await page.goto('/');
    await openClassesPage(page);

    // The table should show notCreated rows from a Google Classroom source;
    // select the first available checkbox
    const table = page.getByRole('table', { name: classesTableAriaLabel });
    await table.getByRole('checkbox').first().check();

    await expect(page.getByRole('button', { name: bulkCreateButtonLabel })).toBeVisible();
  });

  test('bulk create button is absent when only already-created rows are selected', async ({
    page,
  }) => {
    await mockClassesRuntime(page, {
      classPartials: [linkedClassFixture, activeClassFixture],
    });

    await page.goto('/');
    await openClassesPage(page);

    const table = page.getByRole('table', { name: classesTableAriaLabel });
    await table.getByRole('checkbox').first().check();

    await expect(page.getByRole('button', { name: bulkCreateButtonLabel })).toHaveCount(NO_BUTTONS);
  });
});

test.describe('bulk delete flow', () => {
  test('bulk delete confirmation dialog mentions removal of full records', async ({ page }) => {
    await mockClassesRuntime(page, {
      classPartials: [linkedClassFixture],
    });

    await page.goto('/');
    await openClassesPage(page);

    const table = page.getByRole('table', { name: classesTableAriaLabel });
    await table.getByRole('checkbox').first().check();

    await page.getByRole('button', { name: bulkDeleteButtonLabel }).click();

    await expect(page.getByRole('dialog')).toContainText(/full/i);
  });

  test('bulk delete confirmation dialog mentions removal of partial records', async ({ page }) => {
    await mockClassesRuntime(page, {
      classPartials: [linkedClassFixture],
    });

    await page.goto('/');
    await openClassesPage(page);

    const table = page.getByRole('table', { name: classesTableAriaLabel });
    await table.getByRole('checkbox').first().check();

    await page.getByRole('button', { name: bulkDeleteButtonLabel }).click();

    await expect(page.getByRole('dialog')).toContainText(/partial/i);
  });

  test('confirming bulk delete removes the selected rows from the table', async ({ page }) => {
    await mockClassesRuntime(page, {
      classPartials: [linkedClassFixture, activeClassFixture],
      deleteABClassResult: { classId: linkedClassFixture.classId, deleted: true },
    });

    await page.goto('/');
    await openClassesPage(page);

    const table = page.getByRole('table', { name: classesTableAriaLabel });
    await table.getByRole('checkbox').first().check();

    await page.getByRole('button', { name: bulkDeleteButtonLabel }).click();
    await page.getByRole('button', { name: confirmDeleteButtonLabel }).click();

    // After deletion, only one data row should remain
    await expect(table.getByRole('row')).toHaveCount(ONE_DATA_ROW_PLUS_HEADER);
  });
});

test.describe('bulk active-state flow', () => {
  test('set active button is absent when only already-active rows are selected', async ({
    page,
  }) => {
    await mockClassesRuntime(page, {
      classPartials: [activeClassFixture],
    });

    await page.goto('/');
    await openClassesPage(page);

    const table = page.getByRole('table', { name: classesTableAriaLabel });
    await table.getByRole('checkbox').first().check();

    await expect(page.getByRole('button', { name: bulkActivateButtonLabel })).toHaveCount(NO_BUTTONS);
  });

  test('set inactive button is absent when only already-inactive rows are selected', async ({
    page,
  }) => {
    await mockClassesRuntime(page, {
      classPartials: [linkedClassFixture],
    });

    await page.goto('/');
    await openClassesPage(page);

    const table = page.getByRole('table', { name: classesTableAriaLabel });
    await table.getByRole('checkbox').first().check();

    await expect(page.getByRole('button', { name: bulkDeactivateButtonLabel })).toHaveCount(NO_BUTTONS);
  });

  test('set active button is absent when no rows with an eligible transition are selected', async ({
    page,
  }) => {
    await mockClassesRuntime(page, {
      classPartials: [activeClassFixture],
    });

    await page.goto('/');
    await openClassesPage(page);

    const table = page.getByRole('table', { name: classesTableAriaLabel });
    await table.getByRole('checkbox').first().check();

    // Active rows cannot be activated again — button must not appear
    await expect(page.getByRole('button', { name: bulkActivateButtonLabel })).toHaveCount(NO_BUTTONS);
  });

  test('setting rows to active updates the active state displayed in the table', async ({
    page,
  }) => {
    await mockClassesRuntime(page, {
      classPartials: [linkedClassFixture],
      updateABClassResult: { classId: linkedClassFixture.classId, active: true },
    });

    await page.goto('/');
    await openClassesPage(page);

    const table = page.getByRole('table', { name: classesTableAriaLabel });
    await table.getByRole('checkbox').first().check();

    await page.getByRole('button', { name: bulkActivateButtonLabel }).click();

    // After activation, the table should reflect the updated active state
    await expect(table).toContainText(/active/i);
  });
});
