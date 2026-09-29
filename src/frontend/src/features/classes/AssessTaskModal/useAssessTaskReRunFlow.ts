import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { startAssessmentRun } from '../../../services/assignmentAssessment/assignmentAssessmentService';
import type { ReRunContext } from '../../shared/reRunAssessmentContext';
import { resolveReRunTarget, type StartAttempt } from './assessTaskFlowData';
import type { useAssessTaskFlow } from './useAssessTaskFlow';

/**
 * The `useAssessTaskFlow` controls consumed by `useAssessTaskReRunFlow`.
 *
 * @remarks The selection-state setters are deliberately absent: the re-run
 * path records its attempt identity through `captureStartContext` (which
 * syncs the guard ref) instead of driving the assignment Select.
 */
type AssessTaskReRunControls = Pick<
  ReturnType<typeof useAssessTaskFlow>,
  | 'assignments'
  | 'fetchState'
  | 'assessmentState'
  | 'sessionReference'
  | 'captureStartContext'
  | 'isAttemptObsolete'
  | 'handleStartAssessmentError'
  | 'setAssessmentAsError'
  | 'setAssessmentState'
  | 'setAssessmentError'
  | 'settleAssessment'
>;

/**
 * Shared flow controls plus the re-run entry inputs, owned by `AssessTaskModal`.
 */
export type AssessTaskReRunHost = Readonly<{
  open: boolean;
  classId: string;
  reRunContext?: ReRunContext | null;
  flow: AssessTaskReRunControls;
}>;

/**
 * Retry affordance handed back to `AssessTaskModal` for the re-run footer.
 */
export type AssessTaskReRunRetry = Readonly<{
  /**
   * Re-validates the retained context and starts the run again. A no-op
   * unless a retryable failure is currently showing, so a permanently
   * blocked re-run can never start a second run.
   */
  retryReRun: () => void;
  /** True when the visible re-run failure can succeed on retry. */
  isRetryAvailable: boolean;
}>;

/**
 * Owns the explicit re-run entry: once the assignment fetch is ready it
 * validates the re-run context and starts exactly one assessment run with the
 * persisted definition key, skipping the selection and matching stages.
 *
 * @remarks The start is guarded by a processed-context key derived from the
 * modal session, the assignment and the definition key, so React StrictMode
 * double-effects and per-render callback identity changes cannot start a
 * second run. The session component of that key means a context an owner
 * retains across a close/reopen would start at most one new run for the new
 * session; `ClassPage` clears the context when it closes the modal, so a
 * reopened modal re-enters the manual selection path instead. Blocked
 * contexts fail closed through the flow's existing alert state; start
 * failures reuse `useAssessTaskFlow`'s error and stale-recovery handling,
 * and a retryable failure is exposed to the modal footer through
 * `retryReRun` / `isRetryAvailable`.
 *
 * @param {AssessTaskReRunHost} host The modal flags, class identifier, re-run entry and flow controls.
 * @returns {AssessTaskReRunRetry} The retry affordance for the modal footer; the automatic start is effect-driven.
 */
export function useAssessTaskReRunFlow(host: AssessTaskReRunHost): AssessTaskReRunRetry {
  const { open, classId, reRunContext, flow } = host;
  const {
    assignments,
    fetchState,
    assessmentState,
    sessionReference,
    captureStartContext,
    isAttemptObsolete,
    handleStartAssessmentError,
    setAssessmentAsError,
    setAssessmentState,
    setAssessmentError,
    settleAssessment,
  } = flow;
  const queryClient = useQueryClient();
  const processedContextReference = useRef<string | null>(null);
  const [isRetryAvailable, setIsRetryAvailable] = useState(false);

  /**
   * Starts the validated re-run assessment and settles the flow outcome.
   *
   * Shared by the automatic-start effect and Retry. Some flow handlers change
   * identity on render, so the session-keyed processed-context guard, rather
   * than callback identity, prevents the effect from starting a second run.
   *
   * @param {ReRunContext} context The assignment and persisted key to re-run.
   * @returns {Promise<void>} Resolves once the run request has settled.
   */
  const startReRun = useCallback(
    async (context: ReRunContext): Promise<void> => {
      const target = resolveReRunTarget({ context, assignments, queryClient });
      if (target.kind === 'blocked') {
        setIsRetryAvailable(target.retryable);
        setAssessmentAsError(target.alertType, target.message);
        return;
      }

      setIsRetryAvailable(false);
      const attempt: StartAttempt = {
        session: sessionReference.current,
        assignmentId: context.assignmentId,
      };
      setAssessmentState('loading');
      setAssessmentError(undefined);
      // Records the attempt identity: `captureStartContext` syncs the guard ref
      // so the obsolete guard tracks this run, while the selection state stays
      // untouched and the modal renders the re-run body instead of the Select.
      captureStartContext({
        definitionKey: target.definitionKey,
        assignmentId: context.assignmentId,
        courseId: classId,
      });

      try {
        await startAssessmentRun({
          definitionKey: target.definitionKey,
          assignmentId: context.assignmentId,
          courseId: classId,
        });

        if (isAttemptObsolete(attempt)) return;

        settleAssessment('success', `Assessment started for '${target.assignment.title}'.`);
      } catch (error: unknown) {
        if (isAttemptObsolete(attempt)) return;
        setIsRetryAvailable(true);
        handleStartAssessmentError(error);
      }
    },
    [
      assignments,
      queryClient,
      classId,
      sessionReference,
      captureStartContext,
      isAttemptObsolete,
      handleStartAssessmentError,
      setAssessmentAsError,
      setAssessmentState,
      setAssessmentError,
      settleAssessment,
    ]
  );

  useEffect(() => {
    if (!open || fetchState !== 'ready' || !reRunContext) return;

    const { assignmentId, definitionKey } = reRunContext;
    const contextKey = `${sessionReference.current}|${assignmentId}|${definitionKey ?? ''}`;
    if (processedContextReference.current === contextKey) return;
    processedContextReference.current = contextKey;

    void startReRun(reRunContext);
  }, [open, fetchState, reRunContext, startReRun, sessionReference]);

  /**
   * Retries the current re-run failure through the same validated start path.
   *
   * Gated on the retryable flag and the error state so a permanently blocked
   * re-run never starts, and an in-flight or already-settled attempt is never
   * started twice.
   *
   * @returns {void}
   */
  const retryReRun = useCallback((): void => {
    if (
      !isRetryAvailable ||
      assessmentState !== 'error' ||
      fetchState !== 'ready' ||
      !reRunContext
    ) {
      return;
    }
    void startReRun(reRunContext);
  }, [isRetryAvailable, assessmentState, fetchState, reRunContext, startReRun]);

  return { retryReRun, isRetryAvailable };
}
