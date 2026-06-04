import { type FormInstance } from 'antd';
import { type useStartupWarmupState } from '../../features/auth/startupWarmupState';
import { DEFAULT_WEIGHTING_VALUE } from '../../services/assignmentDefinition.zod';
import {
  type AssignmentDefinition,
  type UpsertAssignmentDefinitionRequest,
} from '../../services/assignmentDefinitionService';
import {
  type DocumentChangeState,
  type ModalMode,
  type ParsedCreateBaseline,
  type TaskRow,
} from './types';

const REQUIRED_PARSE_FIELDS = [
  'title',
  'topic',
  'yearGroup',
  'referenceDocumentUrl',
  'templateDocumentUrl',
] as const;

/**
 * Builds a canonical Google Docs/Sheets URL from a document ID and type.
 *
 * @param {string} documentId - The Google document ID.
 * @param {'SLIDES' | 'SHEETS'} documentType - The type of Google document.
 * @returns {string} The canonical URL.
 */
export function buildCanonicalUrl(documentId: string, documentType: 'SLIDES' | 'SHEETS'): string {
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
export function buildDocumentUrlsFromDefinition(
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
 * Builds topic options from topics array.
 *
 * @param {Array<{ key: string; name: string }> | null | undefined} topics - Topics array.
 * @returns {Array<{ value: string; label: string }>} Topic options for Select component.
 */
export function buildTopicOptions(
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
export function buildYearGroupOptions(
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
export function hasAllParseFields(values: Record<string, unknown>): boolean {
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
export function hasYearGroupSelected(values: Record<string, unknown>): boolean {
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
export function hasCreateModeMetadataChanges(
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
export function hasCreateModeTaskWeightingChanges(
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
export function hydrateFormFromDefinition(
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
export function convertBaselineToDefinition(
  baseline: ParsedCreateBaseline
): Record<string, unknown> {
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
export function detectDocumentChange(
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
export function buildWizardErrorContext(
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
export function hasCreateModeDirtyEdits(
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
export function hasUpdateModeDirtyEdits(
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
export function calculateDirtyState(
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
 * Derives reference data state from startup warmup state and query loading states.
 * Determines whether reference data is trustworthy, loading, or blocked.
 *
 * @param {ReturnType<typeof useStartupWarmupState>} startupWarmupState - The startup warmup state.
 * @param {boolean} isTopicsLoading - Whether topics are currently loading.
 * @param {boolean} isYearGroupsLoading - Whether year groups are currently loading.
 * @param {boolean} open - Whether the modal is open.
 * @returns {{ hasTrustworthyReferenceData: boolean; isReferenceDataLoading: boolean; isReferenceDataBlocked: boolean }} Reference data state.
 */
export function deriveReferenceDataState(
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
export function derivePrimaryActionState(
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
