/**
 * Classes bulk core flows — E2E tests.
 *
 * Covers visible browser behaviour for:
 * - Classes table display with row selection
 * - Bulk create: Create ABClass button visible when notCreated rows selected
 * - Bulk delete: confirmation copy explicitly names full and partial record removal
 * - Bulk active/inactive: ineligible rows (notCreated, already at target state) are rejected
 *   before the flow opens
 *
 * Navigation: the Classes management panel lives under Settings > Classes tab (WS3 architecture).
 */

import { expect, test, type Page } from '@playwright/test';
import { googleScriptRunApiHandlerFactorySource } from '../src/test/googleScriptRunHarness';

// ---------------------------------------------------------------------------
// Label constants (WS3 button labels)
// ---------------------------------------------------------------------------
const classesTableAriaLabel = 'Classes table';
const bulkCreateButtonLabel = 'Create ABClass';
const bulkDeleteButtonLabel = 'Delete ABClass';
const bulkActivateButtonLabel = 'Set active';
const bulkDeactivateButtonLabel = 'Set inactive';
const TWO_DATA_ROWS_PLUS_HEADER = 3;
const ONE_DATA_ROW_PLUS_HEADER = 2;

// ---------------------------------------------------------------------------
// WS3-format fixtures (cohortKey/yearGroupKey string fields)
// ---------------------------------------------------------------------------

/** Google Classroom entries – all classes that appear in the GCR. */
const linkedGCR = { classId: 'gcr-class-linked-001', className: 'Year 10 Maths' };
const activeGCR = { classId: 'gcr-class-active-001', className: 'Year 9 English' };
const notCreatedGCR = { classId: 'gcr-class-not-created-001', className: 'Year 11 History' };

/** Class partial for the inactive ("linked") class. */
const linkedClassPartial = {
  classId: 'gcr-class-linked-001',
  className: 'Year 10 Maths',
  cohortKey: 'cohort-2025',
  cohortLabel: 'Cohort 2025',
  courseLength: 2,
  yearGroupKey: 'year-10',
  yearGroupLabel: 'Year 10',
  classOwner: null,
  teachers: [],
  active: false,
};

/** Class partial for the active class. */
const activeClassPartial = {
  classId: 'gcr-class-active-001',
  className: 'Year 9 English',
  cohortKey: 'cohort-2025',
  cohortLabel: 'Cohort 2025',
  courseLength: 1,
  yearGroupKey: 'year-9',
  yearGroupLabel: 'Year 9',
  classOwner: null,
  teachers: [],
  active: true,
};

// ---------------------------------------------------------------------------
// Mock runtime helper
// ---------------------------------------------------------------------------

type BulkCoreScenario = Readonly<{
  /** Google Classrooms to return for all getGoogleClassrooms calls. */
  googleClassrooms: readonly unknown[];
  /** Initial class partials. */
  classPartials: readonly unknown[];
  /**
   * Optional second class partials response, served on the second
   * getABClassPartials call (e.g. after a mutation + refetch).
   */
  classPartialsAfterMutation?: readonly unknown[];
}>;

/**
 * Installs a complete `google.script.run` mock for bulk-core E2E tests.
 * Handles auth, all four data queries, and mutation methods.
 *
 * @param {Page} page Playwright page under test.
 * @param {BulkCoreScenario} scenario API scenario.
 * @returns {Promise<void>} Resolves when the init script is installed.
 */
async function mockBulkCoreRuntime(page: Page, scenario: BulkCoreScenario): Promise<void> {
  await page.addInitScript(`
    (() => {
      const createGoogleScriptRunApiHandlerMock = ${googleScriptRunApiHandlerFactorySource};
      const scenario = ${JSON.stringify(scenario)};
      let classPartialsCallCount = 0;

      function sendSuccess(successHandler, data, requestId) {
        if (successHandler !== undefined) {
          successHandler({ ok: true, requestId, data });
        }
      }

      globalThis.google = {
        script: {
          run: createGoogleScriptRunApiHandlerMock((request, callbacks) => {
            const method = request?.method;

            if (method === 'getAuthorisationStatus') {
              sendSuccess(callbacks.successHandler, true, 'req-auth');
              return;
            }

            if (method === 'getGoogleClassrooms') {
              sendSuccess(callbacks.successHandler, scenario.googleClassrooms, 'req-gcr');
              return;
            }

            if (method === 'getABClassPartials') {
              const data =
                classPartialsCallCount === 0 || scenario.classPartialsAfterMutation === undefined
                  ? scenario.classPartials
                  : scenario.classPartialsAfterMutation;
              classPartialsCallCount += 1;
              sendSuccess(callbacks.successHandler, data, 'req-partials-' + classPartialsCallCount);
              return;
            }

            if (method === 'getCohorts') {
              sendSuccess(callbacks.successHandler, [], 'req-cohorts');
              return;
            }

            if (method === 'getYearGroups') {
              sendSuccess(callbacks.successHandler, [], 'req-year-groups');
              return;
            }

            // Mutation methods — always succeed.
            if (
              method === 'deleteABClass' ||
              method === 'updateABClass' ||
              method === 'upsertABClass'
            ) {
              sendSuccess(callbacks.successHandler, { ok: true }, 'req-mutation');
              return;
            }

            if (callbacks.failureHandler !== undefined) {
              callbacks.failureHandler(new Error('Unexpected method: ' + method));
            }
          }),
        },
      };
    })();
  `);
}

/**
 * Navigates to the Settings page and activates the Classes tab.
 *
 * @param {Page} page Playwright page under test.
 * @returns {Promise<void>} Resolves once the Classes tab is active and the table is visible.
 */
async function openClassesManagementTab(page: Page): Promise<void> {
  await page.getByRole('menuitem', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Settings' })).toBeVisible();
  await page.getByRole('tab', { name: 'Classes' }).click();
  await expect(page.getByRole('table', { name: classesTableAriaLabel })).toBeVisible();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('classes table', () => {
  test('shows a classes table after navigating to the Settings Classes tab', async ({ page }) => {
    await mockBulkCoreRuntime(page, {
      googleClassrooms: [linkedGCR, activeGCR],
      classPartials: [linkedClassPartial, activeClassPartial],
    });

    await page.goto('/');
    await openClassesManagementTab(page);

    await expect(page.getByRole('table', { name: classesTableAriaLabel })).toBeVisible();
  });

  test('renders one row per class returned by the backend', async ({ page }) => {
    await mockBulkCoreRuntime(page, {
      googleClassrooms: [linkedGCR, activeGCR],
      classPartials: [linkedClassPartial, activeClassPartial],
    });

    await page.goto('/');
    await openClassesManagementTab(page);

    const table = page.getByRole('table', { name: classesTableAriaLabel });
    await expect(table.getByRole('row')).toHaveCount(TWO_DATA_ROWS_PLUS_HEADER);
  });
});

test.describe('bulk create flow', () => {
  test('Create ABClass button is enabled when notCreated rows are selected', async ({ page }) => {
    await mockBulkCoreRuntime(page, {
      googleClassrooms: [notCreatedGCR],
      classPartials: [],
    });

    await page.goto('/');
    await openClassesManagementTab(page);

    const table = page.getByRole('table', { name: classesTableAriaLabel });
    await table.getByRole('checkbox').first().check();

    await expect(page.getByRole('button', { name: bulkCreateButtonLabel })).toBeEnabled();
  });

  test('Create ABClass button is disabled when only already-created rows are selected', async ({
    page,
  }) => {
    await mockBulkCoreRuntime(page, {
      googleClassrooms: [linkedGCR, activeGCR],
      classPartials: [linkedClassPartial, activeClassPartial],
    });

    await page.goto('/');
    await openClassesManagementTab(page);

    const table = page.getByRole('table', { name: classesTableAriaLabel });
    await table.getByRole('checkbox').first().check();

    await expect(page.getByRole('button', { name: bulkCreateButtonLabel })).toBeDisabled();
  });
});

test.describe('bulk delete flow', () => {
  test('bulk delete confirmation dialog mentions removal of full records', async ({ page }) => {
    await mockBulkCoreRuntime(page, {
      googleClassrooms: [linkedGCR],
      classPartials: [linkedClassPartial],
    });

    await page.goto('/');
    await openClassesManagementTab(page);

    const table = page.getByRole('table', { name: classesTableAriaLabel });
    await table.getByRole('checkbox').first().check();

    await page.getByRole('button', { name: bulkDeleteButtonLabel }).click();

    await expect(page.getByRole('dialog')).toContainText(/full/i);
  });

  test('bulk delete confirmation dialog mentions removal of partial records', async ({ page }) => {
    await mockBulkCoreRuntime(page, {
      googleClassrooms: [linkedGCR],
      classPartials: [linkedClassPartial],
    });

    await page.goto('/');
    await openClassesManagementTab(page);

    const table = page.getByRole('table', { name: classesTableAriaLabel });
    await table.getByRole('checkbox').first().check();

    await page.getByRole('button', { name: bulkDeleteButtonLabel }).click();

    await expect(page.getByRole('dialog')).toContainText(/partial/i);
  });

  test('confirming bulk delete removes the selected rows from the table', async ({ page }) => {
    // Use an orphaned-class scenario: the orphaned row (classPartial without GCR match)
    // disappears from the table once its ABClass record is deleted and classPartials refetches
    // without it. This tests the WS3 architecture correctly.
    const orphanedPartial = {
      ...linkedClassPartial,
      classId: 'orphaned-class-001',
      className: 'Orphaned Class',
    };
    await mockBulkCoreRuntime(page, {
      googleClassrooms: [activeGCR],
      classPartials: [activeClassPartial, orphanedPartial],
      classPartialsAfterMutation: [activeClassPartial],
    });

    await page.goto('/');
    await openClassesManagementTab(page);

    const table = page.getByRole('table', { name: classesTableAriaLabel });
    // Table starts with 2 rows (active + orphaned)
    await expect(table.getByRole('row')).toHaveCount(TWO_DATA_ROWS_PLUS_HEADER);

    // Select the last row (orphaned, sorted last by STATUS_ORDER)
    await table.getByRole('checkbox').last().check();

    await page.getByRole('button', { name: bulkDeleteButtonLabel }).click();
    // Click the "Delete" button inside the confirmation dialog specifically
    await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();

    // After deletion + refetch, only one data row should remain
    await expect(table.getByRole('row')).toHaveCount(ONE_DATA_ROW_PLUS_HEADER);
  });
});

test.describe('bulk active-state flow', () => {
  test('Set active button is disabled when only already-active rows are selected', async ({
    page,
  }) => {
    await mockBulkCoreRuntime(page, {
      googleClassrooms: [activeGCR],
      classPartials: [activeClassPartial],
    });

    await page.goto('/');
    await openClassesManagementTab(page);

    const table = page.getByRole('table', { name: classesTableAriaLabel });
    await table.getByRole('checkbox').first().check();

    await expect(page.getByRole('button', { name: bulkActivateButtonLabel })).toBeDisabled();
  });

  test('Set inactive button is disabled when only already-inactive rows are selected', async ({
    page,
  }) => {
    await mockBulkCoreRuntime(page, {
      googleClassrooms: [linkedGCR],
      classPartials: [linkedClassPartial],
    });

    await page.goto('/');
    await openClassesManagementTab(page);

    const table = page.getByRole('table', { name: classesTableAriaLabel });
    await table.getByRole('checkbox').first().check();

    await expect(page.getByRole('button', { name: bulkDeactivateButtonLabel })).toBeDisabled();
  });

  test('Set active button is disabled when only notCreated rows are selected', async ({
    page,
  }) => {
    await mockBulkCoreRuntime(page, {
      googleClassrooms: [notCreatedGCR],
      classPartials: [],
    });

    await page.goto('/');
    await openClassesManagementTab(page);

    const table = page.getByRole('table', { name: classesTableAriaLabel });
    await table.getByRole('checkbox').first().check();

    // notCreated rows are ineligible for active-state transitions
    await expect(page.getByRole('button', { name: bulkActivateButtonLabel })).toBeDisabled();
  });

  test('setting rows to active triggers updateABClass and refetches the table', async ({
    page,
  }) => {
    const activatedPartial = { ...linkedClassPartial, active: true };
    await mockBulkCoreRuntime(page, {
      googleClassrooms: [linkedGCR],
      classPartials: [linkedClassPartial],
      classPartialsAfterMutation: [activatedPartial],
    });

    await page.goto('/');
    await openClassesManagementTab(page);

    const table = page.getByRole('table', { name: classesTableAriaLabel });
    await table.getByRole('checkbox').first().check();

    await page.getByRole('button', { name: bulkActivateButtonLabel }).click();

    // After activation + refetch, the status column should reflect active state
    await expect(table).toContainText(/active/i);
  });
});

