import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Form, type FormInstance } from 'antd';
import { useMemo, useRef, useState } from 'react';
import { startAssessmentRun } from '../../../services/assignmentAssessment/assignmentAssessmentService';
import {
  getAssignmentDefinition,
  type AssignmentDefinition,
} from '../../../services/assignmentDefinition/assignmentDefinitionService';
import { DEFAULT_WEIGHTING_VALUE } from '../../../services/assignmentDefinition/assignmentDefinition.zod';
import { mapErrorToUserMessage } from '../../../errors/map-error-to-ui';
import { queryKeys } from '../../../query/queryKeys';
import {
  getAssignmentTopicsQueryOptions,
  getYearGroupsQueryOptions,
} from '../../../query/sharedQueries';
import { useWizardUpsertMutation } from '../../assignmentWizard/assignmentWizardMutation';
import { buildReparseRequest } from '../../assignmentWizard/assignmentWizardOrchestrator';
import {
  buildTopicOptions,
  buildYearGroupOptions,
  calculateDirtyState,
  hydrateFormFromDefinition,
  type DocumentChangeState,
  type TaskRow,
} from '../../assignmentWizard/assignmentWizardFormState';
import {
  buildRecoveryApprovalRequest,
  findResumeTitle,
  isApprovalNotReady,
  isGenerationObsolete,
  isSaveBlocked,
  readReviewFormValues,
  settleApprovalFailure,
  settleMissingCapture,
  settleResumeFailure,
  settleSaveThrow,
  type RecoveryPhase,
} from './assessTaskRecoveryData';
import type {
  AssessTaskAssignment,
  AssessmentAlertType,
  CapturedStartContext,
} from './assessTaskFlowData';

/** A single selectable reference-data option. */
type RecoverySelectOption = { value: string; label: string };

/** Fallback copy when a mutation returns no registry-mapped message. Uses the shared registry generic. */
const REPARSE_FAILED_FALLBACK_MESSAGE = mapErrorToUserMessage(null);

/**
 * Recovery state and handlers consumed by `AssessTaskRecoverySurface`.
 */
export type AssessTaskRecoveryFlow = Readonly<{
  phase: RecoveryPhase;
  errorMessage: string | null;
  saveErrorMessage: string | null;
  form: FormInstance;
  taskRows: TaskRow[];
  documentChange: DocumentChangeState;
  hasDirtyEdits: boolean;
  hasParsedTasks: boolean;
  isMutationBusy: boolean;
  showDiscardConfirm: boolean;
  topicOptions: RecoverySelectOption[];
  yearGroupOptions: RecoverySelectOption[];
  selectedTopicKey?: string;
  selectedYearGroupKey?: string;
  startUpdate: () => Promise<void>;
  cancelFlow: () => void;
  cancelReview: () => void;
  save: () => Promise<void>;
  handleTaskWeightingChange: (taskId: string, value: number | null) => void;
  handleDiscardConfirm: () => void;
  handleKeepEditing: () => void;
  onTopicEntityCreated: () => void;
  onYearGroupEntityCreated: () => void;
}>;

/**
 * Properties for the in-modal stale-recovery flow.
 */
export type AssessTaskRecoveryFlowProperties = Readonly<{
  definitionKey: string | null;
  capturedStartContext: CapturedStartContext | null;
  assignments: readonly AssessTaskAssignment[];
  onClose: () => void;
  endRecovery: () => void;
  settleAssessment: (alertType: AssessmentAlertType, message: string) => void;
}>;

/**
 * Owns the stale-definition recovery state machine for the owning
 * `AssessTaskModal`: the stale prompt, the forced reparse, the in-modal review
 * and the approval outcomes.
 *
 * @remarks
 * The `useAssessTaskFlow` recovery routing (`assessmentRecoveryState` and
 * `transitionToStaleRecovery`) remains the entry point; this hook is mounted by
 * `AssessTaskRecoverySurface` while that state is `stale-prompt`, so every
 * recovery entry starts from a fresh prompt with no reset effect. It reuses the
 * shared wizard mutation/error plumbing (`useWizardUpsertMutation`) and the
 * chrome-free review content so no recovery state stacks a second modal. A
 * forced reparse persists immediately: cancelling review discards only local
 * edits and never starts an assessment. Approval continues the original
 * assessment run with the captured `{definitionKey, assignmentId, courseId}`
 * context.
 *
 * @param {AssessTaskRecoveryFlowProperties} properties Recovery inputs and flow callbacks.
 * @returns {AssessTaskRecoveryFlow} Recovery phase, review state and handlers.
 */
export function useAssessTaskRecoveryFlow(
  properties: AssessTaskRecoveryFlowProperties
): AssessTaskRecoveryFlow {
  const {
    definitionKey,
    capturedStartContext,
    assignments,
    onClose,
    endRecovery,
    settleAssessment,
  } = properties;
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const { runUpsert, isMutationBusy } = useWizardUpsertMutation();
  const generationReference = useRef(0);

  const [phase, setPhase] = useState<RecoveryPhase>('stale-prompt');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [definition, setDefinition] = useState<AssignmentDefinition | null>(null);
  const [taskRows, setTaskRows] = useState<TaskRow[]>([]);
  const [hasParsedTasks, setHasParsedTasks] = useState(false);
  const [documentChange, setDocumentChange] = useState<DocumentChangeState>({
    hasPendingChange: false,
    previousReferenceUrl: '',
    previousTemplateUrl: '',
  });
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const { data: topics } = useQuery({
    ...getAssignmentTopicsQueryOptions(),
    enabled: phase === 'review',
  });
  const { data: yearGroups } = useQuery({
    ...getYearGroupsQueryOptions(),
    enabled: phase === 'review',
  });

  const topicOptions = useMemo(() => buildTopicOptions(topics), [topics]);
  const yearGroupOptions = useMemo(() => buildYearGroupOptions(yearGroups), [yearGroups]);

  const watchedFormValues = Form.useWatch([], form);
  const formValues = useMemo(() => watchedFormValues ?? {}, [watchedFormValues]);
  const hasDirtyEdits = useMemo(
    () => calculateDirtyState(formValues, null, definition, taskRows, false, true),
    [formValues, definition, taskRows]
  );

  /**
   * Loads the stale definition to reparse. A load failure never falls back to
   * the create flow.
   *
   * @param {string} key The stale definition key.
   * @param {number} generation The attempt generation guarding obsolete completions.
   * @returns {Promise<AssignmentDefinition | null>} The loaded definition, or null on failure/obsolete.
   */
  async function loadStaleDefinition(
    key: string,
    generation: number
  ): Promise<AssignmentDefinition | null> {
    try {
      return await getAssignmentDefinition({ definitionKey: key });
    } catch (error: unknown) {
      if (generation !== generationReference.current) return null;
      setErrorMessage(mapErrorToUserMessage(error));
      setPhase('failed');
      return null;
    }
  }

  /**
   * Issues exactly one forced reparse for the loaded definition and opens the
   * review surface on success.
   *
   * @param {AssignmentDefinition} loaded The loaded stale definition.
   * @param {number} generation The attempt generation guarding obsolete completions.
   * @returns {Promise<void>}
   */
  async function reparseLoadedDefinition(
    loaded: AssignmentDefinition,
    generation: number
  ): Promise<void> {
    const request = buildReparseRequest(loaded);
    const result = await runUpsert(request, {
      contextName: 'AssessTaskRecoveryFlow.startUpdate',
      errorContext: {
        mode: 'update',
        definitionKey,
        actionType: 'reparse',
      },
    });
    if (generation !== generationReference.current) return;
    if (result.errorMessage !== null || result.response === undefined) {
      setErrorMessage(result.errorMessage ?? REPARSE_FAILED_FALLBACK_MESSAGE);
      setPhase('failed');
      return;
    }

    setDefinition(result.response);
    hydrateFormFromDefinition(
      form,
      result.response,
      setTaskRows,
      setHasParsedTasks,
      setDocumentChange
    );
    setPhase('review');
  }

  /**
   * Loads the stale definition, then issues exactly one forced reparse.
   * Unexpected failures settle to the blocking failure treatment instead of
   * rejecting, so the surface `void` call never produces an unhandled rejection.
   *
   * @returns {Promise<void>} Resolves when the reparse attempt settles.
   */
  async function startUpdate(): Promise<void> {
    if (definitionKey === null) return;
    const generation = generationReference.current + 1;
    generationReference.current = generation;
    setPhase('reparsing');
    setErrorMessage(null);
    setSaveErrorMessage(null);

    try {
      const loaded = await loadStaleDefinition(definitionKey, generation);
      if (loaded === null) return;
      await reparseLoadedDefinition(loaded, generation);
    } catch (error: unknown) {
      if (generation !== generationReference.current) return;
      setErrorMessage(mapErrorToUserMessage(error));
      setPhase('failed');
    }
  }

  /**
   * Abandons recovery from a prompt/reparsing/failure state and closes the
   * owning modal (SPEC decision 1: Cancel must not open the choice prompt).
   *
   * @returns {void}
   */
  function cancelFlow(): void {
    generationReference.current += 1;
    setShowDiscardConfirm(false);
    endRecovery();
    onClose();
  }

  /**
   * Ends recovery from the review surface, discarding only unsaved edits and
   * leaving the owning modal open on the selection body.
   *
   * @returns {void}
   */
  function endReview(): void {
    generationReference.current += 1;
    setShowDiscardConfirm(false);
    endRecovery();
  }

  /**
   * Handles review cancel: dirty edits require the wizard's discard
   * confirmation before recovery ends.
   *
   * @returns {void}
   */
  function cancelReview(): void {
    if (hasDirtyEdits) {
      setShowDiscardConfirm(true);
      return;
    }
    endReview();
  }

  /**
   * Confirms discarding review edits and ends recovery on the selection body.
   *
   * @returns {void}
   */
  function handleDiscardConfirm(): void {
    endReview();
  }

  /**
   * Keeps editing after the discard confirmation is dismissed.
   *
   * @returns {void}
   */
  function handleKeepEditing(): void {
    setShowDiscardConfirm(false);
  }

  /**
   * Resumes the original assessment run with the captured identifiers after a
   * successful approval save. A repeated stale response returns to the prompt
   * without an automatic recovery loop. A cancelled review never settles.
   *
   * @param {string} key The approved definition key.
   * @param {number} generation The save generation guarding obsolete completions.
   * @returns {Promise<void>}
   */
  async function resumeAssessment(key: string, generation: number): Promise<void> {
    if (capturedStartContext === null) {
      settleMissingCapture(key, generation, generationReference.current, settleAssessment);
      return;
    }
    if (isGenerationObsolete(generation, generationReference.current)) return;
    const captured = capturedStartContext;
    try {
      await startAssessmentRun({
        definitionKey: key,
        assignmentId: captured.assignmentId,
        courseId: captured.courseId,
      });
      if (isGenerationObsolete(generation, generationReference.current)) return;
      settleAssessment(
        'success',
        `Assessment started for '${findResumeTitle(assignments, captured.assignmentId)}'.`
      );
    } catch (error: unknown) {
      settleResumeFailure(
        error,
        generation,
        generationReference.current,
        setPhase,
        settleAssessment
      );
    }
  }

  /**
   * Saves the reviewed definition. A stale rejection returns to the stale
   * prompt; any other failure keeps the review edits and surfaces an error.
   * Expected form-validation rejections settle deliberately without surfacing
   * a save error. A cancelled review never resumes the assessment.
   *
   * @returns {Promise<void>}
   */
  async function save(): Promise<void> {
    if (isSaveBlocked(definition, isMutationBusy)) return;
    const generation = generationReference.current;
    setSaveErrorMessage(null);
    const values = await readReviewFormValues(form);
    if (isApprovalNotReady(values, generation, generationReference.current)) return;
    try {
      const currentDefinition = definition;
      if (currentDefinition === null) return;
      const request = buildRecoveryApprovalRequest(currentDefinition, values, taskRows);
      const result = await runUpsert(request, {
        contextName: 'AssessTaskRecoveryFlow.save',
        errorContext: {
          mode: 'update',
          definitionKey,
          actionType: 'save',
        },
      });
      if (isGenerationObsolete(generation, generationReference.current)) return;
      if (settleApprovalFailure(result, setErrorMessage, setPhase, setSaveErrorMessage)) return;
      await resumeAssessment(currentDefinition.definitionKey, generation);
    } catch (error: unknown) {
      settleSaveThrow(error, generation, generationReference.current, setSaveErrorMessage);
    }
  }

  /**
   * Updates the edited task weighting in the review rows.
   *
   * @param {string} taskId The edited task identifier.
   * @param {number | null} value The new weighting value.
   * @returns {void}
   */
  function handleTaskWeightingChange(taskId: string, value: number | null): void {
    setTaskRows((previous) =>
      previous.map((row) =>
        row.taskId === taskId ? { ...row, taskWeighting: value ?? DEFAULT_WEIGHTING_VALUE } : row
      )
    );
  }

  const onTopicEntityCreated = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.assignmentTopics() });
  };

  const onYearGroupEntityCreated = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.yearGroups() });
  };

  return {
    phase,
    errorMessage,
    saveErrorMessage,
    form,
    taskRows,
    documentChange,
    hasDirtyEdits,
    hasParsedTasks,
    isMutationBusy,
    showDiscardConfirm,
    topicOptions,
    yearGroupOptions,
    selectedTopicKey: definition?.primaryTopicKey,
    selectedYearGroupKey: definition?.yearGroupKey,
    startUpdate,
    cancelFlow,
    cancelReview,
    save,
    handleTaskWeightingChange,
    handleDiscardConfirm,
    handleKeepEditing,
    onTopicEntityCreated,
    onYearGroupEntityCreated,
  };
}
