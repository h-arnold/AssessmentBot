/**
 * Sticky table scroll and frozen student-name columns on all three
 * student-table surfaces (GitHub issue #344): the Class page overview (Student
 * Averages), the Class page assignment heatmap view, and the standalone
 * Heatmaps page. Each renders a sticky student table — a header table inside
 * `.ant-table-header.ant-table-sticky-holder`, a body table inside
 * `.ant-table-body` (the horizontal scroll region), and a
 * `.ant-table-sticky-scroll` bar that renders only while the body overflows
 * horizontally and its scroll region crosses the viewport bottom edge.
 *
 * Narrow-viewport journeys (390px wide, the repo's `NARROW_VIEWPORT`
 * convention) pick their height at runtime below the measured `.ant-table-body`
 * height so the 10-row `createHeatmapScenario` fixture overflows, then assert
 * the bar's viewport-bottom geometry, thumb synchronisation during panning and
 * thumb dragging, fixed Forename/Surname stability, header pinning, a Surname
 * sort applying while pinned (Class page overview), a metric-cell hover
 * firing its preview past the frozen columns on the heatmap surfaces, the
 * region reaching its maximum scroll-left with the last column fully visible,
 * the bar hiding once the scroll region's bottom edge reaches the viewport
 * bottom, and that the table adds nothing to the document's horizontal
 * overflow. The Class page journeys collapse the shell navigation before
 * resizing: the sider otherwise stays expanded at 390px and squeezes the
 * cards below usable width. Headless Chromium hides native scrollbars, so
 * Ant Design's cached scrollbar measurement is 0: the bar's hidden state is
 * asserted by scrolling the scroll region's bottom edge to or above the
 * viewport bottom, never against a one-scrollbar-height boundary; the bar
 * unmounts when hidden or when the table has no horizontal overflow, so
 * absence is asserted with `toHaveCount(0)`. The Heatmaps page additionally
 * asserts `document.scrollingElement.scrollWidth <= clientWidth`; the two
 * Class page surfaces cannot, because their page chrome already overflows
 * the document at 390px independently of this feature (see the contributing
 * report). Wide-viewport journeys (1920px, overflow-free on all three
 * surfaces) assert that no sticky bar renders and the document keeps no
 * horizontal overflow.
 */

import { expect, test, type Locator, type Page } from '@playwright/test';
import { installRuntimeMock, selectVisibleOption } from './shared/endToEndRuntimeMocks';
import {
  stickyScrollBarThumb,
  stickyTableBody,
  stickyTableHeaderHolder,
  stickyTableScrollBar,
  stickyTableWrapper,
  type StickyTableScope,
} from './helpers/sticky-table-locators';
import {
  expectBarPinnedGeometry,
  expectHeaderPinnedAtTop,
  GEOMETRY_TOLERANCE,
  type NameColumnGeometry,
  panTableRegion,
  panTableRegionToEnd,
  readNameColumnGeometry,
  readStickyGeometry,
  scrollRegionAcrossViewportBottom,
} from './helpers/sticky-table-scroll-geometry';
import {
  ASSIGNMENTS_CONTROL_INDEX,
  CLASS_CONTROL_INDEX,
  TOPICS_CONTROL_INDEX,
} from './helpers/shell-controls';
import {
  createHeatmapScenario,
  HEATMAP_ASSIGNMENT_DISPLAY_TITLE,
  HEATMAP_CLASS_NAME,
  openHeatmapClass,
} from './helpers/task-heatmap-end-to-end-helpers';

const NARROW_VIEWPORT_WIDTH = 390;
const WIDE_VIEWPORT_WIDTH = 1920;
const PROVISIONAL_VIEWPORT_HEIGHT = 1000;
const MIN_NARROW_VIEWPORT_HEIGHT = 320;
const HORIZONTAL_PAN = 120;
const THUMB_DRAG_DISTANCE = 100;
/** Runtime narrow height is the measured scroll region height divided by this. */
const NARROW_HEIGHT_DIVISOR = 2;
/** An element's centre offset is its box edge plus its size divided by this. */
const RECT_CENTRE_DIVISOR = 2;
/** Thumb-to-scroll proportionality tolerance (the relation is exact in rc-table). */
const SYNC_TOLERANCE = 0.05;

/**
 * Collapse the shell navigation before a narrow resize: the sider otherwise
 * stays expanded at 390px and squeezes the class-page cards below their usable
 * width.
 *
 * @param {Page} page - The Playwright page under test.
 * @returns {Promise<void>} Resolves once the sider has collapsed.
 */
async function collapseShellNavigation(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Collapse navigation' }).click();
  await expect(page.getByRole('button', { name: 'Expand navigation' })).toBeVisible();
}

/**
 * Resize to the narrow viewport with a runtime height below the measured
 * `.ant-table-body` height, so the 10-row fixture overflows the viewport.
 *
 * @param {Page} page - The Playwright page under test.
 * @param {StickyTableScope} scope - Scope holding exactly one sticky table.
 * @returns {Promise<void>} Resolves once the viewport is set and verified.
 */
async function useNarrowViewport(page: Page, scope: StickyTableScope): Promise<void> {
  await page.setViewportSize({ width: NARROW_VIEWPORT_WIDTH, height: PROVISIONAL_VIEWPORT_HEIGHT });
  const body = stickyTableBody(scope);
  await expect(body).toBeVisible();
  const regionHeight = await body.evaluate((region) => region.getBoundingClientRect().height);
  const narrowHeight = Math.max(
    MIN_NARROW_VIEWPORT_HEIGHT,
    Math.floor(regionHeight / NARROW_HEIGHT_DIVISOR)
  );
  if (narrowHeight >= regionHeight) {
    throw new Error(
      `Runtime viewport height ${narrowHeight} must stay below the measured scroll region height ${regionHeight}.`
    );
  }
  await page.setViewportSize({ width: NARROW_VIEWPORT_WIDTH, height: narrowHeight });
  await expect
    .poll(async () => {
      const geometry = await readStickyGeometry(scope);
      return geometry.regionScrollWidth - geometry.regionClientWidth;
    })
    .toBeGreaterThan(0);
}

/**
 * Assert the full sticky-scroll journey on one surface: the bar pinned to the
 * viewport bottom and spanning the region's visible width while the region
 * crosses the bottom edge, the header holder pinned at the viewport top, a
 * horizontal pan (thumb drag or programmatic) that keeps the thumb synchronised
 * while the fixed name columns hold their viewport x-position, the region
 * reaching its maximum scroll-left with the last column fully visible, a
 * metric-cell hover firing the preview past the frozen columns when
 * `metricCellTrigger` is supplied, and — at the table's end — the bar
 * unmounted with the region still overflowing and partly visible so its own
 * scrollbar is reachable.
 *
 * @param {Page} page - The Playwright page under test.
 * @param {StickyTableScope} scope - Scope holding exactly one sticky table.
 * @param {boolean} shouldPanByThumbDrag - Pan by dragging the thumb, not the region.
 * @param {Locator} [metricCellTrigger] - A heatmap metric-cell preview trigger
 *   to hover at end-of-range. Only the embedded heatmap journey supplies one:
 *   the Student Averages table has no preview triggers, and the standalone
 *   Heatmaps page has no pointer-reachable metric cells at 390px.
 * @returns {Promise<void>} Resolves once the journey's assertions hold.
 */
async function expectStickyScrollJourney(
  page: Page,
  scope: StickyTableScope,
  shouldPanByThumbDrag: boolean,
  metricCellTrigger?: Locator
): Promise<void> {
  await scrollRegionAcrossViewportBottom(scope);
  // Presence is polled: the bar renders only after Ant Design's first visibility check.
  await expect(stickyTableScrollBar(scope)).toBeVisible();
  await expectBarPinnedGeometry(scope);
  await expectHeaderPinnedAtTop(scope);
  // The table adds nothing to the document's horizontal overflow: the document
  // is exactly as wide with the table's card hidden as shown (pre-existing page
  // chrome may overflow independently of this feature).
  const contribution = await stickyTableBody(scope).evaluate((region) => {
    const card = region.closest('.ant-card');
    if (!(card instanceof HTMLElement)) throw new TypeError('Sticky table card missing');
    const widthWithTable = document.documentElement.scrollWidth;
    card.style.display = 'none';
    const widthWithoutTable = document.documentElement.scrollWidth;
    card.style.display = '';
    return { widthWithTable, widthWithoutTable };
  });
  expect(contribution.widthWithTable).toBe(contribution.widthWithoutTable);

  const columnsBefore = await readNameColumnGeometry(scope);
  if (shouldPanByThumbDrag) {
    const thumb = stickyScrollBarThumb(scope);
    const thumbBox = await thumb.boundingBox();
    if (!thumbBox) {
      throw new Error('Sticky bar thumb has no bounding box to drag.');
    }
    const thumbCentreX = thumbBox.x + thumbBox.width / RECT_CENTRE_DIVISOR;
    const thumbCentreY = thumbBox.y + thumbBox.height / RECT_CENTRE_DIVISOR;
    await page.mouse.move(thumbCentreX, thumbCentreY);
    await page.mouse.down();
    await page.mouse.move(thumbCentreX + THUMB_DRAG_DISTANCE, thumbCentreY, { steps: 8 });
    await page.mouse.up();
  } else {
    await panTableRegion(scope, HORIZONTAL_PAN);
  }
  await expect
    .poll(async () => {
      const geometry = await readStickyGeometry(scope);
      const scrollable = geometry.regionScrollWidth - geometry.regionClientWidth;
      if (scrollable <= 0 || geometry.thumbRange === null || geometry.thumbRange <= 0) {
        return Infinity;
      }
      return Math.abs(
        geometry.scrollLeft / scrollable - (geometry.thumbOffset ?? 0) / geometry.thumbRange
      );
    })
    .toBeLessThanOrEqual(SYNC_TOLERANCE);
  const panned = await readStickyGeometry(scope);
  const columnsAfter = await readNameColumnGeometry(scope);
  expect(panned.scrollLeft).toBeGreaterThan(0);
  const fixedProbes: ReadonlyArray<keyof NameColumnGeometry> = [
    'forenameHeaderX',
    'surnameHeaderX',
    'forenameCellX',
    'surnameCellX',
  ];
  for (const probe of fixedProbes) {
    expect(Math.abs(columnsAfter[probe] - columnsBefore[probe])).toBeLessThanOrEqual(
      GEOMETRY_TOLERANCE
    );
  }
  expect(Math.abs(columnsAfter.movingHeaderX - columnsBefore.movingHeaderX)).toBeGreaterThan(
    GEOMETRY_TOLERANCE
  );
  expect(Math.abs(columnsAfter.trailingCellX - columnsBefore.trailingCellX)).toBeGreaterThan(
    GEOMETRY_TOLERANCE
  );

  // End-of-range: the region must reach its maximum scroll-left, aligning the
  // first row's last cell with the region's visible right edge — a clamped-
  // scroll regression cannot pass this.
  await panTableRegionToEnd(scope);
  const endOfRange = await readStickyGeometry(scope);
  const endOfRangeScrollable = endOfRange.regionScrollWidth - endOfRange.regionClientWidth;
  expect(endOfRangeScrollable).toBeGreaterThan(0);
  expect(endOfRange.scrollLeft).toBeGreaterThanOrEqual(endOfRangeScrollable - GEOMETRY_TOLERANCE);
  const endOfRangeCells = await stickyTableBody(scope).evaluate((region) => {
    const firstRow = region.querySelector(':scope tbody tr.ant-table-row');
    if (!(firstRow instanceof HTMLElement)) {
      throw new TypeError('Sticky table body has no data row to measure.');
    }
    const lastCell = firstRow.lastElementChild;
    if (!(lastCell instanceof HTMLElement)) {
      throw new TypeError('First data row has no trailing cell to measure.');
    }
    const regionRect = region.getBoundingClientRect();
    return {
      regionVisibleRight: Math.min(regionRect.right, window.innerWidth),
      lastCellRight: lastCell.getBoundingClientRect().right,
    };
  });
  expect(endOfRangeCells.lastCellRight).toBeLessThanOrEqual(
    endOfRangeCells.regionVisibleRight + GEOMETRY_TOLERANCE
  );
  expect(endOfRangeCells.lastCellRight).toBeGreaterThanOrEqual(
    endOfRangeCells.regionVisibleRight - GEOMETRY_TOLERANCE
  );

  if (metricCellTrigger) {
    // Hit-testing through the frozen columns: at end-of-range the last task
    // column is pointer-reachable past the fixed Forename/Surname columns, so
    // hovering its metric cell must fire the preview — an overlay swallowing
    // pointer events cannot pass this.
    await expect(metricCellTrigger).toBeVisible();
    await metricCellTrigger.hover();
    const popover = page.locator('.ant-popover');
    await expect(popover).toBeVisible();
    await expect(popover.getByText('Reasoning', { exact: true })).toHaveCount(1);
    await expect(popover.getByText('Student Response', { exact: true })).toHaveCount(1);
    // Park the pointer so the hover preview closes before the bar-unmount step.
    await page.mouse.move(0, 0);
    await expect(popover).toHaveCount(0);
  }

  await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  // The bar unmounts when hidden, so absence is a count assertion.
  await expect(stickyTableScrollBar(scope)).toHaveCount(0);
  const atEnd = await readStickyGeometry(scope);
  expect(atEnd.regionBottom).toBeLessThanOrEqual(atEnd.viewportHeight + GEOMETRY_TOLERANCE);
  expect(atEnd.regionTop).toBeLessThan(atEnd.viewportHeight);
  expect(atEnd.regionScrollWidth).toBeGreaterThan(atEnd.regionClientWidth);
}

/**
 * Assert the wide viewport renders no sticky bar, no region overflow and no document overflow.
 * @param {StickyTableScope} scope - Scope holding exactly one sticky table.
 * @returns {Promise<void>} Resolves once the assertions hold.
 */
async function expectNoStickyBar(scope: StickyTableScope): Promise<void> {
  await expect(stickyTableBody(scope)).toBeVisible();
  await expect(stickyTableScrollBar(scope)).toHaveCount(0);
  const geometry = await readStickyGeometry(scope);
  expect(geometry.regionScrollWidth - geometry.regionClientWidth).toBeLessThanOrEqual(
    GEOMETRY_TOLERANCE
  );
  expect(geometry.documentOverflow).toBeLessThanOrEqual(GEOMETRY_TOLERANCE);
}

/**
 * Install the heatmap scenario and open one student-table surface.
 *
 * @remarks
 * The overview uses the zero-weight scenario variant, matching the committed
 * overview journeys in `metric-range-filter.spec.ts`.
 *
 * @param {Page} page - The Playwright page under test.
 * @param {"overview" | "embedded" | "standalone"} surface - Surface to open.
 * @returns {Promise<StickyTableScope>} The surface's table scope: the Student
 *   Averages card on the overview, the page on the heatmap surfaces.
 */
async function openSurface(
  page: Page,
  surface: 'overview' | 'embedded' | 'standalone'
): Promise<StickyTableScope> {
  await installRuntimeMock(
    page,
    createHeatmapScenario(surface === 'overview' ? { zeroWeightAssignment: true } : {})
  );
  if (surface === 'standalone') {
    await page.goto('/');
    await page.getByRole('menuitem', { name: 'Heatmaps' }).click();
    await page.getByRole('combobox').nth(CLASS_CONTROL_INDEX).click();
    await selectVisibleOption(page, HEATMAP_CLASS_NAME);
    await expect(page.getByRole('combobox').nth(TOPICS_CONTROL_INDEX)).toBeEnabled();
    await page.getByRole('combobox').nth(ASSIGNMENTS_CONTROL_INDEX).click();
    await selectVisibleOption(page, HEATMAP_ASSIGNMENT_DISPLAY_TITLE);
  } else {
    await openHeatmapClass(page);
    if (surface === 'embedded') {
      await page.getByRole('button').filter({ hasText: HEATMAP_ASSIGNMENT_DISPLAY_TITLE }).click();
    }
  }
  await expect(stickyTableWrapper(page)).toBeVisible();
  if (surface === 'overview') {
    return page.locator('.ant-card').filter({ hasText: 'Student Averages' });
  }
  return page;
}

/**
 * Build the heatmap's last-column metric-cell preview trigger.
 *
 * The fixture's last task group is Task 3 and its last sub-column is SPaG, so
 * Student Six's Task 3 SPaG cell sits in the scrolled column; at end-of-range
 * it is pointer-reachable past the fixed Forename/Surname columns. Student Six
 * is row six: the pinned two-tier header overlays the region's first rows at
 * the short viewport, so the hit-test targets a row whose centre clears both
 * the pinned header above and the sticky bar below.
 *
 * Only the embedded journey supplies this trigger: the standalone Heatmaps
 * page keeps its sider expanded at 390px, which squeezes the scroll region
 * narrower than the fixed columns, so no metric cell is pointer-reachable
 * there and the visual spec opens previews with the keyboard instead.
 *
 * @param {StickyTableScope} scope - Scope holding exactly one sticky table.
 * @returns {Locator} The metric cell's preview trigger button.
 */
function heatmapMetricPreviewTrigger(scope: StickyTableScope): Locator {
  return stickyTableBody(scope).getByRole('button', {
    name: 'Student Six, Task 3, SPaG: 5',
    exact: true,
  });
}

test.describe('narrow viewport sticky table behaviour', () => {
  test('Class page overview pins bar and header, keeps name columns fixed and sorts while pinned', async ({
    page,
  }) => {
    const averagesCard = await openSurface(page, 'overview');
    await collapseShellNavigation(page);
    await useNarrowViewport(page, averagesCard);
    await expectStickyScrollJourney(page, averagesCard, false);

    // While the header is pinned again, the Surname sorter — inside the fixed
    // name column, so always reachable without panning — still sorts. Two
    // clicks select descending order, putting Student Two in the first row.
    await scrollRegionAcrossViewportBottom(averagesCard);
    await expectHeaderPinnedAtTop(averagesCard);
    const surnameHeader = stickyTableHeaderHolder(averagesCard).getByRole('columnheader', {
      name: 'Surname',
    });
    await surnameHeader.locator('.ant-table-column-sorters').click();
    await surnameHeader.locator('.ant-table-column-sorters').click();
    const firstSurnameCell = stickyTableBody(averagesCard)
      .locator('tbody tr.ant-table-row')
      .first()
      .getByRole('cell')
      .nth(1);
    await expect(firstSurnameCell).toHaveText('Two');
  });

  test('Class page assignment heatmap pins bar and header and drags the thumb to pan', async ({
    page,
  }) => {
    const scope = await openSurface(page, 'embedded');
    await collapseShellNavigation(page);
    await useNarrowViewport(page, scope);
    await expectStickyScrollJourney(page, scope, true, heatmapMetricPreviewTrigger(scope));
  });

  test('Heatmaps page pins bar and header and keeps name columns fixed while panning', async ({
    page,
  }) => {
    const scope = await openSurface(page, 'standalone');
    await useNarrowViewport(page, scope);
    await expectStickyScrollJourney(page, scope, false);
    // This surface's fluid frame keeps the document overflow-free at 390px.
    const geometry = await readStickyGeometry(scope);
    expect(geometry.documentOverflow).toBeLessThanOrEqual(GEOMETRY_TOLERANCE);
  });
});

test.describe('wide viewport renders no sticky bar', () => {
  test('Class page overview renders no sticky bar and no document overflow', async ({ page }) => {
    await page.setViewportSize({ width: WIDE_VIEWPORT_WIDTH, height: PROVISIONAL_VIEWPORT_HEIGHT });
    const averagesCard = await openSurface(page, 'overview');
    await expectNoStickyBar(averagesCard);
  });

  test('Class page assignment heatmap renders no sticky bar and no document overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: WIDE_VIEWPORT_WIDTH, height: PROVISIONAL_VIEWPORT_HEIGHT });
    const scope = await openSurface(page, 'embedded');
    await expectNoStickyBar(scope);
  });

  test('Heatmaps page renders no sticky bar and no document overflow', async ({ page }) => {
    await page.setViewportSize({ width: WIDE_VIEWPORT_WIDTH, height: PROVISIONAL_VIEWPORT_HEIGHT });
    const scope = await openSurface(page, 'standalone');
    await expectNoStickyBar(scope);
  });
});
