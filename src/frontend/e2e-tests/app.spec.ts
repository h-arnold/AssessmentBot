import { expect, test, type Page } from '@playwright/test';
import { pageExpectations } from '../src/test/pageExpectations';
import { googleScriptRunApiHandlerFactorySource } from '../src/test/googleScriptRunHarness';

const appBreadcrumbBaseLabel = 'AssessmentBot Frontend';
const breadcrumbNavigationName = 'Breadcrumb';
const defaultNavigationLabel = 'Dashboard';
const expectedNavigationItemCount = pageExpectations.length;
const assignmentsNavigationItemIndex = 2;
const collapseExpandCycles = 2;
const themeSwitchLabel = 'Dark mode';
const lastPageExpectationOffset = -1;
const ariaExpandedAttribute = 'aria-expanded';
const primaryNavigationLabel = 'Primary navigation';
const collapseNavigationButtonLabel = 'Collapse navigation';
const expandNavigationButtonLabel = 'Expand navigation';
const settingsLabel = 'Settings';
const navigationMenuLabels = ['Dashboard', 'Classes', 'Assignments', settingsLabel];
const backendSettingsFixture = {
  backendAssessorBatchSize: 30,
  apiKey: '****cdef',
  hasApiKey: true,
  backendUrl: 'https://backend.example.com',
  revokeAuthTriggerSet: false,
  daysUntilAuthRevoke: 60,
  slidesFetchBatchSize: 20,
  jsonDbMasterIndexKey: 'master-index',
  jsonDbLockTimeoutMs: 15_000,
  jsonDbLogLevel: 'INFO',
  jsonDbBackupOnInitialise: true,
  jsonDbRootFolderId: 'folder-1234',
};

/**
 * Returns the rendered breadcrumb locator.
 *
 * @param {Page} page - The Playwright page under test.
 * @returns {Locator} The breadcrumb locator.
 */
function getBreadcrumb(page: Page) {
  return page.getByRole('navigation', { name: breadcrumbNavigationName });
}

/**
 * Asserts the visible breadcrumb labels.
 *
 * @param {Page} page - The Playwright page under test.
 * @param {string[]} labels - The expected breadcrumb labels.
 */
async function expectBreadcrumbLabels(page: Page, labels: string[]) {
  const breadcrumb = getBreadcrumb(page);

  await expect(breadcrumb).toBeVisible();

  for (const label of labels) {
    await expect(breadcrumb).toContainText(label);
  }
}

/**
 * Returns the rendered theme mode switch.
 *
 * @param {Page} page - The Playwright page under test.
 * @returns {Locator} The theme mode switch locator.
 */
function getThemeModeSwitch(page: Page) {
  return page.getByRole('switch', { name: themeSwitchLabel });
}

/**
 * Returns the computed header background colour.
 *
 * @param {Page} page - The Playwright page under test.
 * @returns {Promise<string>} The computed banner background colour.
 */
async function getHeaderBackgroundColour(page: Page) {
  return page.getByRole('banner').evaluate((element) => getComputedStyle(element).backgroundColor);
}

/**
 * Installs a deterministic `google.script.run` mock that keeps auth status pending.
 *
 * @param {Page} page - The Playwright page under test.
 */
async function mockPendingGoogleScriptRun(page: Page) {
  await page.addInitScript(`
    (() => {
      const createGoogleScriptRunApiHandlerMock = ${googleScriptRunApiHandlerFactorySource};
      const backendSettingsFixture = ${JSON.stringify(backendSettingsFixture)};

      globalThis.google = {
        script: {
          run: createGoogleScriptRunApiHandlerMock((request, callbacks) => {
            if (request?.method === 'getBackendConfig') {
              callbacks.successHandler?.({
                ok: true,
                requestId: 'req-backend-config',
                data: backendSettingsFixture,
              });
              return;
            }

            if (request?.method === 'getABClassPartials') {
              callbacks.successHandler?.({
                ok: true,
                requestId: 'req-class-partials',
                data: [],
              });
            }
          }),
        },
      };
    })();
  `);
}

test.describe('app shell', () => {
  test('breadcrumb visible and readable on each page', async ({ page }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    await expectBreadcrumbLabels(page, [appBreadcrumbBaseLabel, defaultNavigationLabel]);

    for (const { heading } of pageExpectations) {
      await page.getByRole('menuitem', { name: heading }).click();
      await expectBreadcrumbLabels(page, [appBreadcrumbBaseLabel, heading]);
    }
  });

  test('breadcrumb updates after menu navigation in real browser', async ({ page }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    for (const heading of ['Classes', 'Assignments', settingsLabel]) {
      await page.getByRole('menuitem', { name: heading }).click();
      await expectBreadcrumbLabels(page, [appBreadcrumbBaseLabel, heading]);
    }
  });

  test('breadcrumb remains correct after collapse and expand and then navigation', async ({
    page,
  }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    await page.getByRole('button', { name: collapseNavigationButtonLabel }).click();
    await page.getByRole('button', { name: expandNavigationButtonLabel }).click();

    await page.getByRole('menuitem', { name: settingsLabel }).click();
    await expectBreadcrumbLabels(page, [appBreadcrumbBaseLabel, settingsLabel]);
  });

  test('user can navigate to Dashboard, Classes, Assignments, and Settings via menu clicks', async ({
    page,
  }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    for (const label of navigationMenuLabels) {
      await page.getByRole('menuitem', { name: label }).click();
      await expect(page.getByRole('menuitem', { name: label })).toHaveClass(/ant-menu-item-selected/);
    }
  });

  test('collapsed mode still allows navigation by icon click', async ({ page }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    await page.getByRole('button', { name: collapseNavigationButtonLabel }).click();

    const menuItems = page.getByRole('navigation', { name: primaryNavigationLabel }).getByRole('menuitem');

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
      await page.getByRole('button', { name: collapseNavigationButtonLabel }).click();
      await page.getByRole('button', { name: expandNavigationButtonLabel }).click();
    }

    const settingsItem = page.getByRole('menuitem', { name: settingsLabel });

    await settingsItem.click();
    await expect(settingsItem).toHaveClass(/ant-menu-item-selected/);
  });

  test('settings tabs switch visible panels in the browser', async ({ page }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    await page.getByRole('menuitem', { name: settingsLabel }).click();

    const classesTab = page.getByRole('tab', { name: 'Classes' });
    const backendSettingsTab = page.getByRole('tab', { name: 'Backend settings' });

    await expect(classesTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('region', { name: 'Classes panel' })).toBeVisible();

    await backendSettingsTab.click();

    await expect(backendSettingsTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('region', { name: 'Backend settings panel' })).toBeVisible();
  });

  test('shows shell on initial load', async ({ page }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('navigation', { name: primaryNavigationLabel })).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('button', { name: collapseNavigationButtonLabel })).toBeVisible();
  });

  test('hamburger collapses and expands nav rail visually', async ({ page }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    const collapseButton = page.getByRole('button', { name: collapseNavigationButtonLabel });
    const navigation = page.getByRole('navigation', { name: primaryNavigationLabel });
    const expandedBox = await navigation.boundingBox();

    expect(expandedBox).not.toBeNull();

    await collapseButton.click();

    // Re-acquire by the new accessible name after the toggle changes the button label.
    const expandButton = page.getByRole('button', { name: expandNavigationButtonLabel });

    await expect(expandButton).toBeVisible();
    await expect(expandButton).toHaveAttribute(ariaExpandedAttribute, 'false');
    await expect(expandButton.getByLabel('menu-unfold')).toBeVisible();

    const collapsedBox = await navigation.boundingBox();

    expect(collapsedBox).not.toBeNull();
    expect(collapsedBox!.width).toBeLessThan(expandedBox!.width);

    await expandButton.click();

    const reexpandedButton = page.getByRole('button', { name: collapseNavigationButtonLabel });

    await expect(reexpandedButton).toBeVisible();
    await expect(reexpandedButton).toHaveAttribute(ariaExpandedAttribute, 'true');

    const reexpandedBox = await navigation.boundingBox();

    expect(reexpandedBox).not.toBeNull();
    expect(reexpandedBox!.width).toBeGreaterThan(collapsedBox!.width);
    await expect(reexpandedButton).toBeVisible();
  });

  test('keyboard activation of hamburger works', async ({ page }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    const collapseButton = page.getByRole('button', { name: collapseNavigationButtonLabel });

    await collapseButton.focus();
    await page.keyboard.press('Enter');

    // Re-acquire by the new accessible name after the toggle changes the button label.
    const expandButton = page.getByRole('button', { name: expandNavigationButtonLabel });

    await expect(expandButton).toHaveAttribute(ariaExpandedAttribute, 'false');

    await page.keyboard.press(' ');

    const reexpandedButton = page.getByRole('button', { name: collapseNavigationButtonLabel });

    await expect(reexpandedButton).toHaveAttribute(ariaExpandedAttribute, 'true');
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

  test('user can toggle to dark mode and observe visual change', async ({ page }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    const initialHeaderBackground = await getHeaderBackgroundColour(page);

    await getThemeModeSwitch(page).click();

    await expect(getThemeModeSwitch(page)).toBeChecked();
    await expect
      .poll(async () => getHeaderBackgroundColour(page))
      .not.toBe(initialHeaderBackground);
  });

  test('user can toggle back to light mode and observe visual reversion', async ({ page }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    const initialHeaderBackground = await getHeaderBackgroundColour(page);
    const themeModeSwitch = getThemeModeSwitch(page);

    await themeModeSwitch.click();
    await expect(themeModeSwitch).toBeChecked();

    await themeModeSwitch.click();

    await expect(themeModeSwitch).not.toBeChecked();
    await expect.poll(async () => getHeaderBackgroundColour(page)).toBe(initialHeaderBackground);
  });

  test('theme toggle works after navigating across all four pages', async ({ page }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    const themeModeSwitch = getThemeModeSwitch(page);

    await themeModeSwitch.click();
    await expect(themeModeSwitch).toBeChecked();

    for (const { heading } of pageExpectations) {
      await page.getByRole('menuitem', { name: heading }).click();
      await expect(themeModeSwitch).toBeChecked();
    }
  });

  test('theme toggle remains operable after collapsing and expanding nav', async ({ page }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    const initialHeaderBackground = await getHeaderBackgroundColour(page);

    await page.getByRole('button', { name: collapseNavigationButtonLabel }).click();
    await page.getByRole('button', { name: expandNavigationButtonLabel }).click();

    const themeModeSwitch = getThemeModeSwitch(page);

    await themeModeSwitch.click();

    await expect(themeModeSwitch).toBeChecked();
    await expect
      .poll(async () => getHeaderBackgroundColour(page))
      .not.toBe(initialHeaderBackground);
  });

  test('navigating to each menu item shows matching page heading in browser', async ({ page }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    for (const { heading, summary } of pageExpectations) {
      await page.getByRole('menuitem', { name: heading }).click();
      await expect(page.getByRole('heading', { level: 2, name: heading })).toBeVisible();
      await expect(page.getByText(summary)).toBeVisible();
    }
  });

  test('placeholder text for each page is visible and unique', async ({ page }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    for (const { heading, summary } of pageExpectations) {
      await page.getByRole('menuitem', { name: heading }).click();
      await expect(page.getByText(summary)).toBeVisible();

      for (const otherPage of pageExpectations) {
        if (otherPage.heading !== heading) {
          await expect(page.getByText(otherPage.summary)).toHaveCount(0);
        }
      }
    }
  });

  test('rapid navigation does not leave stale page content onscreen', async ({ page }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    for (const { heading } of pageExpectations) {
      await page.getByRole('menuitem', { name: heading }).click();
    }

    const finalPage = pageExpectations.at(lastPageExpectationOffset);

    if (finalPage === undefined) {
      throw new Error('Expected at least one page expectation.');
    }

    await expect(page.getByRole('heading', { level: 2, name: finalPage.heading })).toBeVisible();
    await expect(page.getByText(finalPage.summary)).toBeVisible();

    for (const pageExpectation of pageExpectations.slice(0, lastPageExpectationOffset)) {
      await expect(page.getByText(pageExpectation.summary)).toHaveCount(0);
    }
  });
});
