import { expect, test } from '@playwright/test';
import { installRuntimeMock } from './shared/endToEndRuntimeMocks';
import {
  ALPHABETICAL_ORDER_CLASS_PARTIALS,
  CARD_INDEX_FIRST,
  CARD_INDEX_SECOND,
  CARD_INDEX_THIRD,
  CLASSES_LABEL,
  EXPECTED_ALPHABETICAL_CARDS_COUNT,
  EXPECTED_BUTTONS_PER_CARD,
  EXPECTED_TIE_BREAK_CARDS_COUNT,
  EXPECTED_TOTAL_CARDS_COUNT,
  TIE_BREAK_CLASS_PARTIALS,
  assertCardButtonStates,
  createClassesOrderScenario,
  createClassesScenario,
  toPlainClassPartials,
} from './helpers/classes-page-end-to-end-helpers';
import { navigateAndExpandAllPanels } from './helpers/classes-page-viewport-layout';

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

    await expect(page.locator('#panel-content-year-group-9')).toBeVisible();

    // Expand remaining panels
    await page.getByRole('heading', { level: 3, name: 'Year 10' }).click();
    await page.getByRole('heading', { level: 3, name: 'Year 11' }).click();

    await expect(page.locator('#panel-content-year-group-10')).toBeVisible();
    await expect(page.locator('#panel-content-year-group-11')).toBeVisible();

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
    await page.getByRole('heading', { level: 3, name: 'Year 10' }).click();
    await page.getByRole('heading', { level: 3, name: 'Year 11' }).click();

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
