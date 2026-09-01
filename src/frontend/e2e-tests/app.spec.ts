import { expect, test, type Page } from '@playwright/test';
import { pageContent } from '../src/pages/pageContent';
import { googleScriptRunApiHandlerFactorySource } from '../src/test/googleScriptRunHarness';

const breadcrumbNavigationName = 'Breadcrumb';
const defaultNavigationLabel = 'Dashboard';
const pageExpectations = [
  pageContent.dashboard,
  pageContent.assignments,
  pageContent.classes,
  pageContent.settings,
  pageContent.heatmaps,
] as const;

const expectedNavigationItemCount = pageExpectations.length;
const classesNavigationItemIndex = 2;
const collapseExpandCycles = 2;
const themeSwitchLabel = 'Dark mode';
const lastPageExpectationOffset = -1;
const ariaExpandedAttribute = 'aria-expanded';
const primaryNavigationLabel = 'Primary navigation';
const collapseNavigationButtonLabel = 'Collapse navigation';
const expandNavigationButtonLabel = 'Expand navigation';
const classesLabel = 'Classes';
const settingsLabel = 'Settings';
const heatmapsPageHeading = pageContent.heatmaps.heading;
const navigationMenuLabels = pageExpectations.map(({ heading }) => heading);
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
  const banner = page.getByRole('banner');
  await expect(banner).toBeVisible();
  return banner.evaluate((element) => getComputedStyle(element).backgroundColor);
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

            if (request?.method === 'getAuthorisationStatus') {
               // AppAuthGate (wrapping the whole app in main.tsx) blocks the shell until
               // authorisation and startup warm-up have resolved, so this shell fixture supplies
               // valid empty responses for every warm-up dataset.
              callbacks.successHandler?.({
                ok: true,
                requestId: 'req-authorisation-status',
                data: true,
              });
              return;
            }

            if (request?.method === 'getABClassPartials') {
              callbacks.successHandler?.({
                ok: true,
                requestId: 'req-class-partials',
                data: [],
              });
              return;
            }

            if (
              request?.method === 'getAssignmentDefinitionPartials' ||
              request?.method === 'getAssignmentTopics' ||
              request?.method === 'getCohorts' ||
              request?.method === 'getYearGroups'
            ) {
              callbacks.successHandler?.({
                ok: true,
                requestId: 'req-' + request.method,
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

    await expectBreadcrumbLabels(page, [defaultNavigationLabel]);

    for (const { heading } of pageExpectations) {
      await page.getByRole('menuitem', { name: heading }).click();
      await expectBreadcrumbLabels(page, [heading]);
    }
  });

  test('breadcrumb updates after menu navigation in real browser', async ({ page }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    for (const heading of ['Assignments', settingsLabel, 'Dashboard']) {
      await page.getByRole('menuitem', { name: heading }).click();
      await expectBreadcrumbLabels(page, [heading]);
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
    await expectBreadcrumbLabels(page, [settingsLabel]);
  });

  test('user can navigate to the top-level pages via menu clicks', async ({ page }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    for (const label of navigationMenuLabels) {
      await page.getByRole('menuitem', { name: label }).click();
      await expect(page.getByRole('menuitem', { name: label })).toHaveClass(
        /ant-menu-item-selected/
      );
    }
  });

  test('collapsed mode still allows navigation by icon click', async ({ page }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    await page.getByRole('button', { name: collapseNavigationButtonLabel }).click();

    const menuItems = page
      .getByRole('navigation', { name: primaryNavigationLabel })
      .getByRole('menuitem');

    await expect(menuItems).toHaveCount(expectedNavigationItemCount);
    await menuItems.nth(classesNavigationItemIndex).click();
    await expect(menuItems.nth(classesNavigationItemIndex)).toHaveClass(/ant-menu-item-selected/);
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

    const classesTab = page.getByRole('tab', { name: classesLabel });
    const backendSettingsTab = page.getByRole('tab', { name: 'Backend settings' });

    await expect(classesTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('region', { name: 'Classes management panel' })).toBeVisible();

    // Wait for the backend settings tab to be ready before clicking
    await expect(backendSettingsTab).toBeVisible();
    await expect(backendSettingsTab).toBeEnabled();
    await backendSettingsTab.click();

    await expect(backendSettingsTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('region', { name: 'Backend settings panel' })).toBeVisible();
  });

  test('Settings page still contains Classes tab after new top-level Classes page is added', async ({
    page,
  }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    await page.getByRole('menuitem', { name: settingsLabel }).click();

    const classesTab = page.getByRole('tab', { name: classesLabel });
    await expect(classesTab).toBeVisible();
    await expect(classesTab).toHaveAttribute('aria-selected', 'true');
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
    const assignmentsItem = page.getByRole('menuitem', { name: 'Assignments' });

    await dashboardItem.click();
    await expect(dashboardItem).toHaveClass(/ant-menu-item-selected/);

    await assignmentsItem.click();

    await expect(assignmentsItem).toHaveClass(/ant-menu-item-selected/);
    await expect(dashboardItem).not.toHaveClass(/ant-menu-item-selected/);
  });

  test('user can toggle to dark mode and observe visual change', async ({ page }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    const themeModeSwitch = getThemeModeSwitch(page);
    await expect(themeModeSwitch).toBeVisible();

    const initialHeaderBackground = await getHeaderBackgroundColour(page);

    await themeModeSwitch.click();

    await expect(themeModeSwitch).toBeChecked();
    await expect
      .poll(async () => getHeaderBackgroundColour(page), { timeout: 10_000 })
      .not.toBe(initialHeaderBackground);
  });

  test('user can toggle back to light mode and observe visual reversion', async ({ page }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    const themeModeSwitch = getThemeModeSwitch(page);
    await expect(themeModeSwitch).toBeVisible();

    const initialHeaderBackground = await getHeaderBackgroundColour(page);

    await themeModeSwitch.click();
    await expect(themeModeSwitch).toBeChecked();

    await themeModeSwitch.click();

    await expect(themeModeSwitch).not.toBeChecked();
    await expect
      .poll(async () => getHeaderBackgroundColour(page), { timeout: 10_000 })
      .toBe(initialHeaderBackground);
  });

  test('theme toggle works after navigating across all pages', async ({ page }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    const themeModeSwitch = getThemeModeSwitch(page);
    await expect(themeModeSwitch).toBeVisible();

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

    const themeModeSwitch = getThemeModeSwitch(page);
    await expect(themeModeSwitch).toBeVisible();

    const initialHeaderBackground = await getHeaderBackgroundColour(page);

    await page.getByRole('button', { name: collapseNavigationButtonLabel }).click();
    await page.getByRole('button', { name: expandNavigationButtonLabel }).click();

    await themeModeSwitch.click();

    await expect(themeModeSwitch).toBeChecked();
    await expect
      .poll(async () => getHeaderBackgroundColour(page), { timeout: 10_000 })
      .not.toBe(initialHeaderBackground);
  });

  test('navigating to each menu item shows matching page heading in browser', async ({ page }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    for (const { heading, summary } of pageExpectations) {
      await page.getByRole('menuitem', { name: heading }).click();
      await expect(page.getByRole('heading', { level: 2, name: heading })).toBeVisible();
      // Heatmaps is a placeholder stub until the builder surface assembles in the plan's Section 6; then extend this summary assertion to Heatmaps like every other page.
      if (heading !== heatmapsPageHeading) {
        await expect(page.getByText(summary)).toBeVisible();
      }
    }
  });

  test('placeholder text for each page is visible and unique', async ({ page }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    for (const { heading, summary } of pageExpectations) {
      await page.getByRole('menuitem', { name: heading }).click();
      // Heatmaps is a placeholder stub until the builder surface assembles in the plan's Section 6; then extend this summary assertion to Heatmaps like every other page.
      if (heading !== heatmapsPageHeading) {
        await expect(page.getByText(summary)).toBeVisible();
      }

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
    // Heatmaps is a placeholder stub until the builder surface assembles in the plan's Section 6; then extend this summary assertion to Heatmaps like every other page.
    if (finalPage.heading !== heatmapsPageHeading) {
      await expect(page.getByText(finalPage.summary)).toBeVisible();
    }

    for (const pageExpectation of pageExpectations.slice(0, lastPageExpectationOffset)) {
      await expect(page.getByText(pageExpectation.summary)).toHaveCount(0);
    }
  });
});
