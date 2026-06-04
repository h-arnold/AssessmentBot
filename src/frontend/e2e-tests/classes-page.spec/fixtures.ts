import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { googleScriptRunApiHandlerFactorySource } from '../../src/test/googleScriptRunHarness';
import {
  CLASSES_LABEL,
  backendSettingsFixture,
  EXPECTED_TOTAL_CARDS_COUNT,
} from '../helpers/classes-page-end-to-end-helpers';

// ============================================================================
// Local overrides for test-specific tolerance constants
// ============================================================================

// Increased to accommodate minimum panel width in Section 6 tests
export const VIEWPORT_OVERFLOW_TOLERANCE_MULTIPLIER = 1.5;

// ============================================================================
// Empty fixtures for pending-state navigation tests
// ============================================================================

export const classPartialsFixture: Array<Record<string, unknown>> = [];
export const yearGroupsFixture: Array<Record<string, unknown>> = [];

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
export async function navigateAndExpandAllPanels(
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
export async function setupViewportAndVerifyCards(
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

  // Verify each card is visible, has proper width, and buttons are disabled
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
    await expect(viewButton).toBeDisabled();
    await expect(assessTaskButton).toBeEnabled();
  }
}

// ============================================================================
// Pending-state mock for navigation tests
// ============================================================================

/**
 * Installs a deterministic `google.script.run` mock that keeps auth status pending
 * and returns empty datasets for class partials, year groups, and other warmup data.
 *
 * @param {Page} page - The Playwright page under test.
 */
export async function mockPendingGoogleScriptRun(page: Page) {
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
