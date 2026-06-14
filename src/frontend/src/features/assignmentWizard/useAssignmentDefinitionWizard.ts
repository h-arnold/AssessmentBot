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
import {
  type AssignmentDefinition,
  type UpsertAssignmentDefinitionResponse,
  type UpsertAssignmentDefinitionRequest,
  upsertAssignmentDefinition,
} from '../../services/assignmentDefinition/assignmentDefinitionService';

export type ModalMode = 'create' | 'update';

export type TaskRow = Readonly<{
  key: string;
  taskId: string;
  taskTitle: string;
  taskWeighting: number;
}>;

export type DocumentChangeState = Readonly<{
  hasPendingChange: boolean;
  previousReferenceUrl: string;
  previousTemplateUrl: string;
}>;

type ParsedCreateBaseline = Readonly<{
  title: string;
  topic: string;
  yearGroup: string;
  referenceDocumentUrl: string;
  templateDocumentUrl: string;
  referenceDocumentId: string;
  templateDocumentId: string;
  documentType: 'SLIDES' | 'SHEETS';
  assignmentWeighting: number | null;
  taskWeightings: ReadonlyMap<string, number>;
}>;

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
 * Builds a canonical Google Docs/Sheets URL from a document ID and type.
 *
 * @param {string} documentId - The Google document ID.
 * @param {'SLIDES' | 'SHEETS'} documentType - The type of Google document.
 * @returns {string} The canonical URL.
 */
function buildCanonicalUrl(documentId: string, documentType: 'SLIDES' | 'SHEETS'): string {
  const base =
    documentType === 'SLIDES'
      ? 'https://docs.google.com/presentation/d'
      : 'https://docs.google.com/spreadsheets/d';
  return `${base}/${documentId}/edit`;
}

/**
 * Builds document URL restoration data from a definition.
 * Used to restore document URLs when canceling re-parse operations.
 *
 * @param {Record<string, unknown>} definition - The definition containing document info.
 * @returns {{ referenceUrl: string; templateUrl: string } | null} The restored URLs or null if not available.
 */
function buildDocumentUrlsFromDefinition(
  definition: Record<string, unknown>
): { referenceUrl: string; templateUrl: string } | null {
  const resolvedDocumentType = definition.documentType as 'SLIDES' | 'SHEETS';
  const resolvedReferenceDocumentId = definition.referenceDocumentId as string;
  const resolvedTemplateDocumentId = definition.templateDocumentId as string;

  if (!resolvedDocumentType || !resolvedReferenceDocumentId || !resolvedTemplateDocumentId) {
    return null;
  }

  return {
    referenceUrl: buildCanonicalUrl(resolvedReferenceDocumentId, resolvedDocumentType),
    templateUrl: buildCanonicalUrl(resolvedTemplateDocumentId, resolvedDocumentType),
  };
}

/**
 * Applies initial form values from initialValues to the form and synchronises
 * selectedTopicKey/selectedYearGroupKey state in create mode.
 * Converts empty strings to undefined for SelectWithAddNew compatibility.
 *
 * @param {FormInstance} form - The Ant Design form instance.
 * @param {Readonly<{ title?: string; topic?: string; yearGroup?: string }>} initialValues - Values to apply.
 * @param {(key: string | undefined) => void} setSelectedTopicKey - State setter for selected topic.
 * @param {(key: string | undefined) => void} setSelectedYearGroupKey - State setter for selected year group.
 * @returns {void}
 */
function applyFormInitialValues(
  form: FormInstance,
  initialValues: Readonly<{ title?: string; topic?: string; yearGroup?: string }>,
  setSelectedTopicKey: (key: string | undefined) => void,
  setSelectedYearGroupKey: (key: string | undefined) => void
): void {
  const fieldsToSet: Record<string, unknown> = {};
  if (initialValues.title !== undefined) fieldsToSet.title = initialValues.title;
  if (initialValues.topic !== undefined) fieldsToSet.topic = initialValues.topic;
  if (initialValues.yearGroup !== undefined) fieldsToSet.yearGroup = initialValues.yearGroup;
  form.setFieldsValue(fieldsToSet);
  setSelectedTopicKey(initialValues.topic || undefined);
  setSelectedYearGroupKey(initialValues.yearGroup || undefined);
}

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
 * Custom hook to handle form initialization for the assignment definition wizard.
 * Manages modal open/close state, form reset, definition hydration, and dirty state tracking.
 *
 * @param {boolean} open - Whether the modal is open.
 * @param {boolean} isCreateMode - Whether in create mode.
 * @param {FormInstance} form - The Ant Design form instance.
 * @param {AssignmentDefinition | null | undefined} definition - The definition to hydrate from in update mode.
 * @param {Record<string, unknown>} formValues - Current form values for dirty state calculation.
 * @param {TaskRow[]} taskRows - Current task rows for dirty state calculation.
 * @param {boolean} hasParsedTasks - Whether tasks have been parsed.
 * @param {function} setHasParsedTasks - State setter for parsed tasks flag.
 * @param {function} setTaskRows - State setter for task rows.
 * @param {function} setDocumentChange - State setter for document change state.
 * @param {function} setHasDirtyEdits - State setter for dirty edits flag.
 * @param {function} setBlockingError - State setter for blocking error.
 * @param {function} setLocalDefinitionKey - State setter for local definition key.
 * @param {string | null} localDefinitionKey - The local definition key from parse response in create mode.
 * @param {QueryClient} queryClient - The React Query client for accessing cached data.
 * @returns {{ storeParseBaseline: (response: UpsertAssignmentDefinitionResponse) => void; getParsedCreateBaseline: () => ParsedCreateBaseline | null }} Initialization state and baseline setter.
 */
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
  setBlockingError: (error: string | null) => void;
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
    setBlockingError,
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
    setBlockingError(null);
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
    setBlockingError,
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
    const referenceUrl = buildCanonicalUrl(response.referenceDocumentId, response.documentType);
    const templateUrl = buildCanonicalUrl(response.templateDocumentId, response.documentType);

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
        const referenceUrl = buildCanonicalUrl(
          cachedDefinition.referenceDocumentId,
          cachedDefinition.documentType
        );
        const templateUrl = buildCanonicalUrl(
          cachedDefinition.templateDocumentId,
          cachedDefinition.documentType
        );

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
  return yearGroups.map((yg) => ({ value: yg.key, label: yg.name }));
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
    // eslint-disable-next-line security/detect-object-injection -- field comes from hardcoded REQUIRED_PARSE_FIELDS constant, not user input; false positive
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
 * Checks if metadata values differ from baseline in create mode.
 *
 * @param {Record<string, unknown>} values - Form values.
 * @param {ParsedCreateBaseline} parsedCreateBaseline - Parsed baseline.
 * @returns {boolean} True if there are metadata changes.
 */
function hasCreateModeMetadataChanges(
  values: Record<string, unknown>,
  parsedCreateBaseline: ParsedCreateBaseline
): boolean {
  const currentAssignmentWeighting =
    typeof values.assignmentWeighting === 'number'
      ? values.assignmentWeighting
      : DEFAULT_WEIGHTING_VALUE;

  return (
    values.title !== parsedCreateBaseline.title ||
    values.topic !== parsedCreateBaseline.topic ||
    values.yearGroup !== parsedCreateBaseline.yearGroup ||
    values.referenceDocumentUrl !== parsedCreateBaseline.referenceDocumentUrl ||
    values.templateDocumentUrl !== parsedCreateBaseline.templateDocumentUrl ||
    currentAssignmentWeighting !== parsedCreateBaseline.assignmentWeighting
  );
}

/**
 * Checks if task weighting values differ from baseline in create mode.
 *
 * @param {TaskRow[]} taskRows - Current task rows.
 * @param {ParsedCreateBaseline} parsedCreateBaseline - Parsed baseline.
 * @returns {boolean} True if there are task weighting changes.
 */
function hasCreateModeTaskWeightingChanges(
  taskRows: TaskRow[],
  parsedCreateBaseline: ParsedCreateBaseline
): boolean {
  return taskRows.some(
    (row) => parsedCreateBaseline.taskWeightings.get(row.taskId) !== row.taskWeighting
  );
}

/**
 * Hydrates form and state from a definition record.
 * Extracts document URLs and populates form fields, task rows, and document change state.
 *
 * @param {FormInstance} form - The Ant Design form instance.
 * @param {AssignmentDefinition} definition - The definition to hydrate from.
 * @param {function} setTaskRows - State setter for task rows.
 * @param {function} setHasParsedTasks - State setter for parsed tasks flag.
 * @param {function} setDocumentChange - State setter for document change state.
 * @returns {void}
 */
function hydrateFormFromDefinition(
  form: FormInstance,
  definition: AssignmentDefinition,
  setTaskRows: (rows: TaskRow[]) => void,
  setHasParsedTasks: (value: boolean) => void,
  setDocumentChange: (state: DocumentChangeState) => void
): void {
  const urls = buildDocumentUrlsFromDefinition(definition);
  const referenceUrl = urls?.referenceUrl ?? '';
  const templateUrl = urls?.templateUrl ?? '';

  form.setFieldsValue({
    title: definition.primaryTitle,
    topic: definition.primaryTopicKey,
    yearGroup: definition.yearGroupKey,
    referenceDocumentUrl: referenceUrl,
    templateDocumentUrl: templateUrl,
    assignmentWeighting: definition.assignmentWeighting,
  });

  setTaskRows(
    definition.tasks.map((t) => ({
      key: t.taskId,
      taskId: t.taskId,
      taskTitle: t.taskTitle,
      taskWeighting: t.taskWeighting,
    }))
  );

  setHasParsedTasks(true);
  setDocumentChange({
    hasPendingChange: false,
    previousReferenceUrl: referenceUrl,
    previousTemplateUrl: templateUrl,
  });
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
 * Detects document change state based on form values and current URLs.
 * Determines if document URLs have changed and returns appropriate change state.
 *
 * @param {Record<string, unknown>} allValues - All form values.
 * @param {{ referenceUrl: string; templateUrl: string }} urls - Current effective URLs.
 * @param {string} urls.referenceUrl - Current reference document URL.
 * @param {string} urls.templateUrl - Current template document URL.
 * @param {boolean} hasPendingChange - Current pending change flag.
 * @returns {DocumentChangeState} The detected document change state.
 */
function detectDocumentChange(
  allValues: Record<string, unknown>,
  urls: { referenceUrl: string; templateUrl: string },
  hasPendingChange: boolean
): DocumentChangeState {
  const referenceChanged = allValues.referenceDocumentUrl !== urls.referenceUrl;
  const templateChanged = allValues.templateDocumentUrl !== urls.templateUrl;

  if (referenceChanged || templateChanged) {
    return {
      hasPendingChange: true,
      previousReferenceUrl: urls.referenceUrl,
      previousTemplateUrl: urls.templateUrl,
    };
  } else if (hasPendingChange) {
    return {
      hasPendingChange: false,
      previousReferenceUrl: urls.referenceUrl,
      previousTemplateUrl: urls.templateUrl,
    };
  }
  return {
    hasPendingChange: false,
    previousReferenceUrl: urls.referenceUrl,
    previousTemplateUrl: urls.templateUrl,
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
 * Checks if form values differ from baseline in create mode.
 *
 * @param {Record<string, unknown>} values - Form values.
 * @param {ParsedCreateBaseline} parsedCreateBaseline - Parsed baseline.
 * @param {TaskRow[]} taskRows - Current task rows.
 * @returns {boolean} True if there are dirty edits.
 */
function hasCreateModeDirtyEdits(
  values: Record<string, unknown>,
  parsedCreateBaseline: ParsedCreateBaseline,
  taskRows: TaskRow[]
): boolean {
  const hasMetadataChanges = hasCreateModeMetadataChanges(values, parsedCreateBaseline);
  const hasTaskWeightingChanges = hasCreateModeTaskWeightingChanges(taskRows, parsedCreateBaseline);

  return hasMetadataChanges || hasTaskWeightingChanges;
}

/**
 * Checks if form values differ from definition in update mode.
 *
 * @param {Record<string, unknown>} values - Form values.
 * @param {Record<string, unknown>} definition - Definition.
 * @param {TaskRow[]} taskRows - Current task rows.
 * @returns {boolean} True if there are dirty edits.
 */
function hasUpdateModeDirtyEdits(
  values: Record<string, unknown>,
  definition: Record<string, unknown>,
  taskRows: TaskRow[]
): boolean {
  const currentAssignmentWeighting =
    typeof values.assignmentWeighting === 'number'
      ? values.assignmentWeighting
      : DEFAULT_WEIGHTING_VALUE;

  const hasMetadataChanges =
    values.title !== definition.primaryTitle ||
    values.topic !== definition.primaryTopicKey ||
    values.yearGroup !== definition.yearGroupKey ||
    currentAssignmentWeighting !== definition.assignmentWeighting;

  const hasTaskWeightingChanges = taskRows.some((row) => {
    const tasks = definition.tasks;
    if (!Array.isArray(tasks)) return false;
    const task = tasks.find(
      (candidate): candidate is { taskId: string; taskWeighting: number } =>
        typeof candidate === 'object' &&
        candidate !== null &&
        'taskId' in candidate &&
        'taskWeighting' in candidate &&
        typeof candidate.taskId === 'string' &&
        typeof candidate.taskWeighting === 'number' &&
        candidate.taskId === row.taskId
    );
    return task === undefined ? false : task.taskWeighting !== row.taskWeighting;
  });

  return hasMetadataChanges || hasTaskWeightingChanges;
}

/**
 * Calculates whether there are dirty edits based on current state.
 *
 * @param {Record<string, unknown>} values - Form values.
 * @param {ParsedCreateBaseline | null} parsedCreateBaseline - Parsed baseline for create mode.
 * @param {Record<string, unknown> | null | undefined} definition - Definition for update mode.
 * @param {TaskRow[]} taskRows - Current task rows.
 * @param {boolean} isCreateMode - Whether in create mode.
 * @param {boolean} hasParsedTasks - Whether tasks have been parsed.
 * @returns {boolean} True if there are dirty edits.
 */
function calculateDirtyState(
  values: Record<string, unknown>,
  parsedCreateBaseline: ParsedCreateBaseline | null,
  definition: Record<string, unknown> | null | undefined,
  taskRows: TaskRow[],
  isCreateMode: boolean,
  hasParsedTasks: boolean
): boolean {
  if (isCreateMode) {
    return hasParsedTasks && parsedCreateBaseline !== null
      ? hasCreateModeDirtyEdits(values, parsedCreateBaseline, taskRows)
      : false;
  }

  return definition ? hasUpdateModeDirtyEdits(values, definition, taskRows) : false;
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
  const hasAppliedInitialValues = useRef(false);

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
  const [blockingError, setBlockingError] = useState<string | null>(null);
  const [selectedTopicKey, setSelectedTopicKey] = useState<string | undefined>();
  const [selectedYearGroupKey, setSelectedYearGroupKey] = useState<string | undefined>();

  // Surface useQuery errors (e.g. ZodError from malformed GAS-serialized response, issue #244)
  // through the wizard's existing blocking error mechanism
  useEffect(() => {
    if (isDefinitionError && definitionError) {
      setBlockingError(mapErrorToUserMessage(definitionError));
    }
  }, [isDefinitionError, definitionError, open, setBlockingError]);

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

  // Reset the initial-values guard when the modal closes so values are re-applied on next open
  useEffect(() => {
    if (!open) {
      hasAppliedInitialValues.current = false;
    }
  }, [open]);

  // Apply initialValues in create mode after form initialization (form.resetFields in create mode)
  // Guarded by a ref to prevent re-application when the initialValues object reference changes
  // due to background query refetches
  useEffect(() => {
    if (!open || !isCreateMode || !initialValues) return;
    if (hasAppliedInitialValues.current) return;
    hasAppliedInitialValues.current = true;
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
