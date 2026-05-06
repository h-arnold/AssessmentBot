import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Form } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStartupWarmupState } from '../features/auth/startupWarmupState';
import { logFrontendError } from '../logging/frontendLogger';
import { queryKeys } from '../query/queryKeys';
import {
  getAssignmentDefinitionQueryOptions,
  getAssignmentTopicsQueryOptions,
  getYearGroupsQueryOptions,
} from '../query/sharedQueries';
import {
  DEFAULT_WEIGHTING_VALUE,
} from '../services/assignmentDefinition.zod';
import { upsertAssignmentDefinition, type UpsertAssignmentDefinitionRequest } from '../services/assignmentDefinitionService';

type ModalMode = 'create' | 'update';

type TaskRow = { key: string; taskId: string; taskTitle: string; taskWeighting: number };

type DocumentChangeState = { hasPendingChange: boolean; previousReferenceUrl: string; previousTemplateUrl: string };

type ParsedCreateBaseline = Readonly<{
  title: string;
  topic: string;
  yearGroup: string;
  referenceDocumentUrl: string;
  templateDocumentUrl: string;
  assignmentWeighting: number;
  taskWeightings: ReadonlyMap<string, number>;
}>;

export type AssignmentDefinitionWizardModalProperties = Readonly<{
  open: boolean;
  mode: ModalMode;
  definitionKey: string | null;
  onClose: () => void;
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

const REQUIRED_PARSE_FIELDS = [
  'title',
  'topic',
  'yearGroup',
  'referenceDocumentUrl',
  'templateDocumentUrl',
] as const;

/**
 * Checks if all required fields for parsing are present and non-empty.
 *
 * @param {Record<string, unknown>} values - Form values to check.
 * @returns {boolean} True if all parse fields are present and non-empty.
 */
function hasAllParseFields(values: Record<string, unknown>): boolean {
  return REQUIRED_PARSE_FIELDS.every((field) => String(values[field as keyof typeof values] ?? '').trim() !== '');
}

/**
 * Checks if a year group has been selected.
 *
 * @param {Record<string, unknown>} values - Form values to check.
 * @returns {boolean} True if year group is selected (non-empty).
 */
function hasYearGroupSelected(values: Record<string, unknown>): boolean {
  return String(values.yearGroup ?? '').trim() !== '';
}

/**
 * Builds the save request object from form values and task rows.
 *
 * @param {Record<string, unknown>} values - Form values.
 * @param {TaskRow[]} taskRows - Current task rows.
 * @param {string | null} definitionKey - Definition key for updates.
 * @returns {UpsertAssignmentDefinitionRequest} The save request object.
 */
function buildSaveRequest(
  values: Record<string, unknown>,
  taskRows: TaskRow[],
  definitionKey: string | null
): UpsertAssignmentDefinitionRequest {
  return {
    ...(definitionKey && { definitionKey }),
    primaryTitle: (values.title as string) || '',
    primaryTopicKey: values.topic as string,
    yearGroupKey: values.yearGroup as string,
    referenceDocumentUrl: values.referenceDocumentUrl as string,
    templateDocumentUrl: values.templateDocumentUrl as string,
    assignmentWeighting: (values.assignmentWeighting as number) ?? DEFAULT_WEIGHTING_VALUE,
    taskWeightings: taskRows.map((row) => ({ taskId: row.taskId, taskWeighting: row.taskWeighting })),
  };
}

/**
 * Builds the re-parse request object from form values.
 *
 * @param {Record<string, unknown>} values - Form values.
 * @param {string} definitionKey - Definition key.
 * @returns {UpsertAssignmentDefinitionRequest} The re-parse request object.
 */
function buildReparseRequest(
  values: Record<string, unknown>,
  definitionKey: string
): UpsertAssignmentDefinitionRequest {
  return {
    definitionKey,
    primaryTitle: (values.title as string) || '',
    primaryTopicKey: values.topic as string,
    yearGroupKey: values.yearGroup as string,
    referenceDocumentUrl: values.referenceDocumentUrl as string,
    templateDocumentUrl: values.templateDocumentUrl as string,
    assignmentWeighting: (values.assignmentWeighting as number) ?? DEFAULT_WEIGHTING_VALUE,
    taskWeightings: [],
  };
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
    typeof values.assignmentWeighting === 'number' ? values.assignmentWeighting : DEFAULT_WEIGHTING_VALUE;
  
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
    typeof values.assignmentWeighting === 'number' ? values.assignmentWeighting : DEFAULT_WEIGHTING_VALUE;
  
  const hasMetadataChanges =
    values.title !== definition.primaryTitle ||
    values.topic !== definition.primaryTopicKey ||
    values.yearGroup !== definition.yearGroupKey ||
    currentAssignmentWeighting !== definition.assignmentWeighting;
  
  const hasTaskWeightingChanges = taskRows.some((row) => {
    const task = definition.tasks.find((t: Record<string, unknown>) => t.taskId === row.taskId);
    return task === undefined ? false : task.taskWeighting !== row.taskWeighting;
  });
  
  return hasMetadataChanges || hasTaskWeightingChanges;
}

/**
 * Calculates whether there are dirty edits based on current state.
 *
 * @param {Record<string, unknown>} values - Form values.
 * @param {ParsedCreateBaseline | null} parsedCreateBaseline - Parsed baseline for create mode.
 * @param {import('../services/assignmentDefinitionService').AssignmentDefinition | null} definition - Definition for update mode.
 * @param {TaskRow[]} taskRows - Current task rows.
 * @param {boolean} isCreateMode - Whether in create mode.
 * @param {boolean} hasParsedTasks - Whether tasks have been parsed.
 * @returns {boolean} True if there are dirty edits.
 */
function calculateDirtyState(
  values: Record<string, unknown>,
  parsedCreateBaseline: ParsedCreateBaseline | null,
  definition: Record<string, unknown> | null,
  taskRows: TaskRow[],
  isCreateMode: boolean,
  hasParsedTasks: boolean
): boolean {
  if (isCreateMode) {
    if (!hasParsedTasks || parsedCreateBaseline === null) {
      return false;
    }
    return hasCreateModeDirtyEdits(values, parsedCreateBaseline, taskRows);
  }

  if (!isCreateMode && definition) {
    return hasUpdateModeDirtyEdits(values, definition, taskRows);
  }

  return false;
}

export type UseAssignmentDefinitionWizardReturn = Readonly<{
  form: Record<string, unknown>;
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
  handleFormValuesChange: (changedValues: Record<string, unknown>, allValues: Record<string, unknown>) => void;
  handleReparse: () => Promise<void>;
  handleReparseCancel: () => void;
  handleClose: () => void;
  handleDiscardConfirm: () => void;
  handleKeepEditing: () => void;
  handleTaskWeightingChange: (taskId: string, value: number | null) => void;
  handlePrimaryAction: () => void;
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
  const { open, mode, definitionKey, onClose } = properties;
  const isCreateMode = mode === 'create';

  const queryClient = useQueryClient();
  const startupWarmupState = useStartupWarmupState();
  const [form] = Form.useForm();
  const isHydratingDefinitionReference = useRef(false);
  const parsedCreateBaselineReference = useRef<ParsedCreateBaseline | null>(null);

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

  const upsertMutation = useMutation({
    mutationFn: upsertAssignmentDefinition,
  });

  const hasTrustworthyReferenceData =
    startupWarmupState.isDatasetReady('assignmentTopics') &&
    startupWarmupState.isDatasetReady('yearGroups') &&
    !startupWarmupState.isDatasetFailed('assignmentTopics') &&
    !startupWarmupState.isDatasetFailed('yearGroups');

  const isReferenceDataLoading = isTopicsLoading || isYearGroupsLoading;
  const isReferenceDataBlocked = open && !hasTrustworthyReferenceData && !isReferenceDataLoading;

  const topicOptions = useMemo(() => {
    if (!Array.isArray(topics)) return [];
    return topics.map((t) => ({ value: t.key, label: t.name }));
  }, [topics]);

  const yearGroupOptions = useMemo(() => {
    if (!Array.isArray(yearGroups)) return [];
    return yearGroups.map((yg) => ({ value: yg.key, label: yg.name }));
  }, [yearGroups]);

  const primaryActionLabel = isCreateMode && !hasParsedTasks ? 'Parse and continue' : 'Save';

  const watchedFormValues = Form.useWatch([], form);
  const formValues = useMemo(() => watchedFormValues ?? {}, [watchedFormValues]);
  const isPrimaryActionDisabled = isCreateMode && !hasParsedTasks
    ? !hasAllParseFields(formValues)
    : !hasYearGroupSelected(formValues);

  // Initialize modal
  useEffect(() => {
    if (!open) {
      isHydratingDefinitionReference.current = false;
      parsedCreateBaselineReference.current = null;
      return;
    }

    setHasParsedTasks(false);
    setTaskRows([]);
    setDocumentChange({ hasPendingChange: false, previousReferenceUrl: '', previousTemplateUrl: '' });
    setHasDirtyEdits(false);
    setBlockingError(null);

    if (!isCreateMode && definition) {
      parsedCreateBaselineReference.current = null;
      isHydratingDefinitionReference.current = true;
      const documentType = definition.documentType;
      form.setFieldsValue({
        title: definition.primaryTitle,
        topic: definition.primaryTopicKey,
        yearGroup: definition.yearGroupKey,
        referenceDocumentUrl: buildCanonicalUrl(definition.referenceDocumentId, documentType),
        templateDocumentUrl: buildCanonicalUrl(definition.templateDocumentId, documentType),
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
        previousReferenceUrl: buildCanonicalUrl(definition.referenceDocumentId, documentType),
        previousTemplateUrl: buildCanonicalUrl(definition.templateDocumentId, documentType),
      });
      queueMicrotask(() => {
        isHydratingDefinitionReference.current = false;
      });
    } else if (isCreateMode) {
      isHydratingDefinitionReference.current = false;
      parsedCreateBaselineReference.current = null;
      form.resetFields();
    }
  }, [open, mode, definition, form, isCreateMode]);

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
  }, [formValues, definition, hasParsedTasks, isCreateMode, taskRows]);

  // Handle document change detection
  const handleFormValuesChange = useCallback(
    (changedValues: Record<string, unknown>, allValues: Record<string, unknown>) => {
      if ((!isCreateMode || hasParsedTasks) && definition) {
        const documentType = definition.documentType;
        const previousReferenceUrl = buildCanonicalUrl(definition.referenceDocumentId, documentType);
        const previousTemplateUrl = buildCanonicalUrl(definition.templateDocumentId, documentType);
        const referenceChanged = allValues.referenceDocumentUrl !== previousReferenceUrl;
        const templateChanged = allValues.templateDocumentUrl !== previousTemplateUrl;

        if (referenceChanged || templateChanged) {
          setDocumentChange({ hasPendingChange: true, previousReferenceUrl, previousTemplateUrl });
        } else if (documentChange.hasPendingChange) {
          setDocumentChange({ hasPendingChange: false, previousReferenceUrl, previousTemplateUrl });
        }
      }
    },
    [hasParsedTasks, isCreateMode, definition, documentChange.hasPendingChange]
  );

  // Handle parse and continue
  const handleParseAndContinue = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const values = await form.validateFields();
      const request: UpsertAssignmentDefinitionRequest = {
        primaryTitle: (values.title as string) || '',
        primaryTopicKey: values.topic as string,
        yearGroupKey: values.yearGroup as string,
        referenceDocumentUrl: values.referenceDocumentUrl as string,
        templateDocumentUrl: values.templateDocumentUrl as string,
      };
      const response = await upsertMutation.mutateAsync(request);
      setTaskRows(
        response.tasks.map((t) => ({
          key: t.taskId,
          taskId: t.taskId,
          taskTitle: t.taskTitle,
          taskWeighting: t.taskWeighting,
        }))
      );
      setHasParsedTasks(true);
      const documentType = response.documentType;
      setDocumentChange({
        hasPendingChange: false,
        previousReferenceUrl: buildCanonicalUrl(response.referenceDocumentId, documentType),
        previousTemplateUrl: buildCanonicalUrl(response.templateDocumentId, documentType),
      });
      parsedCreateBaselineReference.current = {
        title: request.primaryTitle,
        topic: request.primaryTopicKey,
        yearGroup: request.yearGroupKey,
        referenceDocumentUrl: request.referenceDocumentUrl,
        templateDocumentUrl: request.templateDocumentUrl,
        assignmentWeighting: DEFAULT_WEIGHTING_VALUE,
        taskWeightings: new Map(response.tasks.map((task) => [task.taskId, task.taskWeighting])),
      };
      await queryClient.invalidateQueries({ queryKey: queryKeys.assignmentDefinitionPartials() });
      void queryClient.fetchQuery({ queryKey: queryKeys.assignmentDefinitionPartials() });
      setHasDirtyEdits(false);
    } catch (error) {
      logFrontendError('AssignmentDefinitionWizardModal.handleParseAndContinue', error, { mode: 'create' });
      setBlockingError('Required reference data could not be trusted or loaded.');
    } finally {
      setIsSubmitting(false);
    }
  }, [form, isSubmitting, upsertMutation, queryClient]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const values = await form.validateFields();
      const request = buildSaveRequest(values, taskRows, definitionKey);
      await upsertMutation.mutateAsync(request);
      await queryClient.invalidateQueries({ queryKey: queryKeys.assignmentDefinitionPartials() });
      if (definitionKey) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.assignmentDefinitionByKey(definitionKey) });
      }
      try {
        await queryClient.fetchQuery({ queryKey: queryKeys.assignmentDefinitionPartials() });
      } catch {
        setBlockingError('Required reference data could not be trusted or loaded.');
        return;
      }
      onClose();
    } catch (error) {
      logFrontendError('AssignmentDefinitionWizardModal.handleSave', error, { mode, definitionKey });
      setBlockingError('Required reference data could not be trusted or loaded.');
    } finally {
      setIsSubmitting(false);
    }
  }, [form, isSubmitting, taskRows, definitionKey, mode, upsertMutation, queryClient, onClose]);

  // Handle re-parse
  const handleReparse = useCallback(async () => {
    if (isSubmitting || !definitionKey) return;
    setIsSubmitting(true);
    try {
      const values = form.getFieldsValue();
      const request = buildReparseRequest(values, definitionKey);
      const response = await upsertMutation.mutateAsync(request);
      const existingWeightings = new Map(taskRows.map((row) => [row.taskId, row.taskWeighting]));
      setTaskRows(
        response.tasks.map((t) => ({
          key: t.taskId,
          taskId: t.taskId,
          taskTitle: t.taskTitle,
          taskWeighting: existingWeightings.get(t.taskId) ?? DEFAULT_WEIGHTING_VALUE,
        }))
      );
      setHasParsedTasks(true);
      const documentType = response.documentType;
      setDocumentChange({
        hasPendingChange: false,
        previousReferenceUrl: buildCanonicalUrl(response.referenceDocumentId, documentType),
        previousTemplateUrl: buildCanonicalUrl(response.templateDocumentId, documentType),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.assignmentDefinitionPartials() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.assignmentDefinitionByKey(definitionKey) });
      void queryClient.fetchQuery({ queryKey: queryKeys.assignmentDefinitionPartials() });
      setHasDirtyEdits(false);
    } catch (error) {
      logFrontendError('AssignmentDefinitionWizardModal.handleReparse', error, { definitionKey });
      setBlockingError('Required reference data could not be trusted or loaded.');
    } finally {
      setIsSubmitting(false);
    }
  }, [form, isSubmitting, definitionKey, taskRows, upsertMutation, queryClient]);

  // Handle re-parse cancel
  const handleReparseCancel = useCallback(() => {
    if (!definition) return;
    const documentType = definition.documentType;
    form.setFieldsValue({
      referenceDocumentUrl: buildCanonicalUrl(definition.referenceDocumentId, documentType),
      templateDocumentUrl: buildCanonicalUrl(definition.templateDocumentId, documentType),
    });
    setDocumentChange({
      hasPendingChange: false,
      previousReferenceUrl: buildCanonicalUrl(definition.referenceDocumentId, documentType),
      previousTemplateUrl: buildCanonicalUrl(definition.templateDocumentId, documentType),
    });
  }, [form, definition]);

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

  const handleTaskWeightingChange = useCallback(
    (taskId: string, value: number | null) => {
      setTaskRows((previous) =>
        previous.map((row) =>
          row.taskId === taskId ? { ...row, taskWeighting: value ?? DEFAULT_WEIGHTING_VALUE } : row
        )
      );
    },
    []
  );

  const handlePrimaryAction = useCallback(() => {
    const action = isCreateMode && !hasParsedTasks ? handleParseAndContinue : handleSave;
    void action();
  }, [isCreateMode, hasParsedTasks, handleParseAndContinue, handleSave]);

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
    handleFormValuesChange,
    handleReparse,
    handleReparseCancel,
    handleClose,
    handleDiscardConfirm,
    handleKeepEditing,
    handleTaskWeightingChange,
    handlePrimaryAction,
  };
}