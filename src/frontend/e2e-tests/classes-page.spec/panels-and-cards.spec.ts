import { expect, test } from '@playwright/test';
import { installRuntimeMock } from '../shared/endToEndRuntimeMocks';
import {
  CLASSES_LABEL,
  EXPECTED_TOTAL_CARDS_COUNT,
  EXPECTED_BUTTONS_PER_CARD,
  EXPECTED_ALPHABETICAL_CARDS_COUNT,
  EXPECTED_TIE_BREAK_CARDS_COUNT,
  NUMBER_OF_YEAR_GROUP_PANELS,
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
} from '../helpers/classes-page-end-to-end-helpers';
import { navigateAndExpandAllPanels } from './fixtures';

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
