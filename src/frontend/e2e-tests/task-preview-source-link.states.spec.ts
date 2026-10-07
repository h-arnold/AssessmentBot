/**
 * Playwright state and focus-session walkthroughs for the issue #19 task-preview
 * source link.
 *
 * Where `task-preview-source-link.spec.ts` proves the action's *interaction and
 * navigation* — pointer traversal, the exact outgoing editor URL, the link's own
 * keyboard journey and the URL boundary variants — this spec proves the states
 * around it: a preview that is still loading, one that failed, one whose record
 * offers no usable source at all, and the focus session a keyboard user is left
 * in while a held response is released underneath them.
 *
 * @remarks
 * **Boundary probes, not source-navigation tests.** These scenarios assert the
 * focus and dismissal contract of the preview itself. None of them may resolve a
 * source URL, so they deliberately stop at "the action is absent and focus never
 * leaves the cell"; navigation is covered by the companion spec.
 *
 * The pointer versions of the absent-action states are preserved here because
 * they pin pointer behaviour in its own right: hovering a cell must not move
 * focus, and a hover-opened error or unavailable preview must still offer no
 * action.
 *
 * **Keyboard boundaries.** `@rc-component/trigger@3.9.0` registers no keydown
 * handler of its own, but the overlay it renders is mounted through
 * `@rc-component/portal`, whose `useEscKeyDown` installs a window-level
 * `keydown` listener for as long as the portal is open. Escape therefore already
 * dismisses the preview wherever focus happens to sit. Section 3 has since
 * delivered the focus *ownership* that builds on that dismissal, so these two
 * cases pin what must not regress now that it has landed: Enter and Space each
 * open the preview, focus never leaves the cell when the preview has nothing
 * inside to focus, no action appears without a usable source, and Escape still
 * closes the preview and leaves focus on the trigger.
 *
 * **Red-first provenance.** These walkthroughs were authored before Section 3
 * delivered the action and its focus ownership; at that time the
 * deferred-readiness focus-transfer cases failed on the missing action and the
 * missing transfer. Both are now delivered, and the suite pins the current
 * behaviour, with visual/geometry sign-off still pending the actual Section 4
 * visual review. No failure in this spec may be a navigation, schema or queue
 * failure.
 *
 * @see TASK_PREVIEW_SOURCE_LINK_LAYOUT.md
 * @see docs/developer/frontend/frontend-playwright-e2e.md — runtime mocks, StrictMode rule
 */

import { expect, test } from '@playwright/test';
import { releaseNextDeferredSuccess } from './shared/endToEndRuntimeMocks';
import {
  metricTrigger,
  openPreviewPopover,
  sourceDocumentAction,
} from './helpers/task-preview-source-link-helpers';
import {
  enterEmbeddedJourney,
  hoverCanonicalCell,
  taskMetricCells,
} from './helpers/task-preview-source-link-journeys';
import { createEmbeddedAssignmentQueue } from './helpers/task-preview-source-link-scenarios';
import {
  CANONICAL_SLIDES_ASSIGNMENT,
  withSourceLocationOverride,
} from './helpers/task-preview-source-link-fixtures';
import { SOURCE_ACTION_LABEL } from '../src/features/taskHeatmap/TaskPreviewCard';
import {
  LOADING_PREVIEW_LABEL,
  PREVIEW_ERROR_TEXT,
} from '../src/features/taskHeatmap/TaskMetricPreviewContent';
import {
  CANONICAL_SLIDES_CELL,
  deriveSourceLinkCell,
} from './helpers/task-preview-source-link-expectations';

// ---------------------------------------------------------------------------
// Journey cells and state copy
// ---------------------------------------------------------------------------

/** Ready Slides preview cell of the canonical Slides assignment. */
const slidesCell = CANONICAL_SLIDES_CELL;

// ---------------------------------------------------------------------------
// Loading and error states
// ---------------------------------------------------------------------------

test.describe('Task preview source link — loading and error state', () => {
  test('offers no source action while the preview is loading', async ({ page }) => {
    const popover = await hoverCanonicalCell(
      page,
      createEmbeddedAssignmentQueue({ journeyResponseKind: 'deferredSuccess' }),
      slidesCell
    );

    await expect(popover.locator(`[aria-label="${LOADING_PREVIEW_LABEL}"]`)).toHaveCount(1);
    await expect(sourceDocumentAction(popover)).toHaveCount(0);
  });

  test('offers no source action when the preview data failed to load', async ({ page }) => {
    const popover = await hoverCanonicalCell(
      page,
      createEmbeddedAssignmentQueue({ journeyResponseKind: 'failure' }),
      slidesCell
    );

    await expect(popover.getByText(PREVIEW_ERROR_TEXT)).toHaveCount(1);
    await expect(sourceDocumentAction(popover)).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// Unavailable source state
// ---------------------------------------------------------------------------

test.describe('Task preview source link — unavailable source state', () => {
  test('offers no action when neither the artefact nor the parent has a document', async ({
    page,
  }) => {
    const noSource = withSourceLocationOverride(CANONICAL_SLIDES_ASSIGNMENT, {
      artifactDocumentId: null,
      parentDocumentId: null,
    });
    const cell = deriveSourceLinkCell(noSource);
    expect(cell.expectedSourceUrl).toBeNull();

    const popover = await hoverCanonicalCell(
      page,
      createEmbeddedAssignmentQueue({ journeyAssignment: noSource }),
      cell
    );

    // A ready card with no usable source renders no action and no placeholder.
    await expect(popover.getByText(cell.artifactContent, { exact: true })).toHaveCount(1);
    await expect(sourceDocumentAction(popover)).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// Deferred readiness focus session
// ---------------------------------------------------------------------------

test.describe('Task preview source link — deferred readiness', () => {
  test('transfers focus to the source link once when a keyboard preview becomes ready', async ({
    page,
  }) => {
    await enterEmbeddedJourney(
      page,
      createEmbeddedAssignmentQueue({ journeyResponseKind: 'deferredSuccess' })
    );

    const trigger = metricTrigger(page, slidesCell.cellAccessibleLabel);
    await trigger.focus();
    await page.keyboard.press('Enter');

    const popover = openPreviewPopover(page);
    await expect(popover).toBeVisible();
    await expect(popover.locator(`[aria-label="${LOADING_PREVIEW_LABEL}"]`)).toHaveCount(1);
    // The trigger keeps focus while there is nothing inside to focus.
    await expect(trigger).toBeFocused();
    await expect(sourceDocumentAction(popover)).toHaveCount(0);

    await releaseNextDeferredSuccess(page);

    await expect(popover.locator(`[aria-label="${LOADING_PREVIEW_LABEL}"]`)).toHaveCount(0);
    const action = sourceDocumentAction(popover);
    await expect(action).toBeVisible();
    await expect(action).toBeFocused();
  });

  test('does not steal focus when the user leaves the trigger before readiness', async ({
    page,
  }) => {
    await enterEmbeddedJourney(
      page,
      createEmbeddedAssignmentQueue({ journeyResponseKind: 'deferredSuccess' })
    );

    const cells = taskMetricCells(page, slidesCell);
    const sibling = cells.nth(1);
    await cells.first().focus();
    await page.keyboard.press('Enter');
    await expect(openPreviewPopover(page)).toBeVisible();

    // The user moves focus elsewhere before the held response is released.
    await sibling.focus();
    await expect(sibling).toBeFocused();

    await releaseNextDeferredSuccess(page);

    const action = sourceDocumentAction(openPreviewPopover(page));
    await expect(action).toBeVisible();
    await expect(action).not.toBeFocused();
    await expect(sibling).toBeFocused();
  });

  test('offers no action and steals no focus when the preview closed before readiness', async ({
    page,
  }) => {
    await enterEmbeddedJourney(
      page,
      createEmbeddedAssignmentQueue({ journeyResponseKind: 'deferredSuccess' })
    );

    const trigger = metricTrigger(page, slidesCell.cellAccessibleLabel);
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(openPreviewPopover(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(openPreviewPopover(page)).toHaveCount(0);

    await releaseNextDeferredSuccess(page);

    await expect(page.getByRole('link', { name: SOURCE_ACTION_LABEL })).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
});

// ---------------------------------------------------------------------------
// Keyboard boundaries: activation, focus retention, no action, Escape
// ---------------------------------------------------------------------------

test.describe('Task preview source link — keyboard boundary states', () => {
  test('keeps focus on the trigger of a keyboard-opened failed preview and restores it on Escape', async ({
    page,
  }) => {
    await enterEmbeddedJourney(
      page,
      createEmbeddedAssignmentQueue({ journeyResponseKind: 'failure' })
    );

    const trigger = metricTrigger(page, slidesCell.cellAccessibleLabel);
    await trigger.focus();
    await expect(trigger).toBeFocused();

    await page.keyboard.press('Enter');

    const popover = openPreviewPopover(page);
    await expect(popover).toBeVisible();
    await expect(popover.getByText(PREVIEW_ERROR_TEXT)).toHaveCount(1);
    // A failed preview offers nothing to focus, so focus must stay on the cell
    // rather than being dropped onto the overlay or the page body.
    await expect(trigger).toBeFocused();
    await expect(sourceDocumentAction(popover)).toHaveCount(0);

    await page.keyboard.press('Escape');

    await expect(openPreviewPopover(page)).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('keeps focus on the trigger of a keyboard-opened preview with no source and restores it on Escape', async ({
    page,
  }) => {
    const noSource = withSourceLocationOverride(CANONICAL_SLIDES_ASSIGNMENT, {
      artifactDocumentId: null,
      parentDocumentId: null,
    });
    const cell = deriveSourceLinkCell(noSource);
    expect(cell.expectedSourceUrl).toBeNull();

    await enterEmbeddedJourney(
      page,
      createEmbeddedAssignmentQueue({ journeyAssignment: noSource })
    );

    const trigger = metricTrigger(page, cell.cellAccessibleLabel);
    await trigger.focus();
    await expect(trigger).toBeFocused();

    await page.keyboard.press(' ');

    const popover = openPreviewPopover(page);
    await expect(popover).toBeVisible();
    // The ready card still renders its content; only the action is absent.
    await expect(popover.getByText(cell.artifactContent, { exact: true })).toHaveCount(1);
    await expect(trigger).toBeFocused();
    await expect(sourceDocumentAction(popover)).toHaveCount(0);

    await page.keyboard.press('Escape');

    await expect(openPreviewPopover(page)).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
});
