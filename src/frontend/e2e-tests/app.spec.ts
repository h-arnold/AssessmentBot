import { expect, test, type Page } from '@playwright/test';
import {
  appBreadcrumbBaseLabel,
  defaultNavigationKey,
  getNavigationLabel,
  navigationItems,
} from '../src/navigation/appNavigation';

const breadcrumbNavigationName = 'Breadcrumb';
const expectedNavigationItemCount = navigationItems.length;
const assignmentsNavigationItemIndex = 2;
const collapseExpandCycles = 2;

/**
 * Returns the rendered breadcrumb locator.
 */
function getBreadcrumb(page: Page) {
  return page.getByRole('navigation', { name: breadcrumbNavigationName });
}

/**
 * Asserts the visible breadcrumb labels.
 */
async function expectBreadcrumbLabels(page: Page, labels: string[]) {
  const breadcrumb = getBreadcrumb(page);

  await expect(breadcrumb).toBeVisible();

  for (const label of labels) {
    await expect(breadcrumb).toContainText(label);
  }
}

/**
 * Installs a deterministic `google.script.run` mock that keeps auth status pending.
 */
async function mockPendingGoogleScriptRun(page: Page) {
  await page.addInitScript(() => {
    const run = {
      withSuccessHandler() {
        return run;
      },
      withFailureHandler() {
        return run;
      },
      apiHandler() {},
    };

    (globalThis as { google?: unknown }).google = {
      script: {
        run,
      },
    };
  });
}

test.describe('app shell', () => {
  test('breadcrumb visible and readable on each page', async ({ page }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    await expectBreadcrumbLabels(page, [
      appBreadcrumbBaseLabel,
      getNavigationLabel(defaultNavigationKey),
    ]);

    for (const { key } of navigationItems) {
      const label = getNavigationLabel(key);

      await page.getByRole('menuitem', { name: label }).click();
      await expectBreadcrumbLabels(page, [appBreadcrumbBaseLabel, label]);
    }
  });

  test('breadcrumb updates after menu navigation in real browser', async ({ page }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    for (const key of ['classes', 'assignments', 'settings'] as const) {
      const label = getNavigationLabel(key);

      await page.getByRole('menuitem', { name: label }).click();
      await expectBreadcrumbLabels(page, [appBreadcrumbBaseLabel, label]);
    }
  });

  test('breadcrumb remains correct after collapse and expand and then navigation', async ({
    page,
  }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    await page.getByRole('button', { name: 'Collapse navigation' }).click();
    await page.getByRole('button', { name: 'Expand navigation' }).click();

    const settingsLabel = getNavigationLabel('settings');

    await page.getByRole('menuitem', { name: settingsLabel }).click();
    await expectBreadcrumbLabels(page, [appBreadcrumbBaseLabel, settingsLabel]);
  });

  test('user can navigate to Dashboard, Classes, Assignments, and Settings via menu clicks', async ({
    page,
  }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    for (const label of ['Dashboard', 'Classes', 'Assignments', 'Settings']) {
      await page.getByRole('menuitem', { name: label }).click();
      await expect(page.getByRole('menuitem', { name: label })).toHaveClass(/ant-menu-item-selected/);
    }
  });

  test('collapsed mode still allows navigation by icon click', async ({ page }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    await page.getByRole('button', { name: 'Collapse navigation' }).click();

    const menuItems = page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('menuitem');

    await expect(menuItems).toHaveCount(expectedNavigationItemCount);
    await menuItems.nth(assignmentsNavigationItemIndex).click();
    await expect(menuItems.nth(assignmentsNavigationItemIndex)).toHaveClass(
      /ant-menu-item-selected/
    );
  });

  test('menu remains functional after repeated collapse and expand cycles', async ({ page }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    for (let cycle = 0; cycle < collapseExpandCycles; cycle += 1) {
      await page.getByRole('button', { name: 'Collapse navigation' }).click();
      await page.getByRole('button', { name: 'Expand navigation' }).click();
    }

    const settingsItem = page.getByRole('menuitem', { name: 'Settings' });

    await settingsItem.click();
    await expect(settingsItem).toHaveClass(/ant-menu-item-selected/);
  });

  test('shows shell on initial load', async ({ page }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Collapse navigation' })).toBeVisible();
  });

  test('hamburger collapses and expands nav rail visually', async ({ page }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    const collapseButton = page.getByRole('button', { name: 'Collapse navigation' });
    const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
    const expandedBox = await navigation.boundingBox();

    expect(expandedBox).not.toBeNull();

    await collapseButton.click();

    // Re-acquire by the new accessible name after the toggle changes the button label.
    const expandButton = page.getByRole('button', { name: 'Expand navigation' });

    await expect(expandButton).toBeVisible();
    await expect(expandButton).toHaveAttribute('aria-expanded', 'false');
    await expect(expandButton.getByRole('img')).toBeVisible();

    const collapsedBox = await navigation.boundingBox();

    expect(collapsedBox).not.toBeNull();
    expect(collapsedBox!.width).toBeLessThan(expandedBox!.width);

    await expandButton.click();

    const reexpandedButton = page.getByRole('button', { name: 'Collapse navigation' });

    await expect(reexpandedButton).toBeVisible();
    await expect(reexpandedButton).toHaveAttribute('aria-expanded', 'true');

    const reexpandedBox = await navigation.boundingBox();

    expect(reexpandedBox).not.toBeNull();
    expect(reexpandedBox!.width).toBeGreaterThan(collapsedBox!.width);
    await expect(reexpandedButton).toBeVisible();
  });

  test('keyboard activation of hamburger works', async ({ page }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    const collapseButton = page.getByRole('button', { name: 'Collapse navigation' });

    await collapseButton.focus();
    await page.keyboard.press('Enter');

    // Re-acquire by the new accessible name after the toggle changes the button label.
    const expandButton = page.getByRole('button', { name: 'Expand navigation' });

    await expect(expandButton).toHaveAttribute('aria-expanded', 'false');

    await page.keyboard.press(' ');

    const reexpandedButton = page.getByRole('button', { name: 'Collapse navigation' });

    await expect(reexpandedButton).toHaveAttribute('aria-expanded', 'true');
  });

  test('active menu item styling changes when selecting a new page', async ({ page }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    const dashboardItem = page.getByRole('menuitem', { name: 'Dashboard' });
    const classesItem = page.getByRole('menuitem', { name: 'Classes' });

    await dashboardItem.click();
    await expect(dashboardItem).toHaveClass(/ant-menu-item-selected/);

    await classesItem.click();

    await expect(classesItem).toHaveClass(/ant-menu-item-selected/);
    await expect(dashboardItem).not.toHaveClass(/ant-menu-item-selected/);
  });
});
