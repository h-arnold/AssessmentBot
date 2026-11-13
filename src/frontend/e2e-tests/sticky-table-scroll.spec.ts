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
 * sort applying while pinned (Class page overview), the bar
 * hiding once the scroll region's bottom edge reaches the viewport bottom, and
 * that the table adds nothing to the document's horizontal overflow. The Class
 * page journeys collapse the shell navigation before resizing: the sider
 * otherwise stays expanded at 390px and squeezes the cards below usable width.
 * Headless
 * Chromium hides native scrollbars, so Ant Design's cached scrollbar
 * measurement is 0: the bar's hidden state is asserted by scrolling the scroll
 * region's bottom edge to or above the viewport bottom, never against a
 * one-scrollbar-height boundary; the bar unmounts when hidden or when the
 * table has no horizontal overflow, so absence is asserted with
 * `toHaveCount(0)`. The Heatmaps page additionally asserts
 * `document.scrollingElement.scrollWidth <= clientWidth`; the two Class page
 * surfaces cannot, because their page chrome already overflows the document
 * at 390px independently of this feature (see the contributing report).
 * Wide-viewport journeys (1920px, overflow-free on all three surfaces) assert
 * that no sticky bar renders and the document keeps no horizontal overflow.
 */

import { expect, test, type Locator, type Page } from '@playwright/test';
import { installRuntimeMock, selectVisibleOption } from './shared/endToEndRuntimeMocks';
import {
  stickyTableBody,
  stickyTableHeaderHolder,
  stickyTableScrollBar,
  stickyTableWrapper,
  type StickyTableScope,
} from './helpers/sticky-table-locators';
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
/** Document offset kept above the scroll region so the header holder pins. */
const VIEWPORT_TOP_MARGIN = 16;
const HORIZONTAL_PAN = 120;
const THUMB_DRAG_DISTANCE = 100;
/** Runtime narrow height is the measured scroll region height divided by this. */
const NARROW_HEIGHT_DIVISOR = 2;
/** An element's centre offset is its box edge plus its size divided by this. */
const RECT_CENTRE_DIVISOR = 2;
/** Heatmaps builder combobox order: class, topics, assignments. */
const ASSIGNMENTS_CONTROL_INDEX = 2;
/**
 * Sub-pixel rounding tolerance for geometry comparisons, matching the
 * committed convention in `heatmaps-layout.spec.ts`; the document-overflow
 * comparison needs it because `scrollWidth`/`clientWidth` round oppositely.
 */
const GEOMETRY_TOLERANCE = 1;
/** Thumb-to-scroll proportionality tolerance (the relation is exact in rc-table). */
const SYNC_TOLERANCE = 0.05;

/** Measured geometry of one sticky table's scroll region, bar and thumb. */
interface StickyGeometry {
  /** Viewport bottom minus bar bottom; 0 while the bar is pinned. */
  barBottomOffset: number | null;
  barWidth: number | null;
  barLeft: number | null;
  regionLeft: number;
  regionTop: number;
  regionBottom: number;
  regionVisibleWidth: number;
  regionScrollWidth: number;
  regionClientWidth: number;
  scrollLeft: number;
  /** Thumb translate offset inside the bar track. */
  thumbOffset: number | null;
  /** Track width minus thumb width; the thumb's travel range. */
  thumbRange: number | null;
  viewportHeight: number;
  documentOverflow: number;
}

/** Measured viewport x-positions of the fixed name columns and moving probes. */
interface NameColumnGeometry {
  forenameHeaderX: number;
  surnameHeaderX: number;
  movingHeaderX: number;
  forenameCellX: number;
  surnameCellX: number;
  trailingCellX: number;
}

/**
 * Read an element's viewport x-position.
 *
 * @param {Locator} locator - The element locator to measure.
 * @returns {Promise<number>} The element's viewport x-position.
 */
function viewportXOf(locator: Locator): Promise<number> {
  return locator.evaluate((cell) => cell.getBoundingClientRect().x);
}

/**
 * Read the scroll region, sticky bar and thumb geometry of the one sticky
 * student table inside `scope` as a single consistent snapshot. Bar and thumb
 * fields are null when the bar is unmounted (hidden or no overflow).
 *
 * @param {StickyTableScope} scope - Scope holding exactly one sticky table.
 * @returns {Promise<StickyGeometry>} The measured geometry.
 */
async function readStickyGeometry(scope: StickyTableScope): Promise<StickyGeometry> {
  const raw = await stickyTableBody(scope).evaluate((region) => {
    // document.scrollingElement is documentElement in standards mode; its overflow is the criterion's measure.
    const bar = region.closest('.ant-table-wrapper')?.querySelector('.ant-table-sticky-scroll');
    const barRect = bar ? bar.getBoundingClientRect() : null;
    const thumb = bar ? bar.querySelector('.ant-table-sticky-scroll-bar') : null;
    const thumbRect = thumb ? thumb.getBoundingClientRect() : null;
    const regionRect = region.getBoundingClientRect();
    return {
      regionLeft: regionRect.left,
      regionTop: regionRect.top,
      regionBottom: regionRect.bottom,
      regionVisibleWidth:
        Math.min(regionRect.right, window.innerWidth) - Math.max(regionRect.left, 0),
      barRect: barRect
        ? { left: barRect.left, bottom: barRect.bottom, width: barRect.width }
        : null,
      thumbRect: thumbRect ? { left: thumbRect.left, width: thumbRect.width } : null,
      scrollLeft: region.scrollLeft,
      regionScrollWidth: region.scrollWidth,
      regionClientWidth: region.clientWidth,
      viewportHeight: window.innerHeight,
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  const { barRect, thumbRect, ...region } = raw;
  const [barBottomOffset, barWidth, barLeft] = barRect
    ? [region.viewportHeight - barRect.bottom, barRect.width, barRect.left]
    : [null, null, null];
  const [thumbOffset, thumbRange] =
    barRect && thumbRect
      ? [thumbRect.left - barRect.left, barRect.width - thumbRect.width]
      : [null, null];
  return { ...region, barBottomOffset, barWidth, barLeft, thumbOffset, thumbRange };
}

/**
 * Read the viewport x-positions of the fixed Forename/Surname header and body
 * cells, the first Completeness header, and the first row's trailing cell.
 *
 * @param {StickyTableScope} scope - Scope holding exactly one sticky table.
 * @returns {Promise<NameColumnGeometry>} The measured x-positions.
 */
async function readNameColumnGeometry(scope: StickyTableScope): Promise<NameColumnGeometry> {
  const header = stickyTableHeaderHolder(scope);
  const firstRow = stickyTableBody(scope).locator('tbody tr.ant-table-row').first();
  return {
    forenameHeaderX: await viewportXOf(header.getByRole('columnheader', { name: 'Forename' })),
    surnameHeaderX: await viewportXOf(header.getByRole('columnheader', { name: 'Surname' })),
    movingHeaderX: await viewportXOf(
      header.getByRole('columnheader', { name: 'Completeness' }).first()
    ),
    forenameCellX: await viewportXOf(firstRow.getByRole('cell').nth(0)),
    surnameCellX: await viewportXOf(firstRow.getByRole('cell').nth(1)),
    trailingCellX: await viewportXOf(firstRow.getByRole('cell').last()),
  };
}

/**
 * Assert the header holder is pinned at the viewport top with a zero top offset.
 *
 * @param {StickyTableScope} scope - Scope holding exactly one sticky table.
 * @returns {Promise<void>} Resolves once the assertion holds.
 */
async function expectHeaderPinnedAtTop(scope: StickyTableScope): Promise<void> {
  const holderTop = await stickyTableHeaderHolder(scope).evaluate(
    (holder) => holder.getBoundingClientRect().top
  );
  expect(Math.abs(holderTop)).toBeLessThanOrEqual(GEOMETRY_TOLERANCE);
}

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
 * Scroll the document so the table's scroll region crosses the viewport bottom
 * edge, leaving the header holder scrolled past the viewport top.
 *
 * @param {StickyTableScope} scope - Scope holding exactly one sticky table.
 * @returns {Promise<void>} Resolves once the document has scrolled.
 */
async function scrollRegionAcrossViewportBottom(scope: StickyTableScope): Promise<void> {
  await stickyTableBody(scope).evaluate((region, margin) => {
    const regionTop = region.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, Math.max(0, regionTop - margin));
  }, VIEWPORT_TOP_MARGIN);
}

/**
 * Pan the scroll region horizontally to `distance` pixels of scroll-left.
 *
 * @param {StickyTableScope} scope - Scope holding exactly one sticky table.
 * @param {number} distance - Scroll-left target in pixels.
 * @returns {Promise<void>} Resolves once the region has scrolled.
 */
async function panTableRegion(scope: StickyTableScope, distance: number): Promise<void> {
  await stickyTableBody(scope).evaluate((region, pan) => {
    region.scrollLeft = pan;
  }, distance);
}

/**
 * Assert the full sticky-scroll journey on one surface: the bar pinned to the
 * viewport bottom and spanning the region's visible width while the region
 * crosses the bottom edge, the header holder pinned at the viewport top, a
 * horizontal pan (thumb drag or programmatic) that keeps the thumb synchronised
 * while the fixed name columns hold their viewport x-position, and — at the
 * table's end — the bar unmounted with the region still overflowing and partly
 * visible so its own scrollbar is reachable.
 *
 * @param {Page} page - The Playwright page under test.
 * @param {StickyTableScope} scope - Scope holding exactly one sticky table.
 * @param {boolean} shouldPanByThumbDrag - Pan by dragging the thumb, not the region.
 * @returns {Promise<void>} Resolves once the journey's assertions hold.
 */
async function expectStickyScrollJourney(
  page: Page,
  scope: StickyTableScope,
  shouldPanByThumbDrag: boolean
): Promise<void> {
  await scrollRegionAcrossViewportBottom(scope);
  // Presence is polled: the bar renders only after Ant Design's first visibility check.
  await expect(stickyTableScrollBar(scope)).toBeVisible();
  const pinned = await readStickyGeometry(scope);
  expect(Math.abs(pinned.barBottomOffset ?? NaN)).toBeLessThanOrEqual(GEOMETRY_TOLERANCE);
  expect(Math.abs((pinned.barWidth ?? NaN) - pinned.regionVisibleWidth)).toBeLessThanOrEqual(
    GEOMETRY_TOLERANCE
  );
  expect(Math.abs((pinned.barLeft ?? NaN) - Math.max(pinned.regionLeft, 0))).toBeLessThanOrEqual(
    GEOMETRY_TOLERANCE
  );
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
    const thumb = stickyTableScrollBar(scope).locator('.ant-table-sticky-scroll-bar');
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
    await page.getByRole('combobox').nth(0).click();
    await selectVisibleOption(page, HEATMAP_CLASS_NAME);
    await expect(page.getByRole('combobox').nth(1)).toBeEnabled();
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
    await expectStickyScrollJourney(page, scope, true);
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
