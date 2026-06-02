import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { pageContent } from '../src/pages/pageContent';
import { googleScriptRunApiHandlerFactorySource } from '../src/test/googleScriptRunHarness';

const appBreadcrumbBaseLabel = 'AssessmentBot Frontend';
const breadcrumbNavigationName = 'Breadcrumb';
const primaryNavigationLabel = 'Primary navigation';
const classesLabel = 'Classes';
const expectedMenuItemCount = 4;

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

const classPartialsFixture = [];
const yearGroupsFixture = [];

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
 * Installs a deterministic `google.script.run` mock that keeps auth status pending
 * and returns empty datasets for class partials, year groups, and other warmup data.
 *
 * @param {Page} page - The Playwright page under test.
 */
async function mockPendingGoogleScriptRun(page: Page) {
  await page.addInitScript(`
    (() => {
      const createGoogleScriptRunApiHandlerMock = ${googleScriptRunApiHandlerFactorySource};
      const backendSettingsFixture = ${JSON.stringify(backendSettingsFixture)};
      const classPartialsFixture = ${JSON.stringify(classPartialsFixture)};
      const yearGroupsFixture = ${JSON.stringify(yearGroupsFixture)};

      let methodCallTracker: Record<string, number> = {};

      globalThis.google = {
        script: {
          run: createGoogleScriptRunApiHandlerMock((request, callbacks) => {
            const method = (request as { method?: unknown })?.method as string | undefined;
            
            if (method) {
              methodCallTracker[method] = (methodCallTracker[method] || 0) + 1;
            }

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
                data: classPartialsFixture,
              });
              return;
            }

            if (request?.method === 'getYearGroups') {
              callbacks.successHandler?.({
                ok: true,
                requestId: 'req-yeargroups',
                data: yearGroupsFixture,
              });
              return;
            }

            if (request?.method === 'getGoogleClassrooms') {
              callbacks.successHandler?.({
                ok: true,
                requestId: 'req-google-classrooms',
                data: [],
              });
              return;
            }

            // Keep auth and other startup methods pending
            // No callback invoked = pending state
          }),
        },
      };

      // Expose the tracker to global scope so tests can inspect it
      globalThis.__methodCallTracker__ = methodCallTracker;
    })();
  `);
}

test.describe('Classes page navigation', () => {
  test('user can navigate to Classes page via top-level menu click', async ({ page }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    await page.getByRole('menuitem', { name: classesLabel }).click();

    await expect(
      page.getByRole('heading', { level: 2, name: pageContent.classes.heading })
    ).toBeVisible();
    await expect(page.getByText(pageContent.classes.summary)).toBeVisible();
  });

  test('Classes page breadcrumb updates correctly on navigation', async ({ page }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    await page.getByRole('menuitem', { name: classesLabel }).click();

    await expectBreadcrumbLabels(page, [appBreadcrumbBaseLabel, classesLabel]);
  });

  test('Classes page menu item becomes selected when clicked', async ({ page }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    await page.getByRole('menuitem', { name: classesLabel }).click();

    await expect(page.getByRole('menuitem', { name: classesLabel })).toHaveClass(
      /ant-menu-item-selected/
    );
  });

  test('Classes page is in the correct position in navigation (between assignments and settings)', async ({
    page,
  }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    const navigation = page.getByRole('navigation', { name: primaryNavigationLabel });
    const menuItems = navigation.getByRole('menuitem');

    await expect(menuItems).toHaveCount(expectedMenuItemCount);

    const menuItemTexts = await menuItems.evaluateAll((items) =>
      items.map((item) => item.textContent?.trim() || '')
    );

    expect(menuItemTexts).toEqual(['Dashboard', 'Assignments', classesLabel, 'Settings']);
  });
});

test.describe('Classes page method call tracking', () => {
  test('opening Classes page does not call getGoogleClassrooms', async ({ page }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    await page.getByRole('menuitem', { name: classesLabel }).click();

    // Wait for the page to render
    await expect(
      page.getByRole('heading', { level: 2, name: pageContent.classes.heading })
    ).toBeVisible();

    // Check that getGoogleClassrooms was not called
    // The tracker is exposed to global scope in the init script
    const tracker = await page.evaluate(() => {
      return (
        (globalThis as { __methodCallTracker__?: Record<string, number> }).__methodCallTracker__ ||
        {}
      );
    });

    expect(tracker['getGoogleClassrooms']).toBeUndefined();
  });
});

test.describe('Classes page shell-wide integration', () => {
  test('Classes page integrates with shell-wide top-level navigation', async ({ page }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    // Test all top-level pages including Classes
    const allPages = [
      {
        name: 'Dashboard',
        heading: pageContent.dashboard.heading,
        summary: pageContent.dashboard.summary,
      },
      {
        name: 'Assignments',
        heading: pageContent.assignments.heading,
        summary: pageContent.assignments.summary,
      },
      {
        name: classesLabel,
        heading: pageContent.classes.heading,
        summary: pageContent.classes.summary,
      },
      {
        name: 'Settings',
        heading: pageContent.settings.heading,
        summary: pageContent.settings.summary,
      },
    ];

    for (const { name, heading, summary } of allPages) {
      await page.getByRole('menuitem', { name }).click();
      await expect(page.getByRole('heading', { level: 2, name: heading })).toBeVisible();
      await expect(page.getByText(summary)).toBeVisible();
      await expectBreadcrumbLabels(page, [appBreadcrumbBaseLabel, name]);
    }
  });

  test('Classes page maintains menu count consistency', async ({ page }) => {
    await mockPendingGoogleScriptRun(page);
    await page.goto('/');

    const navigation = page.getByRole('navigation', { name: primaryNavigationLabel });
    const menuItems = navigation.getByRole('menuitem');

    // Should have expectedMenuItemCount top-level menu items
    await expect(menuItems).toHaveCount(expectedMenuItemCount);

    // Navigate to Classes and verify count remains the same
    await page.getByRole('menuitem', { name: classesLabel }).click();
    await expect(navigation.getByRole('menuitem')).toHaveCount(expectedMenuItemCount);
  });
});
