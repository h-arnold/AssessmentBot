/**
 * Region reading for the issue #19 task-preview source action's rendered Card
 * header.
 *
 * Owns two responsibilities the rest of the Section 4 geometry work depends on:
 * *where* each header region is (the region contract) and *what the browser
 * painted* there (one atomic rendered reading).
 *
 * @remarks
 * **antd Card head nesting.** antd v6 renders the Card head as
 * `.ant-card-head` → `.ant-card-head-wrapper` → (`.ant-card-head-title`,
 * `.ant-card-extra`), and `.ant-card-extra` exists only when the Card has an
 * `extra` prop. Every selector here is therefore a *descendant* selector scoped
 * to `.ant-card-head`: a direct-child relationship would turn antd's internal
 * wrapper into a contract of this test suite and fail against correct markup.
 *
 * **Balance region.** The left balancing space the layout document requires is
 * the one genuinely project-owned region, so it carries
 * {@link HEADER_BALANCE_CLASS}. It is matched as a header descendant, which
 * states where it has to appear without constraining how the header composes it.
 *
 * **One atomic read.** Every number is read in a single `evaluate`: separate
 * per-element reads could mix two frames of the overlay's `zoom-big` motion into
 * one "measurement". Interpretation — which regions have painted area, and the
 * union of the metric group's painted children — then happens in Node over
 * exactly those values.
 *
 * @see TASK_PREVIEW_SOURCE_LINK_LAYOUT.md — acceptance evidence
 */

import type { Locator } from '@playwright/test';
import { SOURCE_ACTION_LABEL } from '../../src/features/taskHeatmap/TaskPreviewCard';

// ---------------------------------------------------------------------------
// Region contract
// ---------------------------------------------------------------------------

/**
 * Project-owned class on the header's left balancing space.
 *
 * The layout document requires matching non-interactive space on the left of the
 * title region so the metric group stays centred on the whole card once the
 * action occupies the right inset. This is the only measured region that cannot
 * be reached through an antd semantic class or an accessible name.
 */
export const HEADER_BALANCE_CLASS = 'task-preview-header-balance';

/**
 * Every region the header contract measures, in reading order.
 *
 * `metricGroupWrapper` is the metric region's own element; the *painted* metric
 * group is the union of its element children, which the preview card lays out
 * side by side inside that wrapper.
 */
const REGION_NAMES = [
  'card',
  'header',
  'title',
  'extra',
  'balance',
  'action',
  'icon',
  'metricGroupWrapper',
] as const;

/** Name of one region the header contract measures. */
export type PreviewHeaderRegionName = (typeof REGION_NAMES)[number];

/**
 * Selector resolving the source action by the accessible name a teacher actually
 * gets from assistive technology, rather than by a class name.
 */
const ACTION_SELECTOR = `.ant-card-head [aria-label="${SOURCE_ACTION_LABEL}"]`;

/**
 * Descendant selector resolving each contract region, keyed by region name.
 *
 * @remarks
 * Exported so the structural region contract and the rendered reading resolve the
 * same regions: a selector stated twice would be free to drift.
 */
export const PREVIEW_HEADER_REGION_SELECTORS: Readonly<Record<PreviewHeaderRegionName, string>> =
  Object.freeze({
    card: '.ant-card',
    header: '.ant-card-head',
    title: '.ant-card-head-title',
    extra: '.ant-card-head .ant-card-extra',
    balance: `.ant-card-head .${HEADER_BALANCE_CLASS}`,
    action: ACTION_SELECTOR,
    icon: `${ACTION_SELECTOR} svg`,
    metricGroupWrapper: '.ant-card-head [role="status"]',
  });

/** Selector matching elements the browser would make focusable on its own. */
const FOCUSABLE_SELECTOR =
  'a[href], button, input, select, textarea, [contenteditable], [tabindex]';

/**
 * Motion phase markers antd adds to the overlay root while it is appearing or
 * leaving.
 *
 * They are matched as plain strings because the evaluated reading cannot receive
 * a `RegExp` across the page boundary.
 */
const MOTION_PHASE_MARKERS = { appear: '-appear', leave: '-leave' } as const;

// ---------------------------------------------------------------------------
// Measurement shape
// ---------------------------------------------------------------------------

/** One rendered region, in CSS pixels relative to the layout viewport. */
export interface RenderedBox {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

/** Every region the layout document measures, plus the container facts it needs. */
export interface PreviewHeaderMeasurement {
  /** Rendered box of each contract region, keyed by region name. */
  readonly regions: Readonly<Record<PreviewHeaderRegionName, RenderedBox>>;
  /** Painted metric group: the union of the metric wrapper's element children. */
  readonly metricGroup: RenderedBox;
  readonly actionAccessibleLabel: string | null;
  readonly balanceIsFocusable: boolean;
  readonly balanceText: string | null;
  readonly cardClientWidth: number;
  readonly cardScrollWidth: number;
  readonly headerClientWidth: number;
  readonly headerScrollWidth: number;
  readonly layoutViewportWidth: number;
  readonly overlayMotionSettled: boolean;
}

/** What one page-side read records about one region. */
interface RawRegionReading {
  readonly rect: RenderedBox;
  readonly clientWidth: number;
  readonly scrollWidth: number;
  readonly focusable: boolean;
  readonly text: string | null;
  readonly accessibleLabel: string | null;
  readonly childRects: ReadonlyArray<RenderedBox>;
}

/** The raw reading one atomic page evaluation returns. */
interface RawPreviewHeaderReading {
  readonly readings: Readonly<Record<string, RawRegionReading>>;
  readonly layoutViewportWidth: number;
  readonly overlayMotionSettled: boolean;
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/**
 * Read every header region in one atomic in-page evaluation.
 *
 * @remarks
 * The values the page-side function needs travel as an argument: an evaluated
 * function is serialised on its own and cannot read this module's constants, and
 * it must not declare helpers of its own that belong at module scope.
 *
 * The same facts are recorded for every region rather than special-casing the
 * regions that need them, which keeps the page-side read free of per-region
 * branching; each invariant then reads only what it needs.
 *
 * A region that has not rendered yet is reported by returning `null`, because a
 * popover that is still mounting legitimately has no action yet. Because that
 * guard makes the returned record complete, the shape it produces does not carry
 * absent regions.
 *
 * @param {Locator} popover - The open preview popover.
 * @returns {Promise<RawPreviewHeaderReading | null>} The raw reading, or `null`
 * when a contract region has not been rendered yet.
 */
function readRawPreviewHeaderRegions(popover: Locator): Promise<RawPreviewHeaderReading | null> {
  return popover.evaluate(
    (root, config): RawPreviewHeaderReading | null => {
      const readings: Record<string, RawRegionReading> = {};
      for (const [name, selector] of Object.entries(config.selectors)) {
        const element = root.querySelector(selector);
        if (element === null) {
          return null;
        }

        const rect = element.getBoundingClientRect();
        const childRects: RenderedBox[] = [];
        for (const child of element.children) {
          const childRect = child.getBoundingClientRect();
          childRects.push({
            left: childRect.left,
            right: childRect.right,
            top: childRect.top,
            bottom: childRect.bottom,
            width: childRect.width,
            height: childRect.height,
          });
        }

        readings[name] = {
          rect: {
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
          },
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          focusable: element.matches(config.focusableSelector),
          text: element.textContent,
          accessibleLabel: element.getAttribute('aria-label'),
          childRects,
        };
      }

      return {
        readings,
        layoutViewportWidth: document.documentElement.clientWidth,
        overlayMotionSettled:
          !root.className.includes(config.motionPhaseMarkers.appear) &&
          !root.className.includes(config.motionPhaseMarkers.leave) &&
          getComputedStyle(root).transform === 'none',
      };
    },
    {
      selectors: PREVIEW_HEADER_REGION_SELECTORS,
      focusableSelector: FOCUSABLE_SELECTOR,
      motionPhaseMarkers: MOTION_PHASE_MARKERS,
    }
  );
}

// ---------------------------------------------------------------------------
// Interpretation
// ---------------------------------------------------------------------------

/**
 * Reject a rectangle the browser never painted.
 *
 * @param {RenderedBox} rect - The read rectangle.
 * @returns {RenderedBox | null} The rectangle, or `null` when it is unusable.
 */
function toPaintedBox(rect: RenderedBox): RenderedBox | null {
  const isFiniteBox = Object.values(rect).every((value) => Number.isFinite(value));
  return isFiniteBox && rect.width > 0 && rect.height > 0 ? rect : null;
}

/**
 * Union of several painted rectangles, in the order the layout reads them.
 *
 * @param {ReadonlyArray<RenderedBox>} boxes - The painted rectangles.
 * @returns {RenderedBox | null} The smallest rectangle containing all of them,
 * or `null` when there is nothing painted to measure.
 */
function unionRenderedBoxes(boxes: ReadonlyArray<RenderedBox>): RenderedBox | null {
  if (boxes.length === 0) {
    return null;
  }
  const left = Math.min(...boxes.map((box) => box.left));
  const right = Math.max(...boxes.map((box) => box.right));
  const top = Math.min(...boxes.map((box) => box.top));
  const bottom = Math.max(...boxes.map((box) => box.bottom));

  return { left, right, top, bottom, width: right - left, height: bottom - top };
}

/**
 * Read the open preview's header regions as one rendered measurement.
 *
 * @remarks
 * A region that resolved without painted area makes the whole reading unusable:
 * measuring half a header would report invented alignment rather than a defect.
 *
 * @param {Locator} popover - The open preview popover.
 * @returns {Promise<PreviewHeaderMeasurement | null>} The measurement, or `null`
 * while any contract region is missing or has no painted area.
 */
export async function readPreviewHeaderRegions(
  popover: Locator
): Promise<PreviewHeaderMeasurement | null> {
  const raw = await readRawPreviewHeaderRegions(popover);
  if (raw === null) {
    return null;
  }

  const regions = {} as Record<PreviewHeaderRegionName, RenderedBox>;
  for (const name of REGION_NAMES) {
    const box = toPaintedBox(raw.readings[name].rect);
    if (box === null) {
      return null;
    }
    regions[name] = box;
  }

  const metricGroup = unionRenderedBoxes(raw.readings.metricGroupWrapper.childRects);
  if (metricGroup === null) {
    return null;
  }

  return {
    regions,
    metricGroup,
    actionAccessibleLabel: raw.readings.action.accessibleLabel,
    balanceIsFocusable: raw.readings.balance.focusable,
    balanceText: raw.readings.balance.text,
    cardClientWidth: raw.readings.card.clientWidth,
    cardScrollWidth: raw.readings.card.scrollWidth,
    headerClientWidth: raw.readings.header.clientWidth,
    headerScrollWidth: raw.readings.header.scrollWidth,
    layoutViewportWidth: raw.layoutViewportWidth,
    overlayMotionSettled: raw.overlayMotionSettled,
  };
}
