import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Form, type FormInstance } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStartupWarmupState } from '../../features/auth/startupWarmupState';
import { queryKeys } from '../../query/queryKeys';
import {
  getAssignmentDefinitionQueryOptions,
  getAssignmentTopicsQueryOptions,
  getYearGroupsQueryOptions,
} from '../../query/sharedQueries';
import { DEFAULT_WEIGHTING_VALUE } from '../../services/assignmentDefinition/assignmentDefinition.zod';
import { type UpsertAssignmentDefinitionRequest } from '../../services/assignmentDefinition/assignmentDefinitionService';
import {
  applyFormInitialValues,
  buildDocumentUrlsFromDefinition,
  buildTopicOptions,
  buildYearGroupOptions,
  convertBaselineToDefinition,
  derivePrimaryActionState,
  deriveReferenceDataState,
  detectDocumentChange,
  type DocumentChangeState,
  type TaskRow,
} from './assignmentWizardFormState';
import { useFormInitialization } from './assignmentWizardFormInitialization';
import { deriveWizardBlockingError, useWizardMutationSequence } from './assignmentWizardMutation';
import { buildReparseRequest } from './assignmentWizardOrchestrator';

export type { DocumentChangeState, TaskRow } from './assignmentWizardFormState';

export type ModalMode = 'create' | 'update';

/**
 * Properties for the AssignmentDefinitionWizardModal component.
 *
 * @remarks
 * When `onCreateSuccess` is provided, it replaces `onClose` for the save path in create mode.
 * The caller is responsible for unmounting the wizard (e.g., by transitioning its own state).
 * When `onCreateSuccess` is not provided, the normal `onClose()` behaviour is preserved.
 */
export type AssignmentDefinitionWizardModalProperties = Readonly<{
  open: boolean;
  mode: ModalMode;
  definitionKey: string | null;
  onClose: () => void;
  initialValues?: Readonly<{ title?: string; topic?: string; yearGroup?: string }>;
  onCreateSuccess?: (definitionKey: string) => void;
}>;

/**
 * Return type for the useAssignmentDefinitionWizard hook.
 *
 * @remarks
 * When `initialValues` are provided in create mode, they are applied to the form fields
 * and the `selectedTopicKey`/`selectedYearGroupKey` state is synchronised accordingly.
 * `initialValues` are only applied in create mode and are ignored in update mode.
 */
export type UseAssignmentDefinitionWizardReturn = Readonly<{
  form: FormInstance<Record<string, unknown>>;
  hasParsedTasks: boolean;
  taskRows: TaskRow[];
  documentChange: DocumentChangeState;
  hasDirtyEdits: boolean;
  showDiscardConfirm: boolean;
  isSubmitting: boolean;
  blockingError: string | null;
  isReferenceDataLoading: boolean;
  isReferenceDataBlocked: boolean;
  topicOptions: { value: string; label: string }[];
  yearGroupOptions: { value: string; label: string }[];
  primaryActionLabel: string;
  isPrimaryActionDisabled: boolean;
  canReparseDocuments: boolean;
  selectedTopicKey?: string;
  selectedYearGroupKey?: string;
  handleFormValuesChange: (
    changedValues: Record<string, unknown>,
    allValues: Record<string, unknown>
  ) => void;
  handleReparse: () => Promise<void>;
  handleReparseCancel: () => void;
  handleReparseDocuments: () => Promise<void>;
  handleClose: () => void;
  handleDiscardConfirm: () => void;
  handleKeepEditing: () => void;
  handleTaskWeightingChange: (taskId: string, value: number | null) => void;
  handlePrimaryAction: () => void;
  handleTopicAddNew: () => void;
  handleYearGroupAddNew: () => void;
  onTopicEntityCreated: (entity: { key: string; name: string; yearGroupKeys?: string[] }) => void;
  onYearGroupEntityCreated: (entity: { key: string; name: string }) => void;
}>;

/**
 * Enabling conditions for the explicit Reparse documents action.
 */
type ReparseDocumentsGating = Readonly<{
  isCreateMode: boolean;
  isDefinitionLoaded: boolean;
  isDefinitionError: boolean;
  hasDirtyEdits: boolean;
  hasPendingDocumentChange: boolean;
  isSubmitting: boolean;
}>;

/**
 * Derives whether the explicit Reparse documents action is enabled.
 *
 * @remarks
 * The action exists in update mode only, and only when the loaded definition is
 * trustworthy, no mutation is pending, and there are no unsaved metadata/weighting
 * edits or pending URL changes.
 *
 * @param {ReparseDocumentsGating} gating - The enabling condition inputs.
 * @returns {boolean} True when the Reparse documents action may run.
 */
function deriveCanReparseDocuments(gating: ReparseDocumentsGating): boolean {
  const hasTrustworthyDefinition = gating.isDefinitionLoaded && !gating.isDefinitionError;
  return (
    !gating.isCreateMode &&
    hasTrustworthyDefinition &&
    !gating.hasDirtyEdits &&
    !gating.hasPendingDocumentChange &&
    !gating.isSubmitting
  );
}

/**
 * Custom hook for managing assignment definition wizard state and logic.
 *
 * @remarks
 * This hook is a thin composition over the extracted feature-local modules: the
 * pure form-state derivations (`assignmentWizardFormState`), the form
 * initialization/baseline hook (`assignmentWizardFormInitialization`) and the
 * shared mutation/error-mapping sequence (`assignmentWizardMutation`). The
 * recovery/update parse → review → save process lives in
 * `assignmentWizardOrchestrator`.
 *
 * @param {AssignmentDefinitionWizardModalProperties} properties - Modal properties.
 * @returns {UseAssignmentDefinitionWizardReturn} Hook return value with state and handlers.
 */
export function useAssignmentDefinitionWizard(
  properties: AssignmentDefinitionWizardModalProperties
): UseAssignmentDefinitionWizardReturn {
  const { open, mode, definitionKey, onClose, initialValues, onCreateSuccess } = properties;
  const isCreateMode = mode === 'create';

  const queryClient = useQueryClient();
  const startupWarmupState = useStartupWarmupState();
  const [form] = Form.useForm();

  const { data: topics, isLoading: isTopicsLoading } = useQuery({
    ...getAssignmentTopicsQueryOptions(),
    enabled: open && startupWarmupState.isDatasetReady('assignmentTopics'),
  });

  const { data: yearGroups, isLoading: isYearGroupsLoading } = useQuery({
    ...getYearGroupsQueryOptions(),
    enabled: open && startupWarmupState.isDatasetReady('yearGroups'),
  });

  const {
    data: definition,
    isError: isDefinitionError,
    error: definitionError,
  } = useQuery({
    ...getAssignmentDefinitionQueryOptions(definitionKey ?? ''),
    enabled:
      open &&
      !isCreateMode &&
      definitionKey !== null &&
      startupWarmupState.isDatasetReady('assignmentDefinitionPartials'),
  });

  const [hasParsedTasks, setHasParsedTasks] = useState(false);
  const [taskRows, setTaskRows] = useState<TaskRow[]>([]);
  const [documentChange, setDocumentChange] = useState<DocumentChangeState>({
    hasPendingChange: false,
    previousReferenceUrl: '',
    previousTemplateUrl: '',
  });
  const [hasDirtyEdits, setHasDirtyEdits] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [submitBlockingError, setSubmitBlockingError] = useState<string | null>(null);
  const [selectedTopicKey, setSelectedTopicKey] = useState<string | undefined>();
  const [selectedYearGroupKey, setSelectedYearGroupKey] = useState<string | undefined>();

  // Surface useQuery errors (e.g. ZodError from malformed GAS-serialized response, issue #244)
  // through the wizard's existing blocking error mechanism. Derived rather than stored in state
  // to avoid synchronous setState within an effect.
  const blockingError = deriveWizardBlockingError(
    isDefinitionError,
    definitionError,
    submitBlockingError
  );

  // Use extracted helper for reference data state derivation
  const { isReferenceDataLoading, isReferenceDataBlocked } = deriveReferenceDataState(
    startupWarmupState,
    isTopicsLoading,
    isYearGroupsLoading,
    open
  );

  const topicOptions = useMemo(() => buildTopicOptions(topics), [topics]);
  const yearGroupOptions = useMemo(() => buildYearGroupOptions(yearGroups), [yearGroups]);

  const watchedFormValues = Form.useWatch([], form);
  const formValues = useMemo(() => watchedFormValues ?? {}, [watchedFormValues]);

  // Use extracted helper for primary action state derivation
  const { primaryActionLabel, isPrimaryActionDisabled } = derivePrimaryActionState(
    isCreateMode,
    hasParsedTasks,
    formValues
  );

  // Track definitionKey from parse response in create mode for subsequent operations
  const [localDefinitionKey, setLocalDefinitionKey] = useState<string | null>(null);

  // Use extracted custom hook for form initialization and dirty state tracking
  const { storeParseBaseline, getParsedCreateBaseline } = useFormInitialization(
    open,
    isCreateMode,
    form,
    {
      definition,
      formValues,
      taskRows,
      hasParsedTasks,
      localDefinitionKey,
      setHasParsedTasks,
      setTaskRows,
      setDocumentChange,
      setHasDirtyEdits,
      setSubmitBlockingError,
      setLocalDefinitionKey,
    },
    queryClient
  );

  // Apply initialValues in create mode after form initialization (form.resetFields in create mode).
  // Re-applies whenever the deps change, including after the init effect's resetFields on
  // React 19 StrictMode double-mount.  initialValues is a stable memoised reference from the
  // parent so re-application only occurs on meaningful changes, not on every render.
  useEffect(() => {
    if (!open || !isCreateMode || !initialValues) return;
    applyFormInitialValues(form, initialValues, setSelectedTopicKey, setSelectedYearGroupKey);
  }, [open, isCreateMode, form, initialValues, setSelectedTopicKey, setSelectedYearGroupKey]);

  // Get the effective definition for document URL restoration (handles both update and post-parse create modes)
  const getEffectiveDefinition = useCallback(() => {
    if (!isCreateMode && definition) {
      return definition;
    }
    // In create mode: try cached query data first, then parsed baseline
    const baseline = getParsedCreateBaseline();
    if (baseline) {
      return convertBaselineToDefinition(baseline);
    }
    return definition;
  }, [isCreateMode, definition, getParsedCreateBaseline]);

  // Handle document change detection
  const handleFormValuesChange = useCallback(
    (_changedValues: Record<string, unknown>, allValues: Record<string, unknown>) => {
      const effectiveDefinition = getEffectiveDefinition();
      if (!effectiveDefinition) {
        return;
      }
      if (!isCreateMode || hasParsedTasks) {
        const urls = buildDocumentUrlsFromDefinition(
          effectiveDefinition as Record<string, unknown>
        );
        if (!urls) return;

        const newDocumentChange = detectDocumentChange(
          allValues,
          urls,
          documentChange.hasPendingChange
        );
        setDocumentChange(newDocumentChange);
      }
    },
    [hasParsedTasks, isCreateMode, documentChange.hasPendingChange, getEffectiveDefinition]
  );

  // Shared mutation sequence: response handling, invalidation, transitions and error mapping
  const { isSubmitting, runWizardMutation } = useWizardMutationSequence({
    mode,
    form,
    taskRows,
    localDefinitionKey,
    onClose,
    onCreateSuccess,
    storeParseBaseline,
    setTaskRows,
    setHasParsedTasks,
    setDocumentChange,
    setLocalDefinitionKey,
    setHasDirtyEdits,
    setSubmitBlockingError,
  });

  const canReparseDocuments = deriveCanReparseDocuments({
    isCreateMode,
    isDefinitionLoaded: definition !== undefined,
    isDefinitionError,
    hasDirtyEdits,
    hasPendingDocumentChange: documentChange.hasPendingChange,
    isSubmitting,
  });

  // Handle parse and continue
  const handleParseAndContinue = useCallback(async () => {
    const values = await form.validateFields();
    const request: UpsertAssignmentDefinitionRequest = {
      primaryTitle: (values.title as string) || '',
      primaryTopicKey: values.topic as string,
      yearGroupKey: values.yearGroup as string,
      referenceDocumentUrl: values.referenceDocumentUrl as string,
      templateDocumentUrl: values.templateDocumentUrl as string,
    };
    await runWizardMutation({ actionType: 'parse', request, definitionKey: null });
  }, [form, runWizardMutation]);

  // Handle save
  const handleSave = useCallback(async () => {
    const values = await form.validateFields();
    const effectiveKey = localDefinitionKey ?? definitionKey;
    const request: UpsertAssignmentDefinitionRequest = {
      primaryTitle: (values.title as string) || '',
      primaryTopicKey: values.topic as string,
      yearGroupKey: values.yearGroup as string,
      referenceDocumentUrl: values.referenceDocumentUrl as string,
      templateDocumentUrl: values.templateDocumentUrl as string,
      assignmentWeighting: (values.assignmentWeighting as number) ?? DEFAULT_WEIGHTING_VALUE,
      taskWeightings: taskRows.map((row) => ({
        taskId: row.taskId,
        taskWeighting: row.taskWeighting,
      })),
    };
    if (effectiveKey) {
      request.definitionKey = effectiveKey;
    }
    await runWizardMutation({
      actionType: 'save',
      request,
      definitionKey: effectiveKey,
    });
  }, [form, taskRows, definitionKey, localDefinitionKey, runWizardMutation]);

  // Handle re-parse
  const handleReparse = useCallback(async () => {
    const values = form.getFieldsValue();
    const effectiveKey = localDefinitionKey ?? definitionKey;
    if (!effectiveKey) return;
    const request: UpsertAssignmentDefinitionRequest = {
      definitionKey: effectiveKey,
      primaryTitle: (values.title as string) || '',
      primaryTopicKey: values.topic as string,
      yearGroupKey: values.yearGroup as string,
      referenceDocumentUrl: values.referenceDocumentUrl as string,
      templateDocumentUrl: values.templateDocumentUrl as string,
      assignmentWeighting: (values.assignmentWeighting as number) ?? DEFAULT_WEIGHTING_VALUE,
      taskWeightings: [],
    };
    await runWizardMutation({ actionType: 'reparse', request, definitionKey: effectiveKey });
  }, [form, definitionKey, localDefinitionKey, runWizardMutation]);

  // Handle explicit Reparse documents (update mode, unchanged URLs). Reuses the
  // Section 7 forced-reparse request builder so the payload stays ID-shaped with
  // `forceReparse: true` and no weighting patch.
  const handleReparseDocuments = useCallback(async () => {
    const effectiveKey = localDefinitionKey ?? definitionKey;
    if (!effectiveKey || !definition) return;
    const request = buildReparseRequest(definition);
    await runWizardMutation({ actionType: 'reparse', request, definitionKey: effectiveKey });
  }, [definition, definitionKey, localDefinitionKey, runWizardMutation]);

  // Handle re-parse cancel
  const handleReparseCancel = useCallback(() => {
    const effectiveDefinition = getEffectiveDefinition();
    if (!effectiveDefinition) return;

    const urls = buildDocumentUrlsFromDefinition(effectiveDefinition as Record<string, unknown>);
    if (!urls) return;

    form.setFieldsValue({
      referenceDocumentUrl: urls.referenceUrl,
      templateDocumentUrl: urls.templateUrl,
    });
    setDocumentChange({
      hasPendingChange: false,
      previousReferenceUrl: urls.referenceUrl,
      previousTemplateUrl: urls.templateUrl,
    });
  }, [form, getEffectiveDefinition]);

  // Handle close
  const handleClose = useCallback(() => {
    // When a blocking error is displayed, allow the user to dismiss and close
    // without going through the discard-confirm flow
    if (blockingError) {
      onClose();
      return;
    }
    if (hasDirtyEdits && !documentChange.hasPendingChange) {
      setShowDiscardConfirm(true);
      return;
    }
    if (documentChange.hasPendingChange) return;
    onClose();
  }, [hasDirtyEdits, documentChange.hasPendingChange, onClose, blockingError]);

  const handleDiscardConfirm = useCallback(() => {
    setShowDiscardConfirm(false);
    onClose();
  }, [onClose]);

  const handleKeepEditing = useCallback(() => setShowDiscardConfirm(false), []);

  const handleTaskWeightingChange = useCallback((taskId: string, value: number | null) => {
    setTaskRows((previous) =>
      previous.map((row) =>
        row.taskId === taskId ? { ...row, taskWeighting: value ?? DEFAULT_WEIGHTING_VALUE } : row
      )
    );
  }, []);

  const handlePrimaryAction = useCallback(() => {
    const action = isCreateMode && !hasParsedTasks ? handleParseAndContinue : handleSave;
    action().catch((error) => {
      throw error;
    });
  }, [isCreateMode, hasParsedTasks, handleParseAndContinue, handleSave]);

  // Handlers for 'Add new' topic/year group workflow
  const handleTopicAddNew = useCallback(() => {
    // Will be handled by the modal component
  }, []);

  const handleYearGroupAddNew = useCallback(() => {
    // Will be handled by the modal component
  }, []);

  const onTopicEntityCreated = useCallback(
    (entity: { key: string; name: string; yearGroupKeys?: string[] }) => {
      setSelectedTopicKey(entity.key);
      // Invalidate assignmentTopics query so the dropdown refreshes
      queryClient.invalidateQueries({ queryKey: queryKeys.assignmentTopics() });
    },
    [queryClient]
  );

  const onYearGroupEntityCreated = useCallback(
    (entity: { key: string; name: string }) => {
      setSelectedYearGroupKey(entity.key);
      // Invalidate yearGroups query so the dropdown refreshes
      queryClient.invalidateQueries({ queryKey: queryKeys.yearGroups() });
    },
    [queryClient]
  );

  return {
    form,
    hasParsedTasks,
    taskRows,
    documentChange,
    hasDirtyEdits,
    showDiscardConfirm,
    isSubmitting,
    blockingError,
    isReferenceDataLoading,
    isReferenceDataBlocked,
    topicOptions,
    yearGroupOptions,
    primaryActionLabel,
    isPrimaryActionDisabled,
    canReparseDocuments,
    selectedTopicKey,
    selectedYearGroupKey,
    handleFormValuesChange,
    handleReparse,
    handleReparseCancel,
    handleReparseDocuments,
    handleClose,
    handleDiscardConfirm,
    handleKeepEditing,
    handleTaskWeightingChange,
    handlePrimaryAction,
    handleTopicAddNew,
    handleYearGroupAddNew,
    onTopicEntityCreated,
    onYearGroupEntityCreated,
  };
}
