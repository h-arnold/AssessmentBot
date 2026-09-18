import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getGoogleClassroomAssignments } from '../../../services/googleClassrooms/googleClassroomAssignmentsService';
import { findMatchingDefinition } from './matchDefinitionForAssignment';
import { startAssessmentRun } from '../../../services/assignmentAssessment/assignmentAssessmentService';
import { ApiTransportError } from '../../../errors/apiTransportError';
import { queryKeys } from '../../../query/queryKeys';
import { useAssessTaskLinkFlow } from './useAssessTaskLinkFlow';
import { useAssessTaskCreateFlow } from './useAssessTaskCreateFlow';
import {
  getValidatedCachedData,
  type AssessTaskAssignment,
  type AssessmentAlertType,
  type AssessmentFetchState,
  type AssessmentState,
  type CapturedStartContext,
  type NoMatchResolution,
  type StartAttempt,
} from './assessTaskFlowData';

export type AssessTaskFlowParameters = Readonly<{
  open: boolean;
  classId: string;
}>;

export type AssessmentRecoveryState = 'idle' | 'stale-prompt';

/**
 * Owns the AssessTaskModal state machines and API flows: assignment fetching,
 * the assessment lifecycle, the no-match choice/create resolution, the
 * captured assessment-start context, and the stale-recovery transitions.
 *
 * @remarks This hook exists because SPEC.md mandates decomposing the 955-line
 * `AssessTaskModal.tsx` before recovery behaviour lands: the rendering
 * component stays declarative while this module owns both state machines
 * (matching/linking flow plus the captured start context) and the
 * stale-recovery transitions. Sections 7–9 consume the stub recovery
 * contract (`assessmentRecoveryState` / `transitionToStaleRecovery`) and the
 * captured start context (`{definitionKey, assignmentId, courseId}`) without
 * rematching cached titles or relying on error details surviving the generic
 * envelope schema. The stale-prompt state currently renders nothing of
 * itself (Section 9 adds the recovery UI); it only routes.
 *
 * The link-to-existing-definition flow lives in `useAssessTaskLinkFlow` and
 * the create-new-definition flow in `useAssessTaskCreateFlow` (both composed
 * here) so this module stays below the 500-line gate; pure derivations,
 * shared flow contracts and cache validation live in `assessTaskFlowData`,
 * with link-payload derivation in `assessTaskLinkPayload`.
 *
 * @param {AssessTaskFlowParameters} parameters The modal open flag and class identifier.
 * @returns {object} The flow state and handlers consumed by `AssessTaskModal`.
 */
export function useAssessTaskFlow(parameters?: AssessTaskFlowParameters) {
  const { open = false, classId = '' } = parameters ?? {};
  const queryClient = useQueryClient();

  const [assignments, setAssignments] = useState<AssessTaskAssignment[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | undefined>();
  const [fetchState, setFetchState] = useState<AssessmentFetchState>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [assessmentState, setAssessmentState] = useState<AssessmentState>('idle');
  const [assessmentError, setAssessmentError] = useState<string | undefined>();
  const [assessmentAlertType, setAssessmentAlertType] = useState<AssessmentAlertType>('error');
  const [noMatchResolution, setNoMatchResolution] = useState<NoMatchResolution>('idle');
  const [selectedAssignmentForChoice, setSelectedAssignmentForChoice] =
    useState<AssessTaskAssignment | null>(null);
  const [assessmentRecoveryState, setAssessmentRecoveryState] =
    useState<AssessmentRecoveryState>('idle');
  const [recoveryDefinitionKey, setRecoveryDefinitionKey] = useState<string | null>(null);
  const [capturedStartContext, setCapturedStartContext] = useState<CapturedStartContext | null>(
    null
  );

  // Attempt tracking for the obsolete-completion guard. The session increments
  // on every modal open; an async completion whose session or assignment no
  // longer matches the current selection is obsolete and must not mutate state.
  const sessionReference = useRef(0);
  const selectedAssignmentIdReference = useRef<string | undefined>(undefined);
  const pendingStartContextReference = useRef<CapturedStartContext | null>(null);

  /**
   * Records the attempted start context in state (for Sections 7–9 consumers)
   * and in a ref (for stale-routing inside async catch blocks, where state
   * reads would be stale).
   *
   * @param {CapturedStartContext} context The attempted definition, assignment and course identifiers.
   * @returns {void}
   */
  function captureStartContext(context: CapturedStartContext): void {
    pendingStartContextReference.current = context;
    setCapturedStartContext(context);
  }

  /**
   * Reads the pending start context captured before the latest
   * `startAssessmentRun` call.
   *
   * @returns {CapturedStartContext | null} The pending start context, if one was captured.
   */
  function getPendingStartContext(): CapturedStartContext | null {
    return pendingStartContextReference.current;
  }

  /**
   * Reports whether an assessment-start attempt is obsolete: the modal was
   * closed and reopened, or the selection moved on since the attempt began.
   * Obsolete completions must not mutate the new session's state.
   *
   * @param {StartAttempt} attempt The session and assignment captured when the attempt began.
   * @returns {boolean} True when the completion must be ignored.
   */
  function isAttemptObsolete(attempt: StartAttempt): boolean {
    return (
      sessionReference.current !== attempt.session ||
      selectedAssignmentIdReference.current !== attempt.assignmentId
    );
  }

  /**
   * Sets error state with the given alert type and message.
   *
   * @param {AssessmentAlertType} alertType The alert type (success, error, warning).
   * @param {string} message The user-facing error message.
   * @returns {void}
   */
  function setAssessmentAsError(alertType: AssessmentAlertType, message: string): void {
    setAssessmentAlertType(alertType);
    setAssessmentError(message);
    setAssessmentState('error');
  }

  /**
   * Transitions the flow to stale-recovery routing after a DEFINITION_STALE
   * error from `startAssessmentRun`.
   *
   * @remarks
   * Invalidates the assignment definition partials cache to ensure later
   * recovery steps read fresh data, then moves the recovery state machine to
   * `'stale-prompt'`. It deliberately does NOT select
   * `noMatchResolution === 'creating'`: the stacked create wizard must not
   * mount on DEFINITION_STALE, so the genuine create path keeps sole
   * ownership of the `'creating'` state. No recovery UI renders yet
   * (Section 9); the stale-prompt state only routes.
   *
   * @param {string} definitionKey The stale definition key to recover.
   * @returns {void}
   */
  function transitionToStaleRecovery(definitionKey: string): void {
    queryClient.invalidateQueries({ queryKey: queryKeys.assignmentDefinitionPartials() });
    setRecoveryDefinitionKey(definitionKey);
    setCapturedStartContext((previous) =>
      previous === null ? previous : { ...previous, definitionKey }
    );
    setAssessmentRecoveryState('stale-prompt');
    setAssessmentState('idle');
    setAssessmentError(undefined);
  }

  const linkFlow = useAssessTaskLinkFlow({
    classId,
    noMatchResolution,
    selectedAssignmentForChoice,
    sessionReference,
    selectedAssignmentIdReference,
    setAssessmentState,
    setAssessmentError,
    setAssessmentAlertType,
    setNoMatchResolution,
    setAssessmentAsError,
    captureStartContext,
    getPendingStartContext,
    isAttemptObsolete,
    transitionToStaleRecovery,
  });

  const { resetLinkSelection } = linkFlow;

  const {
    selectedDefinitionForLink,
    linkableDefinitions,
    handleLinkExistingDefinition,
    handleLinkConfirm,
    handleLinkCancel,
    handleLinkSelect,
  } = linkFlow;

  const createFlow = useAssessTaskCreateFlow({
    classId,
    noMatchResolution,
    assignments,
    selectedAssignmentId,
    sessionReference,
    selectedAssignmentIdReference,
    setNoMatchResolution,
    setAssessmentState,
    setAssessmentError,
    setAssessmentAlertType,
    setAssessmentAsError,
    captureStartContext,
    isAttemptObsolete,
    handleApiError,
  });

  const { resetCreateState } = createFlow;

  const {
    wizardInitialValues,
    handleCreateNewDefinition,
    handleWizardCreateSuccess,
    handleWizardClose,
  } = createFlow;

  /**
   * Fetches Google Classroom assignments when the modal opens.
   *
   * @remarks
   * Uses a cancelled flag to gate setState calls after the modal has been
   * closed mid-fetch. The underlying service call is not aborted because
   * google.script.run does not support cancellation.
   */
  useEffect(() => {
    let cancelled = false;

    if (!open) return;

    sessionReference.current += 1;
    selectedAssignmentIdReference.current = undefined;
    pendingStartContextReference.current = null;

    getGoogleClassroomAssignments(classId)
      .then((data) => {
        if (!cancelled) {
          // Reset both state machines on modal open (SPEC.md transition rule 0)
          setNoMatchResolution('idle');
          setSelectedAssignmentForChoice(null);
          resetCreateState();
          resetLinkSelection();
          setAssessmentState('idle');
          setAssessmentError(undefined);
          setAssessmentRecoveryState('idle');
          setRecoveryDefinitionKey(null);
          setCapturedStartContext(null);
          setSelectedAssignmentId(undefined);
          setAssignments(data);
          setFetchState('ready');
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          // Reset state machines even on fetch failure
          setNoMatchResolution('idle');
          setSelectedAssignmentForChoice(null);
          resetCreateState();
          resetLinkSelection();
          setAssessmentState('idle');
          setAssessmentError(undefined);
          setAssessmentRecoveryState('idle');
          setRecoveryDefinitionKey(null);
          setCapturedStartContext(null);
          setSelectedAssignmentId(undefined);
          const message = error instanceof Error ? error.message : 'Failed to fetch assignments';
          setErrorMessage(message);
          setFetchState('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, classId, resetLinkSelection, resetCreateState]);

  /**
   * Resolves the currently selected assignment when the flow is ready to
   * start. Returns null when nothing is selected, the fetch is not ready, or
   * the selection no longer matches a fetched assignment.
   *
   * @returns {AssessTaskAssignment | null} The selected assignment, if resolvable.
   */
  function resolveSelectedAssignment(): AssessTaskAssignment | null {
    if (!selectedAssignmentId || fetchState !== 'ready') return null;
    return assignments.find((a) => a.assignmentId === selectedAssignmentId) ?? null;
  }

  /**
   * Handles the Start Assessment click: validates selection, reads cache,
   * runs matching, and starts the assessment run via the API.
   *
   * @returns {Promise<void>}
   */
  async function handleStartAssessment(): Promise<void> {
    const selectedAssignment = resolveSelectedAssignment();
    if (!selectedAssignment) return;

    // Read the attempt identity from the same ref the obsolete guard
    // compares against, so the guard source is uniform across all flows.
    // The ref stays in lock-step with `selectedAssignmentId` state (both
    // writers update them together), and this call site runs after the
    // ref sync, so behaviour is unchanged.
    const attemptAssignmentId = selectedAssignmentIdReference.current;
    if (attemptAssignmentId === undefined) return;

    if (selectedAssignment.topicName === null) {
      // The matcher cannot match (definitions always have topics), but the
      // user can still link to an existing definition or create a new one.
      setNoMatchResolution('choice');
      setAssessmentState('idle');
      setAssessmentError(undefined);
      setSelectedAssignmentForChoice(selectedAssignment);
      return;
    }

    setAssessmentState('loading');
    setAssessmentError(undefined);

    const attempt: StartAttempt = {
      session: sessionReference.current,
      assignmentId: attemptAssignmentId,
    };

    try {
      const cached = getValidatedCachedData(queryClient, classId);
      if (cached.kind === 'cache-error') {
        setAssessmentAsError(cached.alertType, cached.message);
        return;
      }

      const { classPartial, definitionPartials } = cached;

      const matchResult = findMatchingDefinition(
        selectedAssignment,
        classPartial,
        definitionPartials
      );
      await handleMatchOutcome(matchResult, selectedAssignment, attempt);
    } catch (error: unknown) {
      if (isAttemptObsolete(attempt)) return;
      handleStartAssessmentError(error);
    }
  }

  /**
   * Handles the match result: no-match, ambiguous, or matched (API call).
   *
   * @param {ReturnType<typeof findMatchingDefinition>} matchResult The match result.
   * @param {AssessTaskAssignment} selectedAssignment The selected assignment.
   * @param {StartAttempt} attempt The session and assignment captured when the attempt began.
   * @returns {Promise<void>}
   */
  async function handleMatchOutcome(
    matchResult: ReturnType<typeof findMatchingDefinition>,
    selectedAssignment: AssessTaskAssignment,
    attempt: StartAttempt
  ): Promise<void> {
    if (matchResult.kind === 'no-match') {
      setNoMatchResolution('choice');
      setAssessmentState('idle');
      setAssessmentError(undefined);
      setSelectedAssignmentForChoice(selectedAssignment);
      return;
    }

    if (matchResult.kind === 'ambiguous') {
      setAssessmentAsError(
        'error',
        'Multiple definitions match this assignment. Ensure definition titles are unique per topic and year group.'
      );
      return;
    }

    // Matched — capture the start context, then call the API. Both read the
    // attempt identity (itself captured from `selectedAssignmentIdReference`)
    // so the captured context matches the obsolete-guard comparison source.
    captureStartContext({
      definitionKey: matchResult.definition.definitionKey,
      assignmentId: attempt.assignmentId,
      courseId: classId,
    });

    await startAssessmentRun({
      definitionKey: matchResult.definition.definitionKey,
      assignmentId: attempt.assignmentId,
      courseId: classId,
    });

    if (isAttemptObsolete(attempt)) return;

    setAssessmentAlertType('success');
    setAssessmentError(`Assessment started for '${selectedAssignment.title}'.`);
    setAssessmentState('success');
  }

  /**
   * Handles errors from the assessment run API call.
   *
   * @param {unknown} error The caught error.
   * @returns {void}
   */
  function handleApiError(error: unknown): void {
    if (error instanceof ApiTransportError && error.code === 'DEFINITION_STALE') {
      setAssessmentAsError('warning', error.message);
    } else if (error instanceof Error) {
      setAssessmentAsError('error', error.message);
    } else {
      setAssessmentAsError('error', 'An unexpected error occurred.');
    }
  }

  /**
   * Handles errors from the matched-flow `handleStartAssessment` catch block.
   *
   * @remarks
   * Dispatches `DEFINITION_STALE` errors to the stale-recovery routing
   * transition and all other errors to `handleApiError`. The stale definition
   * key is read from the captured start context (via ref, since state reads
   * would be stale inside the async catch block).
   *
   * Extracted from `handleStartAssessment` to keep its cyclomatic complexity
   * within the project's lint limit.
   *
   * @param {unknown} error The caught error.
   * @returns {void}
   */
  function handleStartAssessmentError(error: unknown): void {
    if (error instanceof ApiTransportError && error.code === 'DEFINITION_STALE') {
      const pendingDefinitionKey = pendingStartContextReference.current?.definitionKey;
      if (pendingDefinitionKey !== undefined) {
        transitionToStaleRecovery(pendingDefinitionKey);
        return;
      }
    }
    handleApiError(error);
  }

  const handleAssignmentChange = useCallback((value: string) => {
    selectedAssignmentIdReference.current = value;
    setSelectedAssignmentId(value);
  }, []);

  const isStartDisabled =
    fetchState !== 'ready' || selectedAssignmentId === undefined || assessmentState === 'loading';

  /**
   * Determines the loading button label for the footer during assessment loading.
   *
   * @remarks Per the layout spec, the loading-state button label is "Link"
   * (matching the action the user initiated) not "Start Assessment" (which
   * is the matched-path label and would be misleading for the link flow).
   *
   * @returns {string} 'Link' when in the linking flow, 'Start Assessment' otherwise.
   */
  function getLoadingButtonLabel(): string {
    return noMatchResolution === 'linking' ? 'Link' : 'Start Assessment';
  }

  return {
    assignments,
    selectedAssignmentId,
    fetchState,
    errorMessage,
    assessmentState,
    assessmentError,
    assessmentAlertType,
    noMatchResolution,
    selectedAssignmentForChoice,
    selectedDefinitionForLink,
    assessmentRecoveryState,
    recoveryDefinitionKey,
    capturedStartContext,
    wizardInitialValues,
    linkableDefinitions,
    isStartDisabled,
    handleStartAssessment,
    handleCreateNewDefinition,
    handleLinkExistingDefinition,
    handleLinkConfirm,
    handleLinkCancel,
    handleWizardCreateSuccess,
    handleWizardClose,
    handleAssignmentChange,
    handleLinkSelect,
    getLoadingButtonLabel,
    transitionToStaleRecovery,
  };
}
