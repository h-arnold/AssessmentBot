import { expect, test, type Page } from '@playwright/test';
import { installRuntimeMock } from './shared/endToEndRuntimeMocks';
import { stickyTableBody, stickyTableHeaderHolder } from './helpers/sticky-table-locators';
import {
  createHeatmapScenario,
  HEATMAP_ASSIGNMENT_DISPLAY_TITLE,
  HEATMAP_CLASS_NAME,
} from './helpers/task-heatmap-end-to-end-helpers';

const CLASSES_LABEL = 'Classes';
const FILTERED_ROW_COUNT = 2;
const INCLUDED_ROW_COUNT = 11;

/**
 * Navigate from the root shell to the fixture class overview.
 *
 * @param {Page} page - The Playwright page under test.
 * @returns {Promise<void>} Resolves when the overview is ready.
 */
async function openHeatmapClass(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('menuitem', { name: CLASSES_LABEL }).click();
  const classCard = page.getByRole('article').filter({ hasText: HEATMAP_CLASS_NAME });
  await expect(classCard).toBeVisible();
  await classCard.getByRole('button', { name: 'View' }).click();
  await expect(page.getByText('Recent Assignments')).toBeVisible();
}

test('filters excluded aggregate rows and hides the toggle from task filters', async ({ page }) => {
  await installRuntimeMock(page, createHeatmapScenario({ zeroWeightAssignment: true }));
  await openHeatmapClass(page);

  const averagesCard = page.locator('.ant-card').filter({ hasText: 'Student Averages' });
  const averagesBody = stickyTableBody(averagesCard);
  const completenessHeader = stickyTableHeaderHolder(averagesCard).getByRole('columnheader', {
    name: 'Completeness',
  });
  await completenessHeader.getByRole('button').click();

  const aggregateFilter = page.locator('.ant-dropdown:visible').last();
  await expect(aggregateFilter.getByRole('checkbox', { name: 'Include Excluded' })).toHaveCount(1);
  const lowerHandle = aggregateFilter.locator('.ant-slider-handle').first();
  await lowerHandle.focus();
  await page.keyboard.press('ArrowUp');
  await expect(averagesBody.locator('tbody tr')).toHaveCount(FILTERED_ROW_COUNT);

  await completenessHeader.getByRole('button').click();
  const narrowedAggregateFilter = page.locator('.ant-dropdown:visible').last();
  await narrowedAggregateFilter.getByRole('checkbox', { name: 'Include Excluded' }).click();
  await expect(averagesBody.locator('tbody tr')).toHaveCount(INCLUDED_ROW_COUNT);

  await completenessHeader.getByRole('button').click();
  const reopenedFilter = page.locator('.ant-dropdown:visible').last();
  await expect(reopenedFilter.getByRole('checkbox', { name: 'Include Excluded' })).toBeChecked();
  await page.keyboard.press('Escape');

  await page.getByRole('button').filter({ hasText: HEATMAP_ASSIGNMENT_DISPLAY_TITLE }).click();
  const heatmapHeader = stickyTableHeaderHolder(page);
  await expect(heatmapHeader).toBeVisible();
  await heatmapHeader
    .getByRole('columnheader', { name: 'Completeness' })
    .first()
    .getByRole('button')
    .click();
  const taskFilter = page.locator('.ant-dropdown:visible').last();
  await expect(taskFilter.getByRole('checkbox', { name: 'Include Excluded' })).toHaveCount(0);
});
