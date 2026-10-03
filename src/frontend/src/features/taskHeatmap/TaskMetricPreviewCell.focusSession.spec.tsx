/**
 * Acceptance tests for the metric cell's preview focus session when the preview
 * settles late, or offers nothing to focus.
 *
 * A preview opened from the keyboard can still be loading, can fail, or can
 * carry a record with no usable source, and the user may dismiss it or move on
 * before its data arrives. This suite pins that session: focus stays on the
 * trigger while there is nothing inside the preview to focus; a late readiness
 * transfers focus to the source link exactly once and only while that same
 * keyboard session is still open; and a dismissed session or a user who has
 * moved on is never dragged back by a late render. Each reopened keyboard
 * session owns its own pending intent.
 *
 * @remarks
 * **Red-first provenance.** The late-readiness transfer, the user-moved-focus
 * case and the reopened-session cases were authored before the source action
 * existed; they now pin the delivered session contract. The remaining
 * retention and closed-session cases never depended on the action and pin the
 * boundaries against a focus implementation that over-reaches.
 *
 * **Delivered regression.** The departure-and-return case below pins the
 * delivered contract that focus-departure cancellation is persistent: the cell
 * observes cancellation on the trigger's blur, so tabbing away and later
 * returning to a still-loading trigger never revives the transfer, and the
 * late readiness leaves the action offered but unfocused. The case asserts
 * only the focus steal and the transfer count — not fixture, schema or setup
 * shape.
 *
 * The user-moved-focus case asserts that leaving the trigger cancels the pending
 * transfer while the still-open session renders its ready action unfocused.
 * Moving focus cancels the transfer only; it does not withdraw the preview's own
 * content, which is what makes it a distinct boundary from the
 * closed-before-readiness case.
 *
 * Readiness is simulated by re-rendering the cell in place, which is exactly
 * what the column builder does when the column's preview query settles; the
 * real cell, overlay and card are rendered throughout.
 *
 * @see TASK_PREVIEW_SOURCE_LINK_LAYOUT.md
 * @see docs/developer/frontend/frontend-testing.md
 */

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { PreviewCellHarness } from '../../test/taskHeatmap/previewSourceActionTestHelpers';
import {
  SOURCE_ACTION_LABEL,
  buildCanonicalCellWithoutSourceUrl,
  findSourceAction,
  renderPreviewCell,
  waitForPreviewContent,
  waitForPreviewDismissed,
} from '../../test/taskHeatmap/previewSourceActionTestHelpers';
import { CANONICAL_READY_CELL } from '../../test/taskHeatmap/previewFixtures';

/** Accessible label the loading preview body announces. */
const LOADING_PREVIEW_LABEL = 'Loading task preview';

/** Error copy a failed preview body renders. */
const PREVIEW_ERROR_TEXT = "Couldn't load task details";

/**
 * Focus transfers observed once two keyboard sessions have each handed focus to
 * the source link exactly once.
 */
const TWO_SESSION_FOCUS_TRANSFERS = 2;

let user: ReturnType<typeof userEvent.setup>;
let harness: PreviewCellHarness;

beforeEach(() => {
  user = userEvent.setup();
});

afterEach(() => {
  harness?.stop();
  cleanup();
});

describe('TaskMetricPreviewCell deferred readiness focus session', () => {
  it('keeps focus on the trigger while a keyboard-opened preview is still loading', async () => {
    harness = renderPreviewCell({ isLoading: true });
    harness.trigger.focus();
    await user.keyboard('{Enter}');
    await waitForPreviewContent();

    expect(document.querySelector('.ant-popover output[aria-busy="true"]')).toHaveAttribute(
      'aria-label',
      LOADING_PREVIEW_LABEL
    );
    // A loading preview offers nothing to focus, so focus must stay on the cell
    // rather than being dropped onto the overlay or the document body.
    expect(harness.trigger).toHaveFocus();
    expect(harness.sourceFocusCount()).toBe(0);
  });

  it('transfers focus to the source link once when a keyboard-opened preview becomes ready', async () => {
    harness = renderPreviewCell({ isLoading: true });
    harness.trigger.focus();
    await user.keyboard('{Enter}');
    await waitForPreviewContent();
    expect(harness.trigger).toHaveFocus();

    // The column's preview query settles while the preview is still open.
    await harness.rerenderCell({ isLoading: false });

    const action = await findSourceAction();
    await waitFor(() => {
      expect(action).toHaveFocus();
    });
    // Exactly one transfer for this session, no matter how often the ready card
    // renders afterwards.
    expect(harness.sourceFocusCount()).toBe(1);
  });

  it('cancels the pending transfer when the preview closes before readiness', async () => {
    harness = renderPreviewCell({ isLoading: true });
    harness.trigger.focus();
    await user.keyboard('{Enter}');
    await waitForPreviewContent();

    await user.keyboard('{Escape}');
    await waitForPreviewDismissed();

    await harness.rerenderCell({ isLoading: false });
    await waitFor(() => {
      expect(screen.queryByRole('link', { name: SOURCE_ACTION_LABEL })).not.toBeInTheDocument();
    });

    // A closed session's intent is cancelled: the late card appears with no
    // action at all and must not pull focus back to a preview the user left.
    expect(harness.sourceFocusCount()).toBe(0);
    expect(harness.trigger).toHaveFocus();
  });

  it('cancels the pending transfer when the user moves focus before readiness', async () => {
    harness = renderPreviewCell({ isLoading: true });
    harness.trigger.focus();
    await user.keyboard('{Enter}');
    await waitForPreviewContent();

    // The user tabs on to the next control before the held response arrives.
    await user.tab();
    expect(harness.followingControl).toHaveFocus();

    await harness.rerenderCell({ isLoading: false });

    // Leaving the trigger cancels the pending focus transfer, not the preview's
    // availability: the still-open session renders its ready action, exactly as
    // the reviewed browser states suite expects for this same journey
    // (`does not steal focus when the user leaves the trigger before readiness`).
    const action = await findSourceAction();
    expect(action).toBeVisible();
    // The action is offered but must not take the focus the user has given away.
    expect(action).not.toHaveFocus();
    expect(harness.sourceFocusCount()).toBe(0);
    expect(harness.followingControl).toHaveFocus();
  });

  it('cancels the pending transfer persistently across a focus departure and return', async () => {
    harness = renderPreviewCell({ isLoading: true });
    harness.trigger.focus();
    await user.keyboard('{Enter}');
    await waitForPreviewContent();

    // The user tabs on, then returns to the trigger while the preview is
    // still loading.
    await user.tab();
    expect(harness.followingControl).toHaveFocus();
    await user.tab({ shift: true });
    expect(harness.trigger).toHaveFocus();

    await harness.rerenderCell({ isLoading: false });

    const action = await findSourceAction();
    expect(action).toBeVisible();
    // Departure cancelled the intent; returning focus must not revive it, so
    // the late readiness leaves the action offered but unfocused and spends
    // no transfers.
    expect(action).not.toHaveFocus();
    expect(harness.sourceFocusCount()).toBe(0);
    expect(harness.trigger).toHaveFocus();
  });

  it('keeps focus on the trigger for a failed preview and restores it on Escape', async () => {
    harness = renderPreviewCell({ hasError: true });
    harness.trigger.focus();
    await user.keyboard('{Enter}');
    await waitForPreviewContent();

    expect(screen.getByRole('alert')).toHaveTextContent(PREVIEW_ERROR_TEXT);
    expect(harness.trigger).toHaveFocus();
    expect(harness.sourceFocusCount()).toBe(0);

    await user.keyboard('{Escape}');
    await waitForPreviewDismissed();

    expect(harness.trigger).toHaveFocus();
  });

  it('keeps focus on the trigger for a preview whose record offers no source', async () => {
    harness = renderPreviewCell({ cellData: buildCanonicalCellWithoutSourceUrl() });
    harness.trigger.focus();
    await user.keyboard('{Enter}');
    await waitForPreviewContent();

    // The ready card still renders its content; only the action is absent.
    expect(screen.getByText(CANONICAL_READY_CELL.artifactContent)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: SOURCE_ACTION_LABEL })).not.toBeInTheDocument();
    expect(harness.trigger).toHaveFocus();
    expect(harness.sourceFocusCount()).toBe(0);
  });

  it('gives each reopened keyboard session its own pending focus intent', async () => {
    harness = renderPreviewCell({ isLoading: true });
    harness.trigger.focus();
    await user.keyboard('{Enter}');
    await waitForPreviewContent();

    await harness.rerenderCell({ isLoading: false });
    const firstSessionAction = await findSourceAction();
    await waitFor(() => {
      expect(firstSessionAction).toHaveFocus();
    });
    expect(harness.sourceFocusCount()).toBe(1);

    await user.keyboard('{Escape}');
    await waitForPreviewDismissed();
    expect(harness.trigger).toHaveFocus();

    // Reopening starts a new session, which must own a fresh pending intent
    // rather than replaying or dropping the previous session's transfer.
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(harness.sourceFocusCount()).toBe(TWO_SESSION_FOCUS_TRANSFERS);
    });
    // The second session's action, not the first one, now owns focus.
    expect(document.activeElement).toHaveAccessibleName(SOURCE_ACTION_LABEL);
  });
});
