/**
 * Screenshot tests for Class Page and Task Heatmap navigation consistency.
 *
 * These tests capture screenshots of the Class Page overview and Task Heatmap
 * views to verify the consistent PageHeader navigation pattern.
 */

import { expect, test, type Page } from '@playwright/test';
import { installRuntimeMock } from './shared/endToEndRuntimeMocks';
import {
  createHeatmapScenario,
  HEATMAP_CLASS_NAME,
  HEATMAP_ASSIGNMENT_DISPLAY_TITLE,
} from './helpers/task-heatmap-end-to-end-helpers';

const CLASSES_NAV_LABEL = 'Classes';

/**
 * Navigate to the Task Heatmap from the Classes list.
 * @param page
 */
async function openTaskHeatmap(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('menuitem', { name: CLASSES_NAV_LABEL }).click();

  // The heatmap class appears under a year-group panel; click its "View" button.
  const classCard = page.getByRole('article').filter({ hasText: HEATMAP_CLASS_NAME });
  await expect(classCard).toBeVisible();
  await classCard.getByRole('button', { name: 'View' }).click();

  // Wait for the ready-state Recent Assignments section.
  await expect(page.getByText('Recent Assignments')).toBeVisible();

  // Click the recent assignment card to open heatmap.
  const card = page.getByRole('button').filter({ hasText: HEATMAP_ASSIGNMENT_DISPLAY_TITLE });
  await card.click();

  // Wait for heatmap table.
  await expect(page.getByRole('table', { name: 'Task Heatmap' })).toBeVisible();
}

test.describe('Navigation screenshot tests', () => {
  test('Class Page overview with PageHeader', async ({ page }) => {
    const scenario = createHeatmapScenario();
    await installRuntimeMock(page, scenario);

    await page.goto('/');
    await page.getByRole('menuitem', { name: CLASSES_NAV_LABEL }).click();

    // Click the heatmap class card's View button to open Class Page
    const classCard = page.getByRole('article').filter({ hasText: HEATMAP_CLASS_NAME });
    await expect(classCard).toBeVisible();
    await classCard.getByRole('button', { name: 'View' }).click();

    // Wait for the Class Page ready state
    await expect(page.getByText('Recent Assignments')).toBeVisible();

    // Take screenshot of the Class Page overview with PageHeader
    await expect(page).toHaveScreenshot('class-page-overview.png', {
      maxDiffPixelRatio: 0.1,
    });
  });

  test('Task Heatmap with PageHeader', async ({ page }) => {
    const scenario = createHeatmapScenario();
    await installRuntimeMock(page, scenario);
    await openTaskHeatmap(page);

    // Take screenshot of the Task Heatmap with PageHeader
    await expect(page).toHaveScreenshot('task-heatmap.png', {
      maxDiffPixelRatio: 0.1,
    });
  });
});
