import { type FormInstance } from 'antd';
import { DEFAULT_WEIGHTING_VALUE } from '../../services/assignmentDefinition/assignmentDefinition.zod';
import { type AssignmentDefinition } from '../../services/assignmentDefinition/assignmentDefinitionService';
import { type useStartupWarmupState } from '../auth/startupWarmupState';
import { sortYearGroups } from '../referenceData/yearGroupSorting';

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

export type ParsedCreateBaseline = Readonly<{
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
export function applyFormInitialValues(
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
 * Builds task rows from response tasks, optionally preserving existing weightings for re-parse.
 *
 * @param {Array<{ taskId: string; taskTitle: string; taskWeighting: number }>} responseTasks - Tasks from the response.
 * @param {TaskRow[]} existingTaskRows - Current task rows for weighting preservation on re-parse.
 * @param {'parse' | 'reparse'} actionType - Whether this is a parse or re-parse action.
 * @returns {TaskRow[]} New task rows.
 */
export function buildTaskRowsFromResponse(
  responseTasks: Array<{ taskId: string; taskTitle: string; taskWeighting: number }>,
  existingTaskRows: TaskRow[],
  actionType: 'parse' | 'reparse'
): TaskRow[] {
  const existingWeightings =
    actionType === 'reparse'
      ? new Map(existingTaskRows.map((row) => [row.taskId, row.taskWeighting]))
      : null;

  const newTaskRows: TaskRow[] = responseTasks.map((t) => ({
    key: t.taskId,
    taskId: t.taskId,
    taskTitle: t.taskTitle,
    taskWeighting: existingWeightings?.get(t.taskId) ?? t.taskWeighting,
  }));

  return newTaskRows;
}

/**
 * Form fields that must be non-empty before a stage-one parse can run.
 */
const REQUIRED_PARSE_FIELDS = [
  'title',
  'topic',
  'yearGroup',
  'referenceDocumentUrl',
  'templateDocumentUrl',
] as const;

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
  return topics.map((topic) => ({ value: topic.key, label: topic.name }));
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
  return sortYearGroups(yearGroups).map((yearGroup) => ({
    value: yearGroup.key,
    label: yearGroup.name,
  }));
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
