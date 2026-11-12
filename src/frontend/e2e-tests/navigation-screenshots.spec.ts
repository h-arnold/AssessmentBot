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

// The Class page's attempt-baseline mode control (issue #305): always rendered
// in the Class-page header once loading finishes, never on the Heatmaps
// builder surface. The re-captured baselines must include it.
const MODE_CONTROL_LABEL = 'Averages basis';
const ABSOLUTE_OPTION_LABEL = 'All tasks';

/**
 * Navigate to the Task Heatmap from the Classes list.
 * @param {Page} page - The Playwright page instance.
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

    // The attempt-baseline mode control joins the header slot in both captured
    // baselines; assert it before capturing so the re-capture is deliberate.
    const modeControl = page.getByRole('radiogroup', { name: MODE_CONTROL_LABEL });
    await expect(modeControl).toBeVisible();
    await expect(modeControl.getByRole('radio', { name: ABSOLUTE_OPTION_LABEL })).toBeChecked();

    // Take screenshot of the Class Page overview with PageHeader
    await expect(page).toHaveScreenshot('class-page-overview.png', {
      maxDiffPixelRatio: 0.1,
    });
  });

  test('Task Heatmap with PageHeader', async ({ page }) => {
    const scenario = createHeatmapScenario();
    await installRuntimeMock(page, scenario);
    await openTaskHeatmap(page);

    // The mode control stays rendered above the embedded heatmap view.
    await expect(page.getByRole('radiogroup', { name: MODE_CONTROL_LABEL })).toBeVisible();

    // Take screenshot of the Task Heatmap with PageHeader
    await expect(page).toHaveScreenshot('task-heatmap.png', {
      maxDiffPixelRatio: 0.1,
    });
  });

  test('Heatmaps builder with PageHeader', async ({ page }) => {
    await installRuntimeMock(page, createHeatmapScenario());
    await page.goto('/');
    await page.getByRole('menuitem', { name: 'Heatmaps' }).click();

    await expect(page.getByRole('heading', { level: 2, name: 'Heatmaps' })).toBeVisible();
    await expect(page.getByText('Select a class to build a heatmap.')).toHaveCount(1);
    // The Heatmaps builder surface never shows the attempt-baseline mode
    // control (no mode control exists off the Class page), so this baseline
    // must remain unchanged by the feature.
    await expect(page.getByRole('radiogroup', { name: MODE_CONTROL_LABEL })).toHaveCount(0);
    await expect(page).toHaveScreenshot('heatmaps-builder.png', {
      maxDiffPixelRatio: 0.1,
    });
  });
});
