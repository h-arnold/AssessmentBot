import { expect, type Locator, type Page } from '@playwright/test';
import { CLASSES_LABEL, EXPECTED_TOTAL_CARDS_COUNT } from './classes-page-end-to-end-helpers';

/**
 * Navigates to Classes page, expands all panels, and verifies the total card count.
 *
 * @param {Page} page - The Playwright page under test.
 * @returns {Promise<void>}
 */
export async function navigateAndExpandAllPanels(page: Page): Promise<void> {
  await page.getByRole('menuitem', { name: CLASSES_LABEL }).click();

  // Year 9 is expanded by default; expand the remaining panels.
  await page.getByRole('heading', { level: 3, name: 'Year 10' }).click();
  await page.getByRole('heading', { level: 3, name: 'Year 11' }).click();

  // Verify all panels are visible
  await expect(page.locator('#panel-content-year-group-10')).toBeVisible();
  await expect(page.locator('#panel-content-year-group-11')).toBeVisible();

  // Verify total card count
  const articles = page.locator('[role="article"]');
  await expect(articles).toHaveCount(EXPECTED_TOTAL_CARDS_COUNT);
}

type CardLayoutOptions = {
  viewportWidth: number;
  viewportHeight: number;
  minCardWidth: number;
  cardWidthTolerance: number;
  viewportWidthMargin: number;
};

/**
 * Verifies a single class card: visible, within width bounds, buttons enabled.
 *
 * @param {Locator} article - The card article locator to verify.
 * @param {CardLayoutOptions} options - Layout parameters for the verification.
 * @returns {Promise<void>} Resolves once the card's assertions pass.
 */
async function verifyArticleCard(article: Locator, options: CardLayoutOptions): Promise<void> {
  const { minCardWidth, cardWidthTolerance, viewportWidth, viewportWidthMargin } = options;
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

/**
 * Sets viewport, navigates to Classes page, expands all panels, and verifies card layout.
 * Used by both mobile and tablet viewport tests.
 *
 * @param {Page} page - The Playwright page under test.
 * @param {CardLayoutOptions} options - Layout parameters for the verification.
 * @param {number} options.viewportWidth - Viewport width in pixels.
 * @param {number} options.viewportHeight - Viewport height in pixels.
 * @param {number} options.minCardWidth - Minimum expected card width in pixels.
 * @param {number} options.cardWidthTolerance - Tolerance for minimum card width check.
 * @param {number} options.viewportWidthMargin - Maximum card width margin from viewport edge.
 * @returns {Promise<void>}
 */
export async function setupViewportAndVerifyCards(
  page: Page,
  options: CardLayoutOptions
): Promise<void> {
  const { viewportWidth, viewportHeight } = options;
  await page.setViewportSize({ width: viewportWidth, height: viewportHeight });
  await page.goto('/');
  await navigateAndExpandAllPanels(page);

  // Verify each card is visible, has proper width, and buttons are enabled
  const articles = page.locator('[role="article"]');
  const allArticles = await articles.all();

  await Promise.all(allArticles.map((article) => verifyArticleCard(article, options)));
}

/**
 * Asserts that the document does not overflow horizontally beyond the tolerance.
 *
 * The mobile journey measures the document element's scroll width against the
 * body client width; the tablet journey measures the body's own scroll width.
 * Both compare against the same multiplier, so the measurement source is a
 * parameter rather than a duplicated assertion.
 *
 * @param {Page} page - The Playwright page under test.
 * @param {number} toleranceMultiplier - Maximum allowed scroll-to-client ratio.
 * @param {'document' | 'body'} measurementSource - Which element supplies the scroll width.
 * @returns {Promise<void>}
 */
export async function expectNoHorizontalOverflow(
  page: Page,
  toleranceMultiplier: number,
  measurementSource: 'document' | 'body'
): Promise<void> {
  const scrollWidth =
    measurementSource === 'document'
      ? await page.locator('html').evaluate((element) => element.scrollWidth)
      : await page.evaluate(() => document.body.scrollWidth);
  const bodyClientWidth = await page.evaluate(() => document.body.clientWidth);

  expect(scrollWidth).toBeLessThanOrEqual(bodyClientWidth * toleranceMultiplier);
}
