/**
 * Classes CRUD — Manage Year Groups browser journey tests.
 *
 * Covers the visible browser interactions for the year-group management modal:
 * - Manage Year Groups button visibility in the Classes tab toolbar
 * - Opening the management modal and viewing the year-group list
 * - Empty state when no year groups exist
 * - Create year-group flow
 * - Edit year-group flow
 * - Delete year-group flow (successful)
 * - Blocked delete (IN_USE) — modal stays open with inline Alert
 */

import { expect, test } from '@playwright/test';
import {
  baseClassPartials,
  baseGoogleClassrooms,
  baseCohorts,
  createSuccessfulClassesScenario,
  openClassesTabWithScenario,
  releaseClassesCrudSignal,
} from './classes-crud.shared';
import {
  deleteReferenceDataRowAndExpectBlocked,
  deleteReferenceDataRowAndExpectRemoval,
} from './helpers/classes-crud-delete-flow';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const manageYearGroupsYearGroups = [
  { key: 'year-7', name: 'Year 7' },
  { key: 'year-8', name: 'Year 8' },
] as const;

const yearGroupsBackgroundRefreshReleaseSignal = 'year-groups-background-refresh';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Opens the Classes tab with a baseline scenario suitable for year-group management tests.
 *
 * @param {import('@playwright/test').Page} page Playwright page.
 * @param {object} [overrides] Scenario overrides applied after the baseline scenario.
 * @returns {Promise<void>} Resolves once the Classes tab is active.
 */
async function openClassesTabWithYearGroupManagementScenario(
  page: Parameters<typeof openClassesTabWithScenario>[0],
  overrides: Partial<Parameters<typeof openClassesTabWithScenario>[1]> = {},
) {
  await openClassesTabWithScenario(page, {
    ...createSuccessfulClassesScenario({
      classPartials: baseClassPartials,
      cohorts: baseCohorts,
      googleClassrooms: baseGoogleClassrooms,
      yearGroups: manageYearGroupsYearGroups,
    }),
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Classes CRUD — Manage Year Groups', () => {
  test('shows a Manage Year Groups button in the Classes tab toolbar', async ({ page }) => {
    await openClassesTabWithYearGroupManagementScenario(page);

    await expect(page.getByRole('button', { name: 'Manage Year Groups' })).toBeVisible();
  });

  test('opens the year-group management modal when Manage Year Groups is clicked', async ({
    page,
  }) => {
    await openClassesTabWithYearGroupManagementScenario(page);

    await page.getByRole('button', { name: 'Manage Year Groups' }).click();

    await expect(page.getByRole('dialog', { name: /manage year groups/i })).toBeVisible();
  });

  test('lists year groups with their names in the management modal', async ({ page }) => {
    await openClassesTabWithYearGroupManagementScenario(page);
    await page.getByRole('button', { name: 'Manage Year Groups' }).click();

    const modal = page.getByRole('dialog', { name: /manage year groups/i });
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Year 7')).toBeVisible();
    await expect(modal.getByText('Year 8')).toBeVisible();
    // One header row plus one data row per year group.
    const expectedRowCount = manageYearGroupsYearGroups.length + 1;
    await expect(modal.getByRole('row')).toHaveCount(expectedRowCount);
  });

  test('shows empty state and a Create year group button when no year groups exist', async ({
    page,
  }) => {
    await openClassesTabWithScenario(page, {
      ...createSuccessfulClassesScenario({
        classPartials: baseClassPartials,
        cohorts: baseCohorts,
        googleClassrooms: baseGoogleClassrooms,
        yearGroups: [],
      }),
    });

    await page.getByRole('button', { name: 'Manage Year Groups' }).click();

    const modal = page.getByRole('dialog', { name: /manage year groups/i });
    await expect(modal).toBeVisible();
    await expect(modal.getByText(/no year groups/i)).toBeVisible();
    await expect(modal.getByRole('button', { name: /create year group/i })).toBeVisible();
  });

  test('creates a new year group and shows it in the list', async ({ page }) => {
    const newYearGroup = { key: 'year-9', name: 'Year 9' };

    await openClassesTabWithScenario(page, {
      ...createSuccessfulClassesScenario({
        classPartials: baseClassPartials,
        cohorts: baseCohorts,
        googleClassrooms: baseGoogleClassrooms,
        yearGroups: manageYearGroupsYearGroups,
      }),
      createYearGroup: [{ kind: 'success', data: newYearGroup }],
      // getYearGroups called again after create to refresh the list
      getYearGroups: [
        { kind: 'success', data: manageYearGroupsYearGroups },
        { kind: 'success', data: [...manageYearGroupsYearGroups, newYearGroup] },
      ],
    });

    await page.getByRole('button', { name: 'Manage Year Groups' }).click();
    const modal = page.getByRole('dialog', { name: /manage year groups/i });
    await expect(modal).toBeVisible();

    await modal.getByRole('button', { name: /create year group/i }).click();
    const form = page.getByRole('dialog', { name: /create year group/i });
    await expect(form).toBeVisible();

    await form.getByRole('textbox', { name: /name/i }).fill('Year 9');
    await form.getByRole('button', { name: /ok|save|create/i }).click();

    await expect(form).toHaveCount(0);
    await expect(modal.getByText('Year 9')).toBeVisible();
  });

  test('fails closed in the modal when a successful year-group create cannot refresh trustworthy year-group data', async ({ page }) => {
    const newYearGroup = { key: 'year-9', name: 'Year 9' };

    await openClassesTabWithScenario(page, {
      ...createSuccessfulClassesScenario({
        classPartials: baseClassPartials,
        cohorts: baseCohorts,
        googleClassrooms: baseGoogleClassrooms,
        yearGroups: manageYearGroupsYearGroups,
      }),
      createYearGroup: [{ kind: 'success', data: newYearGroup }],
      getYearGroups: [
        { kind: 'success', data: manageYearGroupsYearGroups },
        { kind: 'transportFailure', message: 'Year groups refresh failed.' },
      ],
    });

    await page.getByRole('button', { name: 'Manage Year Groups' }).click();
    const modal = page.getByRole('dialog', { name: /manage year groups/i });
    await expect(modal).toBeVisible();

    await modal.getByRole('button', { name: /create year group/i }).click();
    const form = page.getByRole('dialog', { name: /create year group/i });
    await expect(form).toBeVisible();

    await form.getByRole('textbox', { name: /name/i }).fill('Year 9');
    await form.getByRole('button', { name: /ok|save|create/i }).click();

    await expect(modal.getByRole('alert')).toContainText('Unable to load year groups right now.');
    await expect(modal.getByRole('button', { name: /create year group/i })).toHaveCount(0);
    await expect(modal.getByRole('table', { name: /year groups/i })).toHaveCount(0);
  });

  test('keeps trusted year-group data visible while publishing modal busy state during background refresh', async ({ page }) => {
    const updatedYearGroup = { key: 'year-7', name: 'Year Seven' };

    await openClassesTabWithScenario(page, {
      ...createSuccessfulClassesScenario({
        classPartials: baseClassPartials,
        cohorts: baseCohorts,
        googleClassrooms: baseGoogleClassrooms,
        yearGroups: manageYearGroupsYearGroups,
      }),
      updateYearGroup: [{ kind: 'success', data: updatedYearGroup }],
      getYearGroups: [
        { kind: 'success', data: manageYearGroupsYearGroups },
        {
          kind: 'success',
          data: [updatedYearGroup, manageYearGroupsYearGroups[1]],
          releaseSignal: yearGroupsBackgroundRefreshReleaseSignal,
        },
      ],
    });

    await page.getByRole('button', { name: 'Manage Year Groups' }).click();
    const modal = page.getByRole('dialog', { name: /manage year groups/i });
    await expect(modal).toBeVisible();

    const year7Row = modal.getByRole('row', { name: /year 7/i });
    await year7Row.getByRole('button', { name: /edit/i }).click();

    const form = page.getByRole('dialog', { name: /edit year group/i });
    await expect(form).toBeVisible();
    await form.getByRole('textbox', { name: /name/i }).fill('Year Seven');

    try {
      await form.getByRole('button', { name: /ok|save|update/i }).click();

      await expect(modal).toHaveAttribute('aria-busy', 'true');
      await expect(modal.getByRole('button', { name: /create year group/i })).toBeVisible();
      await expect(modal.getByRole('table', { name: /year groups/i })).toBeVisible();
      await expect(modal.getByText('Year 7')).toBeVisible();
    } finally {
      await releaseClassesCrudSignal(page, yearGroupsBackgroundRefreshReleaseSignal);
    }
  });

  test('edits an existing year group and shows the updated name', async ({ page }) => {
    const updatedYearGroup = { key: 'year-7', name: 'Year Seven' };

    await openClassesTabWithScenario(page, {
      ...createSuccessfulClassesScenario({
        classPartials: baseClassPartials,
        cohorts: baseCohorts,
        googleClassrooms: baseGoogleClassrooms,
        yearGroups: manageYearGroupsYearGroups,
      }),
      updateYearGroup: [{ kind: 'success', data: updatedYearGroup }],
      getYearGroups: [
        { kind: 'success', data: manageYearGroupsYearGroups },
        {
          kind: 'success',
          data: [updatedYearGroup, manageYearGroupsYearGroups[1]],
        },
      ],
    });

    await page.getByRole('button', { name: 'Manage Year Groups' }).click();
    const modal = page.getByRole('dialog', { name: /manage year groups/i });
    await expect(modal).toBeVisible();

    // Click the Edit button on the first year-group row (Year 7).
    const year7Row = modal.getByRole('row', { name: /year 7/i });
    await year7Row.getByRole('button', { name: /edit/i }).click();

    const form = page.getByRole('dialog', { name: /edit year group/i });
    await expect(form).toBeVisible();
    await expect(form.getByRole('textbox', { name: /name/i })).not.toHaveValue('');

    await form.getByRole('textbox', { name: /name/i }).fill('Year Seven');
    await form.getByRole('button', { name: /ok|save|update/i }).click();

    await expect(form).toHaveCount(0);
    await expect(modal.getByText('Year Seven')).toBeVisible();
  });

  test('deletes a year group and removes it from the list', async ({ page }) => {
    await openClassesTabWithScenario(page, {
      ...createSuccessfulClassesScenario({
        classPartials: baseClassPartials,
        cohorts: baseCohorts,
        googleClassrooms: baseGoogleClassrooms,
        yearGroups: manageYearGroupsYearGroups,
      }),
      deleteYearGroup: [{ kind: 'success', data: undefined }],
      getYearGroups: [
        { kind: 'success', data: manageYearGroupsYearGroups },
        { kind: 'success', data: [manageYearGroupsYearGroups[1]] },
      ],
    });

    await deleteReferenceDataRowAndExpectRemoval(page, {
      managementButtonName: 'Manage Year Groups',
      managementDialogName: /manage year groups/i,
      rowName: /year 7/i,
      deleteDialogName: /delete year group/i,
      removedText: 'Year 7',
      remainingText: 'Year 8',
    });
  });

  test('keeps the delete dialog open with an inline Alert when delete is blocked because the year group is in use', async ({
    page,
  }) => {
    await openClassesTabWithScenario(page, {
      ...createSuccessfulClassesScenario({
        classPartials: baseClassPartials,
        cohorts: baseCohorts,
        googleClassrooms: baseGoogleClassrooms,
        yearGroups: manageYearGroupsYearGroups,
      }),
      deleteYearGroup: [
        {
          kind: 'failureEnvelope',
          code: 'IN_USE',
          message: 'Year group is in use by one or more classes and cannot be deleted.',
        },
      ],
    });

    await deleteReferenceDataRowAndExpectBlocked(page, {
      managementButtonName: 'Manage Year Groups',
      managementDialogName: /manage year groups/i,
      rowName: /year 7/i,
      deleteDialogName: /delete year group/i,
    });
  });

  test('closes the management modal via its close control', async ({ page }) => {
    await openClassesTabWithYearGroupManagementScenario(page);

    await page.getByRole('button', { name: 'Manage Year Groups' }).click();
    const modal = page.getByRole('dialog', { name: /manage year groups/i });
    await expect(modal).toBeVisible();

    await modal.getByRole('button', { name: /close/i }).click();

    await expect(modal).toHaveCount(0);
  });
});
