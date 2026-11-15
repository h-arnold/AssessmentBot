/**
 * Geometry measurement and scroll primitives for the sticky-table scroll
 * journeys (`e2e-tests/sticky-table-scroll.spec.ts`).
 *
 * Owns the consistent-geometry snapshots (`readStickyGeometry`,
 * `readNameColumnGeometry`), the pinned bar and header assertions, and the
 * document/region scrolling primitives the journeys compose. Journey
 * composition and the surface tests stay in the spec; this module only reads
 * and moves the sticky table's geometry.
 *
 * The selectors are passed into `evaluate` snapshots as arguments (an
 * `evaluate` callback cannot close over imports), sourced from the exported
 * constants in `sticky-table-locators.ts` so a rename stays single-sourced.
 */

import { expect, type Locator } from '@playwright/test';
import {
  stickyTableBody,
  stickyTableHeaderHolder,
  STICKY_SCROLL_SELECTOR,
  STICKY_SCROLL_THUMB_SELECTOR,
  STICKY_TABLE_WRAPPER_SELECTOR,
  type StickyTableScope,
} from './sticky-table-locators';

/**
 * Sub-pixel rounding tolerance for geometry comparisons, matching the
 * committed convention in `heatmaps-layout.spec.ts`; the document-overflow
 * comparison needs it because `scrollWidth`/`clientWidth` round oppositely.
 */
export const GEOMETRY_TOLERANCE = 1;

/** Document offset kept above the scroll region so the header holder pins. */
const VIEWPORT_TOP_MARGIN = 16;

/** Measured geometry of one sticky table's scroll region, bar and thumb. */
export interface StickyGeometry {
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
export interface NameColumnGeometry {
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
export async function readStickyGeometry(scope: StickyTableScope): Promise<StickyGeometry> {
  const raw = await stickyTableBody(scope).evaluate(
    (region, selectors) => {
      // document.scrollingElement is documentElement in standards mode; its overflow is the criterion's measure.
      const wrapper = region.closest(selectors.wrapper);
      const bar = wrapper ? wrapper.querySelector(selectors.scroll) : null;
      const barRect = bar ? bar.getBoundingClientRect() : null;
      const thumb = bar ? bar.querySelector(selectors.thumb) : null;
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
        documentOverflow:
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    },
    {
      wrapper: STICKY_TABLE_WRAPPER_SELECTOR,
      scroll: STICKY_SCROLL_SELECTOR,
      thumb: STICKY_SCROLL_THUMB_SELECTOR,
    }
  );
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
export async function readNameColumnGeometry(scope: StickyTableScope): Promise<NameColumnGeometry> {
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
export async function expectHeaderPinnedAtTop(scope: StickyTableScope): Promise<void> {
  const holderTop = await stickyTableHeaderHolder(scope).evaluate(
    (holder) => holder.getBoundingClientRect().top
  );
  expect(Math.abs(holderTop)).toBeLessThanOrEqual(GEOMETRY_TOLERANCE);
}

/**
 * Assert the bar's pinned geometry while the scroll region crosses the
 * viewport bottom: a zero bottom offset, a width spanning the region's
 * visible width, and left alignment with the region's visible left edge.
 *
 * @param {StickyTableScope} scope - Scope holding exactly one sticky table.
 * @returns {Promise<void>} Resolves once the assertions hold.
 */
export async function expectBarPinnedGeometry(scope: StickyTableScope): Promise<void> {
  const pinned = await readStickyGeometry(scope);
  const { barBottomOffset, barWidth, barLeft } = pinned;
  if (barBottomOffset === null || barWidth === null || barLeft === null) {
    throw new TypeError(
      'Sticky bar geometry missing while the scroll region crosses the viewport bottom.'
    );
  }
  expect(Math.abs(barBottomOffset)).toBeLessThanOrEqual(GEOMETRY_TOLERANCE);
  expect(Math.abs(barWidth - pinned.regionVisibleWidth)).toBeLessThanOrEqual(GEOMETRY_TOLERANCE);
  expect(Math.abs(barLeft - Math.max(pinned.regionLeft, 0))).toBeLessThanOrEqual(
    GEOMETRY_TOLERANCE
  );
}

/**
 * Scroll the document so the table's scroll region crosses the viewport bottom
 * edge, leaving the header holder scrolled past the viewport top.
 *
 * @param {StickyTableScope} scope - Scope holding exactly one sticky table.
 * @returns {Promise<void>} Resolves once the document has scrolled.
 */
export async function scrollRegionAcrossViewportBottom(scope: StickyTableScope): Promise<void> {
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
export async function panTableRegion(scope: StickyTableScope, distance: number): Promise<void> {
  await stickyTableBody(scope).evaluate((region, pan) => {
    region.scrollLeft = pan;
  }, distance);
}

/**
 * Pan the scroll region horizontally to its maximum scroll-left.
 *
 * The browser clamps an over-large scroll-left assignment to the region's
 * maximum, so assigning the full scroll width scrolls to the end of range.
 *
 * @param {StickyTableScope} scope - Scope holding exactly one sticky table.
 * @returns {Promise<void>} Resolves once the region has scrolled to its end.
 */
export async function panTableRegionToEnd(scope: StickyTableScope): Promise<void> {
  await stickyTableBody(scope).evaluate((region) => {
    region.scrollLeft = region.scrollWidth;
  });
}
