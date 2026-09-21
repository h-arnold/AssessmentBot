import { useQueryClient } from '@tanstack/react-query';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { startAssessmentRun } from '../../../services/assignmentAssessment/assignmentAssessmentService';
import { queryKeys } from '../../../query/queryKeys';
import type { ClassPartial } from '../../../services/googleClassrooms/classPartials.zod';
import type { AssignmentTopic } from '../../../services/referenceData/referenceData.zod';
import {
  deriveWizardInitialValues,
  type AssessTaskAssignment,
  type AssessmentAlertType,
  type AssessmentState,
  type CapturedStartContext,
  type NoMatchResolution,
  type StartAttempt,
} from './assessTaskFlowData';

/**
 * Shared flow controls owned by `useAssessTaskFlow` and consumed by the
 * create flow. Passed as a single documented host contract so the create
 * state machine stays in its own module without duplicating the assessment
 * state machine.
 */
export type AssessTaskCreateHost = {
  classId: string;
  noMatchResolution: NoMatchResolution;
  assignments: readonly AssessTaskAssignment[];
  selectedAssignmentId: string | undefined;
  sessionReference: { current: number };
  selectedAssignmentIdReference: { current: string | undefined };
  setNoMatchResolution: Dispatch<SetStateAction<NoMatchResolution>>;
  setAssessmentState: Dispatch<SetStateAction<AssessmentState>>;
  setAssessmentError: Dispatch<SetStateAction<string | undefined>>;
  setAssessmentAlertType: Dispatch<SetStateAction<AssessmentAlertType>>;
  setAssessmentAsError: (alertType: AssessmentAlertType, message: string) => void;
  captureStartContext: (context: CapturedStartContext) => void;
  isAttemptObsolete: (attempt: StartAttempt) => boolean;
  handleApiError: (error: unknown) => void;
};

/**
 * One auto-assessment start scheduled after a successful create-path save.
 *
 * @remarks The start is queued as state (not called inline) so the in-modal
 * wizard content unmounts before `startAssessmentRun` is observed, preserving
 * the sequencing contract the previous `flushSync` choreography provided.
 */
type PendingAutoStart = {
  definitionKey: string;
  assignmentId: string;
  courseId: string;
  assignmentTitle: string;
  attempt: StartAttempt;
};

/**
 * Owns the create-new-definition flow: the wizard initial values, the
 * create-success auto-assessment sequence, and the wizard close routing.
 *
 * @remarks Extracted from the assessment orchestration hook so that hook stays
 * below the 500-line gate. The assessment lifecycle states themselves
 * (`assessmentState`, `noMatchResolution`) remain owned by
 * `useAssessTaskFlow` and are driven through the host contract — this module
 * never duplicates them. Section 8 converts this path to in-modal rendering:
 * the create-success start is queued as state so the wizard content unmounts
 * before the auto-assessment API call begins.
 *
 * @param {AssessTaskCreateHost} host The shared flow controls owned by `useAssessTaskFlow`.
 * @returns {object} The create state and handlers consumed by `AssessTaskModal` via the orchestration hook.
 */
export function useAssessTaskCreateFlow(host: AssessTaskCreateHost) {
  const {
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
  } = host;
  const queryClient = useQueryClient();

  const [pendingAutoStart, setPendingAutoStart] = useState<PendingAutoStart | null>(null);
  const autoStartHandledReference = useRef(false);

  // Read cached data for wizard pre-population
  const assignmentTopics = queryClient.getQueryData<AssignmentTopic[]>(
    queryKeys.assignmentTopics()
  );
  const classPartialsFromCache = queryClient.getQueryData<ClassPartial[]>(
    queryKeys.classPartials()
  );
  const yearGroupKey = classPartialsFromCache?.find((cp) => cp.classId === classId)?.yearGroupKey;

  const wizardInitialValues = useMemo(
    () =>
      deriveWizardInitialValues({
        noMatchResolution,
        assignments,
        selectedAssignmentId,
        assignmentTopics,
        yearGroupKey,
      }),
    [noMatchResolution, selectedAssignmentId, assignments, assignmentTopics, yearGroupKey]
  );

  /**
   * Resets the create-path state when the modal reopens. Stable across
   * renders so the owning flow can depend on it in its fetch effect.
   *
   * @returns {void}
   */
  const resetCreateState = useCallback((): void => {
    autoStartHandledReference.current = false;
    setPendingAutoStart(null);
  }, []);

  /**
   * Transitions to the 'creating' state when the user clicks
   * "Create New Definition" in the choice prompt.
   *
   * @returns {void}
   */
  function handleCreateNewDefinition(): void {
    setNoMatchResolution('creating');
  }

  /**
   * Runs one queued auto-assessment start using the captured identifiers.
   *
   * @remarks Called only from the commit effect below, after the in-modal
   * wizard content has unmounted, so `startAssessmentRun` is never observed
   * while the review content is mounted.
   *
   * @param {PendingAutoStart} pending The queued start identifiers and attempt.
   * @returns {Promise<void>}
   */
  const performAutoStart = useCallback(
    async (pending: PendingAutoStart): Promise<void> => {
      try {
        await startAssessmentRun({
          definitionKey: pending.definitionKey,
          assignmentId: pending.assignmentId,
          courseId: pending.courseId,
        });

        if (isAttemptObsolete(pending.attempt)) return;

        setNoMatchResolution('idle');
        setAssessmentAlertType('success');
        setAssessmentError(`Assessment started for '${pending.assignmentTitle}'.`);
        setAssessmentState('success');
      } catch (error: unknown) {
        if (isAttemptObsolete(pending.attempt)) return;
        setNoMatchResolution('idle');
        handleApiError(error);
      }
    },
    [
      isAttemptObsolete,
      handleApiError,
      setNoMatchResolution,
      setAssessmentAlertType,
      setAssessmentError,
      setAssessmentState,
    ]
  );

  // Starts the queued auto-assessment only after the commit that unmounts the
  // in-modal wizard content. The ref guards the React StrictMode double-effect
  // invocation so a single save cannot start two assessment runs.
  useEffect(() => {
    if (pendingAutoStart === null || autoStartHandledReference.current) return;
    autoStartHandledReference.current = true;
    setPendingAutoStart(null);
    void performAutoStart(pendingAutoStart);
  }, [pendingAutoStart, performAutoStart]);

  /**
   * Handles the wizard's onCreateSuccess callback — captures the start context
   * and queues the auto-assessment run using the newly created definition key.
   *
   * @remarks
   * Setting `assessmentState = 'loading'` unmounts the in-modal wizard content
   * in the next commit; the effect above then starts the assessment run, so the
   * sequencing contract (start observed with wizard content unmounted) holds
   * without the previous stacked-modal `flushSync` choreography.
   *
   * @param {string} definitionKey The key of the newly created definition.
   * @returns {void}
   */
  function handleWizardCreateSuccess(definitionKey: string): void {
    const attemptAssignmentId = selectedAssignmentIdReference.current;
    if (attemptAssignmentId === undefined) {
      setNoMatchResolution('idle');
      setAssessmentAsError('error', 'Selected assignment not found. Please try again.');
      return;
    }

    const selectedAssignment = assignments.find((a) => a.assignmentId === attemptAssignmentId);
    if (!selectedAssignment) {
      setNoMatchResolution('idle');
      setAssessmentAsError('error', 'Selected assignment not found. Please try again.');
      return;
    }

    captureStartContext({
      definitionKey,
      assignmentId: selectedAssignment.assignmentId,
      courseId: classId,
    });

    autoStartHandledReference.current = false;
    setAssessmentState('loading');
    setAssessmentError(undefined);
    setPendingAutoStart({
      definitionKey,
      assignmentId: selectedAssignment.assignmentId,
      courseId: classId,
      assignmentTitle: selectedAssignment.title,
      attempt: {
        session: sessionReference.current,
        assignmentId: attemptAssignmentId,
      },
    });
  }

  /**
   * Handles the in-modal review cancel, returning the owning modal to the
   * no-match choice prompt. In-modal, the wizard content only closes through
   * this explicit user cancel, so a close always means "return to choice".
   *
   * @returns {void}
   */
  function handleWizardClose(): void {
    setNoMatchResolution('choice');
  }

  return {
    wizardInitialValues,
    resetCreateState,
    handleCreateNewDefinition,
    handleWizardCreateSuccess,
    handleWizardClose,
  };
}
