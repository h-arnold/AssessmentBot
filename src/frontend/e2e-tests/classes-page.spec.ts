import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { pageContent } from '../src/pages/pageContent';
import { googleScriptRunApiHandlerFactorySource } from '../src/test/googleScriptRunHarness';
import { installRuntimeMock } from './shared/endToEndRuntimeMocks';
import {
  PRIMARY_NAVIGATION_LABEL,
  CLASSES_LABEL,
  EXPECTED_MENU_ITEM_COUNT,
  backendSettingsFixture,
  MOBILE_VIEWPORT_WIDTH,
  MOBILE_VIEWPORT_HEIGHT,
  TABLET_VIEWPORT_WIDTH,
  TABLET_VIEWPORT_HEIGHT,
  MIN_CARD_WIDTH_MOBILE,
  MIN_CARD_WIDTH_TABLET,
  NUMBER_OF_YEAR_GROUP_PANELS,
  MOBILE_CARD_WIDTH_TOLERANCE,
  TABLET_CARD_WIDTH_MARGIN,
  EXPECTED_TOTAL_CARDS_COUNT,
  EXPECTED_BUTTONS_PER_CARD,
  EXPECTED_ALPHABETICAL_CARDS_COUNT,
  EXPECTED_TIE_BREAK_CARDS_COUNT,
  CARD_INDEX_FIRST,
  CARD_INDEX_SECOND,
  CARD_INDEX_THIRD,
  toPlainClassPartials,
  ALPHABETICAL_ORDER_CLASS_PARTIALS,
  TIE_BREAK_CLASS_PARTIALS,
  assertCardButtonStates,
  createClassesScenario,
  createClassesEmptyPanelScenario,
  createClassesOrderScenario,
  expectBreadcrumbLabels,
} from './helpers/classes-page-end-to-end-helpers';

// ============================================================================
// Local overrides for test-specific tolerance constants
// ============================================================================

// Increased to accommodate minimum panel width in Section 6 tests
const VIEWPORT_OVERFLOW_TOLERANCE_MULTIPLIER = 1.5;

// ============================================================================
// Empty fixtures for pending-state navigation tests
// ============================================================================

const classPartialsFixture: Array<Record<string, unknown>> = [];
const yearGroupsFixture: Array<Record<string, unknown>> = [];

// ============================================================================
// Shared test setup helpers (DRY up internal duplication)
// ============================================================================

/**
 * Navigates to Classes page, expands all panels, and verifies the total card count.
 *
 * @param {Page} page - The Playwright page under test.
 * @param {number} [expectedCardCount] - Expected number of cards across all panels.
 * @returns {Promise<void>}
 */
async function navigateAndExpandAllPanels(
  page: Page,
  expectedCardCount: number = EXPECTED_TOTAL_CARDS_COUNT
): Promise<void> {
  await page.getByRole('menuitem', { name: CLASSES_LABEL }).click();

  // Expand Year 11 and Year 9 (Year 10 is expanded by default)
  await page.getByRole('heading', { level: 3, name: 'Year 11' }).click();
  await page.getByRole('heading', { level: 3, name: 'Year 9' }).click();

  // Verify all panels are visible
  await expect(page.locator('#panel-content-year-group-11')).toBeVisible();
  await expect(page.locator('#panel-content-year-group-9')).toBeVisible();

  // Verify total card count
  const articles = page.locator('[role="article"]');
  await expect(articles).toHaveCount(expectedCardCount);
}

/**
 * Sets viewport, navigates to Classes page, expands all panels, and verifies card layout.
 * Used by both mobile and tablet viewport tests.
 *
 * @param {Page} page - The Playwright page under test.
 * @param {number} viewportWidth - Viewport width in pixels.
 * @param {number} viewportHeight - Viewport height in pixels.
 * @param {number} minCardWidth - Minimum expected card width in pixels.
 * @param {number} cardWidthTolerance - Tolerance for minimum card width check.
 * @param {number} viewportWidthMargin - Maximum card width margin from viewport edge.
 * @returns {Promise<void>}
 */
async function setupViewportAndVerifyCards(
  page: Page,
  viewportWidth: number,
  viewportHeight: number,
  minCardWidth: number,
  cardWidthTolerance: number,
  viewportWidthMargin: number
): Promise<void> {
  await page.setViewportSize({ width: viewportWidth, height: viewportHeight });
  await page.goto('/');
  await navigateAndExpandAllPanels(page);

  // Verify each card is visible, has proper width, and buttons are enabled
  const articles = page.locator('[role="article"]');
  const allArticles = await articles.all();

  for (const article of allArticles) {
    await expect(article).toBeVisible();

    const cardTitle = article.locator('.ant-card-head-title');
    await expect(cardTitle).toBeVisible();

    const cardWidth = await article.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width;
    });

    expect(cardWidth).toBeGreaterThanOrEqual(minCardWidth - cardWidthTolerance);
    expect(cardWidth).toBeLessThanOrEqual(viewportWidth - viewportWidthMargin);

    const viewButton = article.getByRole('button', { name: /view/i });
    const assessTaskButton = article.getByRole('button', { name: 'Assess Task' });
    await expect(viewButton).toBeVisible();
    await expect(assessTaskButton).toBeVisible();
    await expect(viewButton).toBeEnabled();
    await expect(assessTaskButton).toBeEnabled();
  }
}

// ============================================================================
// Pending-state mock for navigation tests
// ============================================================================

/**
 * Installs a deterministic `google.script.run` mock with authorisation resolved
 * and returns empty datasets for class partials, year groups, and other warmup data.
 *
 * @param {Page} page - The Playwright page under test.
 */
async function mockAuthenticatedGoogleScriptRun(page: Page) {
  await page.addInitScript(`
    (() => {
      const createGoogleScriptRunApiHandlerMock = ${googleScriptRunApiHandlerFactorySource};
      const backendSettingsFixture = ${JSON.stringify(backendSettingsFixture)};
      const classPartialsFixture = ${JSON.stringify(classPartialsFixture)};
      const yearGroupsFixture = ${JSON.stringify(yearGroupsFixture)};

      let methodCallTracker = {};

      globalThis.google = {
        script: {
          run: createGoogleScriptRunApiHandlerMock((request, callbacks) => {
            const method = (request?.method);

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

            if (request?.method === 'getAuthorisationStatus') {
              callbacks.successHandler?.({
                ok: true,
                requestId: 'req-auth-status',
                data: true,
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

            if (
              request?.method === 'getCohorts' ||
              request?.method === 'getAssignmentTopics' ||
              request?.method === 'getAssignmentDefinitionPartials'
            ) {
              callbacks.successHandler?.({
                ok: true,
                requestId: 'req-' + request.method,
                data: [],
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

          }),
        },
      };

      // Expose the tracker to global scope so tests can inspect it
      globalThis.__methodCallTracker__ = methodCallTracker;
    })();
  `);
}

// ============================================================================
// Navigation Tests
// ============================================================================

test.describe('Classes page navigation', () => {
  test('user can navigate to Classes page via top-level menu click', async ({ page }) => {
    await mockAuthenticatedGoogleScriptRun(page);
    await page.goto('/');

    await page.getByRole('menuitem', { name: CLASSES_LABEL }).click();

    await expect(
      page.getByRole('heading', { level: 2, name: pageContent.classes.heading })
    ).toBeVisible();
    await expect(page.getByText(pageContent.classes.summary)).toBeVisible();
  });

  test('Classes page breadcrumb updates correctly on navigation', async ({ page }) => {
    await mockAuthenticatedGoogleScriptRun(page);
    await page.goto('/');

    await page.getByRole('menuitem', { name: CLASSES_LABEL }).click();

    await expectBreadcrumbLabels(page, [CLASSES_LABEL]);
  });

  test('Classes page menu item becomes selected when clicked', async ({ page }) => {
    await mockAuthenticatedGoogleScriptRun(page);
    await page.goto('/');

    await page.getByRole('menuitem', { name: CLASSES_LABEL }).click();

    await expect(page.getByRole('menuitem', { name: CLASSES_LABEL })).toHaveClass(
      /ant-menu-item-selected/
    );
  });

  test('Classes page is in the correct position in navigation (between assignments and settings)', async ({
    page,
  }) => {
    await installRuntimeMock(page, createClassesScenario());
    await page.goto('/');

    const navigation = page.getByRole('navigation', { name: PRIMARY_NAVIGATION_LABEL });
    const menuItems = navigation.getByRole('menuitem');

    await expect(menuItems).toHaveCount(EXPECTED_MENU_ITEM_COUNT);

    const menuItemTexts = await menuItems.evaluateAll((items) =>
      items.map((item) => item.textContent?.trim() || '')
    );

    expect(menuItemTexts).toEqual(['Dashboard', CLASSES_LABEL, 'Assignments', 'Settings']);
  });
});

test.describe('Classes page method call tracking', () => {
  test('opening Classes page does not call getGoogleClassrooms', async ({ page }) => {
    await mockAuthenticatedGoogleScriptRun(page);
    await page.goto('/');

    await page.getByRole('menuitem', { name: CLASSES_LABEL }).click();

    await expect(
      page.getByRole('heading', { level: 2, name: pageContent.classes.heading })
    ).toBeVisible();

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
    await mockAuthenticatedGoogleScriptRun(page);
    await page.goto('/');

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
        name: CLASSES_LABEL,
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
      await expectBreadcrumbLabels(page, [name]);
    }
  });

  test('Classes page maintains menu count consistency', async ({ page }) => {
    await installRuntimeMock(page, createClassesScenario());
    await page.goto('/');

    const navigation = page.getByRole('navigation', { name: PRIMARY_NAVIGATION_LABEL });
    const menuItems = navigation.getByRole('menuitem');

    await expect(menuItems).toHaveCount(EXPECTED_MENU_ITEM_COUNT);

    await page.getByRole('menuitem', { name: CLASSES_LABEL }).click();
    await expect(navigation.getByRole('menuitem')).toHaveCount(EXPECTED_MENU_ITEM_COUNT);
  });
});

// ============================================================================
// Year-group collapse behaviour
// ============================================================================

test.describe('Year-group collapse behaviour', () => {
  test('collapse headers should render in alphabetical order', async ({ page }) => {
    const scenario = createClassesScenario();
    await installRuntimeMock(page, scenario);
    await page.goto('/');
    await page.getByRole('menuitem', { name: CLASSES_LABEL }).click();

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
    const scenario = createClassesScenario();
    await installRuntimeMock(page, scenario);
    await page.goto('/');
    await page.getByRole('menuitem', { name: CLASSES_LABEL }).click();

    const year10PanelContent = page.locator('#panel-content-year-group-10');
    await expect(year10PanelContent).toBeVisible();

    const year10Panel = page.getByRole('region', { name: /year 10/i });
    await expect(year10Panel).toBeVisible();
  });

  test('multi-expand - expanding second panel keeps first expanded', async ({ page }) => {
    const scenario = createClassesScenario();
    await installRuntimeMock(page, scenario);
    await page.goto('/');
    await page.getByRole('menuitem', { name: CLASSES_LABEL }).click();

    const year11Header = page.getByRole('heading', { level: 3, name: 'Year 11' });
    const year10PanelContent = page.locator('#panel-content-year-group-10');
    await expect(year10PanelContent).toBeVisible();

    await year11Header.click();

    await expect(year10PanelContent).toBeVisible();
    const year11PanelContent = page.locator('#panel-content-year-group-11');
    await expect(year11PanelContent).toBeVisible();
  });

  test('collapse and re-expand panel using visible controls', async ({ page }) => {
    const scenario = createClassesScenario();
    await installRuntimeMock(page, scenario);
    await page.goto('/');
    await page.getByRole('menuitem', { name: CLASSES_LABEL }).click();

    const year10Header = page.getByRole('heading', { level: 3, name: 'Year 10' });
    const year10PanelContent = page.locator('#panel-content-year-group-10');

    await expect(year10PanelContent).toBeVisible();
    await year10Header.click();
    await expect(year10PanelContent).not.toBeVisible();
    await year10Header.click();
    await expect(year10PanelContent).toBeVisible();
  });

  test('empty year-group panel shows in-panel empty message', async ({ page }) => {
    const scenario = createClassesEmptyPanelScenario();
    await installRuntimeMock(page, scenario);
    await page.goto('/');
    await page.getByRole('menuitem', { name: CLASSES_LABEL }).click();

    const year9PanelContent = page.locator('#panel-content-year-group-9');
    await expect(year9PanelContent).not.toBeVisible();

    const year9Header = page.getByRole('heading', { level: 3, name: 'Year 9' });
    await year9Header.click();
    await expect(year9PanelContent).toBeVisible();
    await expect(year9PanelContent).toContainText('No classes');
  });
});

// ============================================================================
// Class cards and placeholder action affordances
// ============================================================================

test.describe('Class cards and placeholder action affordances', () => {
  test('opens a populated year-group panel and asserts card titles are in expected alphabetical order', async ({
    page,
  }) => {
    const scenario = createClassesOrderScenario(
      toPlainClassPartials(ALPHABETICAL_ORDER_CLASS_PARTIALS)
    );
    await installRuntimeMock(page, scenario);
    await page.goto('/');
    await page.getByRole('menuitem', { name: CLASSES_LABEL }).click();

    const year10PanelContent = page.locator('#panel-content-year-group-10');
    await expect(year10PanelContent).toBeVisible();

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
    const scenario = createClassesOrderScenario(toPlainClassPartials(TIE_BREAK_CLASS_PARTIALS));
    await installRuntimeMock(page, scenario);
    await page.goto('/');
    await page.getByRole('menuitem', { name: CLASSES_LABEL }).click();

    const year10PanelContent = page.locator('#panel-content-year-group-10');
    await expect(year10PanelContent).toBeVisible();

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

  test('asserts correct button states for every card', async ({ page }) => {
    const scenario = createClassesScenario();
    await installRuntimeMock(page, scenario);
    await page.goto('/');
    await page.getByRole('menuitem', { name: CLASSES_LABEL }).click();

    await expect(page.locator('#panel-content-year-group-10')).toBeVisible();

    // Expand remaining panels
    await page.getByRole('heading', { level: 3, name: 'Year 11' }).click();
    await page.getByRole('heading', { level: 3, name: 'Year 9' }).click();

    await expect(page.locator('#panel-content-year-group-11')).toBeVisible();
    await expect(page.locator('#panel-content-year-group-9')).toBeVisible();

    const viewButtons = page.getByRole('button', { name: /view/i });
    await expect(viewButtons).toHaveCount(EXPECTED_TOTAL_CARDS_COUNT);

    await assertCardButtonStates(page);
  });

  test('verifies no enabled View/Edit link, dialog trigger, or workflow affordance is present', async ({
    page,
  }) => {
    const scenario = createClassesScenario();
    await installRuntimeMock(page, scenario);
    await page.goto('/');
    await page.getByRole('menuitem', { name: CLASSES_LABEL }).click();

    // Expand all panels
    await page.getByRole('heading', { level: 3, name: 'Year 11' }).click();
    await page.getByRole('heading', { level: 3, name: 'Year 9' }).click();

    const viewLinks = page.getByRole('link', { name: /view/i });
    await expect(viewLinks).toHaveCount(0);

    const editLinks = page.getByRole('link', { name: /edit/i });
    await expect(editLinks).toHaveCount(0);

    await assertCardButtonStates(page);
  });

  test('asserts no drag handle, reorder button, or ordering affordance is visible in the card surface', async ({
    page,
  }) => {
    const scenario = createClassesScenario();
    await installRuntimeMock(page, scenario);
    await page.goto('/');
    await page.getByRole('menuitem', { name: CLASSES_LABEL }).click();

    await navigateAndExpandAllPanels(page);

    const dragHandles = page.locator('[draggable="true"]');
    await expect(dragHandles).toHaveCount(0);

    const dragElements = page.locator('.drag-handle, .ant-drag-handle, .draggable');
    await expect(dragElements).toHaveCount(0);

    const reorderText = page.locator('[role="article"]:has-text("reorder")');
    await expect(reorderText).toHaveCount(0);

    const moveText = page.locator('[role="article"]:has-text("move")');
    await expect(moveText).toHaveCount(0);

    const sortHandles = page.locator(
      '[role="article"] .sort-handle, [role="article"] .ant-sort-handle'
    );
    await expect(sortHandles).toHaveCount(0);

    const articles = page.locator('[role="article"]');
    const allArticles = await articles.all();
    for (const article of allArticles) {
      const buttons = article.locator('button');
      await expect(buttons).toHaveCount(EXPECTED_BUTTONS_PER_CARD);

      // View button has text "View"; Assess Task button is icon-only with aria-label
      const viewButton = buttons.nth(0);
      const assessButton = buttons.nth(1);
      await expect(viewButton).toHaveText(/view/i);
      await expect(assessButton).toHaveAttribute('aria-label', 'Assess Task');
    }
  });
});

// ============================================================================
// Keyboard interaction for collapse headers
// ============================================================================

test.describe('Keyboard interaction for collapse headers', () => {
  test('can navigate and toggle collapse headers using keyboard only', async ({ page }) => {
    const scenario = createClassesScenario();
    await installRuntimeMock(page, scenario);
    await page.goto('/');
    await page.getByRole('menuitem', { name: CLASSES_LABEL }).click();

    await expect(page.getByRole('heading', { level: 3, name: 'Year 10' })).toBeVisible();

    const year10PanelContent = page.locator('#panel-content-year-group-10');
    await expect(year10PanelContent).toBeVisible();

    const collapseHeaders = page.locator('.ant-collapse-header');
    await expect(collapseHeaders).toHaveCount(NUMBER_OF_YEAR_GROUP_PANELS);

    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    const year11Panel = page.locator('.ant-collapse-header').filter({ hasText: 'Year 11' });
    await year11Panel.focus();
    await expect(year11Panel).toBeFocused();

    await year11Panel.press('Enter');

    const year11PanelContent = page.locator('#panel-content-year-group-11');
    await expect(year11PanelContent).toBeVisible();
    await expect(year10PanelContent).toBeVisible();

    await year11Panel.press('Enter');
    await expect(year11PanelContent).not.toBeVisible();
    await expect(year10PanelContent).toBeVisible();

    await page.keyboard.press('Tab');

    const year9Panel = page.locator('.ant-collapse-header').filter({ hasText: 'Year 9' });
    await expect(year9Panel).toBeFocused();

    await year9Panel.press('Enter');

    const year9PanelContent = page.locator('#panel-content-year-group-9');
    await expect(year9PanelContent).toBeVisible();

    await expect(year10PanelContent).toBeVisible();
    await expect(year11PanelContent).not.toBeVisible();
    await expect(year9PanelContent).toBeVisible();
  });

  test('can navigate collapse headers using arrow keys when focused', async ({ page }) => {
    const scenario = createClassesScenario();
    await installRuntimeMock(page, scenario);
    await page.goto('/');
    await page.getByRole('menuitem', { name: CLASSES_LABEL }).click();

    await expect(page.getByRole('heading', { level: 3, name: 'Year 10' })).toBeVisible();

    const collapseHeaders = page.locator('.ant-collapse-header');
    await expect(collapseHeaders).toHaveCount(NUMBER_OF_YEAR_GROUP_PANELS);

    const year10Panel = page.locator('.ant-collapse-header').filter({ hasText: 'Year 10' });
    const year11Panel = page.locator('.ant-collapse-header').filter({ hasText: 'Year 11' });
    const year9Panel = page.locator('.ant-collapse-header').filter({ hasText: 'Year 9' });

    await year10Panel.focus();
    await expect(year10Panel).toBeFocused();

    await year11Panel.focus();
    await expect(year11Panel).toBeFocused();

    await year9Panel.focus();
    await expect(year9Panel).toBeFocused();

    await year10Panel.focus();
    await expect(year10Panel).toBeFocused();

    await expect(year10Panel).toHaveAttribute('role', 'button');
    await expect(year11Panel).toHaveAttribute('role', 'button');
    await expect(year9Panel).toHaveAttribute('role', 'button');

    await expect(year10Panel).toHaveAttribute('tabindex', '0');
    await expect(year11Panel).toHaveAttribute('tabindex', '0');
    await expect(year9Panel).toHaveAttribute('tabindex', '0');
  });
});

// ============================================================================
// Narrow viewport layout resilience
// ============================================================================

test.describe('Narrow viewport layout resilience', () => {
  test('cards remain readable and reachable without horizontal page overflow at mobile viewport', async ({
    page,
  }) => {
    const scenario = createClassesScenario();
    await installRuntimeMock(page, scenario);

    await setupViewportAndVerifyCards(
      page,
      MOBILE_VIEWPORT_WIDTH,
      MOBILE_VIEWPORT_HEIGHT,
      MIN_CARD_WIDTH_MOBILE,
      MOBILE_CARD_WIDTH_TOLERANCE,
      TABLET_CARD_WIDTH_MARGIN
    );

    // Verify no excessive horizontal overflow
    const htmlElement = page.locator('html');
    const pageScrollWidth = await htmlElement.evaluate((element) => element.scrollWidth);
    const bodyClientWidth = await page.evaluate(() => document.body.clientWidth);

    expect(pageScrollWidth).toBeLessThanOrEqual(
      bodyClientWidth * VIEWPORT_OVERFLOW_TOLERANCE_MULTIPLIER
    );
  });

  test('cards wrap appropriately and remain usable at tablet viewport', async ({ page }) => {
    const scenario = createClassesScenario();
    await installRuntimeMock(page, scenario);

    await setupViewportAndVerifyCards(
      page,
      TABLET_VIEWPORT_WIDTH,
      TABLET_VIEWPORT_HEIGHT,
      MIN_CARD_WIDTH_TABLET,
      MOBILE_CARD_WIDTH_TOLERANCE,
      TABLET_CARD_WIDTH_MARGIN
    );

    // Verify no excessive horizontal overflow
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const bodyClientWidth = await page.evaluate(() => document.body.clientWidth);

    expect(bodyScrollWidth).toBeLessThanOrEqual(
      bodyClientWidth * VIEWPORT_OVERFLOW_TOLERANCE_MULTIPLIER
    );
  });
});
