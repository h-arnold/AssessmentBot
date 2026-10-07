/**
 * Reviewed geometry values, stability polling and invariant assertions for the
 * issue #19 task-preview source action's rendered header geometry, following
 * the accepted representative visual inspection.
 *
 * @remarks
 * **Real measurements only.** Every number asserted here comes from
 * `getBoundingClientRect()` on the rendered elements, read once the layout has
 * settled. DOM order, SVG attributes and CSS declarations are never used as a
 * substitute for geometry.
 *
 * **Stable layout, not an animation frame.** The antd Popover mounts with a
 * `zoom-big` motion on the overlay root, so a first read catches a scaled,
 * translated frame whose numbers are still changing. `measureStablePreviewHeader`
 * therefore polls — with no arbitrary sleeps — until the whole region set has
 * been read {@link REQUIRED_STABLE_READS} consecutive times with byte-identical
 * values *and* the overlay's motion has finished.
 *
 * **Where the regions come from.** Region resolution and reading live in
 * `task-preview-header-regions.ts`; this module owns the reviewed numbers, the
 * layout document's tolerances, the assertions over a settled measurement and
 * the page-level overflow invariant.
 *
 * **One acceptance path, in one order.** Layout invariant 6 is "no *new*
 * horizontal overflow", which is only a closed-page-to-open-page comparison.
 * `assertReadyPreviewGeometry` therefore takes the baseline
 * {@link readClosedPageOverflowWidth} recorded while the page sat without a
 * preview, and reading that baseline is deliberately impossible from here any
 * other way: the raw page read is private, and the baseline function fails
 * loudly if a preview is open. A caller cannot re-order the two readings, which
 * is what made the earlier comparison vacuous — two open readings match
 * whatever overflow the preview permanently added.
 *
 * @see TASK_PREVIEW_SOURCE_LINK_LAYOUT.md — acceptance evidence
 */

import { expect, type Locator, type Page } from '@playwright/test';
import { SOURCE_ACTION_LABEL } from '../../src/features/taskHeatmap/TaskPreviewCard';
import { openPreviewPopover } from './task-preview-source-link-helpers';
import {
  PREVIEW_HEADER_REGION_SELECTORS,
  readPreviewHeaderRegions,
  type PreviewHeaderMeasurement,
  type RenderedBox,
} from './task-preview-header-regions';

// ---------------------------------------------------------------------------
// Starting-proposal values and tolerances
// ---------------------------------------------------------------------------

/** Retained final value, accepted at the representative visual inspection: SVG side length of the Lucide `ExternalLink` icon, in CSS pixels. */
export const SOURCE_ICON_SIDE_PX = 16;

/** Retained final value, accepted at the representative visual inspection: square side length of the header source action, in CSS pixels. */
export const SOURCE_ACTION_SIDE_PX = 24;

/** Tolerance the layout document allows on the icon and action size checks. */
export const SIZE_TOLERANCE_PX = 1;

/** Tolerance the layout document allows on the centring and vertical checks. */
export const CENTRE_TOLERANCE_PX = 2;

/** Tolerance used when comparing two edges that must coincide. */
export const EDGE_TOLERANCE_PX = 1;

/** Consecutive byte-identical reads required before the layout counts as settled. */
export const REQUIRED_STABLE_READS = 3;

/** Longest the stability poll waits for a settled, motion-free layout. */
const GEOMETRY_STABILITY_TIMEOUT_MS = 10_000;

/**
 * Divisor that turns a box's length into half of it, for every centre measured
 * against another centre.
 */
const HALF_LENGTH_DIVISOR = 2;

// ---------------------------------------------------------------------------
// Centre arithmetic
// ---------------------------------------------------------------------------

/**
 * Horizontal centre of a rendered box.
 *
 * @param {RenderedBox} box - The rendered box.
 * @returns {number} Its horizontal centre, in CSS pixels.
 */
function horizontalCentre(box: RenderedBox): number {
  return box.left + box.width / HALF_LENGTH_DIVISOR;
}

/**
 * Vertical centre of a rendered box.
 *
 * @param {RenderedBox} box - The rendered box.
 * @returns {number} Its vertical centre, in CSS pixels.
 */
function verticalCentre(box: RenderedBox): number {
  return box.top + box.height / HALF_LENGTH_DIVISOR;
}

// ---------------------------------------------------------------------------
// Page-level reading
// ---------------------------------------------------------------------------

/**
 * Read the page's horizontal overflow width.
 *
 * The narrow viewport legitimately overflows already — the app shell plus the
 * wide data table do it before any preview exists — so "no new overflow" is
 * asserted by comparing this width with and without the open preview rather than
 * by expecting it to equal the viewport width.
 *
 * @remarks
 * Private on purpose: this is a raw reading, and exporting it would let a
 * caller pair it with an already-open preview and reproduce the vacuous
 * comparison described in the module remarks. Use
 * {@link readClosedPageOverflowWidth} for the baseline and
 * {@link assertReadyPreviewGeometry} for the comparison.
 *
 * @param {Page} page - The Playwright page under test.
 * @returns {Promise<number>} `document.documentElement.scrollWidth`.
 */
async function readPageOverflowWidth(page: Page): Promise<number> {
  return await page.evaluate(() => document.documentElement.scrollWidth);
}

/**
 * Read the closed-page overflow width that an open preview must not exceed.
 *
 * @remarks
 * Call this after the journey itself has settled — table rendered, colour scheme
 * applied, pointer reveal done — and *before* opening the preview under review.
 * Pre-existing overflow is preserved rather than corrected: the number is the
 * page's own width, and the invariant is that opening a preview does not widen
 * it. Fixing unrelated shell or table overflow is not this feature's business,
 * so nothing here compares the reading against the viewport width.
 *
 * The guard is what keeps the baseline honest. An open popover is mounted in a
 * portal on the document, so reading the page while one is open silently
 * absorbs any overflow the preview caused and the later comparison can never
 * fail; asserting that the page is at rest turns that silent pass into a loud
 * failure at the point where the sequence went wrong.
 *
 * @param {Page} page - The Playwright page under test.
 * @param {string} description - Matrix coordinate used in the failure message.
 * @returns {Promise<number>} `document.documentElement.scrollWidth` with no preview open.
 */
export async function readClosedPageOverflowWidth(
  page: Page,
  description: string
): Promise<number> {
  await expect(
    openPreviewPopover(page),
    `${description}: the page-overflow baseline is read while no preview is open`
  ).toHaveCount(0);
  return await readPageOverflowWidth(page);
}

/**
 * Put the page back at rest and re-read the closed-page overflow baseline.
 *
 * @remarks
 * A journey that opens one preview per iteration must not measure the next
 * iteration's baseline against a page that still carries the previous preview,
 * so it re-baselines rather than reusing an earlier reading. Reusing one would
 * be defensible only if the page were provably identical, and the precondition
 * is then verified instead of assumed — the guard in
 * {@link readClosedPageOverflowWidth} still runs on every reading.
 *
 * The pointer leaves every trigger, so a hover-opened preview closes on its
 * `mouseleave`; Escape dismisses an overlay the keyboard opened, which has no
 * hover to leave. Closing this way is activation-agnostic, so one implementation
 * serves the pointer and keyboard journeys.
 *
 * @param {Page} page - The Playwright page under test.
 * @param {string} description - Matrix coordinate used in the failure message.
 * @returns {Promise<number>} `document.documentElement.scrollWidth` with no preview open.
 */
export async function rebaselineClosedPageOverflow(
  page: Page,
  description: string
): Promise<number> {
  await page.mouse.move(0, 0);
  await page.keyboard.press('Escape');
  return await readClosedPageOverflowWidth(page, description);
}

// ---------------------------------------------------------------------------
// Asserting
// ---------------------------------------------------------------------------

/** Bookkeeping for the "same geometry N reads running" decision. */
interface GeometryStabilityTracker {
  /**
   * Feed one reading.
   *
   * @param {PreviewHeaderMeasurement | null} reading - A fresh reading, or `null`
   * when a region was missing or had no painted area yet.
   * @returns {string | null} The reading's serialised key once the layout has been
   * identical for {@link REQUIRED_STABLE_READS} consecutive reads and the
   * overlay's motion has finished; otherwise `null`, which makes the poll retry.
   */
  accept(reading: PreviewHeaderMeasurement | null): string | null;
  /** The most recent reading, present once any reading has been seen. */
  readonly accepted: PreviewHeaderMeasurement | null;
}

/**
 * Create the stateful half of the stability poll.
 *
 * @remarks
 * Keeping this out of the poll callback leaves each function small enough to
 * read, and makes the stability rule — identical readings, no motion — explicit
 * in one place.
 *
 * @returns {GeometryStabilityTracker} A fresh tracker.
 */
function createStabilityTracker(): GeometryStabilityTracker {
  let latestKey: string | null = null;
  let latestReading: PreviewHeaderMeasurement | null = null;
  let identicalReads = 0;

  return {
    accept(reading) {
      const key = reading === null ? null : JSON.stringify(reading);
      identicalReads = key !== null && key === latestKey ? identicalReads + 1 : 1;
      latestKey = key;
      latestReading = reading;
      const settled = reading?.overlayMotionSettled === true;
      return settled && identicalReads >= REQUIRED_STABLE_READS ? key : null;
    },
    get accepted() {
      return latestReading;
    },
  };
}

/**
 * Assert the documented header regions exist, then return their stable geometry.
 *
 * The structural assertions run first and separately so a missing region fails
 * with its own precise message, rather than surfacing as a stability poll that
 * never settles.
 *
 * @param {Locator} popover - The open preview popover.
 * @param {string} description - Matrix coordinate used in every failure message.
 * @returns {Promise<PreviewHeaderMeasurement>} The settled rendered measurement.
 */
export async function measureStablePreviewHeader(
  popover: Locator,
  description: string
): Promise<PreviewHeaderMeasurement> {
  // The accessible name, not a class, identifies the action: that is the name a
  // teacher actually gets from assistive technology.
  await expect(
    popover.getByRole('link', { name: SOURCE_ACTION_LABEL }),
    `${description}: the header offers the source action`
  ).toBeVisible();
  // Both regions are matched as header descendants: antd nests the `extra` slot
  // inside `.ant-card-head-wrapper`, so a direct-child relationship would demand
  // markup antd does not produce.
  await expect(
    popover.locator(PREVIEW_HEADER_REGION_SELECTORS.extra),
    `${description}: the source action sits in the Card extra region`
  ).toHaveCount(1);
  await expect(
    popover.locator(PREVIEW_HEADER_REGION_SELECTORS.balance),
    `${description}: the header reserves the documented left balancing space`
  ).toHaveCount(1);

  const tracker = createStabilityTracker();

  await expect
    .poll(async () => tracker.accept(await readPreviewHeaderRegions(popover)), {
      message: `${description}: the ready header geometry settles and its motion finishes`,
      timeout: GEOMETRY_STABILITY_TIMEOUT_MS,
    })
    .not.toBeNull();

  const accepted = tracker.accepted;
  if (accepted === null) {
    throw new Error(
      `${description}: the header geometry poll accepted no reading, so no stable measurement exists.`
    );
  }
  return accepted;
}

/**
 * Assert the layout document's rendered-geometry invariants.
 *
 * @remarks
 * Every check reads a number produced by `getBoundingClientRect()`. Nothing here
 * inspects a computed style declaration, a DOM position, or an SVG attribute as
 * a stand-in for where the browser actually painted something.
 *
 * @param {PreviewHeaderMeasurement} measurement - The settled measurement.
 * @param {string} description - Matrix coordinate used in every failure message.
 * @returns {void}
 */
export function assertPreviewHeaderInvariants(
  measurement: PreviewHeaderMeasurement,
  description: string
): void {
  const {
    regions: { action, balance, card, extra, header, icon, title },
    actionAccessibleLabel,
    balanceIsFocusable,
    balanceText,
    cardClientWidth,
    cardScrollWidth,
    headerClientWidth,
    headerScrollWidth,
    layoutViewportWidth,
    metricGroup,
  } = measurement;

  const headerLeftInset = title.left - header.left;
  const actionRightInset = card.right - action.right;

  // 1 and 2 — the reviewed icon and action sizes, as rendered.
  expect(
    Math.abs(icon.width - SOURCE_ICON_SIDE_PX),
    `${description}: rendered icon width is ${SOURCE_ICON_SIDE_PX}px`
  ).toBeLessThanOrEqual(SIZE_TOLERANCE_PX);
  expect(
    Math.abs(icon.height - SOURCE_ICON_SIDE_PX),
    `${description}: rendered icon height is ${SOURCE_ICON_SIDE_PX}px`
  ).toBeLessThanOrEqual(SIZE_TOLERANCE_PX);
  expect(
    Math.abs(action.width - SOURCE_ACTION_SIDE_PX),
    `${description}: rendered action width is ${SOURCE_ACTION_SIDE_PX}px`
  ).toBeLessThanOrEqual(SIZE_TOLERANCE_PX);
  expect(
    Math.abs(action.height - SOURCE_ACTION_SIDE_PX),
    `${description}: rendered action height is ${SOURCE_ACTION_SIDE_PX}px`
  ).toBeLessThanOrEqual(SIZE_TOLERANCE_PX);

  // 3 — the metric group stays centred on the whole card, not on the space
  // left beside the action.
  expect(
    Math.abs(horizontalCentre(metricGroup) - horizontalCentre(card)),
    `${description}: metric group horizontal centre sits on the card centre`
  ).toBeLessThanOrEqual(CENTRE_TOLERANCE_PX);

  // 4 — vertical centring of both the action and its icon within the header.
  expect(
    Math.abs(verticalCentre(action) - verticalCentre(header)),
    `${description}: action vertical centre sits on the header centre`
  ).toBeLessThanOrEqual(CENTRE_TOLERANCE_PX);
  expect(
    Math.abs(verticalCentre(icon) - verticalCentre(header)),
    `${description}: icon vertical centre sits on the header centre`
  ).toBeLessThanOrEqual(CENTRE_TOLERANCE_PX);

  // 5 — right inset, ordering and non-overlap.
  expect(
    Math.abs(actionRightInset - headerLeftInset),
    `${description}: the action keeps the header's right inset`
  ).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
  expect(
    actionRightInset,
    `${description}: the action keeps a positive right inset`
  ).toBeGreaterThan(0);
  expect(
    action.left,
    `${description}: the action lies wholly right of the metric group`
  ).toBeGreaterThanOrEqual(metricGroup.right - EDGE_TOLERANCE_PX);
  expect(
    action.left,
    `${description}: the action starts inside the Card extra region`
  ).toBeGreaterThanOrEqual(extra.left - EDGE_TOLERANCE_PX);
  expect(
    action.right,
    `${description}: the action ends inside the Card extra region`
  ).toBeLessThanOrEqual(extra.right + EDGE_TOLERANCE_PX);
  expect(
    Math.abs(balance.width - action.width),
    `${description}: the balancing space matches the occupied action width`
  ).toBeLessThanOrEqual(SIZE_TOLERANCE_PX);
  expect(
    balance.left,
    `${description}: the balancing space starts at the title region's left inset`
  ).toBeGreaterThanOrEqual(title.left - EDGE_TOLERANCE_PX);

  // 6 — containment, no clipping and no overflow of its own.
  expect(header.left, `${description}: the header starts inside the card`).toBeGreaterThanOrEqual(
    card.left - EDGE_TOLERANCE_PX
  );
  expect(header.right, `${description}: the header ends inside the card`).toBeLessThanOrEqual(
    card.right + EDGE_TOLERANCE_PX
  );
  expect(card.left, `${description}: the card starts inside the viewport`).toBeGreaterThanOrEqual(
    -EDGE_TOLERANCE_PX
  );
  expect(card.right, `${description}: the card ends inside the viewport`).toBeLessThanOrEqual(
    layoutViewportWidth + EDGE_TOLERANCE_PX
  );
  expect(
    cardScrollWidth,
    `${description}: the card does not overflow horizontally`
  ).toBeLessThanOrEqual(cardClientWidth + EDGE_TOLERANCE_PX);
  expect(
    headerScrollWidth,
    `${description}: the header does not overflow horizontally`
  ).toBeLessThanOrEqual(headerClientWidth + EDGE_TOLERANCE_PX);

  // The accessible name the geometry was measured against must be the one the
  // layout document fixes, and the balancing space must stay inert.
  expect(
    actionAccessibleLabel,
    `${description}: the measured action carries the documented accessible name`
  ).toBe(SOURCE_ACTION_LABEL);
  expect(balanceIsFocusable, `${description}: the balancing space creates no focus target`).toBe(
    false
  );
  expect(balanceText, `${description}: the balancing space announces nothing`).toBe('');
}

/**
 * Accept one settled, open ready preview against the layout document.
 *
 * @remarks
 * The measured header invariants and the page-level overflow invariant are one
 * decision, so they are composed here: a caller cannot measure the header and
 * then forget the overflow check, nor measure the overflow against a page that
 * still carries another preview.
 *
 * `closedPageOverflowWidth` must be the value {@link readClosedPageOverflowWidth}
 * returned *before* this preview was opened. Equality, not a tolerance, is the
 * right comparison for the document's `scrollWidth`: any widening, however
 * small, is a horizontally scrollable page the teacher did not have before,
 * while pre-existing overflow is preserved rather than fixed here.
 *
 * @param {Page} page - The Playwright page under test.
 * @param {Locator} popover - The open preview popover.
 * @param {string} description - Matrix coordinate used in every failure message.
 * @param {number} closedPageOverflowWidth - Baseline read before the preview opened.
 * @returns {Promise<void>} Resolves once every invariant holds.
 */
export async function assertReadyPreviewGeometry(
  page: Page,
  popover: Locator,
  description: string,
  closedPageOverflowWidth: number
): Promise<void> {
  const measurement = await measureStablePreviewHeader(popover, description);
  assertPreviewHeaderInvariants(measurement, description);
  expect(
    await readPageOverflowWidth(page),
    `${description}: the open preview adds no horizontal page overflow (closed page: ${closedPageOverflowWidth}px)`
  ).toBe(closedPageOverflowWidth);
}
