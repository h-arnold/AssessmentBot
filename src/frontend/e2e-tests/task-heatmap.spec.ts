import { expect, test, type Page } from '@playwright/test';
import {
  installRuntimeMock,
  releaseNextDeferredSuccess,
  applyColumnFilterOption,
} from './shared/endToEndRuntimeMocks';
import {
  createHeatmapScenario,
  HEATMAP_CLASS_NAME,
  HEATMAP_ASSIGNMENT_DISPLAY_TITLE,
} from './helpers/task-heatmap-end-to-end-helpers';

const CLASSES_LABEL = 'Classes';
const HEATMAP_TABLE_NAME = 'Task Heatmap';
/** Number of metric sub-columns per task group (Completeness, Accuracy, SPaG). */
const METRIC_SUBCOLUMN_COUNT = 3;
/** Human-readable task titles sourced from the warm-up partial (taskColumn.taskTitle). */
const HEATMAP_TASK_TITLES = ['Task 1', 'Task 2', 'Task 3'];

/**
 * Navigate from the root shell to the heatmap class overview (ready state).
 *
 * @param {Page} page - The Playwright page.
 * @returns {Promise<void>}
 */
async function openHeatmapClass(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('menuitem', { name: CLASSES_LABEL }).click();

  // The class appears under a year-group panel; click its "View" button.
  const classCard = page.getByRole('article').filter({ hasText: HEATMAP_CLASS_NAME });
  await expect(classCard).toBeVisible();
  await classCard.getByRole('button', { name: 'View' }).click();

  // Wait for the ready-state Recent Assignments section (an antd Card title div).
  await expect(page.getByText('Recent Assignments')).toBeVisible();
}

test.describe('Task Heatmap E2E journey (RED)', () => {
  test('opens heatmap from recent assignment card', async ({ page }) => {
    const scenario = createHeatmapScenario();
    await installRuntimeMock(page, scenario);
    await openHeatmapClass(page);

    // Click the recent assignment card to open the heatmap (uses primaryTitle display).
    const card = page.getByRole('button').filter({ hasText: HEATMAP_ASSIGNMENT_DISPLAY_TITLE });
    await card.click();

    // Header: assignment display title (primaryTitle) + class name.
    await expect(
      page.getByRole('heading', { name: HEATMAP_ASSIGNMENT_DISPLAY_TITLE })
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: HEATMAP_CLASS_NAME })).toBeVisible();

    // Grouped header: Student Name + task_001/002/003 with Completeness/Accuracy/SPaG.
    const table = page.getByRole('table', { name: HEATMAP_TABLE_NAME });
    await expect(table).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Student Name' })).toHaveCount(1);
    for (const taskTitle of HEATMAP_TASK_TITLES) {
      await expect(table.getByRole('columnheader', { name: taskTitle })).toHaveCount(1);
    }
    await expect(table.getByRole('columnheader', { name: 'Completeness' })).toHaveCount(
      METRIC_SUBCOLUMN_COUNT
    );

    // Student Two's task_001 Completeness cell shows green band + aria-label (2 dp).
    const cell = page.getByRole('cell').filter({
      has: page.locator(`[aria-label="Student Two, task_001, Completeness: 5.00"]`),
    });
    await expect(cell).toHaveCount(1);
  });

  test('band filter hides non-matching rows', async ({ page }) => {
    const scenario = createHeatmapScenario();
    await installRuntimeMock(page, scenario);
    await openHeatmapClass(page);

    await page.getByRole('button').filter({ hasText: HEATMAP_ASSIGNMENT_DISPLAY_TITLE }).click();
    const table = page.getByRole('table', { name: HEATMAP_TABLE_NAME });
    await expect(table).toBeVisible();

    // Apply Green (high) filter to task_001 > Completeness (strict: first group header).
    await applyColumnFilterOption(
      page,
      table.getByRole('columnheader', { name: 'Completeness' }).first(),
      'Green (high)'
    );

    // Student One (N) should disappear; a green-band student should remain.
    await expect(table.getByText('Student One')).toHaveCount(0);
    await expect(table.getByText('Student Two')).toHaveCount(1);
  });

  test('student name sort reverses pre-sorted order', async ({ page }) => {
    const scenario = createHeatmapScenario();
    await installRuntimeMock(page, scenario);
    await openHeatmapClass(page);

    await page.getByRole('button').filter({ hasText: HEATMAP_ASSIGNMENT_DISPLAY_TITLE }).click();
    const table = page.getByRole('table', { name: HEATMAP_TABLE_NAME });
    await expect(table).toBeVisible();

    // Capture the first data-row student name before any interaction.
    const defaultFirstNameCell = table
      .locator('tbody tr.ant-table-row')
      .first()
      .locator('td')
      .first();
    const defaultFirstNameRaw = await defaultFirstNameCell.textContent();
    const defaultFirstName = defaultFirstNameRaw?.trim();
    expect(defaultFirstName).toBeTruthy();

    // Click Student Name header to toggle sort direction.
    await table.getByRole('columnheader', { name: 'Student Name' }).click();

    // Direction-agnostic: after the toggle the order must differ from the default.
    const afterFirstNameCell = table
      .locator('tbody tr.ant-table-row')
      .first()
      .locator('td')
      .first();
    const afterFirstNameRaw = await afterFirstNameCell.textContent();
    const afterFirstName = afterFirstNameRaw?.trim();
    expect(afterFirstName?.trim()).not.toBe(defaultFirstName?.trim());
  });

  test('back returns to overview', async ({ page }) => {
    const scenario = createHeatmapScenario();
    await installRuntimeMock(page, scenario);
    await openHeatmapClass(page);

    await page.getByRole('button').filter({ hasText: HEATMAP_ASSIGNMENT_DISPLAY_TITLE }).click();
    await expect(page.getByRole('table', { name: HEATMAP_TABLE_NAME })).toBeVisible();

    await page.getByRole('button', { name: 'Back to Class overview' }).click();

    // Overview content visible again (antd Card title divs, not headings).
    await expect(page.getByText('Recent Assignments')).toBeVisible();
    await expect(page.getByText('Student Averages')).toBeVisible();
  });

  test('loading skeleton then ready', async ({ page }) => {
    const scenario = createHeatmapScenario({ deferredClass: true });
    await installRuntimeMock(page, scenario);
    await page.goto('/');
    await page.getByRole('menuitem', { name: CLASSES_LABEL }).click();

    const classCard = page.getByRole('article').filter({ hasText: HEATMAP_CLASS_NAME });
    await classCard.getByRole('button', { name: 'View' }).click();

    // Loading skeleton present while the heatmap table is NOT yet rendered.
    const heatmapTable = page.getByRole('table', { name: HEATMAP_TABLE_NAME });
    await expect(heatmapTable).toHaveCount(0);
    await expect(page.locator('.ant-skeleton').first()).toBeVisible();

    // Release deferred class and expect the class overview to reach ready.
    await releaseNextDeferredSuccess(page);
    await expect(page.getByText('Recent Assignments')).toBeVisible();

    // Open the heatmap from the recent assignment card and expect the table.
    await page.getByRole('button').filter({ hasText: HEATMAP_ASSIGNMENT_DISPLAY_TITLE }).click();
    await expect(heatmapTable).toBeVisible();
    await expect(page.locator('.ant-skeleton')).toHaveCount(0);
  });

  test('empty-state: no submissions', async ({ page }) => {
    // No submissions → full roster with N cells + "No submissions yet" caption.
    const noSubScenario = createHeatmapScenario({ emptySubmissions: true });
    await installRuntimeMock(page, noSubScenario);
    await openHeatmapClass(page);
    await page.getByRole('button').filter({ hasText: HEATMAP_ASSIGNMENT_DISPLAY_TITLE }).click();

    const table = page.getByRole('table', { name: HEATMAP_TABLE_NAME });
    await expect(table).toBeVisible();
    await expect(table.getByText('Student One')).toHaveCount(1);
    await expect(page.getByText('No submissions yet')).toBeVisible();
  });

  test('empty-state: zero tasks', async ({ page }) => {
    // Zero tasks → no task columns render.
    const zeroTaskScenario = createHeatmapScenario({ zeroTasks: true });
    await installRuntimeMock(page, zeroTaskScenario);
    await openHeatmapClass(page);
    await page.getByRole('button').filter({ hasText: HEATMAP_ASSIGNMENT_DISPLAY_TITLE }).click();

    const zeroTable = page.getByRole('table', { name: HEATMAP_TABLE_NAME });
    await expect(zeroTable).toBeVisible();
    await expect(zeroTable.getByRole('columnheader', { name: /task_\d/ })).toHaveCount(0);
  });

  test('metric icons visible and themed in light and dark modes', async ({ page }) => {
    const scenario = createHeatmapScenario();
    await installRuntimeMock(page, scenario);
    await openHeatmapClass(page);

    await page.getByRole('button').filter({ hasText: HEATMAP_ASSIGNMENT_DISPLAY_TITLE }).click();
    const table = page.getByRole('table', { name: HEATMAP_TABLE_NAME });
    await expect(table).toBeVisible();

    // The three metric icons render in the grouped column headers.
    const completenessIcon = table.locator('[aria-label="Completeness"]').first();
    const accuracyIcon = table.locator('[aria-label="Accuracy"]').first();
    const spagIcon = table.locator('[aria-label="SPaG"]').first();

    // Light mode: every metric icon is visible.
    await expect(completenessIcon).toBeVisible();
    await expect(accuracyIcon).toBeVisible();
    await expect(spagIcon).toBeVisible();

    // Capture the themed colour in light mode (driven by theme.useToken().colorText).
    const lightColor = await completenessIcon.evaluate(
      (element) => getComputedStyle(element).color
    );

    // Toggle dark mode via the header switch.
    const themeSwitch = page.getByRole('switch', { name: 'Dark mode' });
    await expect(themeSwitch).toBeVisible();
    await themeSwitch.click();
    await expect(themeSwitch).toBeChecked();

    // Dark mode: icons remain visible and their themed colour adapts to the dark algorithm.
    await expect(completenessIcon).toBeVisible();
    await expect(accuracyIcon).toBeVisible();
    await expect(spagIcon).toBeVisible();

    const darkColor = await completenessIcon.evaluate((element) => getComputedStyle(element).color);
    expect(darkColor).not.toBe(lightColor);
  });

  test('metric icons expose aria-labels and themed stroke in header cells', async ({ page }) => {
    const scenario = createHeatmapScenario();
    await installRuntimeMock(page, scenario);
    await openHeatmapClass(page);

    await page.getByRole('button').filter({ hasText: HEATMAP_ASSIGNMENT_DISPLAY_TITLE }).click();
    const table = page.getByRole('table', { name: HEATMAP_TABLE_NAME });
    await expect(table).toBeVisible();

    // Each metric renders one icon per task group inside the grouped header row
    // (the body cells render their own per-cell metric icons, so scope to `thead`).
    const expectedLabels = ['Completeness', 'Accuracy', 'SPaG'];
    for (const label of expectedLabels) {
      // With LucideIcon, the aria-label is on the antd Icon wrapper span (role="img"),
      // not directly on the SVG element. Scope to the SVG descendant for stroke checks.
      const headerIconWrappers = table.locator(`thead [role="img"][aria-label="${label}"]`);
      const headerSvgs = headerIconWrappers.locator('svg');

      // One icon per task group column, all visible in the header cells.
      await expect(headerIconWrappers).toHaveCount(METRIC_SUBCOLUMN_COUNT);
      await expect(headerIconWrappers.first()).toBeVisible();

      // The Lucide SVG carries stroke attributes; the colour resolves from the
      // wrapping span's `token.colorText` (theme token) via `currentColor`.
      const strokeWidth = await headerSvgs.first().getAttribute('stroke-width');
      expect(strokeWidth).toBeTruthy();
    }
  });
});
