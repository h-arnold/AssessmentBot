import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { pageContent } from '../src/pages/pageContent';
import { googleScriptRunApiHandlerFactorySource } from '../src/test/googleScriptRunHarness';
import { installRuntimeMock, type RuntimeScenario } from './shared/endToEndRuntimeMocks';

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

// Section 4: Year-group collapse behaviour fixtures
// These fixtures provide trustworthy data with proper year group and class partial mappings

// Year groups in mixed order (will be sorted alphabetically by name: Year 10, Year 11, Year 9)
const mixedOrderYearGroups = [
  { key: 'year-group-11', name: 'Year 11' },
  { key: 'year-group-9', name: 'Year 9' },
  { key: 'year-group-10', name: 'Year 10' },
] as const;

// Class partials belonging to each year group
const mixedOrderClassPartials = [
  {
    classId: 'class-math-11a',
    className: 'Mathematics 11A',
    cohortKey: null,
    courseLength: 1,
    yearGroupKey: 'year-group-11',
    classOwner: null,
    teachers: [],
    active: null,
  },
  {
    classId: 'class-science-9',
    className: 'Science 9',
    cohortKey: null,
    courseLength: 1,
    yearGroupKey: 'year-group-9',
    classOwner: null,
    teachers: [],
    active: null,
  },
  {
    classId: 'class-math-10a',
    className: 'Mathematics 10A',
    cohortKey: null,
    courseLength: 1,
    yearGroupKey: 'year-group-10',
    classOwner: null,
    teachers: [],
    active: null,
  },
  {
    classId: 'class-english-10',
    className: 'English 10',
    cohortKey: null,
    courseLength: 1,
    yearGroupKey: 'year-group-10',
    classOwner: null,
    teachers: [],
    active: null,
  },
] as const;

// Year groups with empty one (Year 9 has no classes)
const yearGroupsWithEmpty = [
  { key: 'year-group-9', name: 'Year 9' },
  { key: 'year-group-10', name: 'Year 10' },
] as const;

// Class partials for empty panel test (only classes for Year 10)
const classPartialsForEmptyPanel = [
  {
    classId: 'class-math-10a',
    className: 'Mathematics 10A',
    cohortKey: null,
    courseLength: 1,
    yearGroupKey: 'year-group-10',
    classOwner: null,
    teachers: [],
    active: null,
  },
] as const;

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

/**
 * Returns plain JavaScript objects without TypeScript type annotations for JSON serialization.
 *
 * @param {typeof mixedOrderClassPartials} classPartials - Class partials to convert.
 * @returns {Array<Record<string, unknown>>} Plain objects.
 */
function getPlainClassPartials(
  classPartials: typeof mixedOrderClassPartials
): Array<Record<string, unknown>> {
  return classPartials.map((cp) => ({
    classId: cp.classId,
    className: cp.className,
    cohortKey: cp.cohortKey,
    courseLength: cp.courseLength,
    yearGroupKey: cp.yearGroupKey,
    classOwner: cp.classOwner,
    teachers: cp.teachers,
    active: cp.active,
  }));
}

/**
 * Creates a runtime scenario for Section 4 classes page tests.
 *
 * @param {object} options - Options for the scenario.
 * @param {Array<Record<string, unknown>>} options.classPartials - Class partials to return.
 * @param {Array<{key: string; name: string}>} options.yearGroups - Year groups to return.
 * @returns {import('./shared/endToEndRuntimeMocks').RuntimeScenario} Runtime scenario.
 */
function createClassesScenario(
  options: {
    classPartials?: Array<Record<string, unknown>>;
    yearGroups?: Array<{ key: string; name: string }>;
  } = {}
): RuntimeScenario {
  const {
    classPartials = getPlainClassPartials(mixedOrderClassPartials),
    yearGroups = mixedOrderYearGroups,
  } = options;

  return {
    getAuthorisationStatus: [{ kind: 'success', data: true }],
    getABClassPartials: [{ kind: 'success', data: classPartials }],
    getCohorts: [{ kind: 'success', data: [] }],
    getYearGroups: [{ kind: 'success', data: yearGroups }],
    getAssignmentTopics: [{ kind: 'success', data: [] }],
    getAssignmentDefinitionPartials: [{ kind: 'success', data: [] }],
  };
}

/**
 * Creates a runtime scenario for Section 4 empty panel test.
 *
 * @returns {import('./shared/endToEndRuntimeMocks').RuntimeScenario} Runtime scenario.
 */
function createClassesEmptyPanelScenario(): RuntimeScenario {
  return createClassesScenario({
    classPartials: getPlainClassPartials(classPartialsForEmptyPanel),
    yearGroups: yearGroupsWithEmpty,
  });
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

// ============================================================================
// Section 4: Year-group collapse behaviour
// ============================================================================

test.describe('Section 4: Year-group collapse behaviour', () => {
  test('collapse headers should render in alphabetical order', async ({ page }) => {
    // Use the mock that returns trustworthy data for Section 4
    const scenario = createClassesScenario();
    await installRuntimeMock(page, scenario);
    await page.goto('/');
    await page.getByRole('menuitem', { name: classesLabel }).click();

    // Verify collapse headers render in alphabetical order: Year 10, Year 11, Year 9
    const year10Header = page.getByRole('heading', { level: 3, name: 'Year 10' });
    const year11Header = page.getByRole('heading', { level: 3, name: 'Year 11' });
    const year9Header = page.getByRole('heading', { level: 3, name: 'Year 9' });

    await expect(year10Header).toBeVisible();
    await expect(year11Header).toBeVisible();
    await expect(year9Header).toBeVisible();

    const allHeaders = page.getByRole('heading', { level: 3 });
    const headerTexts = await allHeaders.evaluateAll((headers) =>
      headers.map((h) => h.textContent?.trim() || '')
    );
    expect(headerTexts).toEqual(['Year 10', 'Year 11', 'Year 9']);
  });

  test('first alphabetical panel should be expanded by default', async ({ page }) => {
    // Use the mock that returns trustworthy data for Section 4
    const scenario = createClassesScenario();
    await installRuntimeMock(page, scenario);
    await page.goto('/');
    await page.getByRole('menuitem', { name: classesLabel }).click();

    // Year 10 should be first alphabetically and expanded by default
    // Check that the panel content is visible
    const year10PanelContent = page.locator('#panel-content-year-group-10');
    await expect(year10PanelContent).toBeVisible();

    // Also check that the panel region with aria-label exists
    const year10Panel = page.getByRole('region', { name: /year 10/i });
    await expect(year10Panel).toBeVisible();
  });

  test('multi-expand - expanding second panel keeps first expanded', async ({ page }) => {
    // Use the mock that returns trustworthy data for Section 4
    const scenario = createClassesScenario();
    await installRuntimeMock(page, scenario);
    await page.goto('/');
    await page.getByRole('menuitem', { name: classesLabel }).click();

    const year11Header = page.getByRole('heading', { level: 3, name: 'Year 11' });

    // Year 10 should be expanded by default (check the panel content has the class)
    const year10PanelContent = page.locator('#panel-content-year-group-10');
    await expect(year10PanelContent).toBeVisible();

    await year11Header.click();

    // Both panels should remain expanded (multi-expand mode)
    // Year 10 panel should still be visible
    await expect(year10PanelContent).toBeVisible();
    // Year 11 panel should now be visible
    const year11PanelContent = page.locator('#panel-content-year-group-11');
    await expect(year11PanelContent).toBeVisible();
  });

  test('collapse and re-expand panel using visible controls', async ({ page }) => {
    // Use the mock that returns trustworthy data for Section 4
    const scenario = createClassesScenario();
    await installRuntimeMock(page, scenario);
    await page.goto('/');
    await page.getByRole('menuitem', { name: classesLabel }).click();

    const year10Header = page.getByRole('heading', { level: 3, name: 'Year 10' });
    const year10PanelContent = page.locator('#panel-content-year-group-10');

    // Year 10 should be expanded by default
    await expect(year10PanelContent).toBeVisible();

    await year10Header.click();

    // Year 10 panel should be collapsed (hidden)
    await expect(year10PanelContent).not.toBeVisible();

    await year10Header.click();

    // Year 10 panel should be expanded again
    await expect(year10PanelContent).toBeVisible();
  });

  test('empty year-group panel shows in-panel empty message', async ({ page }) => {
    // Use the mock that returns trustworthy data with empty year group panel
    const scenario = createClassesEmptyPanelScenario();
    await installRuntimeMock(page, scenario);
    await page.goto('/');
    await page.getByRole('menuitem', { name: classesLabel }).click();

    // Year 9 panel with no classes should exist
    // The panel content div has id="panel-content-year-group-9"
    // Year 9 panel is collapsed by default (Year 10 is first alphabetical and expanded)
    const year9PanelContent = page.locator('#panel-content-year-group-9');
    await expect(year9PanelContent).not.toBeVisible();

    const year9Header = page.getByRole('heading', { level: 3, name: 'Year 9' });
    await year9Header.click();

    // Wait for the panel to expand
    await expect(year9PanelContent).toBeVisible();

    // Check that the empty message is displayed
    await expect(year9PanelContent).toContainText('No classes');
  });
});
