/**
 * Shared test contract for the task-preview source action and for the metric
 * cell's preview focus session.
 *
 * The issue #19 source action and its approved keyboard handling are exercised
 * from four co-located suites: the card suite (the rendered action), the content
 * suite (which preview states may offer it), and the two metric-cell focus
 * suites. This module owns the single shared contract they would otherwise
 * restate four times over:
 *
 * - the action's accessible name and the canonical editor URL it must link,
 *   both derived from the canonical synthetic `small` record rather than
 *   restated as literals;
 * - a narrow local boundary fixture for a cell whose record offers no usable
 *   source (a cloned canonical cell with its derived URL cleared);
 * - a harness that renders the **real** `TaskMetricPreviewCell` — and through it
 *   the real `TaskMetricPreviewContent`, `DeferredPopoverContent` and
 *   `TaskPreviewCard` — with focusable controls either side of the cell, so
 *   Tab order and focus departure are observable;
 * - a focus observer that counts how many times the source action has actually
 *   taken focus, which is how "focused exactly once per session" is proven
 *   without predetermining the behaviour under test;
 * - open/closed waits for the Ant Design overlay.
 *
 * @remarks
 * Nothing here mocks the behaviour under test. The only stub is the boundary
 * `sourceUrl: null` cell, which is a real lookup output for a record with no
 * usable source.
 *
 * @see docs/developer/frontend/frontend-testing.md
 * @see docs/developer/testing/synthetic-test-data.md
 */

import { Fragment, createElement, type ReactElement } from 'react';
import { act, render, screen, waitFor, type RenderResult } from '@testing-library/react';
import { expect } from 'vitest';

import {
  TaskMetricPreviewCell,
  type TaskMetricPreviewCellProperties,
} from '../../features/taskHeatmap/TaskMetricPreviewCell';
import type { CellPreviewData } from '../../features/taskHeatmap/buildCellPreviewLookup';
import { formatMetricDisplayText } from '../../services/dataAnalysis/metricDisplay/metricDisplayText';
import { createComputedMetricResult } from '../dataAnalysis/fixtures';
import { CANONICAL_READY_CELL, buildCanonicalReadyCellData } from './previewFixtures';

/**
 * Accessible name (and tooltip text) of the preview card's source action.
 *
 * The name is stated on the action itself, so it is the single source of truth
 * for every unit-suite query against it.
 */
export const SOURCE_ACTION_LABEL = 'Open source document (opens in a new tab)';

/** Metric result the canonical ready cell's analyser output carries. */
const CANONICAL_CELL_METRIC = createComputedMetricResult({
  value: CANONICAL_READY_CELL.completenessScore,
});

/** Score text the column builder formats for the canonical ready cell. */
const CANONICAL_CELL_SCORE_TEXT = formatMetricDisplayText(CANONICAL_CELL_METRIC, 0);

/** Accessible label the column builder shares between a cell and its trigger. */
const CANONICAL_CELL_ACCESSIBLE_LABEL = `${CANONICAL_READY_CELL.studentName}, ${CANONICAL_READY_CELL.taskTitle}, Completeness: ${CANONICAL_CELL_SCORE_TEXT}`;

/** Accessible name of the focusable control rendered before the metric cell. */
const PRECEDING_CONTROL_LABEL = 'Previous metric cell control';

/** Accessible name of the focusable control rendered after the metric cell. */
const FOLLOWING_CONTROL_LABEL = 'Following metric cell control';

/**
 * Read the editor source URL the canonical Slides ready cell derives, failing
 * loudly when the corpus no longer provides one.
 *
 * @returns {string} The canonical derived editor URL.
 */
function requireCanonicalSourceUrl(): string {
  const { sourceUrl } = buildCanonicalReadyCellData();
  if (sourceUrl === null) {
    throw new Error(
      'previewSourceActionTestHelpers: the canonical Slides ready cell must derive an editor source URL.'
    );
  }
  return sourceUrl;
}

/**
 * The editor source URL the canonical `small` Slides ready cell derives through
 * the production lookup. Every href assertion compares against this value, so
 * the suites cannot drift from the resolver they are meant to accompany.
 */
export const CANONICAL_SOURCE_URL = requireCanonicalSourceUrl();

/**
 * Clone the canonical ready cell with its derived source URL cleared.
 *
 * A record whose artefact and parent submission both carry no usable document
 * is the realistic "no link available" boundary; clearing the derived URL on a
 * clone reproduces exactly that lookup output without mutating the shared
 * frozen canonical record.
 *
 * @returns {CellPreviewData} A detached cell carrying no source URL.
 */
export function buildCanonicalCellWithoutSourceUrl(): CellPreviewData {
  return { ...buildCanonicalReadyCellData(), sourceUrl: null };
}

/**
 * Count how many times the source action has taken keyboard focus.
 */
interface SourceFocusObserver {
  /** Focus transfers observed on the source action since the observer started. */
  count(): number;
  /** Detach the document-level observer. */
  stop(): void;
}

/**
 * Start counting focus transfers onto the source action.
 *
 * A `focusin` listener is used rather than a spy on `HTMLElement.focus`, so the
 * count reflects the DOM's own focus accounting: it counts a transfer whether
 * the implementation reached it through `.focus()`, a native Tab, or anything
 * else, and it counts one transfer per session rather than per call.
 *
 * @returns {SourceFocusObserver} The observer and its detach handle.
 */
function createSourceFocusObserver(): SourceFocusObserver {
  let observedCount = 0;

  const recordFocusTransfer = (event: Event): void => {
    const { target } = event;
    if (
      target instanceof HTMLElement &&
      target.getAttribute('aria-label') === SOURCE_ACTION_LABEL
    ) {
      observedCount += 1;
    }
  };

  document.addEventListener('focusin', recordFocusTransfer);

  return {
    count: () => observedCount,
    stop: () => {
      document.removeEventListener('focusin', recordFocusTransfer);
    },
  };
}

/**
 * Build the cell under test between two focusable neighbour controls.
 *
 * The neighbours exist so Tab order and a user's focus departure are real DOM
 * focus movements rather than programmatic `focus()` calls that would bypass
 * the browser behaviour under test.
 *
 * @param {TaskMetricPreviewCellProperties} properties - Resolved cell properties.
 * @returns {ReactElement} The neighbour controls wrapped around the cell.
 */
function buildCellTree(properties: TaskMetricPreviewCellProperties): ReactElement {
  // Built with `createElement` rather than JSX so this shared helper stays a
  // plain `.ts` module: it exports no component, and a `.tsx` test helper that
  // exports only helpers trips the fast-refresh export rule.
  return createElement(
    Fragment,
    null,
    createElement('button', { type: 'button' }, PRECEDING_CONTROL_LABEL),
    createElement(TaskMetricPreviewCell, properties),
    createElement('button', { type: 'button' }, FOLLOWING_CONTROL_LABEL)
  );
}

/**
 * A rendered metric cell plus the handles the focus suites assert against.
 */
export interface PreviewCellHarness {
  /** The cell's score trigger, as the column builder renders it. */
  readonly trigger: HTMLElement;
  /** The focusable control immediately before the cell in DOM order. */
  readonly precedingControl: HTMLElement;
  /** The focusable control immediately after the cell in DOM order. */
  readonly followingControl: HTMLElement;
  /** How many times the source action has taken focus so far. */
  sourceFocusCount(): number;
  /**
   * Re-render the cell in place with new properties.
   *
   * This is how the column builder updates a cell when its preview query
   * settles, so it is what turns a loading preview into a ready one.
   *
   * @param {Partial<TaskMetricPreviewCellProperties>} [overrides] - Properties to change.
   * @returns {Promise<void>} Resolves once React has committed the new properties.
   */
  rerenderCell(overrides?: Partial<TaskMetricPreviewCellProperties>): Promise<void>;
  /** Stop observing focus transfers. Call this from `afterEach`. */
  stop(): void;
}

/**
 * Render the real metric cell with the canonical cell inputs.
 *
 * @param {Partial<TaskMetricPreviewCellProperties>} [properties] - Per-test overrides.
 * @returns {PreviewCellHarness} The rendered cell and its focus-observation handles.
 */
export function renderPreviewCell(
  properties: Partial<TaskMetricPreviewCellProperties> = {}
): PreviewCellHarness {
  let resolvedProperties: TaskMetricPreviewCellProperties = {
    accessibleLabel: CANONICAL_CELL_ACCESSIBLE_LABEL,
    scoreText: CANONICAL_CELL_SCORE_TEXT,
    cellData: buildCanonicalReadyCellData(),
    metricResult: CANONICAL_CELL_METRIC,
    metricKey: 'completeness',
    taskId: CANONICAL_READY_CELL.taskId,
    isLoading: false,
    hasError: false,
    ...properties,
  };

  const observer = createSourceFocusObserver();
  const view: RenderResult = render(buildCellTree(resolvedProperties));

  return {
    trigger: screen.getByRole('button', { name: CANONICAL_CELL_ACCESSIBLE_LABEL }),
    precedingControl: screen.getByRole('button', { name: PRECEDING_CONTROL_LABEL }),
    followingControl: screen.getByRole('button', { name: FOLLOWING_CONTROL_LABEL }),
    sourceFocusCount: () => observer.count(),
    rerenderCell: async (overrides = {}): Promise<void> => {
      resolvedProperties = { ...resolvedProperties, ...overrides };
      const nextTree = buildCellTree(resolvedProperties);
      await act(async () => {
        view.rerender(nextTree);
      });
    },
    stop: () => {
      observer.stop();
    },
  };
}

/**
 * Wait until the popover overlay has mounted its content.
 *
 * @returns {Promise<void>} Resolves once the overlay content is present.
 */
export async function waitForPreviewContent(): Promise<void> {
  await waitFor(() => {
    expect(document.querySelector('.ant-popover-content')).not.toBeNull();
  });
}

/**
 * Wait until the popover overlay has been dismissed.
 *
 * @remarks
 * A dismissed overlay is one the trigger has stopped presenting: either its node
 * is gone, or `rc-trigger` has marked it non-interactive and started its leave
 * motion. Both signals are accepted because happy-dom never fires the motion's
 * transition end, so the node can linger with the leave motion still running.
 * Waiting for node removal alone would hang here even though the overlay really
 * is closed.
 *
 * @returns {Promise<void>} Resolves once the overlay is closed or removed.
 */
export async function waitForPreviewDismissed(): Promise<void> {
  await waitFor(() => {
    const overlay = document.querySelector('.ant-popover');
    const dismissed =
      overlay === null ||
      (overlay instanceof HTMLElement && overlay.style.pointerEvents === 'none');
    expect(dismissed).toBe(true);
  });
}

/**
 * Find the rendered source action, waiting for it if it is not mounted yet.
 *
 * @returns {Promise<HTMLElement>} The action element.
 */
export async function findSourceAction(): Promise<HTMLElement> {
  return screen.findByRole('link', { name: SOURCE_ACTION_LABEL });
}

/**
 * Dispatch a cancelable `keydown` at an element and hand the event back so the
 * caller can inspect whether the component consumed it.
 *
 * @param {Element} target - Element the key is pressed on.
 * @param {string} key - The `KeyboardEvent.key` value.
 * @param {Readonly<{ shiftKey?: boolean }>} [options] - Modifier overrides.
 * @returns {KeyboardEvent} The dispatched event.
 */
export function dispatchCancelableKeydown(
  target: Element,
  key: string,
  options: Readonly<{ shiftKey?: boolean }> = {}
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    shiftKey: options.shiftKey ?? false,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
}
