/**
 * Reference Data Modal Scaffold — browser-level Playwright tests.
 *
 * Purpose: Verify that the scaffold correctly applies:
 * 1. Caller-supplied modal width to the dialog element
 * 2. aria-busy attribute during refresh states
 * 3. DOM structure and class application
 *
 * These tests complement the unit tests in ReferenceDataManagementModalScaffold.spec.tsx
 * and help determine if test failures are due to HappyDOM limitations vs. actual bugs.
 *
 * NOTE: These tests verify the behavior through the actual UI (Manage Cohorts/Year Groups modals).
 * Once the migration to use ReferenceDataManagementModalScaffold is complete, these tests
 * will validate the scaffold behavior in a real browser environment (Chromium).
 *
 * If the unit tests fail in HappyDOM but these Playwright tests pass, it strongly suggests
 * the failures are due to HappyDOM's DOM simulation limitations rather than code bugs.
 */

import { expect, test, type Locator } from '@playwright/test';
import {
  baseClassPartials,
  baseCohorts,
  baseGoogleClassrooms,
  baseYearGroups,
  createSuccessfulClassesScenario,
  openClassesTabWithScenario,
} from './classes-crud.shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Opens the Classes tab with a baseline scenario suitable for reference-data modal tests.
 *
 * @param {Parameters<typeof openClassesTabWithScenario>[0]} page Playwright page.
 * @returns {Promise<void>}
 */
async function openClassesTabWithReferenceDataScenario(
  page: Parameters<typeof openClassesTabWithScenario>[0]
): Promise<void> {
  await openClassesTabWithScenario(page, {
    ...createSuccessfulClassesScenario({
      classPartials: baseClassPartials,
      cohorts: baseCohorts,
      googleClassrooms: baseGoogleClassrooms,
      yearGroups: baseYearGroups,
    }),
  });
}

/**
 * Opens the Manage Cohorts modal.
 *
 * @param {Parameters<typeof openClassesTabWithReferenceDataScenario>[0]} page Playwright page.
 * @returns {Promise<Locator>} The modal dialog locator.
 */
async function openManageCohortsModal(page: Parameters<typeof openClassesTabWithReferenceDataScenario>[0]): Promise<Locator> {
  await page.getByRole('button', { name: 'Manage Cohorts' }).click();
  const dialog = page.getByRole('dialog', { name: /manage cohorts/i });
  await expect(dialog).toBeVisible();
  return dialog;
}

/**
 * Opens the Manage Year Groups modal.
 *
 * @param {Parameters<typeof openClassesTabWithReferenceDataScenario>[0]} page Playwright page.
 * @returns {Promise<Locator>} The modal dialog locator.
 */
async function openManageYearGroupsModal(page: Parameters<typeof openClassesTabWithReferenceDataScenario>[0]): Promise<Locator> {
  await page.getByRole('button', { name: 'Manage Year Groups' }).click();
  const dialog = page.getByRole('dialog', { name: /manage year groups/i });
  await expect(dialog).toBeVisible();
  return dialog;
}

// ---------------------------------------------------------------------------
// Tests for modal width
// ---------------------------------------------------------------------------

test.describe('Reference Data Modal — width preservation', () => {
  test('Manage Cohorts modal has width applied to dialog element', async ({ page }) => {
    await openClassesTabWithReferenceDataScenario(page);
    const dialog = await openManageCohortsModal(page);

    // Verify the dialog element exists and is visible
    await expect(dialog).toBeVisible();

    // Check that the dialog has a width style attribute
    const style = await dialog.getAttribute('style');
    expect(style).toBeTruthy();
    expect(style?.toLowerCase()).toContain('width:');

    // Verify the computed width is a valid non-zero value
    const computedWidth = await dialog.evaluate((element) => {
      const style = globalThis.getComputedStyle(element);
      return style.width;
    });
    expect(computedWidth).not.toBe('0px');
    expect(computedWidth).not.toBe('');
    expect(computedWidth).not.toBe('auto');
  });

  test('Manage Year Groups modal has width applied to dialog element', async ({ page }) => {
    await openClassesTabWithReferenceDataScenario(page);
    const dialog = await openManageYearGroupsModal(page);

    await expect(dialog).toBeVisible();

    const style = await dialog.getAttribute('style');
    expect(style).toBeTruthy();
    expect(style?.toLowerCase()).toContain('width:');

    const computedWidth = await dialog.evaluate((element) => {
      const style = globalThis.getComputedStyle(element);
      return style.width;
    });
    expect(computedWidth).not.toBe('0px');
    expect(computedWidth).not.toBe('');
    expect(computedWidth).not.toBe('auto');
  });

  test('dialog element width style contains pixel value', async ({ page }) => {
    await openClassesTabWithReferenceDataScenario(page);
    const dialog = await openManageCohortsModal(page);

    const style = await dialog.getAttribute('style');
    // The width should be specified in pixels (e.g., "width: 800px;")
    expect(style?.toLowerCase()).toMatch(/width:\s*\d+px/);
  });
});

// ---------------------------------------------------------------------------
// Tests for aria-busy
// ---------------------------------------------------------------------------

test.describe('Reference Data Modal — aria-busy attribute', () => {
  test('dialog element has no aria-busy attribute in ready state', async ({ page }) => {
    await openClassesTabWithReferenceDataScenario(page);
    const dialog = await openManageCohortsModal(page);

    // In ready state (data loaded, not refreshing), aria-busy should not be present
    const ariaBusy = await dialog.getAttribute('aria-busy');
    expect(ariaBusy).toBeNull();
  });

  test('dialog element aria-busy attribute is either absent or false in ready state', async ({ page }) => {
    await openClassesTabWithReferenceDataScenario(page);
    const dialog = await openManageCohortsModal(page);

    const ariaBusy = await dialog.getAttribute('aria-busy');
    // aria-busy should be null (not set) or explicitly "false" in ready state
    expect(ariaBusy === null || ariaBusy === 'false').toBe(true);
  });

  test('dialog element can be queried by role and has expected attributes', async ({ page }) => {
    await openClassesTabWithReferenceDataScenario(page);
    const dialog = await openManageCohortsModal(page);

    // Verify we can query the dialog by role
    await expect(dialog).toHaveAttribute('role', 'dialog');
    
    // Verify it has aria-modal attribute (standard for modals)
    const ariaModal = await dialog.getAttribute('aria-modal');
    expect(ariaModal).toBe('true');
  });
});

// ---------------------------------------------------------------------------
// Tests for scaffold DOM structure (when migration is complete)
// ---------------------------------------------------------------------------

test.describe('Reference Data Modal Scaffold — DOM structure', () => {
  test('Manage Cohorts modal dialog is rendered in the DOM', async ({ page }) => {
    await openClassesTabWithReferenceDataScenario(page);
    const dialog = await openManageCohortsModal(page);

    // Basic verification that the dialog is in the DOM
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveCount(1);
  });

  test('modal wrapper structure exists in the DOM', async ({ page }) => {
    await openClassesTabWithReferenceDataScenario(page);
    await openManageCohortsModal(page);

    // Check for the Ant Design modal wrapper class
    // This should exist whether using old Modal or new scaffold
    const modalWrap = page.locator('.ant-modal-wrap');
    await expect(modalWrap).toBeVisible();
  });

  test('dialog element has correct class structure', async ({ page }) => {
    await openClassesTabWithReferenceDataScenario(page);
    const dialog = await openManageCohortsModal(page);

    // The dialog should have ant-modal class
    await expect(dialog).toHaveClass(/ant-modal/);
  });
});

// ---------------------------------------------------------------------------
// Tests for scaffold-specific behavior (conditional on migration being complete)
// ---------------------------------------------------------------------------

/**
 * These tests verify scaffold-specific DOM markers that will only be present
 * after the ManageCohortsModal and ManageYearGroupsModal components are migrated
 * to use ReferenceDataManagementModalScaffold.
 *
 * Until migration is complete, these tests are skipped as they will fail.
 * Once migration is complete, remove the `.skip` modifier to enable them.
 */
test.describe.skip('Reference Data Modal Scaffold — scaffold-specific features', () => {
  test('scaffold wrapper class is present', async ({ page }) => {
    await openClassesTabWithReferenceDataScenario(page);
    await openManageCohortsModal(page);

    // After migration to scaffold, this class should be present on the modal wrapper
    const scaffoldWrapper = page.locator('.reference-data-modal-scaffold-wrapper');
    await expect(scaffoldWrapper).toBeVisible();
  });

  test('create action icon test seam is present', async ({ page }) => {
    await openClassesTabWithReferenceDataScenario(page);
    const dialog = await openManageCohortsModal(page);

    // After migration to scaffold, the create action icon should have this test ID
    const createIcon = dialog.getByTestId('reference-data-create-action-icon');
    await expect(createIcon).toBeVisible();
  });

  test('scaffold dialog class is present', async ({ page }) => {
    await openClassesTabWithReferenceDataScenario(page);
    const dialog = await openManageCohortsModal(page);

    // After migration, the dialog should have the scaffold-specific class
    await expect(dialog).toHaveClass(/reference-data-modal-scaffold-dialog/);
  });
});
