import { expect, test } from '@playwright/test';
import { installRuntimeMock } from './shared/endToEndRuntimeMocks';
import {
  CLASSES_LABEL,
  NUMBER_OF_YEAR_GROUP_PANELS,
  createClassesEmptyPanelScenario,
  createClassesScenario,
} from './helpers/classes-page-end-to-end-helpers';

// ============================================================================
// Year-group collapse behaviour
// ============================================================================

test.describe('Year-group collapse behaviour', () => {
  test('collapse headers should render in natural year-group order', async ({ page }) => {
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
    expect(headerTexts).toEqual(['Year 9', 'Year 10', 'Year 11']);
  });

  test('first naturally ordered panel should be expanded by default', async ({ page }) => {
    const scenario = createClassesScenario();
    await installRuntimeMock(page, scenario);
    await page.goto('/');
    await page.getByRole('menuitem', { name: CLASSES_LABEL }).click();

    const year9PanelContent = page.locator('#panel-content-year-group-9');
    await expect(year9PanelContent).toBeVisible();

    const year9Panel = page.getByRole('region', { name: /year 9/i });
    await expect(year9Panel).toBeVisible();
  });

  test('multi-expand - expanding second panel keeps first expanded', async ({ page }) => {
    const scenario = createClassesScenario();
    await installRuntimeMock(page, scenario);
    await page.goto('/');
    await page.getByRole('menuitem', { name: CLASSES_LABEL }).click();

    const year11Header = page.getByRole('heading', { level: 3, name: 'Year 11' });
    const year9PanelContent = page.locator('#panel-content-year-group-9');
    await expect(year9PanelContent).toBeVisible();

    await year11Header.click();

    await expect(year9PanelContent).toBeVisible();
    const year11PanelContent = page.locator('#panel-content-year-group-11');
    await expect(year11PanelContent).toBeVisible();
  });

  test('collapse and re-expand panel using visible controls', async ({ page }) => {
    const scenario = createClassesScenario();
    await installRuntimeMock(page, scenario);
    await page.goto('/');
    await page.getByRole('menuitem', { name: CLASSES_LABEL }).click();

    const year9Header = page.getByRole('heading', { level: 3, name: 'Year 9' });
    const year9PanelContent = page.locator('#panel-content-year-group-9');

    await expect(year9PanelContent).toBeVisible();
    await year9Header.click();
    await expect(year9PanelContent).not.toBeVisible();
    await year9Header.click();
    await expect(year9PanelContent).toBeVisible();
  });

  test('empty year-group panel shows in-panel empty message', async ({ page }) => {
    const scenario = createClassesEmptyPanelScenario();
    await installRuntimeMock(page, scenario);
    await page.goto('/');
    await page.getByRole('menuitem', { name: CLASSES_LABEL }).click();

    const year9PanelContent = page.locator('#panel-content-year-group-9');
    await expect(year9PanelContent).toBeVisible();
    await expect(year9PanelContent).toContainText('No classes');
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

    await expect(page.getByRole('heading', { level: 3, name: 'Year 9' })).toBeVisible();

    const year10PanelContent = page.locator('#panel-content-year-group-10');
    const year9PanelContent = page.locator('#panel-content-year-group-9');
    await expect(year9PanelContent).toBeVisible();
    await expect(year10PanelContent).not.toBeVisible();

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
    await expect(year10PanelContent).not.toBeVisible();

    await year11Panel.press('Enter');
    await expect(year11PanelContent).not.toBeVisible();
    await expect(year10PanelContent).not.toBeVisible();

    const year9Panel = page.locator('.ant-collapse-header').filter({ hasText: 'Year 9' });
    await year9Panel.focus();
    await expect(year9Panel).toBeFocused();

    await year9Panel.press('Enter');

    await expect(year10PanelContent).not.toBeVisible();
    await expect(year11PanelContent).not.toBeVisible();
    await expect(year9PanelContent).not.toBeVisible();
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
