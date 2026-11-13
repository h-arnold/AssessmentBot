import { expect, test } from '@playwright/test';
import { installRuntimeMock, selectVisibleOption } from './shared/endToEndRuntimeMocks';
import { stickyTableWrapper } from './helpers/sticky-table-locators';
import {
  createHeatmapScenario,
  HEATMAP_ASSIGNMENT_DISPLAY_TITLE,
  HEATMAP_CLASS_NAME,
} from './helpers/task-heatmap-end-to-end-helpers';

const VIEWPORT_1920 = 1920;
const VIEWPORT_2560 = 2560;
const NARROW_VIEWPORT = 390;
const VIEWPORT_HEIGHT = 1000;
const EXPECTED_SHELL_PADDING = 16;
const GEOMETRY_TOLERANCE = 1;
const SIBLING_PAGE_MAX_WIDTH = 1280;
const ASSIGNMENTS_CONTROL_INDEX = 2;

test('populated Heatmaps stays fluid across viewport widths without widening capped siblings', async ({
  page,
}) => {
  await installRuntimeMock(page, createHeatmapScenario());
  await page.setViewportSize({ width: VIEWPORT_1920, height: VIEWPORT_HEIGHT });
  await page.goto('/');
  await page.getByRole('menuitem', { name: 'Heatmaps' }).click();
  await page.getByRole('combobox').nth(0).click();
  await selectVisibleOption(page, HEATMAP_CLASS_NAME);
  await expect(page.getByRole('combobox').nth(1)).toBeEnabled();
  await page.getByRole('combobox').nth(ASSIGNMENTS_CONTROL_INDEX).click();
  await selectVisibleOption(page, HEATMAP_ASSIGNMENT_DISPLAY_TITLE);

  const table = stickyTableWrapper(page);
  await expect(table).toBeVisible();
  const panel = table.locator(
    'xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " ant-card ")][1]'
  );

  for (const width of [VIEWPORT_1920, VIEWPORT_2560]) {
    await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
    await expect
      .poll(async () => {
        const geometry = await page.locator('.app-content').evaluate((shellContent) => {
          const shell = shellContent.getBoundingClientRect();
          const pageFrame = shellContent.querySelector('.app-page-content--fluid');
          if (!(pageFrame instanceof HTMLElement))
            throw new TypeError('Fluid Heatmaps frame missing');
          const frameBox = pageFrame.getBoundingClientRect();
          const style = getComputedStyle(shellContent);
          return {
            available:
              shell.width -
              Number.parseFloat(style.paddingLeft) -
              Number.parseFloat(style.paddingRight),
            frame: frameBox.width,
            left: frameBox.left - shell.left,
            right: shell.right - frameBox.right,
          };
        });
        const panelWidth = await panel.evaluate((element) => element.getBoundingClientRect().width);
        return {
          ...geometry,
          panelWidth,
          fluidFrameMatches: Math.abs(geometry.frame - geometry.available) <= GEOMETRY_TOLERANCE,
          shellInsetsMatch:
            geometry.left === EXPECTED_SHELL_PADDING && geometry.right === EXPECTED_SHELL_PADDING,
          panelMatchesFrame: panelWidth === geometry.frame,
        };
      })
      .toMatchObject({
        fluidFrameMatches: true,
        shellInsetsMatch: true,
        panelMatchesFrame: true,
      });
  }

  await page.setViewportSize({ width: NARROW_VIEWPORT, height: VIEWPORT_HEIGHT });
  await expect(table).toBeVisible();
  await expect
    .poll(() => {
      return page.evaluate((tolerance) => {
        const tableBody = document.querySelector('.ant-table-body');
        if (!(tableBody instanceof HTMLElement))
          throw new TypeError('Heatmap table scroll region missing');
        const documentOverflow = document.documentElement.scrollWidth - window.innerWidth;
        return {
          documentOverflow,
          tableBodyWidth: tableBody.clientWidth,
          tableScrollWidth: tableBody.scrollWidth,
          noDocumentOverflow: documentOverflow <= tolerance,
          tableScrollsLocally: tableBody.scrollWidth > tableBody.clientWidth,
        };
      }, GEOMETRY_TOLERANCE);
    })
    .toMatchObject({ noDocumentOverflow: true, tableScrollsLocally: true });

  await page.setViewportSize({ width: VIEWPORT_2560, height: VIEWPORT_HEIGHT });
  await page.getByRole('menuitem', { name: 'Assignments' }).click();
  const siblingFrame = page.locator('.app-page-content').first();
  await expect
    .poll(() => siblingFrame.evaluate((element) => element.getBoundingClientRect().width))
    .toBeLessThanOrEqual(SIBLING_PAGE_MAX_WIDTH);
});
