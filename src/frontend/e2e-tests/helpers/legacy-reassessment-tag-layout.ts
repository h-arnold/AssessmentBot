/**
 * Locators and geometry assertions for the task-heatmap reassessment tag.
 *
 * @remarks
 * The tag is assignment-level status on the navigation card, so every locator
 * here is scoped to that card: stored explicit `REASSESSMENT_REQUIRED` errors
 * can render the same reasoning text inside a task preview, which is not the
 * assignment status. Measurements are read from rendered bounding boxes after
 * the layout settles, never from CSS declarations or DOM order.
 *
 * The layout lets Back and the actions group occupy separate rows at narrow
 * widths, so the ordering assertions come in two modes: the same-row mode pins
 * horizontal x-ordering, and the wrapped mode pins DOM order plus the rule
 * that every wrapped row renders at the shared row start. Containment follows
 * the same split: at desktop width the tag must sit inside the navigation
 * card's box, while at narrow widths the layout keeps the page's existing
 * scroll policy, so the tag is held to the page level instead — inside the
 * page's scrollable content area, untruncated by any clipping ancestor, and
 * without widening the pre-existing page overflow.
 *
 * @see LEGACY_ASSIGNMENT_READ_LAYOUT.md
 */

import { expect, type Locator, type Page } from '@playwright/test';

/** Exact tag copy fixed by the layout document. */
export const REASSESSMENT_TAG_TEXT = 'Reassessment required';

/** Back action that identifies the navigation card. */
export const BACK_LABEL = 'Back to Class overview';
/** Rerun action that follows the tag. */
export const RE_RUN_LABEL = 'Re-run Assessment';
/** Refresh action that closes the action group. */
export const REFRESH_LABEL = 'Refresh';

/** Consecutive identical geometry reads required before asserting layout. */
const STABLE_GEOMETRY_READS = 3;

/** Tolerance for the card's content-box edges and row-start alignment. */
const EDGE_TOLERANCE_PX = 1;

/**
 * Vertical tolerance for treating two boxes as sharing one wrapped row.
 *
 * @remarks
 * Same-row items differ in top y by at most half a button's height (the tag's
 * box centres against 32px buttons), while separate flex lines differ by at
 * least one button height plus the 8px row gap.
 */
const ROW_TOLERANCE_PX = 8;

/** Expected row topology of the navigation card's items. */
type NavActionOrderMode = 'same-row' | 'wrapped';

/** A rendered box in CSS pixels. */
type Box = { x: number; y: number; width: number; height: number };

/** One navigation-card item measured for ordering. */
interface NavItem {
  readonly label: string;
  readonly locator: Locator;
}

/**
 * Locate the navigation card that owns the assignment status tag.
 * @param {Page} page - The Playwright page.
 * @returns {Locator} The navigation card.
 */
function navigationCard(page: Page): Locator {
  return page.locator('.ant-card').filter({ has: page.getByRole('button', { name: BACK_LABEL }) });
}

/**
 * Locate the assignment status tag inside the navigation card.
 * @param {Page} page - The Playwright page.
 * @returns {Locator} The status tag.
 */
export function reassessmentTag(page: Page): Locator {
  return navigationCard(page).getByText(REASSESSMENT_TAG_TEXT, { exact: true });
}

/**
 * The navigation-card items in their layout order.
 * @param {Page} page - The Playwright page.
 * @returns {NavItem[]} Back, the tag, Re-run Assessment and Refresh.
 */
function navItems(page: Page): NavItem[] {
  return [
    { label: BACK_LABEL, locator: page.getByRole('button', { name: BACK_LABEL }) },
    { label: REASSESSMENT_TAG_TEXT, locator: reassessmentTag(page) },
    { label: RE_RUN_LABEL, locator: page.getByRole('button', { name: RE_RUN_LABEL }) },
    { label: REFRESH_LABEL, locator: page.getByRole('button', { name: REFRESH_LABEL }) },
  ];
}

/**
 * Read one element's rendered box as a plain tuple.
 * @param {Locator} locator - The element to measure.
 * @returns {Promise<number[]>} `[x, y, width, height]` in CSS pixels.
 */
function readBox(locator: Locator): Promise<number[]> {
  return locator.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return [bounds.x, bounds.y, bounds.width, bounds.height];
  });
}

/**
 * Poll the navigation-card items until their geometry is stable.
 *
 * @remarks
 * The sampled set is exactly the four items whose order and geometry the
 * navigation assertions measure, so their boxes settling also settles the
 * card's rendered box: an entrance transform moves parent and children alike.
 *
 * @param {Page} page - The Playwright page.
 * @returns {Promise<void>} Resolves once the layout has settled.
 */
async function waitForStableNavGeometry(page: Page): Promise<void> {
  let samples: string[] = [];
  await expect
    .poll(async () => {
      const sample = JSON.stringify(
        await Promise.all(navItems(page).map((item) => readBox(item.locator)))
      );
      samples = [...samples, sample].slice(-STABLE_GEOMETRY_READS);
      return samples.length === STABLE_GEOMETRY_READS && samples.every((entry) => entry === sample);
    })
    .toBe(true);
}

/**
 * Assert one item follows another in DOM order.
 * @param {Locator} first - The earlier item.
 * @param {Locator} second - The later item.
 * @param {string} description - Assertion description used on failure.
 * @returns {Promise<void>} Resolves once the ordering assertion passes.
 */
async function expectFollowsInDomOrder(
  first: Locator,
  second: Locator,
  description: string
): Promise<void> {
  const laterElement = await second.elementHandle();
  expect(laterElement, `${description}: expected the later item to render`).not.toBeNull();
  const isFollowing = await first.evaluate((element, other) => {
    const position = element.compareDocumentPosition(other);
    return (position & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  }, laterElement);
  expect(isFollowing, description).toBe(true);
}

/**
 * Group item indexes into wrapped rows by their rendered top offset.
 * @param {Array<{ label: string; box: Box }>} positioned - Measured items.
 * @returns {Array<number[]>} One index list per rendered row.
 */
function groupRowsByRenderedTop(positioned: Array<{ label: string; box: Box }>): Array<number[]> {
  const rows: Array<number[]> = [];
  for (const [index, item] of positioned.entries()) {
    const row = rows.find((rowIndices) => {
      return rowIndices.some(
        (rowIndex) => Math.abs(positioned[rowIndex].box.y - item.box.y) <= ROW_TOLERANCE_PX
      );
    });
    if (row === undefined) {
      rows.push([index]);
    } else {
      row.push(index);
    }
  }
  return rows;
}

/**
 * Assert the wrapped navigation order: DOM order plus row-start alignment.
 *
 * @remarks
 * Wrapping puts Back and the actions group on separate rows, so horizontal
 * x-ordering no longer describes the layout. DOM order pins the sequence, and
 * each row's leftmost item is asserted to sit at the shared row start — the
 * layout's rule that a wrapped single-item row renders at the row start under
 * the existing `space-between` justification.
 *
 * @param {Page} page - The Playwright page.
 * @returns {Promise<void>} Resolves once the ordering assertions pass.
 */
async function expectWrappedNavActionOrder(page: Page): Promise<void> {
  const items = navItems(page);
  const orderingChecks: Array<Promise<void>> = [];
  for (let index = 0; index < items.length - 1; index += 1) {
    orderingChecks.push(
      expectFollowsInDomOrder(
        items[index].locator,
        items[index + 1].locator,
        `Expected ${items[index + 1].label} to follow ${items[index].label} in DOM order.`
      )
    );
  }
  await Promise.all(orderingChecks);

  const measured = await Promise.all(
    items.map(async (item) => ({ label: item.label, box: await item.locator.boundingBox() }))
  );
  if (measured.some((item) => item.box === null)) {
    throw new Error('Expected every navigation item to report a bounding box.');
  }
  const positioned = measured as Array<{ label: string; box: Box }>;
  const rows = groupRowsByRenderedTop(positioned);

  // Every row is left-aligned at the shared row start: the smallest x across
  // all items is the card's content edge, and no row may start right of it.
  const rowStartX = Math.min(...positioned.map((item) => item.box.x));
  for (const row of rows) {
    let leftmostIndex = row[0];
    for (const rowIndex of row) {
      if (positioned[rowIndex].box.x < positioned[leftmostIndex].box.x) {
        leftmostIndex = rowIndex;
      }
    }
    expect(
      Math.abs(positioned[leftmostIndex].box.x - rowStartX),
      `Expected ${positioned[leftmostIndex].label} to render at its row's start.`
    ).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
  }
}

/**
 * Assert the navigation-card action order: Back, tag, Re-run, then Refresh.
 *
 * @param {Page} page - The Playwright page.
 * @param {NavActionOrderMode} [mode='same-row'] - Expected row topology.
 * @returns {Promise<void>} Resolves once the ordering assertions pass.
 */
export async function expectNavActionOrder(
  page: Page,
  mode: NavActionOrderMode = 'same-row'
): Promise<void> {
  if (mode === 'wrapped') {
    await expectWrappedNavActionOrder(page);
    return;
  }
  const [backBox, tagBox, reRunBox, refreshBox] = await Promise.all(
    navItems(page).map((item) => item.locator.boundingBox())
  );
  if (backBox === null || tagBox === null || reRunBox === null || refreshBox === null) {
    throw new Error('Expected every navigation item to report a bounding box.');
  }
  expect(backBox.x + backBox.width).toBeLessThanOrEqual(tagBox.x);
  expect(tagBox.x + tagBox.width).toBeLessThanOrEqual(reRunBox.x);
  expect(reRunBox.x + reRunBox.width).toBeLessThanOrEqual(refreshBox.x);
}

/**
 * Decide whether two boxes share any rendered area.
 * @param {number[]} left - `[x, y, width, height]` of the first box.
 * @param {number[]} right - `[x, y, width, height]` of the second box.
 * @returns {boolean} True when the boxes overlap.
 */
function isOverlapping(left: number[], right: number[]): boolean {
  const [leftX, leftY, leftWidth, leftHeight] = left;
  const [rightX, rightY, rightWidth, rightHeight] = right;
  const isHorizontallyShared = leftX < rightX + rightWidth && rightX < leftX + leftWidth;
  const isVerticallyShared = leftY < rightY + rightHeight && rightY < leftY + leftHeight;
  return isHorizontallyShared && isVerticallyShared;
}

/**
 * Read the page's horizontal overflow width.
 * @param {Page} page - The Playwright page.
 * @returns {Promise<number>} `document.documentElement.scrollWidth` in CSS pixels.
 */
export function readPageOverflowWidth(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth);
}

/**
 * Find ancestors whose hidden overflow would cut off the tag's rendered box.
 *
 * @remarks
 * Scrollable overflow (`auto`/`scroll`) keeps the tag reachable by scrolling,
 * so only a `hidden` or `clip` computed overflow counts as clipping, and only
 * when that axis does not contain the tag's box within the edge tolerance.
 *
 * @param {Locator} tag - The status tag.
 * @returns {Promise<string[]>} One description per clipping ancestor axis.
 */
function findClippingAncestors(tag: Locator): Promise<string[]> {
  return tag.evaluate((element, tolerance) => {
    const axes = [
      { property: 'overflowX', start: 'left', end: 'right' },
      { property: 'overflowY', start: 'top', end: 'bottom' },
    ] as const;
    const bounds = element.getBoundingClientRect();
    const ancestors: Element[] = [];
    for (let node = element.parentElement; node !== null; node = node.parentElement) {
      ancestors.push(node);
    }
    return ancestors.flatMap((ancestor) => {
      const style = getComputedStyle(ancestor);
      const box = ancestor.getBoundingClientRect();
      return axes
        .filter((axis) => {
          const overflow = style[axis.property];
          const isClipping = overflow === 'hidden' || overflow === 'clip';
          const isTruncated =
            bounds[axis.end] > box[axis.end] + tolerance ||
            bounds[axis.start] < box[axis.start] - tolerance;
          return isClipping && isTruncated;
        })
        .map(
          (axis) => `${ancestor.tagName.toLowerCase()} (${axis.property}: ${style[axis.property]})`
        );
    });
  }, EDGE_TOLERANCE_PX);
}

/**
 * Assert the tag is not clipped or overlapped and does not widen the page's
 * horizontal overflow.
 *
 * @remarks
 * Containment follows the navigation row topology. The same-row mode pins the
 * tag inside the navigation card's box on both axes. The wrapped mode is the
 * narrow-width contract: the layout keeps the page's existing scroll policy, so
 * containment is page-level — the tag's right edge stays within the page's
 * scrollable content area and no clipping ancestor truncates its rendered box.
 * Both modes assert the tag occupies disjoint rendered areas with each action,
 * and the app shell's pre-existing overflow is a before/after comparison
 * against a reading captured before the tag rendered, not a zero-tolerance
 * check against the viewport.
 *
 * @param {Page} page - The Playwright page.
 * @param {number} overflowWidthBeforeTag - A `readPageOverflowWidth` reading captured before the tag rendered.
 * @param {NavActionOrderMode} mode - The navigation row topology under assertion.
 * @returns {Promise<void>} Resolves once the layout assertions pass.
 */
export async function expectTagNotClippedOrOverlapped(
  page: Page,
  overflowWidthBeforeTag: number,
  mode: NavActionOrderMode
): Promise<void> {
  await waitForStableNavGeometry(page);
  const [, tagItem, reRunItem, refreshItem] = navItems(page);
  const tagBox = await tagItem.locator.boundingBox();
  const actionBoxes = await Promise.all(
    [reRunItem.locator, refreshItem.locator].map((locator) => locator.boundingBox())
  );
  if (tagBox === null || actionBoxes.includes(null)) {
    throw new Error('Expected the tag and the navigation actions to report a bounding box.');
  }

  if (mode === 'same-row') {
    // Desktop: inside the card on both axes, allowing the one-pixel edge
    // tolerance.
    const cardBox = await navigationCard(page).boundingBox();
    if (cardBox === null) {
      throw new Error('Expected the navigation card to report a bounding box.');
    }
    expect(tagBox.x).toBeGreaterThanOrEqual(cardBox.x - EDGE_TOLERANCE_PX);
    expect(tagBox.y).toBeGreaterThanOrEqual(cardBox.y - EDGE_TOLERANCE_PX);
    expect(tagBox.x + tagBox.width).toBeLessThanOrEqual(
      cardBox.x + cardBox.width + EDGE_TOLERANCE_PX
    );
    expect(tagBox.y + tagBox.height).toBeLessThanOrEqual(
      cardBox.y + cardBox.height + EDGE_TOLERANCE_PX
    );
  } else {
    // Narrow: the layout keeps the page's existing scroll policy, so
    // containment is page-level rather than the card box: the tag's right edge
    // stays within the scrollable content area and no clipping ancestor cuts
    // it off.
    const pageOverflowWidth = await readPageOverflowWidth(page);
    expect(
      tagBox.x + tagBox.width,
      'Expected the tag to stay within the page scrollable content area.'
    ).toBeLessThanOrEqual(pageOverflowWidth);
    const clippedBy = await findClippingAncestors(tagItem.locator);
    expect(clippedBy, 'Expected no clipping ancestor to truncate the tag.').toEqual([]);
  }

  // The tag and each action occupy disjoint rendered areas, on one row or wrapped.
  const tagTuple = [tagBox.x, tagBox.y, tagBox.width, tagBox.height];
  for (const actionBox of actionBoxes) {
    expect(
      isOverlapping(tagTuple, [actionBox!.x, actionBox!.y, actionBox!.width, actionBox!.height])
    ).toBe(false);
  }

  // The tag does not widen the overflow captured before it rendered.
  const overflowWidth = await readPageOverflowWidth(page);
  expect(overflowWidth).toBe(overflowWidthBeforeTag);
}

/**
 * Read the tag's computed text colour.
 *
 * @remarks
 * Returns the theme-derived colour so a journey can pin the theme tokens by
 * comparing readings across a theme toggle: a hardcoded colour would not
 * change when the theme changes.
 *
 * @param {Page} page - The Playwright page.
 * @returns {Promise<string>} The tag's computed `color`.
 */
export async function readTagComputedColour(page: Page): Promise<string> {
  const tag = reassessmentTag(page);
  await expect(tag).toBeVisible();
  return tag.evaluate((element) => getComputedStyle(element).color);
}
