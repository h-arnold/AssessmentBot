/**
 * Popover trigger and focus-session owner for one heatmap metric cell.
 *
 * @remarks
 * The controlled preview retains ordinary pointer behaviour; keyboard activation
 * transfers focus to a ready source action once per session, and Escape restores
 * focus to the trigger.
 *
 * The intent is armed only by a keyboard activation of the trigger, and is spent
 * at most once, on the first moment this session offers something focusable —
 * the body publishing its source action, or an opening that lands on a body
 * already offering one. While the preview is loading, failing, or offering no
 * usable source there is nothing to focus, so focus simply stays on the trigger
 * and the intent waits; when a ready action appears, focus moves to it if — and
 * only if — the trigger still holds it. Leaving the trigger cancels the transfer,
 * never the preview: a user who has tabbed on keeps the ready card, unfocused.
 * Pointer traversal never arms the intent, so hovering or clicking a cell moves no
 * focus at all, and there is no focus trap — Tab and Shift+Tab stay ordinary.
 *
 * **Focus safety.** The intent is armed only by keyboard activation, spent at
 * most once, and cancelled on departure from the trigger or session close. The
 * transfer re-checks the active element before focusing, so it never steals
 * focus after the user moves elsewhere. It is deferred by one microtask to avoid
 * invoking Ant Design's synchronous overlay update during React's commit; see
 * §9.26 of `frontend-shared-helpers-and-abstraction-standards.md`.
 */

import {
  useCallback,
  useRef,
  useState,
  type FocusEvent,
  type JSX,
  type KeyboardEvent,
} from 'react';
import { Popover } from 'antd';

import { DeferredPopoverContent } from './DeferredPopoverContent';
import {
  TaskMetricPreviewContent,
  type TaskMetricPreviewContentProperties,
} from './TaskMetricPreviewContent';
import type { SourceActionElement } from './TaskPreviewCard';
import { APP_GAP_XS } from '../../theme/spacing';
import styles from './TaskMetricPreviewCell.module.css';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Inputs required to render one metric cell and its deferred popover body.
 *
 * @remarks
 * `sourceAnchorRef` is omitted: the source-action ref is an internal
 * collaboration between this module and the preview body, so a column builder
 * cannot supply one.
 */
export interface TaskMetricPreviewCellProperties extends Omit<
  TaskMetricPreviewContentProperties,
  'sourceAnchorRef'
> {
  /** Accessible label shared by the table cell (`onCell`) and this trigger. */
  readonly accessibleLabel: string;
  /** Formatted score text rendered inside the trigger. */
  readonly scoreText: string;
}

// ---------------------------------------------------------------------------
// TaskMetricPreviewCell component
// ---------------------------------------------------------------------------

/**
 * Metric-cell score trigger wrapped in the preview Popover, owning the preview's
 * open state and its focus session.
 *
 * @remarks
 * Tone mapping stays a `<td>` responsibility (`onCell` in the column module),
 * so this trigger paints no background of its own and carries the shared
 * accessible label rather than restating cell styling.
 *
 * @param {Readonly<TaskMetricPreviewCellProperties>} props - Cell inputs.
 * @returns {JSX.Element} The popover-wrapped score trigger.
 */
export function TaskMetricPreviewCell({
  accessibleLabel,
  scoreText,
  cellData,
  metricResult,
  metricKey,
  taskId,
  isLoading,
  hasError,
}: Readonly<TaskMetricPreviewCellProperties>): JSX.Element {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const triggerReference = useRef<HTMLSpanElement | null>(null);
  const previewBodyReference = useRef<HTMLDivElement | null>(null);
  const sourceActionReference = useRef<SourceActionElement | null>(null);
  // Whether the current open session still owes its body a focus transfer.
  const pendingSourceFocus = useRef(false);

  /**
   * Hand this session's transfer to the preview's source action, if it is still
   * owed and the trigger still holds focus.
   */
  const transferPendingSourceFocus = useCallback((): void => {
    const action = sourceActionReference.current;
    if (action === null || !pendingSourceFocus.current) {
      return;
    }
    // Spend before focusing: no later commit in this session may pull focus back
    // from wherever the user has since put it.
    pendingSourceFocus.current = false;
    if (document.activeElement !== triggerReference.current) {
      return;
    }
    action.focus();
  }, []);

  /**
   * Decide the pending transfer once the current work is over.
   *
   * Nothing is scheduled while the preview has no focusable action, so a loading,
   * failed or source-less session simply leaves its intent waiting for the moment
   * that does offer one.
   *
   * The two callers are the only two moments an action becomes reachable: the
   * body publishing it as it mounts, and a session opening onto a body that was
   * already mounted.
   */
  const scheduleSourceFocusTransfer = useCallback((): void => {
    if (sourceActionReference.current === null || !pendingSourceFocus.current) {
      return;
    }
    queueMicrotask(transferPendingSourceFocus);
  }, [transferPendingSourceFocus]);

  /**
   * Record the open state Ant Design asks for, and settle the session it ends.
   *
   * @remarks
   * The close branch is also where a portal Escape is answered: focus sat inside
   * the preview body, which is about to unmount, so it is returned to the cell
   * that opened it. A pointer dismissal never holds focus in there, so it moves
   * focus nowhere.
   */
  const handleOpenChange = useCallback(
    (nextOpen: boolean): void => {
      setIsPreviewOpen(nextOpen);

      if (nextOpen) {
        // A body that was already mounted for this session offers its action
        // again without a fresh mount, so this opening re-decides the transfer.
        scheduleSourceFocusTransfer();
        return;
      }

      // The session is over: a closing preview owes nothing, whatever it was
      // still waiting for.
      pendingSourceFocus.current = false;
      if (previewBodyReference.current?.contains(document.activeElement) === true) {
        triggerReference.current?.focus();
      }
    },
    [scheduleSourceFocusTransfer]
  );

  /**
   * Cancel this session's pending transfer once the trigger loses focus.
   *
   * @remarks
   * The transfer-time active-element check alone forgets the journey: a user
   * who has tabbed away and later returned to the still-loading trigger would
   * otherwise be scanned as "holding focus" and have it stolen when readiness
   * landed. Departure cancels the intent permanently, so a later return never
   * revives it — while focus moving into the preview's own body (the portal
   * action the transfer itself targets, or anything else rendered there) is
   * not a departure and leaves the intent alone.
   */
  const handleTriggerBlur = useCallback((event: FocusEvent<HTMLSpanElement>): void => {
    const next = event.relatedTarget;
    if (next instanceof Node && previewBodyReference.current?.contains(next) === true) {
      return;
    }
    pendingSourceFocus.current = false;
  }, []);

  /**
   * Open the preview from the keyboard, and arm this session's focus transfer.
   *
   * @remarks
   * The trigger is a span, so it has no native activation of its own, and Space
   * would scroll the page: this handler is the whole keyboard contract. It opens
   * rather than toggles, which is why the trigger-level dismissal in the approved
   * workflow is Escape.
   */
  const handleTriggerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLSpanElement>): void => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }
      event.preventDefault();
      pendingSourceFocus.current = true;
      setIsPreviewOpen(true);
      // Opening an already-open preview mounts nothing, so without this the
      // armed intent would wait for an unrelated render to spend it.
      scheduleSourceFocusTransfer();
    },
    [scheduleSourceFocusTransfer]
  );

  /**
   * Take delivery of the preview body's source action, and re-decide the session's
   * transfer now that there is something to transfer to.
   *
   * @remarks
   * A preview that renders no action — loading, failed, or a record with no
   * usable source — leaves this untouched, which is exactly what tells this
   * module that the session has nothing to hand focus to yet. The same callback
   * releases the action as the body is torn down.
   */
  const handleSourceActionMounted = useCallback(
    (node: SourceActionElement | null): void => {
      sourceActionReference.current = node;
      scheduleSourceFocusTransfer();
    },
    [scheduleSourceFocusTransfer]
  );

  return (
    <Popover
      trigger={['hover', 'click']}
      placement="right"
      destroyOnHidden
      open={isPreviewOpen}
      onOpenChange={handleOpenChange}
      classNames={{ root: styles.previewPopover }}
      content={
        // This element is the preview body as far as focus is concerned: it is
        // the only thing this module renders inside the portal, so it answers
        // "is focus inside the preview?" locally, without a global DOM query and
        // without depending on Ant Design's own overlay handle.
        <div ref={previewBodyReference} role="dialog" aria-label={accessibleLabel}>
          <DeferredPopoverContent
            buildContent={() => (
              <TaskMetricPreviewContent
                cellData={cellData}
                metricResult={metricResult}
                metricKey={metricKey}
                taskId={taskId}
                isLoading={isLoading}
                hasError={hasError}
                sourceAnchorRef={handleSourceActionMounted}
              />
            )}
          />
        </div>
      }
    >
      {/* 4px padding (APP_GAP_XS, documented half-unit exception) widens the
          Popover hover/click target around the score without covering the
          whole cell; inline-block is required for padding to take effect. */}
      <span
        ref={triggerReference}
        tabIndex={0}
        role="button"
        aria-label={accessibleLabel}
        aria-expanded={isPreviewOpen}
        aria-haspopup="dialog"
        className={styles.trigger}
        style={{ padding: APP_GAP_XS, display: 'inline-block' }}
        onKeyDown={handleTriggerKeyDown}
        onBlur={handleTriggerBlur}
      >
        {scoreText}
      </span>
    </Popover>
  );
}
