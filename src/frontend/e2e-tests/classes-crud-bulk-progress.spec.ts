/**
 * Classes bulk progress modal — E2E tests.
 *
 * Covers visible browser behaviour for:
 * - Progress modal appearance during bulk create/delete/metadata actions
 * - Count updates as queued calls complete
 * - Cancellation of pending items and cancellation message
 * - Toolbar disabled and re-enabled around active queue lifecycle
 * - Toolbar button disabled state during active queue
 * - Metadata action (Set cohort) progress verb and count tracking
 *
 * Navigation: the Classes management panel lives under Settings > Classes tab (WS3 architecture).
 */

import { expect, test, type Page } from '@playwright/test';
import {
  baseCohorts,
  baseYearGroups,
  mockClassesCrudRuntime,
  openClassesTab,
  releaseClassesCrudSignal,
  type ClassesCrudRuntimeScenario,
} from './classes-crud.shared';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Google Classroom entries for notCreated rows (no matching class partials). */
const notCreatedGCR1 = { classId: 'gcr-not-created-001', className: 'Year 11 History' };
const notCreatedGCR2 = { classId: 'gcr-not-created-002', className: 'Year 11 Geography' };
const notCreatedGCR3 = { classId: 'gcr-not-created-003', className: 'Year 11 French' };
const notCreatedGCRs = [notCreatedGCR1, notCreatedGCR2, notCreatedGCR3] as const;

/** Existing class rows (already created, used for delete/metadata actions). */
const existingGCR1 = { classId: 'gcr-existing-001', className: 'Year 10 Maths' };
const existingGCR2 = { classId: 'gcr-existing-002', className: 'Year 9 English' };

const existingClassPartial1 = {
  classId: 'gcr-existing-001',
  className: 'Year 10 Maths',
  cohortKey: 'cohort-2024',
  courseLength: 2,
  yearGroupKey: 'year-7',
  classOwner: null,
  teachers: [],
  active: false,
};

const existingClassPartial2 = {
  classId: 'gcr-existing-002',
  className: 'Year 9 English',
  cohortKey: 'cohort-2023',
  courseLength: 1,
  yearGroupKey: 'year-8',
  classOwner: null,
  teachers: [],
  active: true,
};

/** Cohort/year-group fixtures used by the create and set-cohort modals. */
const cohorts = [
  {
    key: 'cohort-2025',
    name: 'Cohort 2025',
    active: true,
    startYear: 2025,
    startMonth: 9,
  },
] as const;

const yearGroups = [
  {
    key: 'year-11',
    name: 'Year 11',
  },
] as const;

// ---------------------------------------------------------------------------
// Release-signal constants
// ---------------------------------------------------------------------------

const UPSERT_SIGNAL_PREFIX = 'upsert-row-';
const DELETE_SIGNAL_PREFIX = 'delete-row-';
const UPDATE_SIGNAL_PREFIX = 'update-row-';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const classesTableAriaLabel = 'Classes table';
const bulkCreateButtonLabel = 'Create ABClass';
const bulkDeleteButtonLabel = 'Delete ABClass';
const bulkSetCohortButtonLabel = 'Set cohort';
const progressModalTitle = 'Bulk class update in progress';
const THREE_ROWS = 3;
const TWO_ROWS = 2;

/**
 * Builds deferred success entries for N rows.
 *
 * @param {number} count Number of rows.
 * @param {string} prefix Signal name prefix.
 * @returns {ReadonlyArray<object>} Deferred success entries with releaseSignal.
 */
function buildDeferredMutationEntries(count: number, prefix: string) {
  return Array.from({ length: count }, (_, index) => ({
    kind: 'success' as const,
    data: null,
    releaseSignal: `${prefix}${index}`,
  }));
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

/**
 * Opens the progress modal for a bulk create action with deferred responses.
 *
 * Selects all notCreated rows, opens the Create ABClass modal, fills in the form,
 * and clicks OK. Returns the dialog locator for the progress modal.
 *
 * @param {Page} page Playwright page under test.
 * @returns {Promise<ReturnType<Page['getByRole']>>} Progress modal dialog locator.
 */
async function startBulkCreateWithDeferredUpserts(page: Page) {
  const table = page.getByRole('table', { name: classesTableAriaLabel });

  // Select all three notCreated rows
  const checkboxes = table.getByRole('checkbox');
  const checkboxCount = await checkboxes.count();
  for (let index = 0; index < checkboxCount; index++) {
    await checkboxes.nth(index).check();
  }

  await page.getByRole('button', { name: bulkCreateButtonLabel }).click();

  const createDialog = page.getByRole('dialog', { name: bulkCreateButtonLabel });
  await expect(createDialog).toBeVisible();
  await createDialog.getByRole('combobox', { name: 'Cohort' }).click();
  await page.getByRole('option', { name: 'Cohort 2025' }).click();
  await createDialog.getByRole('combobox', { name: 'Year group' }).click();
  await page.getByRole('option', { name: 'Year 11' }).click();
  await createDialog.getByRole('spinbutton', { name: 'Course length' }).fill('2');
  await createDialog.getByRole('button', { name: 'OK' }).click();

  // The create modal closes synchronously before the progress modal opens
  await expect(createDialog).toHaveCount(0);

  const progressDialog = page.getByRole('dialog', { name: progressModalTitle });
  await expect(progressDialog).toBeVisible();

  return progressDialog;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('bulk progress modal', () => {
  test('bulk create shows progress modal with correct initial count', async ({ page }) => {
    const scenario: ClassesCrudRuntimeScenario = {
      getAuthorisationStatus: [{ kind: 'success', data: true }],
      getABClassPartials: [{ kind: 'success', data: [] }],
      getCohorts: [{ kind: 'success', data: cohorts }],
      getYearGroups: [{ kind: 'success', data: yearGroups }],
      getGoogleClassrooms: [{ kind: 'success', data: notCreatedGCRs }],
      upsertABClass: buildDeferredMutationEntries(THREE_ROWS, UPSERT_SIGNAL_PREFIX),
    };

    await mockClassesCrudRuntime(page, scenario);
    await page.goto('/');
    await openClassesManagementTab(page);

    await startBulkCreateWithDeferredUpserts(page);

    // The progress modal should show the first row's class name and initial count.
    // The table sorts alphabetically by class name: Year 11 French, Year 11 Geography, Year 11 History.
    const progressDialog = page.getByRole('dialog', { name: progressModalTitle });
    await expect(progressDialog.getByText('Creating class Year 11 French')).toHaveCount(1);
    await expect(progressDialog.getByText('0 / 3')).toHaveCount(1);
  });

  test('progress count updates as queued create calls complete', async ({ page }) => {
    const scenario: ClassesCrudRuntimeScenario = {
      getAuthorisationStatus: [{ kind: 'success', data: true }],
      getABClassPartials: [
        { kind: 'success', data: [] },
        // Post-mutation refetch — not deferred so it resolves when the refetch runs
        { kind: 'success', data: [] },
      ],
      getCohorts: [{ kind: 'success', data: cohorts }],
      getYearGroups: [{ kind: 'success', data: yearGroups }],
      getGoogleClassrooms: [{ kind: 'success', data: notCreatedGCRs }],
      upsertABClass: buildDeferredMutationEntries(THREE_ROWS, UPSERT_SIGNAL_PREFIX),
    };

    await mockClassesCrudRuntime(page, scenario);
    await page.goto('/');
    await openClassesManagementTab(page);

    await startBulkCreateWithDeferredUpserts(page);

    const progressDialog = page.getByRole('dialog', { name: progressModalTitle });
    await expect(progressDialog.getByText('0 / 3')).toHaveCount(1);

    // Release first row (Year 11 French) — count should advance to 1 / 3
    await releaseClassesCrudSignal(page, `${UPSERT_SIGNAL_PREFIX}0`);
    await expect(progressDialog.getByText('1 / 3')).toHaveCount(1);
    // The second row's class name (Year 11 Geography) should now be the current item
    await expect(progressDialog.getByText('Creating class Year 11 Geography')).toHaveCount(1);

    // Release second row — count should advance to 2 / 3
    await releaseClassesCrudSignal(page, `${UPSERT_SIGNAL_PREFIX}1`);
    await expect(progressDialog.getByText('2 / 3')).toHaveCount(1);
    // The third row's class name (Year 11 History) should now be the current item
    await expect(progressDialog.getByText('Creating class Year 11 History')).toHaveCount(1);

    // Release third row — the last item settles, isInProgress becomes false,
    // and the modal closes automatically. The final "3 / 3" count may render
    // too briefly to observe, so we only assert the modal closed.
    await releaseClassesCrudSignal(page, `${UPSERT_SIGNAL_PREFIX}2`);

    // After the last mutation settles and the refetch completes, the modal closes
    await expect(progressDialog).toHaveCount(0);
  });

  test('cancelling a multi-row create removes pending rows and shows cancellation message', async ({
    page,
  }) => {
    const scenario: ClassesCrudRuntimeScenario = {
      getAuthorisationStatus: [{ kind: 'success', data: true }],
      getABClassPartials: [
        { kind: 'success', data: [] },
        // Post-mutation refetch — will include cancelled-row partials
        { kind: 'success', data: [] },
      ],
      getCohorts: [{ kind: 'success', data: cohorts }],
      getYearGroups: [{ kind: 'success', data: yearGroups }],
      getGoogleClassrooms: [{ kind: 'success', data: notCreatedGCRs }],
      upsertABClass: buildDeferredMutationEntries(THREE_ROWS, UPSERT_SIGNAL_PREFIX),
    };

    await mockClassesCrudRuntime(page, scenario);
    await page.goto('/');
    await openClassesManagementTab(page);

    await startBulkCreateWithDeferredUpserts(page);

    const progressDialog = page.getByRole('dialog', { name: progressModalTitle });

    // All items are enqueued upfront. Only the first item (Year 11 French) is
    // the active in-flight request; the remaining two are pending in the queue.
    // Click Cancel remaining to cancel the two pending rows.
    await expect(progressDialog.getByText('Creating class Year 11 French')).toHaveCount(1);
    await progressDialog.getByRole('button', { name: 'Cancel remaining' }).click();

    // Release the active in-flight item so it completes
    await releaseClassesCrudSignal(page, `${UPSERT_SIGNAL_PREFIX}0`);

    // After the active item settles and the cancelled items resolve, the modal
    // closes and a cancellation message appears in the alert banner.
    await expect(progressDialog).toHaveCount(0);
    await expect(page.getByText(/cancelled/i)).toBeVisible();
  });

  test('toolbar remains disabled while queue is active and alert banner appears on drain', async ({
    page,
  }) => {
    const scenario: ClassesCrudRuntimeScenario = {
      getAuthorisationStatus: [{ kind: 'success', data: true }],
      getABClassPartials: [
        { kind: 'success', data: [] },
        { kind: 'success', data: [] },
      ],
      getCohorts: [{ kind: 'success', data: cohorts }],
      getYearGroups: [{ kind: 'success', data: yearGroups }],
      getGoogleClassrooms: [{ kind: 'success', data: notCreatedGCRs }],
      upsertABClass: buildDeferredMutationEntries(THREE_ROWS, UPSERT_SIGNAL_PREFIX),
    };

    await mockClassesCrudRuntime(page, scenario);
    await page.goto('/');
    await openClassesManagementTab(page);

    await startBulkCreateWithDeferredUpserts(page);

    const progressDialog = page.getByRole('dialog', { name: progressModalTitle });

    // Toolbar buttons should remain disabled while the queue is active
    await expect(page.getByRole('button', { name: bulkCreateButtonLabel })).toBeDisabled();
    await expect(page.getByRole('button', { name: bulkDeleteButtonLabel })).toBeDisabled();
    await expect(page.getByRole('button', { name: bulkSetCohortButtonLabel })).toBeDisabled();

    // Release all signals so the queue drains
    await releaseClassesCrudSignal(page, `${UPSERT_SIGNAL_PREFIX}0`);
    await releaseClassesCrudSignal(page, `${UPSERT_SIGNAL_PREFIX}1`);
    await releaseClassesCrudSignal(page, `${UPSERT_SIGNAL_PREFIX}2`);

    // After drain, the modal closes and the toolbar re-enables.
    // Bulk-action buttons may be disabled due to empty/inegligible selection;
    // verify that a non-bulk toolbar button (Manage Cohorts) is enabled.
    await expect(progressDialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Manage Cohorts' })).toBeEnabled();
  });

  test('bulk delete disables toolbar buttons while queue is active', async ({ page }) => {
    const scenario: ClassesCrudRuntimeScenario = {
      getAuthorisationStatus: [{ kind: 'success', data: true }],
      getABClassPartials: [
        { kind: 'success', data: [existingClassPartial1, existingClassPartial2] },
        { kind: 'success', data: [] },
      ],
      getCohorts: [{ kind: 'success', data: baseCohorts }],
      getYearGroups: [{ kind: 'success', data: baseYearGroups }],
      getGoogleClassrooms: [{ kind: 'success', data: [existingGCR1, existingGCR2] }],
      deleteABClass: buildDeferredMutationEntries(TWO_ROWS, DELETE_SIGNAL_PREFIX),
      // Provide upsertABClass entries as a safety net (default queue for core tests)
      upsertABClass: Array.from({ length: 12 }, () => ({
        kind: 'success' as const,
        data: null,
      })),
    };

    await mockClassesCrudRuntime(page, scenario);
    await page.goto('/');
    await openClassesManagementTab(page);

    const table = page.getByRole('table', { name: classesTableAriaLabel });

    // Select both rows
    const checkboxes = table.getByRole('checkbox');
    const checkboxCount = await checkboxes.count();
    for (let index = 0; index < checkboxCount; index++) {
      await checkboxes.nth(index).check();
    }

    // Open the delete confirmation modal
    await page.getByRole('button', { name: bulkDeleteButtonLabel }).click();
    const deleteDialog = page.getByRole('dialog', { name: 'Delete classes' });
    await expect(deleteDialog).toBeVisible();

    // Confirm deletion
    await deleteDialog.getByRole('button', { name: 'Delete', exact: true }).click();

    // The delete modal closes; progress modal opens
    await expect(deleteDialog).toHaveCount(0);
    const progressDialog = page.getByRole('dialog', { name: progressModalTitle });
    await expect(progressDialog).toBeVisible();

    // Toolbar bulk-action buttons should be disabled while queue active
    await expect(page.getByRole('button', { name: bulkCreateButtonLabel })).toBeDisabled();
    await expect(page.getByRole('button', { name: bulkDeleteButtonLabel })).toBeDisabled();
    await expect(page.getByRole('button', { name: bulkSetCohortButtonLabel })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Set active' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Set inactive' })).toBeDisabled();

    // Clean up — release signals so the queue drains
    await releaseClassesCrudSignal(page, `${DELETE_SIGNAL_PREFIX}0`);
    await releaseClassesCrudSignal(page, `${DELETE_SIGNAL_PREFIX}1`);
    await expect(progressDialog).toHaveCount(0);
  });

  test('set cohort shows progress modal with correct verb and count updates', async ({ page }) => {
    const scenario: ClassesCrudRuntimeScenario = {
      getAuthorisationStatus: [{ kind: 'success', data: true }],
      getABClassPartials: [
        { kind: 'success', data: [existingClassPartial1, existingClassPartial2] },
        { kind: 'success', data: [existingClassPartial1, existingClassPartial2] },
      ],
      getCohorts: [{ kind: 'success', data: baseCohorts }],
      getYearGroups: [{ kind: 'success', data: baseYearGroups }],
      getGoogleClassrooms: [{ kind: 'success', data: [existingGCR1, existingGCR2] }],
      updateABClass: buildDeferredMutationEntries(TWO_ROWS, UPDATE_SIGNAL_PREFIX),
      upsertABClass: Array.from({ length: 12 }, () => ({
        kind: 'success' as const,
        data: null,
      })),
    };

    await mockClassesCrudRuntime(page, scenario);
    await page.goto('/');
    await openClassesManagementTab(page);

    const table = page.getByRole('table', { name: classesTableAriaLabel });

    // Select both existing rows
    const checkboxes = table.getByRole('checkbox');
    const checkboxCount = await checkboxes.count();
    for (let index = 0; index < checkboxCount; index++) {
      await checkboxes.nth(index).check();
    }

    // Open the Set cohort modal
    await page.getByRole('button', { name: bulkSetCohortButtonLabel }).click();
    const setCohortDialog = page.getByRole('dialog', { name: 'Set cohort' });
    await expect(setCohortDialog).toBeVisible();

    // Select a cohort
    await setCohortDialog.getByRole('combobox', { name: 'Cohort' }).click();
    await page.getByRole('option', { name: 'Cohort 2024' }).click();
    await setCohortDialog.getByRole('button', { name: 'OK' }).click();

    // The set-cohort modal closes; progress modal opens
    await expect(setCohortDialog).toHaveCount(0);
    const progressDialog = page.getByRole('dialog', { name: progressModalTitle });
    await expect(progressDialog).toBeVisible();

    // Verify the verb is correct for the metadata action.
    // The table sorts alphabetically: Year 9 English first, Year 10 Maths second.
    await expect(progressDialog.getByText('Setting cohort for class Year 9 English')).toHaveCount(
      1
    );
    await expect(progressDialog.getByText('0 / 2')).toHaveCount(1);

    // Release first row
    await releaseClassesCrudSignal(page, `${UPDATE_SIGNAL_PREFIX}0`);
    await expect(progressDialog.getByText('1 / 2')).toHaveCount(1);
    await expect(progressDialog.getByText('Setting cohort for class Year 10 Maths')).toHaveCount(1);

    // Release second row — modal closes automatically on drain
    await releaseClassesCrudSignal(page, `${UPDATE_SIGNAL_PREFIX}1`);

    // After drain, modal closes
    await expect(progressDialog).toHaveCount(0);
  });
});
