import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Form } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { useStartupWarmupState } from '../../features/auth/startupWarmupState';
import { logFrontendError } from '../../logging/frontendLogger';
import {
  mapErrorToUserMessage,
  extractErrorCode,
  extractRequestId,
} from '../../errors/map-error-to-ui';
import { queryKeys } from '../../query/queryKeys';
import {
  getAssignmentDefinitionQueryOptions,
  getAssignmentTopicsQueryOptions,
  getYearGroupsQueryOptions,
} from '../../query/sharedQueries';
import { DEFAULT_WEIGHTING_VALUE } from '../../services/assignmentDefinition.zod';
import {
  type UpsertAssignmentDefinitionResponse,
  type UpsertAssignmentDefinitionRequest,
  upsertAssignmentDefinition,
} from '../../services/assignmentDefinitionService';
import {
  buildCanonicalUrl,
  buildDocumentUrlsFromDefinition,
  buildTopicOptions,
  buildYearGroupOptions,
  convertBaselineToDefinition,
  derivePrimaryActionState,
  deriveReferenceDataState,
  detectDocumentChange,
  buildWizardErrorContext,
} from './helpers';
import { useFormInitialization } from './formInit';
import {
  type AssignmentDefinitionWizardModalProperties,
  type DocumentChangeState,
  type TaskRow,
  type UseAssignmentDefinitionWizardReturn,
} from './types';

// Re-export all public types
export type {
  DocumentChangeState,
  TaskRow,
  ModalMode,
  AssignmentDefinitionWizardModalProperties,
  FormInitializationOptions,
  UseAssignmentDefinitionWizardReturn,
  ParsedCreateBaseline,
} from './types';

// Re-export the form initialization hook for testing
export { useFormInitialization } from './formInit';

/**
 * Custom hook for managing assignment definition wizard state and logic.
 *
 * @param {AssignmentDefinitionWizardModalProperties} properties - Modal properties.
 * @returns {UseAssignmentDefinitionWizardReturn} Hook return value with state and handlers.
 */
export function useAssignmentDefinitionWizard(
  properties: AssignmentDefinitionWizardModalProperties
): UseAssignmentDefinitionWizardReturn {
  const { open, mode, definitionKey, onClose } = properties;
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

  const { data: definition } = useQuery({
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [blockingError, setBlockingError] = useState<string | null>(null);
  const [selectedTopicKey, setSelectedTopicKey] = useState<string | undefined>();
  const [selectedYearGroupKey, setSelectedYearGroupKey] = useState<string | undefined>();

  const upsertMutation = useMutation({
    mutationFn: upsertAssignmentDefinition,
  });

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
      setBlockingError,
      setLocalDefinitionKey,
    },
    queryClient
  );

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

  /**
   * Builds task rows from response tasks, optionally preserving existing weightings for re-parse.
   *
   * @param {Array<{ taskId: string; taskTitle: string; taskWeighting: number }>} responseTasks - Tasks from the response.
   * @param {TaskRow[]} existingTaskRows - Current task rows for weighting preservation.
   * @param {'parse' | 'reparse'} actionType - Whether this is a parse or re-parse action.
   * @returns {TaskRow[]} New task rows.
   */
  const buildTaskRowsFromResponse = useCallback(
    (
      responseTasks: Array<{ taskId: string; taskTitle: string; taskWeighting: number }>,
      actionType: 'parse' | 'reparse'
    ) => {
      const existingWeightings =
        actionType === 'reparse'
          ? new Map(taskRows.map((row) => [row.taskId, row.taskWeighting]))
          : null;

      const newTaskRows: TaskRow[] = responseTasks.map((t) => ({
        key: t.taskId,
        taskId: t.taskId,
        taskTitle: t.taskTitle,
        taskWeighting: existingWeightings?.get(t.taskId) ?? t.taskWeighting,
      }));

      return newTaskRows;
    },
    [taskRows]
  );

  /**
   * Handles the response from a parse or re-parse mutation by updating task rows and document state.
   *
   * @param {UpsertAssignmentDefinitionResponse} response - The mutation response containing tasks and document info.
   * @param {'parse' | 'reparse'} actionType - The type of action that produced the response.
   * @returns {void}
   */
  const handleParseResponse = useCallback(
    (response: UpsertAssignmentDefinitionResponse, actionType: 'parse' | 'reparse') => {
      const documentType = response.documentType;
      const newTaskRows = buildTaskRowsFromResponse(response.tasks, actionType);

      setTaskRows(newTaskRows);
      setHasParsedTasks(true);
      setDocumentChange({
        hasPendingChange: false,
        previousReferenceUrl: buildCanonicalUrl(response.referenceDocumentId, documentType),
        previousTemplateUrl: buildCanonicalUrl(response.templateDocumentId, documentType),
      });

      if (actionType === 'parse' && response.definitionKey) {
        setLocalDefinitionKey(response.definitionKey);
      }

      if (actionType === 'parse') {
        storeParseBaseline(response);
      }

      // Update form with response data after parse/re-parse to reflect persisted state
      // In create mode: this ensures the form shows the server-defaulted assignmentWeighting
      // In update mode with re-parse: this ensures document URLs are updated while preserving metadata
      if (actionType === 'parse' || actionType === 'reparse') {
        const referenceUrl = buildCanonicalUrl(response.referenceDocumentId, documentType);
        const templateUrl = buildCanonicalUrl(response.templateDocumentId, documentType);

        // For parse: update all metadata fields to reflect persisted state
        // For reparse: update document URLs while preserving other metadata
        if (actionType === 'parse') {
          form.setFieldsValue({
            title: response.primaryTitle,
            topic: response.primaryTopicKey,
            yearGroup: response.yearGroupKey,
            referenceDocumentUrl: referenceUrl,
            templateDocumentUrl: templateUrl,
            assignmentWeighting: response.assignmentWeighting,
          });
        } else {
          // Reparse: only update document URLs
          form.setFieldsValue({
            referenceDocumentUrl: referenceUrl,
            templateDocumentUrl: templateUrl,
          });
        }
      }
    },
    [buildTaskRowsFromResponse, storeParseBaseline, form]
  );

  /**
   * Performs query invalidation after a mutation.
   * Invalidate both assignmentDefinitionPartials and assignmentDefinitionByKey (for create-mode localDefinitionKey).
   *
   * Per frontend-react-query-and-prefetch.md §7, we use invalidateQueries only.
   * Active useQuery observers will automatically refetch in the background,
   * and any errors will properly propagate to their isError state.
   *
   * @param {string | null} explicitKey - Explicit definition key if provided.
   * @returns {Promise<void>} Resolves when invalidation is complete.
   */
  const invalidateMutationQueries = useCallback(
    async (explicitKey: string | null) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.assignmentDefinitionPartials() });
      // Invalidate the specific definition query for both explicit key and local definition key
      // This handles both update mode (explicitKey) and create mode (localDefinitionKey)
      const effectiveKey = explicitKey ?? localDefinitionKey;
      if (effectiveKey) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.assignmentDefinitionByKey(effectiveKey),
        });
      }
      // Removed fetchQuery call as per frontend-react-query-and-prefetch.md §7:
      // fetchQuery after invalidation is anti-pattern. Let React Query's background
      // refetch handle cache updates. Errors will properly propagate to page-level
      // useQuery.isError state, allowing blocking UI to render correctly.
    },
    [queryClient, localDefinitionKey]
  );

  /**
   * Handles post-mutation actions based on action type.
   *
   * @param {'parse' | 'save' | 'reparse'} actionType - The action type.
   * @param {UpsertAssignmentDefinitionResponse | undefined} response - The mutation response for parse/reparse.
   * @returns {UpsertAssignmentDefinitionResponse | undefined} The response to return.
   */
  const handlePostMutation = useCallback(
    (
      actionType: 'parse' | 'save' | 'reparse',
      response: UpsertAssignmentDefinitionResponse | undefined
    ): UpsertAssignmentDefinitionResponse | undefined => {
      if (actionType === 'save') {
        onClose();
        return undefined;
      }
      setHasDirtyEdits(false);
      return response;
    },
    [onClose]
  );

  /**
   * Shared orchestration function for all wizard mutations (parse, save, re-parse).
   *
   * @remarks
   * This function consolidates the duplicated async mutation skeleton from handleParseAndContinue,
   * handleSave, and handleReparse into a single descriptor-driven orchestration path.
   * Mode-specific behaviour is expressed through the options parameter rather than copied control flow.
   *
   * @param {object} options - Mutation configuration.
   * @param {'parse' | 'save' | 'reparse'} options.actionType - Type of mutation action.
   * @param {UpsertAssignmentDefinitionRequest} options.request - Pre-built request object.
   * @param {string | null} options.definitionKey - Definition key for update/reparse, or null for create parse.
   * @returns {Promise<UpsertAssignmentDefinitionResponse | undefined>} Resolves with response for parse/reparse, undefined otherwise.
   */
  const runWizardMutation = useCallback(
    async (options: {
      actionType: 'parse' | 'save' | 'reparse';
      request: UpsertAssignmentDefinitionRequest;
      definitionKey: string | null;
    }): Promise<UpsertAssignmentDefinitionResponse | undefined> => {
      if (isSubmitting) {
        return undefined;
      }
      setIsSubmitting(true);
      try {
        const response = await upsertMutation.mutateAsync(options.request);

        if (options.actionType === 'parse' || options.actionType === 'reparse') {
          handleParseResponse(response, options.actionType);
        }

        const definitionKeyForInvalidation =
          options.actionType === 'parse' ? response.definitionKey : options.definitionKey;
        await invalidateMutationQueries(definitionKeyForInvalidation);
        return handlePostMutation(options.actionType, response);
      } catch (caughtError) {
        // Extract error details for structured logging per frontend-logging-and-error-handling.md
        const errorCode = extractErrorCode(caughtError);
        const requestId = extractRequestId(caughtError);

        // Build structured error context using helper
        const errorContext = buildWizardErrorContext(mode, options, errorCode, requestId);
        // Add stack trace to error context
        if (caughtError instanceof Error) {
          errorContext.stack = caughtError.stack;
        }

        logFrontendError(
          'AssignmentDefinitionWizardModal.runWizardMutation',
          caughtError,
          errorContext
        );

        // Map to user-safe message using error code per frontend-logging-and-error-handling.md
        const userSafeMessage = mapErrorToUserMessage(caughtError);
        setBlockingError(userSafeMessage);
        return undefined;
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      isSubmitting,
      upsertMutation,
      handleParseResponse,
      invalidateMutationQueries,
      handlePostMutation,
      mode,
    ]
  );

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
    await runWizardMutation({ actionType: 'save', request, definitionKey: effectiveKey });
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
    if (hasDirtyEdits && !documentChange.hasPendingChange) {
      setShowDiscardConfirm(true);
      return;
    }
    if (documentChange.hasPendingChange) return;
    onClose();
  }, [hasDirtyEdits, documentChange.hasPendingChange, onClose]);

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
    selectedTopicKey,
    selectedYearGroupKey,
    handleFormValuesChange,
    handleReparse,
    handleReparseCancel,
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
