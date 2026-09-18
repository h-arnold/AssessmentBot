import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { flushSync } from 'react-dom';
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
 * Owns the create-new-definition flow: the wizard initial values, the
 * create-success auto-assessment sequence, and the wizard close routing.
 *
 * @remarks Extracted from the assessment orchestration hook so that hook stays
 * below the 500-line gate. The assessment lifecycle states themselves
 * (`assessmentState`, `noMatchResolution`) remain owned by
 * `useAssessTaskFlow` and are driven through the host contract — this module
 * never duplicates them. Section 8 converts this path to in-modal rendering.
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

  const [hasCreateSucceeded, setHasCreateSucceeded] = useState(false);

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
   * Resets the create success flag when the modal reopens. Stable across
   * renders so the owning flow can depend on it in its fetch effect.
   *
   * @returns {void}
   */
  const resetCreateState = useCallback((): void => {
    setHasCreateSucceeded(false);
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
   * Handles the wizard's onCreateSuccess callback — kicks off the
   * assessment run using the newly created definition key.
   *
   * @remarks
   * Uses `flushSync` to synchronously unmount the wizard before the
   * auto-assessment API call begins. React 18's automatic batching would
   * defer the `assessmentState` update to the next microtask, causing the
   * wizard to remain mounted during the API call. `flushSync` forces
   * the state update to flush synchronously so the wizard unmounts
   * immediately and the body remains hidden per SPEC.md §250.
   *
   * The state transition sequence:
   * 1. `hasCreateSucceeded = true`, `assessmentState = 'loading'` (sync flush)
   * 2. `startAssessmentRun` API call
   * 3a. Success: `noMatchResolution = 'idle'`, `assessmentState = 'success'`
   * 3b. Failure: `noMatchResolution = 'idle'`, `assessmentState = 'error'`
   *
   * @param {string} definitionKey The key of the newly created definition.
   * @returns {Promise<void>}
   */
  async function handleWizardCreateSuccess(definitionKey: string): Promise<void> {
    // Use flushSync so the wizard is unmounted synchronously before the
    // auto-assessment API call begins (React 18 batching would otherwise
    // defer the unmount to the next microtask).
    flushSync(() => {
      setHasCreateSucceeded(true);
      setAssessmentState('loading');
      setAssessmentError(undefined);
    });

    const attemptAssignmentId = selectedAssignmentIdReference.current;
    if (attemptAssignmentId === undefined) {
      setNoMatchResolution('idle');
      setAssessmentAsError('error', 'Selected assignment not found. Please try again.');
      return;
    }

    const attempt: StartAttempt = {
      session: sessionReference.current,
      assignmentId: attemptAssignmentId,
    };

    try {
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

      await startAssessmentRun({
        definitionKey,
        assignmentId: selectedAssignment.assignmentId,
        courseId: classId,
      });

      if (isAttemptObsolete(attempt)) return;

      setNoMatchResolution('idle');
      setAssessmentAlertType('success');
      setAssessmentError(`Assessment started for '${selectedAssignment.title}'.`);
      setAssessmentState('success');
    } catch (error: unknown) {
      if (isAttemptObsolete(attempt)) return;
      setNoMatchResolution('idle');
      handleApiError(error);
    }
  }

  /**
   * Handles wizard close — if the wizard closed without onCreateSuccess
   * having fired (i.e., user cancelled), return to the choice state.
   *
   * @remarks
   * Uses the `hasCreateSucceeded` flag to distinguish the two close paths
   * from the wizard per SPEC.md §189:
   * - **Wizard success**: `onCreateSuccess` fires first, setting
   *   `hasCreateSucceeded = true`; when the wizard subsequently unmounts
   *   and `onClose` fires, this handler returns early — the assessment
   *   state machine handles the transition.
   * - **Wizard cancel**: `onClose` fires without `onCreateSuccess` having
   *   been called; `hasCreateSucceeded` is still `false`, so the handler
   *   transitions `noMatchResolution` back to `'choice'`.
   *
   * @returns {void}
   */
  function handleWizardClose(): void {
    if (hasCreateSucceeded) {
      // Wizard closed after success — assessment state handles the transition
      return;
    }
    // Wizard cancelled — return to choice state
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
