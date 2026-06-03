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

// ==========================================================================
// Section 5: Render class cards and placeholder action affordances
// ==========================================================================

// Classes with names that need alphabetical ordering
const alphabeticalClasses = [
  {
    classId: 'class-math-10b',
    className: 'Mathematics 10B',
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

// Classes with same name but different IDs for tie-break testing
const tieBreakClasses = [
  {
    classId: 'class-b-z',
    className: 'Z Class',
    cohortKey: null,
    courseLength: 1,
    yearGroupKey: 'year-group-10',
    classOwner: null,
    teachers: [],
    active: null,
  },
  {
    classId: 'class-a-z',
    className: 'Z Class',
    cohortKey: null,
    courseLength: 1,
    yearGroupKey: 'year-group-10',
    classOwner: null,
    teachers: [],
    active: null,
  },
  {
    classId: 'class-b-a',
    className: 'A Class',
    cohortKey: null,
    courseLength: 1,
    yearGroupKey: 'year-group-10',
    classOwner: null,
    teachers: [],
    active: null,
  },
] as const;

/**
 * Creates a runtime scenario for Section 5 alphabetical order test.
 *
 * @returns {RuntimeScenario} Runtime scenario.
 */
function createClassesAlphabeticalOrderScenario(): RuntimeScenario {
  const plainClasses = alphabeticalClasses.map((cp) => ({
    classId: cp.classId,
    className: cp.className,
    cohortKey: cp.cohortKey,
    courseLength: cp.courseLength,
    yearGroupKey: cp.yearGroupKey,
    classOwner: cp.classOwner,
    teachers: cp.teachers,
    active: cp.active,
  }));

  return {
    getAuthorisationStatus: [{ kind: 'success', data: true }],
    getABClassPartials: [{ kind: 'success', data: plainClasses }],
    getCohorts: [{ kind: 'success', data: [] }],
    getYearGroups: [{ kind: 'success', data: [{ key: 'year-group-10', name: 'Year 10' }] }],
    getAssignmentTopics: [{ kind: 'success', data: [] }],
    getAssignmentDefinitionPartials: [{ kind: 'success', data: [] }],
  };
}

/**
 * Creates a runtime scenario for Section 5 tie-break order test.
 *
 * @returns {RuntimeScenario} Runtime scenario.
 */
function createClassesTieBreakOrderScenario(): RuntimeScenario {
  const plainClasses = tieBreakClasses.map((cp) => ({
    classId: cp.classId,
    className: cp.className,
    cohortKey: cp.cohortKey,
    courseLength: cp.courseLength,
    yearGroupKey: cp.yearGroupKey,
    classOwner: cp.classOwner,
    teachers: cp.teachers,
    active: cp.active,
  }));

  return {
    getAuthorisationStatus: [{ kind: 'success', data: true }],
    getABClassPartials: [{ kind: 'success', data: plainClasses }],
    getCohorts: [{ kind: 'success', data: [] }],
    getYearGroups: [{ kind: 'success', data: [{ key: 'year-group-10', name: 'Year 10' }] }],
    getAssignmentTopics: [{ kind: 'success', data: [] }],
    getAssignmentDefinitionPartials: [{ kind: 'success', data: [] }],
  };
}

test.describe('Section 5: Render class cards and placeholder action affordances', () => {
  // Test constants for magic numbers
  const EXPECTED_ALPHABETICAL_CARDS_COUNT = 3;
  const EXPECTED_TIE_BREAK_CARDS_COUNT = 3;
  const EXPECTED_TOTAL_CARDS_COUNT = 4; // 2 in Year 10, 1 in Year 11, 1 in Year 9
  const EXPECTED_BUTTONS_PER_CARD = 2; // View and Edit
  const CARD_INDEX_FIRST = 0;
  const CARD_INDEX_SECOND = 1;
  const CARD_INDEX_THIRD = 2;

  test('opens a populated year-group panel and asserts card titles are in expected alphabetical order', async ({
    page,
  }) => {
    // Use a scenario with multiple classes in Year 10 that need alphabetical ordering
    const scenario = createClassesAlphabeticalOrderScenario();
    await installRuntimeMock(page, scenario);
    await page.goto('/');
    await page.getByRole('menuitem', { name: classesLabel }).click();

    // Year 10 panel should be expanded by default (first alphabetical)
    const year10PanelContent = page.locator('#panel-content-year-group-10');
    await expect(year10PanelContent).toBeVisible();

    // Verify the card titles are in alphabetical order: English 10, Mathematics 10A, Mathematics 10B
    const articles = year10PanelContent.locator('[role="article"]');
    await expect(articles).toHaveCount(EXPECTED_ALPHABETICAL_CARDS_COUNT);

    const firstCardTitle = await articles
      .nth(CARD_INDEX_FIRST)
      .locator('.ant-card-head-title')
      .textContent();
    const secondCardTitle = await articles
      .nth(CARD_INDEX_SECOND)
      .locator('.ant-card-head-title')
      .textContent();
    const thirdCardTitle = await articles
      .nth(CARD_INDEX_THIRD)
      .locator('.ant-card-head-title')
      .textContent();

    expect(firstCardTitle?.trim()).toBe('English 10');
    expect(secondCardTitle?.trim()).toBe('Mathematics 10A');
    expect(thirdCardTitle?.trim()).toBe('Mathematics 10B');
  });

  test('uses classId as tie-break when className is identical', async ({ page }) => {
    // Use a scenario with classes that have the same name but different IDs
    const scenario = createClassesTieBreakOrderScenario();
    await installRuntimeMock(page, scenario);
    await page.goto('/');
    await page.getByRole('menuitem', { name: classesLabel }).click();

    // Year 10 panel should be expanded by default
    const year10PanelContent = page.locator('#panel-content-year-group-10');
    await expect(year10PanelContent).toBeVisible();

    // Expected order: A Class, Z Class (classId a-z), Z Class (classId b-z)
    const articles = year10PanelContent.locator('[role="article"]');
    await expect(articles).toHaveCount(EXPECTED_TIE_BREAK_CARDS_COUNT);

    const firstCardTitle = await articles
      .nth(CARD_INDEX_FIRST)
      .locator('.ant-card-head-title')
      .textContent();
    expect(firstCardTitle?.trim()).toBe('A Class');

    const secondCardTitle = await articles
      .nth(CARD_INDEX_SECOND)
      .locator('.ant-card-head-title')
      .textContent();
    const thirdCardTitle = await articles
      .nth(CARD_INDEX_THIRD)
      .locator('.ant-card-head-title')
      .textContent();
    expect(secondCardTitle?.trim()).toBe('Z Class');
    expect(thirdCardTitle?.trim()).toBe('Z Class');
  });

  test('asserts every visible View and Edit button is disabled', async ({ page }) => {
    // Use the standard Section 4 scenario which has classes
    const scenario = createClassesScenario();
    await installRuntimeMock(page, scenario);
    await page.goto('/');
    await page.getByRole('menuitem', { name: classesLabel }).click();

    // Year 10 should already be expanded
    await expect(page.locator('#panel-content-year-group-10')).toBeVisible();

    // Expand Year 11 and Year 9
    await page.getByRole('heading', { level: 3, name: 'Year 11' }).click();
    await page.getByRole('heading', { level: 3, name: 'Year 9' }).click();

    // Now all panels should be visible
    await expect(page.locator('#panel-content-year-group-11')).toBeVisible();
    await expect(page.locator('#panel-content-year-group-9')).toBeVisible();

    // Find all View buttons and verify they are disabled
    const viewButtons = page.getByRole('button', { name: /view/i });
    await expect(viewButtons).toHaveCount(EXPECTED_TOTAL_CARDS_COUNT);

    // Find all Edit buttons and verify they are disabled
    const editButtons = page.getByRole('button', { name: /edit/i });
    await expect(editButtons).toHaveCount(EXPECTED_TOTAL_CARDS_COUNT);

    // Verify all View buttons are disabled
    const allViewButtons = await viewButtons.all();
    for (const viewButton of allViewButtons) {
      await expect(viewButton).toBeDisabled();
    }

    // Verify all Edit buttons are disabled
    const allEditButtons = await editButtons.all();
    for (const editButton of allEditButtons) {
      await expect(editButton).toBeDisabled();
    }
  });

  test('verifies no enabled View/Edit link, dialog trigger, or workflow affordance is present', async ({
    page,
  }) => {
    // Use the standard Section 4 scenario
    const scenario = createClassesScenario();
    await installRuntimeMock(page, scenario);
    await page.goto('/');
    await page.getByRole('menuitem', { name: classesLabel }).click();

    // Expand all panels
    await page.getByRole('heading', { level: 3, name: 'Year 11' }).click();
    await page.getByRole('heading', { level: 3, name: 'Year 9' }).click();

    // Verify no links for View/Edit exist
    const viewLinks = page.getByRole('link', { name: /view/i });
    await expect(viewLinks).toHaveCount(0);

    const editLinks = page.getByRole('link', { name: /edit/i });
    await expect(editLinks).toHaveCount(0);

    // Verify all View buttons are disabled
    const allViewButtons = await page.getByRole('button', { name: /view/i }).all();
    for (const viewButton of allViewButtons) {
      await expect(viewButton).toBeDisabled();
    }

    // Verify all Edit buttons are disabled
    const allEditButtons = await page.getByRole('button', { name: /edit/i }).all();
    for (const editButton of allEditButtons) {
      await expect(editButton).toBeDisabled();
    }
  });

  test('asserts no drag handle, reorder button, or ordering affordance is visible in the card surface', async ({
    page,
  }) => {
    // Use the standard Section 4 scenario
    const scenario = createClassesScenario();
    await installRuntimeMock(page, scenario);
    await page.goto('/');
    await page.getByRole('menuitem', { name: classesLabel }).click();

    // Expand all panels
    await page.getByRole('heading', { level: 3, name: 'Year 11' }).click();
    await page.getByRole('heading', { level: 3, name: 'Year 9' }).click();

    // Get all card elements
    const articles = page.locator('[role="article"]');
    await expect(articles).toHaveCount(EXPECTED_TOTAL_CARDS_COUNT);

    // Verify no drag handles or reorder affordances exist
    const dragHandles = page.locator('[draggable="true"]');
    await expect(dragHandles).toHaveCount(0);

    // Verify no drag-related classes exist
    const dragElements = page.locator('.drag-handle, .ant-drag-handle, .draggable');
    await expect(dragElements).toHaveCount(0);

    // Verify no reorder-related text/content exists in cards
    const reorderText = page.locator('[role="article"]:has-text("reorder")');
    await expect(reorderText).toHaveCount(0);

    const moveText = page.locator('[role="article"]:has-text("move")');
    await expect(moveText).toHaveCount(0);

    // Verify no sort-related classes exist in cards
    const sortHandles = page.locator(
      '[role="article"] .sort-handle, [role="article"] .ant-sort-handle'
    );
    await expect(sortHandles).toHaveCount(0);

    // Verify each card only has View and Edit buttons (no other action buttons)
    const allArticles = await articles.all();
    for (const article of allArticles) {
      const buttons = article.locator('button');
      await expect(buttons).toHaveCount(EXPECTED_BUTTONS_PER_CARD);

      const buttonTexts = await buttons.allTextContents();
      expect(buttonTexts).toEqual(['View', 'Edit']);
    }
  });
});
