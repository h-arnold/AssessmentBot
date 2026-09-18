import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { Form, type FormInstance } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { DEFAULT_WEIGHTING_VALUE } from '../../services/assignmentDefinition/assignmentDefinition.zod';
import { sortYearGroups } from '../referenceData/yearGroupSorting';
import {
  type AssignmentDefinition,
  type UpsertAssignmentDefinitionResponse,
  type UpsertAssignmentDefinitionRequest,
  upsertAssignmentDefinition,
} from '../../services/assignmentDefinition/assignmentDefinitionService';
import {
  applyFormInitialValues,
  buildDocumentUrlsFromDefinition,
  buildTaskRowsFromResponse,
  calculateDirtyState,
  detectDocumentChange,
  hydrateFormFromDefinition,
  type DocumentChangeState,
  type ParsedCreateBaseline,
  type TaskRow,
} from './assignmentWizardFormState';

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

const REQUIRED_PARSE_FIELDS = [
  'title',
  'topic',
  'yearGroup',
  'referenceDocumentUrl',
  'templateDocumentUrl',
] as const;

/**
 * Derives reference data state from startup warmup state and query loading states.
 * Determines whether reference data is trustworthy, loading, or blocked.
 *
 * @param {ReturnType<typeof useStartupWarmupState>} startupWarmupState - The startup warmup state.
 * @param {boolean} isTopicsLoading - Whether topics are currently loading.
 * @param {boolean} isYearGroupsLoading - Whether year groups are currently loading.
 * @param {boolean} open - Whether the modal is open.
 * @returns {{ hasTrustworthyReferenceData: boolean; isReferenceDataLoading: boolean; isReferenceDataBlocked: boolean }} Reference data state.
 */
function deriveReferenceDataState(
  startupWarmupState: ReturnType<typeof useStartupWarmupState>,
  isTopicsLoading: boolean,
  isYearGroupsLoading: boolean,
  open: boolean
): {
  hasTrustworthyReferenceData: boolean;
  isReferenceDataLoading: boolean;
  isReferenceDataBlocked: boolean;
} {
  const hasTrustworthyReferenceData =
    startupWarmupState.isDatasetReady('assignmentTopics') &&
    startupWarmupState.isDatasetReady('yearGroups') &&
    !startupWarmupState.isDatasetFailed('assignmentTopics') &&
    !startupWarmupState.isDatasetFailed('yearGroups');

  const isReferenceDataLoading = isTopicsLoading || isYearGroupsLoading;
  const isReferenceDataBlocked = open && !hasTrustworthyReferenceData && !isReferenceDataLoading;

  return {
    hasTrustworthyReferenceData,
    isReferenceDataLoading,
    isReferenceDataBlocked,
  };
}

/**
 * Derives primary action state based on parse phase and form values.
 *
 * @param {boolean} isCreateMode - Whether in create mode.
 * @param {boolean} hasParsedTasks - Whether tasks have been parsed.
 * @param {Record<string, unknown>} formValues - Current form values.
 * @returns {{ primaryActionLabel: string; isPrimaryActionDisabled: boolean }} Primary action state.
 */
function derivePrimaryActionState(
  isCreateMode: boolean,
  hasParsedTasks: boolean,
  formValues: Record<string, unknown>
): { primaryActionLabel: string; isPrimaryActionDisabled: boolean } {
  const isParsePhase = isCreateMode && !hasParsedTasks;
  const primaryActionLabel = isParsePhase ? 'Parse and continue' : 'Save';

  const isPrimaryActionDisabled = isParsePhase
    ? !hasAllParseFields(formValues)
    : !hasYearGroupSelected(formValues);

  return {
    primaryActionLabel,
    isPrimaryActionDisabled,
  };
}

/**
 * Derives the effective blocking error, preferring a failed assignment definition
 * query error and falling back to any submit-time error.
 *
 * The query-derived error reflects the definition query's last known failure. The
 * query retains that error state even when disabled (whilst the modal is closed),
 * so the derived value can remain non-null until the next successful fetch. This
 * matches the prior effect-based behaviour and is surfaced only when the wizard
 * renders the blocking alert.
 *
 * @param {boolean} isQueryError Whether the query errored.
 * @param {unknown} queryError The query error, if any.
 * @param {string | null} submitError Error captured from a failed submission.
 * @returns {string | null} A user-safe message, or null when there is no error.
 */
function deriveBlockingError(
  isQueryError: boolean,
  queryError: unknown,
  submitError: string | null
): string | null {
  if (isQueryError && queryError) {
    return mapErrorToUserMessage(queryError);
  }
  return submitError;
}

/**
 * Options for the useFormInitialization hook.
 * Contains all state values and setters needed for form initialization.
 */
export interface FormInitializationOptions {
  definition: AssignmentDefinition | null | undefined;
  formValues: Record<string, unknown>;
  taskRows: TaskRow[];
  hasParsedTasks: boolean;
  localDefinitionKey: string | null;
  setHasParsedTasks: (value: boolean) => void;
  setTaskRows: (rows: TaskRow[]) => void;
  setDocumentChange: (state: DocumentChangeState) => void;
  setHasDirtyEdits: (value: boolean) => void;
  setSubmitBlockingError: (error: string | null) => void;
  setLocalDefinitionKey: (key: string | null) => void;
}

/**
 * Hook for form initialization and baseline management.
 * Manages parse baseline storage and retrieval for the assignment definition wizard.
 *
 * @param {boolean} open - Whether the modal is open.
 * @param {boolean} isCreateMode - Whether in create mode.
 * @param {FormInstance} form - The Ant Design form instance.
 * @param {FormInitializationOptions} options - Form initialization options containing state and setters.
 * @param {QueryClient} queryClient - The React Query client for accessing cached data.
 * @returns {object} Object containing storeParseBaseline and getParsedCreateBaseline functions.
 */
function useFormInitialization(
  open: boolean,
  isCreateMode: boolean,
  form: FormInstance,
  options: FormInitializationOptions,
  queryClient: QueryClient
): {
  storeParseBaseline: (response: UpsertAssignmentDefinitionResponse) => void;
  getParsedCreateBaseline: () => ParsedCreateBaseline | null;
} {
  const {
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
  } = options;
  const isHydratingDefinitionReference = useRef(false);
  const parsedCreateBaselineReference = useRef<ParsedCreateBaseline | null>(null);

  // Initialize modal and track hydration state
  useEffect(() => {
    if (!open) {
      isHydratingDefinitionReference.current = false;
      parsedCreateBaselineReference.current = null;
      setLocalDefinitionKey(null);
      return;
    }

    setHasParsedTasks(false);
    setTaskRows([]);
    setDocumentChange({
      hasPendingChange: false,
      previousReferenceUrl: '',
      previousTemplateUrl: '',
    });
    setHasDirtyEdits(false);
    setSubmitBlockingError(null);
    setLocalDefinitionKey(null);

    if (isCreateMode) {
      isHydratingDefinitionReference.current = false;
      parsedCreateBaselineReference.current = null;
      form.resetFields();
    } else if (definition) {
      parsedCreateBaselineReference.current = null;
      isHydratingDefinitionReference.current = true;

      hydrateFormFromDefinition(
        form,
        definition,
        setTaskRows,
        setHasParsedTasks,
        setDocumentChange
      );
      queueMicrotask(() => {
        isHydratingDefinitionReference.current = false;
      });
    }
  }, [
    open,
    isCreateMode,
    definition,
    form,
    setTaskRows,
    setHasParsedTasks,
    setDocumentChange,
    setHasDirtyEdits,
    setSubmitBlockingError,
    setLocalDefinitionKey,
  ]);

  // Track dirty state
  useEffect(() => {
    if (isHydratingDefinitionReference.current) {
      setHasDirtyEdits(false);
      return;
    }

    if (isCreateMode && !hasParsedTasks) {
      setHasDirtyEdits(false);
      return;
    }

    const isDirty = calculateDirtyState(
      formValues,
      parsedCreateBaselineReference.current,
      definition,
      taskRows,
      isCreateMode,
      hasParsedTasks
    );
    setHasDirtyEdits(isDirty);
  }, [formValues, definition, taskRows, isCreateMode, hasParsedTasks, setHasDirtyEdits]);

  // Function to store parse baseline after successful stage-one create
  const storeParseBaseline = useCallback((response: UpsertAssignmentDefinitionResponse) => {
    const documentUrls = buildDocumentUrlsFromDefinition(response);
    if (!documentUrls) {
      return;
    }
    const referenceUrl = documentUrls.referenceUrl;
    const templateUrl = documentUrls.templateUrl;

    parsedCreateBaselineReference.current = {
      // Use response values for metadata to capture any server-side normalisation
      title: response.primaryTitle,
      topic: response.primaryTopicKey,
      yearGroup: response.yearGroupKey,
      // Build canonical URLs from response IDs for consistent baseline
      referenceDocumentUrl: referenceUrl,
      templateDocumentUrl: templateUrl,
      referenceDocumentId: response.referenceDocumentId,
      templateDocumentId: response.templateDocumentId,
      documentType: response.documentType,
      // Use the actual assignmentWeighting from the response, not the default
      assignmentWeighting: response.assignmentWeighting,
      taskWeightings: new Map(response.tasks.map((task) => [task.taskId, task.taskWeighting])),
    };
  }, []);

  // Function to get parsed create baseline for document URL restoration
  const getParsedCreateBaseline = useCallback((): ParsedCreateBaseline | null => {
    // In create mode: try cached query data first
    if (localDefinitionKey) {
      const cached = queryClient.getQueryData<UpsertAssignmentDefinitionResponse>(
        queryKeys.assignmentDefinitionByKey(localDefinitionKey)
      );
      if (cached) {
        const cachedDefinition = cached;
        const documentUrls = buildDocumentUrlsFromDefinition(cachedDefinition);
        if (!documentUrls) {
          return parsedCreateBaselineReference.current;
        }
        const referenceUrl = documentUrls.referenceUrl;
        const templateUrl = documentUrls.templateUrl;

        return {
          title: cachedDefinition.primaryTitle,
          topic: cachedDefinition.primaryTopicKey,
          yearGroup: cachedDefinition.yearGroupKey,
          referenceDocumentUrl: referenceUrl,
          templateDocumentUrl: templateUrl,
          referenceDocumentId: cachedDefinition.referenceDocumentId,
          templateDocumentId: cachedDefinition.templateDocumentId,
          documentType: cachedDefinition.documentType,
          // Use the actual assignmentWeighting from the cached definition
          assignmentWeighting: cachedDefinition.assignmentWeighting,
          taskWeightings: new Map(
            cachedDefinition.tasks.map((task) => [task.taskId, task.taskWeighting])
          ),
        };
      }
    }
    return parsedCreateBaselineReference.current;
  }, [localDefinitionKey, queryClient]);

  return { storeParseBaseline, getParsedCreateBaseline };
}

/**
 * Builds topic options from topics array.
 *
 * @param {Array<{ key: string; name: string }> | null | undefined} topics - Topics array.
 * @returns {Array<{ value: string; label: string }>} Topic options for Select component.
 */
function buildTopicOptions(
  topics: Array<{ key: string; name: string }> | null | undefined
): Array<{ value: string; label: string }> {
  if (!Array.isArray(topics)) return [];
  return topics.map((t) => ({ value: t.key, label: t.name }));
}

/**
 * Builds year group options from year groups array.
 *
 * @param {Array<{ key: string; name: string }> | null | undefined} yearGroups - Year groups array.
 * @returns {Array<{ value: string; label: string }>} Year group options for Select component.
 */
function buildYearGroupOptions(
  yearGroups: Array<{ key: string; name: string }> | null | undefined
): Array<{ value: string; label: string }> {
  if (!Array.isArray(yearGroups)) return [];
  return sortYearGroups(yearGroups).map((yg) => ({ value: yg.key, label: yg.name }));
}

/**
 * Checks if all required fields for parsing are present and non-empty.
 *
 * @param {Record<string, unknown>} values - Form values to check.
 * @returns {boolean} True if all parse fields are present and non-empty.
 */
function hasAllParseFields(values: Record<string, unknown>): boolean {
  // REQUIRED_PARSE_FIELDS contains known field names that are safe to access on values
  return REQUIRED_PARSE_FIELDS.every((field) => {
    const value = values[field];
    return typeof value === 'string' ? value.trim() !== '' : false;
  });
}

/**
 * Checks if a year group has been selected.
 *
 * @param {Record<string, unknown>} values - Form values to check.
 * @returns {boolean} True if year group is selected (non-empty).
 */
function hasYearGroupSelected(values: Record<string, unknown>): boolean {
  const yearGroup = values.yearGroup;
  return typeof yearGroup === 'string' ? yearGroup.trim() !== '' : false;
}

/**
 * Converts a parsed create baseline to a definition record for consistent handling.
 * Provides a fallback definition shape when query cache lookup fails in create mode.
 *
 * @param {ParsedCreateBaseline} baseline - The parsed baseline from stage-one create.
 * @returns {Record<string, unknown>} The converted definition record.
 */
function convertBaselineToDefinition(baseline: ParsedCreateBaseline): Record<string, unknown> {
  return {
    primaryTitle: baseline.title,
    primaryTopicKey: baseline.topic,
    yearGroupKey: baseline.yearGroup,
    referenceDocumentUrl: baseline.referenceDocumentUrl,
    templateDocumentUrl: baseline.templateDocumentUrl,
    referenceDocumentId: baseline.referenceDocumentId,
    templateDocumentId: baseline.templateDocumentId,
    documentType: baseline.documentType,
  };
}

/**
 * Builds structured error context for wizard mutation errors.
 * Creates a consistent error logging object with correlation IDs and request metadata.
 *
 * @param {ModalMode} mode - The current modal mode (create or update).
 * @param {{ definitionKey: string | null; actionType: string; request: UpsertAssignmentDefinitionRequest }} options - Mutation options.
 * @param {string | null} options.definitionKey - Definition key for update/reparse, or null for create parse.
 * @param {'parse' | 'save' | 'reparse'} options.actionType - Type of mutation action.
 * @param {UpsertAssignmentDefinitionRequest} options.request - Pre-built request object.
 * @param {string | null} errorCode - Extracted error code.
 * @param {string | null} requestId - Extracted request ID.
 * @returns {object} The structured error context for logging.
 */
function buildWizardErrorContext(
  mode: ModalMode,
  options: {
    definitionKey: string | null;
    actionType: string;
    request: UpsertAssignmentDefinitionRequest;
  },
  errorCode: string | null,
  requestId: string | null
): {
  mode: ModalMode;
  definitionKey: string | null;
  actionType: string;
  requestId: string | undefined;
  errorCode: string | undefined;
  requestPayload: UpsertAssignmentDefinitionRequest;
  stack: string | undefined;
} {
  return {
    mode,
    definitionKey: options.definitionKey,
    actionType: options.actionType,
    requestId: requestId ?? undefined,
    errorCode: errorCode ?? undefined,
    requestPayload: options.request,
    stack: undefined,
  };
}

/**
 * Updates form fields with response data after parse/re-parse to reflect persisted state.
 * For parse: updates all metadata fields to reflect persisted state (including the
 * server-defaulted assignmentWeighting in create mode). For reparse: updates document
 * URLs while preserving other metadata.
 *
 * @param {FormInstance} form - The Ant Design form instance.
 * @param {UpsertAssignmentDefinitionResponse} response - The mutation response.
 * @param {string} referenceUrl - Canonical reference document URL.
 * @param {string} templateUrl - Canonical template document URL.
 * @param {'parse' | 'reparse'} actionType - The type of action that produced the response.
 * @returns {void}
 */
function applyParseResponseToForm(
  form: FormInstance,
  response: UpsertAssignmentDefinitionResponse,
  referenceUrl: string,
  templateUrl: string,
  actionType: 'parse' | 'reparse'
): void {
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
  selectedTopicKey?: string;
  selectedYearGroupKey?: string;
  handleFormValuesChange: (
    changedValues: Record<string, unknown>,
    allValues: Record<string, unknown>
  ) => void;
  handleReparse: () => Promise<void>;
  handleReparseCancel: () => void;
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
 * Custom hook for managing assignment definition wizard state and logic.
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitBlockingError, setSubmitBlockingError] = useState<string | null>(null);
  const [selectedTopicKey, setSelectedTopicKey] = useState<string | undefined>();
  const [selectedYearGroupKey, setSelectedYearGroupKey] = useState<string | undefined>();

  // Surface useQuery errors (e.g. ZodError from malformed GAS-serialized response, issue #244)
  // through the wizard's existing blocking error mechanism. Derived rather than stored in state
  // to avoid synchronous setState within an effect.
  const blockingError = deriveBlockingError(
    isDefinitionError,
    definitionError,
    submitBlockingError
  );

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

  /**
   * Handles the response from a parse or re-parse mutation by updating task rows and document state.
   *
   * @param {UpsertAssignmentDefinitionResponse} response - The mutation response containing tasks and document info.
   * @param {'parse' | 'reparse'} actionType - The type of action that produced the response.
   * @returns {void}
   */
  const handleParseResponse = useCallback(
    (response: UpsertAssignmentDefinitionResponse, actionType: 'parse' | 'reparse') => {
      const documentUrls = buildDocumentUrlsFromDefinition(response);
      if (!documentUrls) {
        return;
      }
      const referenceUrl = documentUrls.referenceUrl;
      const templateUrl = documentUrls.templateUrl;
      const newTaskRows = buildTaskRowsFromResponse(response.tasks, taskRows, actionType);

      setTaskRows(newTaskRows);
      setHasParsedTasks(true);
      setDocumentChange({
        hasPendingChange: false,
        previousReferenceUrl: referenceUrl,
        previousTemplateUrl: templateUrl,
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
      applyParseResponseToForm(form, response, referenceUrl, templateUrl, actionType);
    },
    [taskRows, storeParseBaseline, form]
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
   * @param {(definitionKey: string) => void} [onCreateSuccess] - Optional callback for save success in create mode.
   * @param {string | null} [effectiveKey] - The effective key from the request, used as fallback.
   * @returns {UpsertAssignmentDefinitionResponse | undefined} The response to return.
   */
  const handlePostMutation = useCallback(
    (
      actionType: 'parse' | 'save' | 'reparse',
      response: UpsertAssignmentDefinitionResponse | undefined,
      effectiveKey: string | null,
      onCreateSuccess?: (definitionKey: string) => void
    ): UpsertAssignmentDefinitionResponse | undefined => {
      if (actionType === 'save') {
        if (onCreateSuccess) {
          const key = response?.definitionKey ?? effectiveKey;
          if (key) {
            onCreateSuccess(key);
          }
          return undefined;
        }
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
   * @param {(definitionKey: string) => void} [options.onCreateSuccess] - Optional callback for save success in create mode.
   * @returns {Promise<UpsertAssignmentDefinitionResponse | undefined>} Resolves with response for parse/reparse, undefined otherwise.
   */
  const runWizardMutation = useCallback(
    async (options: {
      actionType: 'parse' | 'save' | 'reparse';
      request: UpsertAssignmentDefinitionRequest;
      definitionKey: string | null;
      onCreateSuccess?: (definitionKey: string) => void;
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
        return handlePostMutation(
          options.actionType,
          response,
          options.definitionKey,
          options.onCreateSuccess
        );
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
        setSubmitBlockingError(userSafeMessage);
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
    await runWizardMutation({
      actionType: 'save',
      request,
      definitionKey: effectiveKey,
      onCreateSuccess,
    });
  }, [form, taskRows, definitionKey, localDefinitionKey, runWizardMutation, onCreateSuccess]);

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
