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
 *
 * RED PHASE: ManageYearGroupsModal, its launcher button, and API transport for IN_USE
 * do not yet exist. All tests are expected to fail until the green-phase
 * implementation is complete.
 */

import { expect, test } from '@playwright/test';
import {
  baseClassPartials,
  baseGoogleClassrooms,
  baseCohorts,
  createSuccessfulClassesScenario,
  openClassesTabWithScenario,
} from './classes-crud.shared';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const manageYearGroupsYearGroups = [
  { key: 'year-7', name: 'Year 7' },
  { key: 'year-8', name: 'Year 8' },
] as const;

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

    await page.getByRole('button', { name: 'Manage Year Groups' }).click();
    const modal = page.getByRole('dialog', { name: /manage year groups/i });
    await expect(modal).toBeVisible();

    const year7Row = modal.getByRole('row', { name: /year 7/i });
    await year7Row.getByRole('button', { name: /delete/i }).click();

    const confirmDialog = page.getByRole('dialog', { name: /delete year group/i });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole('button', { name: /delete|confirm|ok/i }).click();

    await expect(confirmDialog).toHaveCount(0);
    await expect(modal.getByText('Year 7')).toHaveCount(0);
    await expect(modal.getByText('Year 8')).toBeVisible();
  });

  test('keeps the delete dialog open with an inline Alert when delete is blocked because the year group is in use', async ({
    page,
  }) => {
    // NOTE: The API currently collapses IN_USE to INTERNAL_ERROR at the envelope level.
    // This test expects a machine-readable IN_USE code in the failure envelope, which
    // is the deferred contract fix from workstream 5.3. Until that fix lands the
    // frontend will not receive IN_USE and this test will fail on the blocked-state assertion.
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

    await page.getByRole('button', { name: 'Manage Year Groups' }).click();
    const modal = page.getByRole('dialog', { name: /manage year groups/i });
    await expect(modal).toBeVisible();

    const year7Row = modal.getByRole('row', { name: /year 7/i });
    await year7Row.getByRole('button', { name: /delete/i }).click();

    const confirmDialog = page.getByRole('dialog', { name: /delete year group/i });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole('button', { name: /delete|confirm|ok/i }).click();

    // Confirmation dialog must remain open with an explanatory alert.
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog.getByRole('alert')).toBeVisible();
    await expect(confirmDialog.getByRole('alert')).toContainText(/in use/i);

    // The destructive button must be disabled so the user cannot retry blindly.
    await expect(
      confirmDialog.getByRole('button', { name: /delete|confirm|ok/i }),
    ).toBeDisabled();
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
