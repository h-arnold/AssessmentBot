import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Form, type FormInstance } from 'antd';
import { useMemo, useRef, useState } from 'react';
import { startAssessmentRun } from '../../../services/assignmentAssessment/assignmentAssessmentService';
import {
  getAssignmentDefinition,
  type AssignmentDefinition,
} from '../../../services/assignmentDefinition/assignmentDefinitionService';
import { DEFAULT_WEIGHTING_VALUE } from '../../../services/assignmentDefinition/assignmentDefinition.zod';
import { ApiTransportError } from '../../../errors/apiTransportError';
import { mapErrorToUserMessage } from '../../../errors/map-error-to-ui';
import { queryKeys } from '../../../query/queryKeys';
import {
  getAssignmentTopicsQueryOptions,
  getYearGroupsQueryOptions,
} from '../../../query/sharedQueries';
import { useWizardUpsertMutation } from '../../assignmentWizard/assignmentWizardMutation';
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
  buildRecoveryReparseRequest,
  type RecoveryPhase,
} from './assessTaskRecoveryData';
import type {
  AssessTaskAssignment,
  AssessmentAlertType,
  CapturedStartContext,
} from './assessTaskFlowData';

/** A single selectable reference-data option. */
type RecoverySelectOption = { value: string; label: string };

/** Fallback copy when a mutation returns no registry-mapped message. */
const REPARSE_FAILED_FALLBACK_MESSAGE = 'An error occurred. Please try again.';

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
 * The Section 6 routing stub (`useAssessTaskFlow`'s `assessmentRecoveryState`
 * and `transitionToStaleRecovery`) remains the entry point; this hook is
 * mounted by `AssessTaskRecoverySurface` while that state is `stale-prompt`,
 * so every recovery entry starts from a fresh prompt with no reset effect. It
 * reuses the Section 7 mutation/error plumbing (`useWizardUpsertMutation`) and
 * the chrome-free review content so no recovery state stacks a second modal.
 * A forced reparse persists immediately (SPEC decision 5): cancelling review
 * discards only local edits and never starts an assessment. Approval continues
 * the original assessment run with the captured
 * `{definitionKey, assignmentId, courseId}` context.
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
   * the create flow (SPEC.md feature architecture).
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
    const request = buildRecoveryReparseRequest(loaded);
    const result = await runUpsert(request, {
      contextName: 'AssessTaskRecoveryFlow.startUpdate',
      errorContext: {
        mode: 'update',
        definitionKey,
        actionType: 'reparse',
        requestPayload: request,
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

    const loaded = await loadStaleDefinition(definitionKey, generation);
    if (loaded === null) return;
    await reparseLoadedDefinition(loaded, generation);
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
   * leaving the owning modal open on the selection body (layout region 4).
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
   * without an automatic recovery loop.
   *
   * @param {string} key The approved definition key.
   * @returns {Promise<void>}
   */
  async function resumeAssessment(key: string): Promise<void> {
    if (capturedStartContext === null) {
      settleAssessment('error', 'An unexpected error occurred.');
      return;
    }
    try {
      await startAssessmentRun({
        definitionKey: key,
        assignmentId: capturedStartContext.assignmentId,
        courseId: capturedStartContext.courseId,
      });
      const title =
        assignments.find((a) => a.assignmentId === capturedStartContext.assignmentId)?.title ?? '';
      settleAssessment('success', `Assessment started for '${title}'.`);
    } catch (error: unknown) {
      if (error instanceof ApiTransportError && error.code === 'DEFINITION_STALE') {
        setPhase('stale-prompt');
        return;
      }
      settleAssessment('error', mapErrorToUserMessage(error));
    }
  }

  /**
   * Saves the reviewed definition. A stale rejection returns to the stale
   * prompt; any other failure keeps the review edits and surfaces an error.
   *
   * @returns {Promise<void>}
   */
  async function save(): Promise<void> {
    if (definition === null || isMutationBusy) return;
    setSaveErrorMessage(null);
    const values = await form.validateFields();
    const request = buildRecoveryApprovalRequest(definition, values, taskRows);
    const result = await runUpsert(request, {
      contextName: 'AssessTaskRecoveryFlow.save',
      errorContext: {
        mode: 'update',
        definitionKey,
        actionType: 'save',
        requestPayload: request,
      },
    });
    if (result.errorMessage !== null) {
      if (result.errorCode === 'DEFINITION_STALE') {
        setErrorMessage(null);
        setPhase('stale-prompt');
        return;
      }
      setSaveErrorMessage(result.errorMessage);
      return;
    }
    await resumeAssessment(definition.definitionKey);
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
