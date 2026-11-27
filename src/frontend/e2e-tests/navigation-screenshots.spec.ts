/**
 * Screenshot tests for Class Page and Task Heatmap navigation consistency.
 *
 * These tests capture screenshots of the Class Page overview and Task Heatmap
 * views to verify the consistent PageHeader navigation pattern. The Class Page
 * capture is deliberately built from the canonical six-assignment class, so it
 * shows the three-row preview, the title-bar disclosure and every column
 * control; the heatmap captures keep their own single-assignment fixture.
 */

import { expect, test, type Page } from '@playwright/test';
import { installRuntimeMock } from './shared/endToEndRuntimeMocks';
import {
  assignmentNameButton,
  assignmentsTable,
  ASSIGNMENTS_HEADINGS,
} from './helpers/assignments-table-locators';
import {
  EXPECTED_ASSIGNMENT_TITLES,
  INITIAL_VISIBLE_ROWS,
} from './helpers/assignments-table-expectations';
import {
  classPageAssignmentQueue,
  openErrorClass,
} from './helpers/assessment-error-preview-journeys';
import {
  createHeatmapScenario,
  HEATMAP_CLASS_NAME,
  HEATMAP_ASSIGNMENT_DISPLAY_TITLE,
} from './helpers/task-heatmap-end-to-end-helpers';
import { stickyTableWrapper } from './helpers/sticky-table-locators';

const CLASSES_NAV_LABEL = 'Classes';

// The Class page's attempt-baseline mode control (issue #305): rendered in the
// top-right corner of the Student Averages card (overview) or the embedded
// heatmap's table card, falling back to the page header only while blocked. It
// never appears on the Heatmaps builder surface. Its visible label is sr-only,
// so the accessible name below still resolves. The re-captured baselines must
// include it in its new position.
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

  // Wait for the ready-state Assignments table.
  await expect(assignmentsTable(page)).toBeVisible();

  // Click the assignment's name button to open the heatmap. The table row
  // itself is not an entry point.
  await assignmentNameButton(page, HEATMAP_ASSIGNMENT_DISPLAY_TITLE).click();

  // Wait for heatmap table.
  await expect(stickyTableWrapper(page)).toBeVisible();
}

test.describe('Navigation screenshot tests', () => {
  test('Class Page overview with PageHeader', async ({ page }) => {
    // The canonical six-assignment class is essential here: its three-row
    // preview, six column controls and title-bar disclosure are the capture
    // subject. The single-assignment heatmap fixture cannot show any of them.
    await openErrorClass(page, { getAssignment: classPageAssignmentQueue() });

    const table = assignmentsTable(page);
    await expect(table).toBeVisible();
    await expect(table.locator('tbody tr.ant-table-row')).toHaveCount(INITIAL_VISIBLE_ROWS);
    await expect
      .poll(async () => {
        const names = await table
          .locator('tbody tr.ant-table-row')
          .getByRole('button')
          .allTextContents();
        return names.map((name) => name.trim());
      })
      .toEqual(EXPECTED_ASSIGNMENT_TITLES.slice(0, INITIAL_VISIBLE_ROWS));
    await expect(table.getByRole('columnheader')).toHaveCount(ASSIGNMENTS_HEADINGS.length);
    for (const heading of ASSIGNMENTS_HEADINGS) {
      const header = table.getByRole('columnheader', { name: heading, exact: true });
      await expect(header).toHaveCount(1);
      await expect(header.locator('.ant-table-column-sorters')).toHaveCount(1);
      await expect(header.locator('.ant-table-filter-trigger')).toHaveCount(1);
    }
    const disclosure = page.getByRole('button', { name: 'Show all assignments' });
    await expect(disclosure).toBeVisible();
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    const cardHead = page.locator('.ant-card-head').filter({ hasText: 'Assignments' });
    await expect(cardHead.getByRole('button', { name: 'Show all assignments' })).toHaveCount(1);

    // The attempt-baseline mode control now sits in the Student Averages
    // card's top-right corner; assert it before capturing so the re-capture is
    // deliberate.
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

    // The mode control now sits in the embedded heatmap's table-card header.
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
