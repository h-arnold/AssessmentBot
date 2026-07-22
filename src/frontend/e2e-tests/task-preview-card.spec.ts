/**
 * Playwright E2E tests for the Task Preview Card Popover (ACTION_PLAN.md §8).
 *
 * Navigates to the heatmap table via the `createHeatmapScenario` factory, then
 * hovers over metric sub-cells (and clicks to pin) to verify the preview card
 * content with web-first, structural assertions. Screenshots are captured as
 * supplementary evidence into `task-preview-card.spec.ts-snapshots/`.
 *
 * This is the RED phase: the feature was already implemented in §6, so these
 * tests assert the real required contract and are expected to pass when the
 * live app wiring matches; failures here are informational.
 *
 * @see ACTION_PLAN.md §8 — Playwright E2E tests
 * @see SPEC.md — Task Preview Card contract
 * @see docs/developer/frontend/frontend-playwright-e2e.md — runtime mocks, StrictMode rule
 */

import { expect, test, type Locator, type Page } from '@playwright/test';
import { installRuntimeMock } from './shared/endToEndRuntimeMocks';
import {
  createHeatmapScenario,
  HEATMAP_CLASS_NAME,
  HEATMAP_ASSIGNMENT_DISPLAY_TITLE,
} from './helpers/task-heatmap-end-to-end-helpers';

const CLASSES_LABEL = 'Classes';
const HEATMAP_TABLE_NAME = 'Task Heatmap';

/**
 * Navigate from the root shell to the open heatmap table (ready state).
 *
 * Mirrors the private `openHeatmapClass` helper in `task-heatmap.spec.ts` so
 * this spec is independently runnable. Mocks must already be installed before
 * calling this.
 *
 * @param {Page} page - The Playwright page.
 * @returns {Promise<void>}
 */
async function openHeatmapTable(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('menuitem', { name: CLASSES_LABEL }).click();

  const classCard = page.getByRole('article').filter({ hasText: HEATMAP_CLASS_NAME });
  await expect(classCard).toBeVisible();
  await classCard.getByRole('button', { name: 'View' }).click();

  await expect(page.getByText('Recent Assignments')).toBeVisible();

  // Open the heatmap from the recent assignment card.
  await page.getByRole('button').filter({ hasText: HEATMAP_ASSIGNMENT_DISPLAY_TITLE }).click();

  const table = page.getByRole('table', { name: HEATMAP_TABLE_NAME });
  await expect(table).toBeVisible();
}

/**
 * Returns the locator for the popover trigger of a single metric sub-cell.
 *
 * The aria-label format is `${studentName}, ${taskId}, ${metricLabel}: ${score}`
 * (see `TaskHeatmapTable.tsx` `onCell` and `render`). That label is now applied
 * to BOTH the `<td role="cell">` (via `onCell`) and the nested
 * `<span role="button" aria-haspopup="dialog">` popover trigger, so a bare
 * `[aria-label="..."] selector matches two elements. Disambiguate by targeting
 * the `role="button"` trigger specifically — that is the element the hover and
 * click interactions must act on.
 *
 * @param {Page} page - The Playwright page.
 * @param {string} ariaLabel - The exact aria-label value of the target cell.
 * @returns {Locator} The popover trigger locator.
 */
function metricCell(page: Page, ariaLabel: string) {
  return page.locator(`[role="button"][aria-label="${ariaLabel}"]`);
}

/**
 * Asserts the common popover structure (metric label, Reasoning, Student
 * Response) is present, scoped to a single `.ant-popover`.
 *
 * @param {Locator} popover - The popover locator.
 * @param {string} metricLabel - The expected metric label (e.g. "Completeness").
 * @returns {Promise<void>}
 */
async function assertPopoverStructure(popover: Locator, metricLabel: string): Promise<void> {
  // Metric label in the header — assert via the Card title Flex `aria-label`
  // (`"Completeness score: 5"`), which is structural and avoids the flaky
  // `toBeVisible`/`getByText` behaviour on antd `Typography.Text` (see §5.6).
  await expect(popover.locator(`[aria-label^="${metricLabel} score:"]`).first()).toHaveCount(1);
  // Reasoning section label.
  await expect(popover.getByText('Reasoning', { exact: true })).toHaveCount(1);
  // Student Response section label.
  await expect(popover.getByText('Student Response', { exact: true })).toHaveCount(1);
}

test.describe('Task Preview Card popover', () => {
  test('shows IMAGE preview card when hovering a completeness cell', async ({ page }) => {
    const scenario = createHeatmapScenario();
    await installRuntimeMock(page, scenario);
    await openHeatmapTable(page);

    // Student Two / task_001 / Completeness: 5 (from createHeatmapScenario fixture).
    const cell = metricCell(page, 'Student Two, task_001, Completeness: 5');
    await expect(cell).toHaveCount(1);

    await cell.hover();

    const popover = page.locator('.ant-popover');
    await expect(popover).toBeVisible();

    // Scoped structural assertions (no toBeVisible on Typography.Text).
    await assertPopoverStructure(popover, 'Completeness');
    await expect(popover.locator('img')).toHaveCount(1);

    await popover.screenshot({
      path: `${test.info().snapshotDir}/image-completeness-hover.png`,
    });
  });

  test('shows TEXT preview card when hovering an accuracy cell', async ({ page }) => {
    const scenario = createHeatmapScenario();
    await installRuntimeMock(page, scenario);
    await openHeatmapTable(page);

    // Student Two / task_002 / Accuracy: 4 (task_002 is the TEXT-seeded task).
    const cell = metricCell(page, 'Student Two, task_002, Accuracy: 4');
    await expect(cell).toHaveCount(1);

    await cell.hover();

    const popover = page.locator('.ant-popover');
    await expect(popover).toBeVisible();

    await assertPopoverStructure(popover, 'Accuracy');
    // TEXT artifact renders the seeded markdown reasoning for task_002 accuracy.
    // Assert the deterministic real-data text rendered, proving the markdown
    // pipeline worked rather than merely that *a* paragraph element exists.
    await expect(
      popover.getByText(/student explained the method clearly and showed all working\./i)
    ).toHaveCount(1);

    await popover.screenshot({
      path: `${test.info().snapshotDir}/text-accuracy-hover.png`,
    });
  });

  test('shows TABLE preview card when hovering a spag cell', async ({ page }) => {
    const scenario = createHeatmapScenario();
    await installRuntimeMock(page, scenario);
    await openHeatmapTable(page);

    // Student Two / task_003 / SPaG: 5 (task_003 is the TABLE-seeded task).
    const cell = metricCell(page, 'Student Two, task_003, SPaG: 5');
    await expect(cell).toHaveCount(1);

    await cell.hover();

    const popover = page.locator('.ant-popover');
    await expect(popover).toBeVisible();

    await assertPopoverStructure(popover, 'SPaG');
    // TABLE artifact renders via react-markdown as a <table>.
    await expect(popover.locator('table')).toHaveCount(1);

    await popover.screenshot({
      path: `${test.info().snapshotDir}/table-spag-hover.png`,
    });
  });

  test('pins the popover when clicking a cell and keeps it visible after mouse leave', async ({
    page,
  }) => {
    const scenario = createHeatmapScenario();
    await installRuntimeMock(page, scenario);
    await openHeatmapTable(page);

    // Click the completeness cell to pin the popover open.
    const cell = metricCell(page, 'Student Two, task_001, Completeness: 5');
    await expect(cell).toHaveCount(1);

    await cell.click();

    const popover = page.locator('.ant-popover');
    await expect(popover).toBeVisible();
    await assertPopoverStructure(popover, 'Completeness');

    // Move to a neutral coordinate to trigger mouseLeave on the trigger.
    await page.mouse.move(0, 0);

    // Popover must remain visible after unpinned-hover would have closed it.
    await expect(popover).toBeVisible();
    await expect(popover.locator(`[aria-label^="Completeness score:"]`).first()).toHaveCount(1);

    await page.screenshot({
      path: `${test.info().snapshotDir}/completeness-pinned.png`,
    });
  });
});
