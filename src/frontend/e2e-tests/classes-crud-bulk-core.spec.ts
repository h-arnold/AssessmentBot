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
import {
  baseCohorts,
  baseYearGroups,
  mockClassesCrudRuntime,
  openClassesTab,
  type ClassesCrudRuntimeScenario,
} from './classes-crud.shared';

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
const DEFAULT_MUTATION_QUEUE_LENGTH = 12;

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
  courseLength: 2,
  yearGroupKey: 'year-10',
  classOwner: null,
  teachers: [],
  active: false,
};

/** Class partial for the active class. */
const activeClassPartial = {
  classId: 'gcr-class-active-001',
  className: 'Year 9 English',
  cohortKey: 'cohort-2025',
  courseLength: 1,
  yearGroupKey: 'year-9',
  classOwner: null,
  teachers: [],
  active: true,
};

const secondInactiveGCR = { classId: 'gcr-class-linked-002', className: 'Year 8 Science' };
const secondInactiveClassPartial = {
  ...linkedClassPartial,
  classId: 'gcr-class-linked-002',
  className: 'Year 8 Science',
};
const secondActiveGCR = { classId: 'gcr-class-active-002', className: 'Year 7 Art' };
const secondActiveClassPartial = {
  ...activeClassPartial,
  classId: 'gcr-class-active-002',
  className: 'Year 7 Art',
};

// ---------------------------------------------------------------------------
// Shared harness adapter
// ---------------------------------------------------------------------------

type BulkCoreMutationScenario = Readonly<
  | {
      kind: 'success';
      data?: unknown;
    }
  | {
      kind: 'transportFailure';
      message: string;
    }
  | {
      kind: 'failureEnvelope';
      code?: string;
      message: string;
    }
>;

type BulkCoreScenario = Readonly<{
  /** Google Classrooms to return for all getGoogleClassrooms calls. */
  googleClassrooms: readonly unknown[];
  /** Initial class partials. */
  classPartials: readonly unknown[];
  /** Cohorts returned for getCohorts. */
  cohorts?: readonly unknown[];
  /** Year groups returned for getYearGroups. */
  yearGroups?: readonly unknown[];
  /**
   * Optional second class partials response, served on the second
   * getABClassPartials call (e.g. after a mutation + refetch).
   */
  classPartialsAfterMutation?: readonly unknown[];
  /** Optional queued delete responses. Defaults to success when omitted. */
  deleteABClass?: readonly BulkCoreMutationScenario[];
  /** Optional queued update responses. Defaults to success when omitted. */
  updateABClass?: readonly BulkCoreMutationScenario[];
  /** Optional queued upsert responses. Defaults to success when omitted. */
  upsertABClass?: readonly BulkCoreMutationScenario[];
}>;

/**
 * Builds a padded queue of successful mutation responses.
 *
 * @returns {ReadonlyArray<BulkCoreMutationScenario>} Default success queue.
 */
function buildDefaultMutationQueue(): ReadonlyArray<BulkCoreMutationScenario> {
  return Array.from({ length: DEFAULT_MUTATION_QUEUE_LENGTH }, () => ({ kind: 'success', data: { ok: true } }));
}

/**
 * Maps the bulk-core shorthand scenario onto the shared classes CRUD harness scenario.
 *
 * @param {BulkCoreScenario} scenario Bulk-core shorthand scenario.
 * @returns {ClassesCrudRuntimeScenario} Shared harness scenario.
 */
function toClassesCrudScenario(scenario: BulkCoreScenario): ClassesCrudRuntimeScenario {
  const classPartialsQueue: ClassesCrudRuntimeScenario['getABClassPartials'] = [
    { kind: 'success', data: scenario.classPartials },
  ];

  if (scenario.classPartialsAfterMutation !== undefined) {
    classPartialsQueue.push({ kind: 'success', data: scenario.classPartialsAfterMutation });
  }

  return {
    getAuthorisationStatus: [{ kind: 'success', data: true }],
    getABClassPartials: classPartialsQueue,
    getCohorts: [{ kind: 'success', data: scenario.cohorts ?? baseCohorts }],
    getYearGroups: [{ kind: 'success', data: scenario.yearGroups ?? baseYearGroups }],
    getGoogleClassrooms: [{ kind: 'success', data: scenario.googleClassrooms }],
    deleteABClass: scenario.deleteABClass ?? buildDefaultMutationQueue(),
    updateABClass: scenario.updateABClass ?? buildDefaultMutationQueue(),
    upsertABClass: scenario.upsertABClass ?? buildDefaultMutationQueue(),
  };
}

/**
 * Installs a complete `google.script.run` scenario using the shared classes CRUD harness.
 *
 * @param {Page} page Playwright page under test.
 * @param {BulkCoreScenario} scenario API scenario.
 * @returns {Promise<void>} Resolves when the init script is installed.
 */
async function mockBulkCoreRuntime(page: Page, scenario: BulkCoreScenario): Promise<void> {
  await mockClassesCrudRuntime(page, toClassesCrudScenario(scenario));
}

/**
 * Navigates to the Settings page and activates the Classes tab.
 *
 * @param {Page} page Playwright page under test.
 * @returns {Promise<void>} Resolves once the Classes tab is active and the table is visible.
 */
async function openClassesManagementTab(page: Page): Promise<void> {
  await openClassesTab(page);
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

  test('seeds the bulk create course-length input with the default value of 1', async ({ page }) => {
    await mockBulkCoreRuntime(page, {
      googleClassrooms: [notCreatedGCR],
      classPartials: [],
      cohorts: [
        {
          key: 'cohort-2025',
          name: 'Cohort 2025',
          active: true,
          startYear: 2025,
          startMonth: 9,
        },
      ],
      yearGroups: [
        {
          key: 'year-11',
          name: 'Year 11',
        },
      ],
    });

    await page.goto('/');
    await openClassesManagementTab(page);

    const table = page.getByRole('table', { name: classesTableAriaLabel });
    await table.getByRole('checkbox').first().check();
    await page.getByRole('button', { name: bulkCreateButtonLabel }).click();

    const dialog = page.getByRole('dialog', { name: bulkCreateButtonLabel });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('spinbutton', { name: 'Course length' })).toHaveValue('1');
  });

  test('submitting bulk create creates selected rows and closes the modal', async ({ page }) => {
    await mockBulkCoreRuntime(page, {
      googleClassrooms: [notCreatedGCR],
      classPartials: [],
      classPartialsAfterMutation: [
        {
          classId: notCreatedGCR.classId,
          className: notCreatedGCR.className,
          cohortKey: 'cohort-2025',
          courseLength: 2,
          yearGroupKey: 'year-11',
          classOwner: null,
          teachers: [],
          active: true,
        },
      ],
      cohorts: [
        {
          key: 'cohort-2025',
          name: 'Cohort 2025',
          active: true,
          startYear: 2025,
          startMonth: 9,
        },
      ],
      yearGroups: [
        {
          key: 'year-11',
          name: 'Year 11',
        },
      ],
    });

    await page.goto('/');
    await openClassesManagementTab(page);

    const table = page.getByRole('table', { name: classesTableAriaLabel });
    await table.getByRole('checkbox').first().check();
    await page.getByRole('button', { name: bulkCreateButtonLabel }).click();

    const dialog = page.getByRole('dialog', { name: bulkCreateButtonLabel });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('combobox', { name: 'Cohort' }).click();
    await page.getByRole('option', { name: 'Cohort 2025' }).click();
    await dialog.getByRole('combobox', { name: 'Year group' }).click();
    await page.getByRole('option', { name: 'Year 11' }).click();
    await dialog.getByRole('spinbutton', { name: 'Course length' }).fill('2');
    await dialog.getByRole('button', { name: 'OK' }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('table', { name: classesTableAriaLabel })).toContainText('Cohort 2025');
    await expect(page.getByRole('table', { name: classesTableAriaLabel })).toContainText('Year 11');
    await expect(page.getByRole('button', { name: bulkCreateButtonLabel })).toBeDisabled();
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

test.describe('bulk delete failure feedback', () => {
  test('partial bulk delete failure closes the dialog, keeps failed rows selected, and shows a warning', async ({ page }) => {
    const orphanedPartial = {
      ...linkedClassPartial,
      classId: 'orphaned-class-001',
      className: 'Orphaned Class',
    };
    await mockBulkCoreRuntime(page, {
      googleClassrooms: [activeGCR],
      classPartials: [activeClassPartial, orphanedPartial],
      classPartialsAfterMutation: [orphanedPartial],
      deleteABClass: [
        { kind: 'success' },
        { kind: 'failureEnvelope', message: 'Delete failed.' },
      ],
    });

    await page.goto('/');
    await openClassesManagementTab(page);

    const table = page.getByRole('table', { name: classesTableAriaLabel });
    await table.getByRole('checkbox').first().check();

    await page.getByRole('button', { name: bulkDeleteButtonLabel }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();

    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('Some selected classes were not deleted.')).toBeVisible();
    await expect(page.getByText('1 of 2 selected classes could not be deleted. Successful rows were refreshed. Please review the remaining selection and try again.')).toBeVisible();
    await expect(page.getByText('Selected rows: 1')).toBeVisible();
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

  test('partial Set active failure keeps failed rows selected and shows a warning', async ({ page }) => {
    const activatedPartial = { ...linkedClassPartial, active: true };
    await mockBulkCoreRuntime(page, {
      googleClassrooms: [linkedGCR, secondInactiveGCR],
      classPartials: [linkedClassPartial, secondInactiveClassPartial],
      classPartialsAfterMutation: [activatedPartial, secondInactiveClassPartial],
      updateABClass: [
        { kind: 'success' },
        { kind: 'failureEnvelope', message: 'Activation failed.' },
      ],
    });

    await page.goto('/');
    await openClassesManagementTab(page);

    const table = page.getByRole('table', { name: classesTableAriaLabel });
    await table.getByRole('checkbox').first().check();

    await page.getByRole('button', { name: bulkActivateButtonLabel }).click();

    await expect(page.getByText('Some selected classes were not set to active.')).toBeVisible();
    await expect(page.getByText('1 of 2 selected classes could not be set to active. Successful rows were refreshed. Please review the remaining selection and try again.')).toBeVisible();
    await expect(page.getByText('Selected rows: 1')).toBeVisible();
  });

  test('full Set inactive failure keeps failed rows selected and shows an error', async ({ page }) => {
    await mockBulkCoreRuntime(page, {
      googleClassrooms: [activeGCR, secondActiveGCR],
      classPartials: [activeClassPartial, secondActiveClassPartial],
      updateABClass: [
        { kind: 'failureEnvelope', message: 'Deactivation failed.' },
        { kind: 'failureEnvelope', message: 'Deactivation failed.' },
      ],
    });

    await page.goto('/');
    await openClassesManagementTab(page);

    const table = page.getByRole('table', { name: classesTableAriaLabel });
    await table.getByRole('checkbox').first().check();

    await page.getByRole('button', { name: bulkDeactivateButtonLabel }).click();

    await expect(page.getByText('Could not set selected classes to inactive.')).toBeVisible();
    await expect(page.getByText('Unable to set any of the 2 selected classes to inactive. Please review the remaining selection and try again.')).toBeVisible();
    await expect(page.getByText('Selected rows: 2')).toBeVisible();
  });
});
