import { expect, test } from '@playwright/test';
import { pageContent } from '@/pages/pageContent';
import { installRuntimeMock } from './shared/endToEndRuntimeMocks';
import {
  CLASSES_LABEL,
  EXPECTED_MENU_ITEM_COUNT,
  PRIMARY_NAVIGATION_LABEL,
  createClassesScenario,
  expectBreadcrumbLabels,
} from './helpers/classes-page-end-to-end-helpers';
import { mockAuthenticatedGoogleScriptRun } from './helpers/classes-page-navigation-runtime-mock';

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

  test('Classes page menu order is stable with the heatmaps entry between assignments and settings', async ({
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

    expect(menuItemTexts).toEqual([
      'Dashboard',
      CLASSES_LABEL,
      'Assignments',
      'Heatmaps',
      'Settings',
    ]);
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
