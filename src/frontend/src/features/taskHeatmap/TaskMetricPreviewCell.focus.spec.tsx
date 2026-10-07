/**
 * Acceptance tests for the metric cell's keyboard focus ownership when a
 * preview opens.
 *
 * Where `TaskMetricPreviewCell.spec.tsx` pins the characterisation the column
 * module relies on, and `TaskMetricPreviewCell.focusSession.spec.tsx` pins what
 * happens to a preview that settles late, this suite pins the open/dismiss
 * contract of a keyboard-activated preview: Enter and Space each open the
 * preview and hand focus to the rendered source link exactly once, pointer
 * traversal never takes focus at all, Escape at the trigger or inside the
 * portal closes the preview and returns focus to the trigger, and Tab and
 * Shift+Tab remain untrapped in both directions.
 *
 * @remarks
 * **Red-first provenance.** The source action and its focus ownership were
 * still missing when these cases were authored, so the cases needing a
 * focusable element inside the preview failed first; they now pin the
 * delivered contract. The trigger-level Escape case opens with Enter, awaits
 * the one transfer that opening owes, and only then returns focus to the
 * trigger before pressing Escape, so its cumulative count cannot contradict
 * the Enter case. The pointer and Tab-order cases never depended on the
 * action and pin the pointer-first behaviour and the no-trap boundary
 * against regression.
 *
 * The real `TaskMetricPreviewCell` is rendered — and through it the real
 * content, deferred overlay and card — because a stubbed overlay would
 * predetermine the very focus lifecycle under test. The cell is rendered
 * between two focusable neighbour controls so Tab order and focus departure are
 * genuine DOM focus movements.
 *
 * @see TASK_PREVIEW_SOURCE_LINK_LAYOUT.md
 * @see docs/developer/frontend/frontend-testing.md
 */

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { cleanup, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { PreviewCellHarness } from '../../test/taskHeatmap/previewSourceActionTestHelpers';
import {
  dispatchCancelableKeydown,
  findSourceAction,
  buildCanonicalCellWithoutSourceUrl,
  renderPreviewCell,
  waitForPreviewContent,
  waitForPreviewDismissed,
} from '../../test/taskHeatmap/previewSourceActionTestHelpers';

let user: ReturnType<typeof userEvent.setup>;
let harness: PreviewCellHarness;

beforeEach(() => {
  user = userEvent.setup();
});

afterEach(() => {
  harness?.stop();
  cleanup();
});

describe('TaskMetricPreviewCell keyboard activation and focus ownership', () => {
  it.each([
    ['loading', { isLoading: true }],
    ['error', { isLoading: false, hasError: true }],
    ['no-source', { cellData: buildCanonicalCellWithoutSourceUrl() }],
  ] as const)('closes the %s preview on Escape at the trigger', async (_state, properties) => {
    harness = renderPreviewCell(properties);
    harness.trigger.focus();

    await user.keyboard('{Enter}');
    await waitForPreviewContent();
    expect(document.activeElement).toBe(harness.trigger);

    await user.keyboard('{Escape}');
    await waitForPreviewDismissed();

    expect(harness.trigger).toHaveFocus();
  });

  it('opens the preview on Enter and focuses the source link exactly once', async () => {
    harness = renderPreviewCell();
    harness.trigger.focus();
    expect(harness.trigger).toHaveFocus();

    await user.keyboard('{Enter}');
    await waitForPreviewContent();

    const action = await findSourceAction();
    await waitFor(() => {
      expect(action).toHaveFocus();
    });
    // A single focus transfer per keyboard session: the action must not be
    // re-focused by later renders of the same session.
    expect(harness.sourceFocusCount()).toBe(1);
  });

  it('opens the preview on Space and focuses the source link exactly once', async () => {
    harness = renderPreviewCell();
    harness.trigger.focus();
    expect(harness.trigger).toHaveFocus();
    // `{ }` resolves to the Space key (`key === ' '`), which is the value the
    // trigger's keydown handler matches.
    await user.keyboard('{ }');
    await waitForPreviewContent();

    const action = await findSourceAction();
    await waitFor(() => {
      expect(action).toHaveFocus();
    });
    expect(harness.sourceFocusCount()).toBe(1);
  });

  it.each(['Enter', ' '] as const)(
    're-arms source focus when %s is pressed after pointer-opening the preview',
    async (key) => {
      harness = renderPreviewCell();
      await user.click(harness.trigger);
      await waitForPreviewContent();
      const action = await findSourceAction();
      expect(action).not.toHaveFocus();

      harness.trigger.focus();
      await user.keyboard(key === 'Enter' ? '{Enter}' : '{ }');

      await waitFor(() => expect(action).toHaveFocus());
      expect(harness.sourceFocusCount()).toBe(1);
    }
  );

  it('opens the preview on pointer hover without taking focus at all', async () => {
    harness = renderPreviewCell();

    await user.hover(harness.trigger);
    await waitForPreviewContent();

    // Pointer traversal must not become keyboard focus: neither the cell nor
    // anything inside the preview may receive it.
    expect(document.activeElement).toBe(document.body);
    expect(harness.trigger).not.toHaveFocus();
    expect(harness.sourceFocusCount()).toBe(0);
  });

  it('opens the preview on pointer click without handing focus to the action', async () => {
    harness = renderPreviewCell();

    await user.click(harness.trigger);
    await waitForPreviewContent();

    // Only the keyboard path owns the action's focus.
    expect(harness.sourceFocusCount()).toBe(0);
  });

  it('closes on Escape at the trigger, keeping trigger focus without a second source focus transfer', async () => {
    harness = renderPreviewCell();
    harness.trigger.focus();
    expect(harness.trigger).toHaveFocus();

    // Opened exactly as the Enter case above, so the session's single pending
    // transfer is the same one that test pins. Awaiting it here keeps the
    // cumulative count honest: this observer never resets, so a count of zero
    // could never be asserted against an opening that has already handed focus
    // to the source action.
    await user.keyboard('{Enter}');
    await waitForPreviewContent();

    const action = await findSourceAction();
    await waitFor(() => {
      expect(action).toHaveFocus();
    });
    expect(harness.sourceFocusCount()).toBe(1);

    // The trigger-level Escape contract needs the cell to own focus before the
    // key is pressed. Without this the key would be answered from the source
    // action inside the portal, which is the separate case below, so focus is
    // deliberately returned to the trigger first. Wrapped in `act` because this
    // programmatic focus drives React updates outside any user interaction.
    act(() => {
      harness.trigger.focus();
    });
    expect(harness.trigger).toHaveFocus();
    expect(action).not.toHaveFocus();
    // Returning focus to the cell is not a source transfer.
    expect(harness.sourceFocusCount()).toBe(1);

    await user.keyboard('{Escape}');
    await waitForPreviewDismissed();

    // Focus never leaves the cell on this path, and a closing session owes
    // nothing: the already-spent transfer must not be replayed.
    expect(harness.trigger).toHaveFocus();
    expect(harness.sourceFocusCount()).toBe(1);
  });

  it('closes on Escape from inside the preview and restores focus to the trigger', async () => {
    harness = renderPreviewCell();
    harness.trigger.focus();
    await user.keyboard('{Enter}');
    await waitForPreviewContent();

    // Escape pressed while focus sits on the action inside the portal overlay.
    const action = await findSourceAction();
    await waitFor(() => {
      expect(action).toHaveFocus();
    });

    await user.keyboard('{Escape}');
    await waitForPreviewDismissed();

    expect(harness.trigger).toHaveFocus();
  });

  it('lets Tab and Shift+Tab leave the trigger in both directions', async () => {
    harness = renderPreviewCell();
    harness.trigger.focus();

    await user.tab();
    expect(harness.followingControl).toHaveFocus();

    await user.tab({ shift: true });
    expect(harness.trigger).toHaveFocus();
  });

  it('leaves Tab and Shift+Tab unprevented inside the open preview', async () => {
    harness = renderPreviewCell();
    harness.trigger.focus();
    await user.keyboard('{Enter}');
    await waitForPreviewContent();

    const action = await findSourceAction();
    await waitFor(() => {
      expect(action).toHaveFocus();
    });

    // There is no focus trap, so neither key may be consumed, and focus must not
    // be wrapped back onto the action while they are pressed.
    expect(dispatchCancelableKeydown(action, 'Tab').defaultPrevented).toBe(false);
    expect(action).toHaveFocus();
    expect(dispatchCancelableKeydown(action, 'Tab', { shiftKey: true }).defaultPrevented).toBe(
      false
    );
    expect(action).toHaveFocus();
  });
});
