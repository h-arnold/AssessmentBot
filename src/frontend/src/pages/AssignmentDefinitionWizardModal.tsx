import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Form, Input, InputNumber, Modal, Select, Skeleton, Space, Table, Typography } from 'antd';
import type { FormProps } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStartupWarmupState } from '../features/auth/startupWarmupState';
import { logFrontendError } from '../logging/frontendLogger';
import { queryKeys } from '../query/queryKeys';
import {
  getAssignmentDefinitionQueryOptions,
  getAssignmentTopicsQueryOptions,
  getYearGroupsQueryOptions,
} from '../query/sharedQueries';
import { upsertAssignmentDefinition, type UpsertAssignmentDefinitionRequest } from '../services/assignmentDefinitionService';
import type { AssignmentTopic } from '../services/assignmentTopicsService';
import type { YearGroup } from '../services/referenceDataService';

const { Text } = Typography;

const CREATE_TITLE = 'Create assignment';
const UPDATE_TITLE = 'Update assignment';
const BLOCKING_ERROR_MESSAGE = 'Required reference data could not be trusted or loaded.';
const PARSE_REQUIRED_MESSAGE = 'Parsing is required before task weightings can be edited.';
const DOCUMENT_CHANGED_MESSAGE = 'Document changed. Re-parse to continue editing.';
const MIN_WEIGHTING = 0;
const MAX_WEIGHTING = 10;
const DEFAULT_WEIGHTING = 1;

type ModalMode = 'create' | 'update';

type TaskRow = { key: string; taskId: string; taskTitle: string; taskWeighting: number };

type DocumentChangeState = { hasPendingChange: boolean; previousReferenceUrl: string; previousTemplateUrl: string };

export type AssignmentDefinitionWizardModalProperties = Readonly<{
  open: boolean;
  mode: ModalMode;
  definitionKey: string | null;
  onClose: () => void;
}>;

/**
 * Builds a canonical Google Docs/Sheets URL from a document ID and type.
 *
 * @param {string} documentId The Google document ID.
 * @param {'SLIDES' | 'SHEETS'} documentType The type of Google document.
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
 * Checks if all required fields for parsing are present and non-empty.
 *
 * @param {Record<string, unknown>} values Form values to check.
 * @returns {boolean} True if all parse fields are present and non-empty.
 */
function hasAllParseFields(values: Record<string, unknown>): boolean {
  return (
    String(values.title ?? '').trim() !== '' &&
    String(values.topic ?? '').trim() !== '' &&
    String(values.yearGroup ?? '').trim() !== '' &&
    String(values.referenceDocumentUrl ?? '').trim() !== '' &&
    String(values.templateDocumentUrl ?? '').trim() !== ''
  );
}

/**
 * Checks if a year group has been selected.
 *
 * @param {Record<string, unknown>} values Form values to check.
 * @returns {boolean} True if year group is selected (non-empty).
 */
function hasYearGroupSelected(values: Record<string, unknown>): boolean {
  return String(values.yearGroup ?? '').trim() !== '';
}

/**
 * Renders the assignment-definition wizard modal for create and update workflows.
 *
 * @param {AssignmentDefinitionWizardModalProperties} properties Modal properties.
 * @returns {JSX.Element} The wizard modal component.
 */
export function AssignmentDefinitionWizardModal(
  properties: AssignmentDefinitionWizardModalProperties
): JSX.Element {
  const { open, mode, definitionKey, onClose } = properties;
  const isCreateMode = mode === 'create';
  const modalTitle = isCreateMode ? CREATE_TITLE : UPDATE_TITLE;

  const queryClient = useQueryClient();
  const startupWarmupState = useStartupWarmupState();
  const [form] = Form.useForm();
  const isHydratingDefinitionRef = useRef(false);

  const { data: topics, isLoading: isTopicsLoading } = useQuery({
    ...getAssignmentTopicsQueryOptions(),
    enabled: open && startupWarmupState.isDatasetReady('assignmentTopics'),
  });

  const { data: yearGroups, isLoading: isYearGroupsLoading } = useQuery({
    ...getYearGroupsQueryOptions(),
    enabled: open && startupWarmupState.isDatasetReady('yearGroups'),
  });

  const { data: definition, isLoading: isDefinitionLoading, isError: isDefinitionError } = useQuery({
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
    if (!topics) return [];
    return (topics as AssignmentTopic[]).map((t) => ({ value: t.key, label: t.name }));
  }, [topics]);

  const yearGroupOptions = useMemo(() => {
    if (!yearGroups) return [];
    return (yearGroups as YearGroup[]).map((yg) => ({ value: yg.key, label: yg.name }));
  }, [yearGroups]);

  const primaryActionLabel = isCreateMode && !hasParsedTasks ? 'Parse and continue' : 'Save';

  const formValues = Form.useWatch([], form) ?? {};
  const isPrimaryActionDisabled = isCreateMode && !hasParsedTasks
    ? !hasAllParseFields(formValues)
    : !hasYearGroupSelected(formValues);

  // Initialize modal
  useEffect(() => {
    if (!open) {
      isHydratingDefinitionRef.current = false;
      return;
    }

    setHasParsedTasks(false);
    setTaskRows([]);
    setDocumentChange({ hasPendingChange: false, previousReferenceUrl: '', previousTemplateUrl: '' });
    setHasDirtyEdits(false);
    setBlockingError(null);

    if (!isCreateMode && definition) {
      isHydratingDefinitionRef.current = true;
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
        isHydratingDefinitionRef.current = false;
      });
    } else if (isCreateMode) {
      isHydratingDefinitionRef.current = false;
      form.resetFields();
    }
  }, [open, mode, definition, form, isCreateMode]);

  // Track dirty state
  useEffect(() => {
    if (isHydratingDefinitionRef.current) {
      setHasDirtyEdits(false);
      return;
    }

    if (isCreateMode && !hasParsedTasks) {
      setHasDirtyEdits(false);
      return;
    }
    if (!isCreateMode && definition) {
      const values = form.getFieldsValue();
      const isDirty =
        values.title !== definition.primaryTitle ||
        values.topic !== definition.primaryTopicKey ||
        values.yearGroup !== definition.yearGroupKey ||
        values.assignmentWeighting !== definition.assignmentWeighting ||
        taskRows.some((row) => {
          const task = definition.tasks.find((t) => t.taskId === row.taskId);
          return task === undefined ? false : task.taskWeighting !== row.taskWeighting;
        });
      setHasDirtyEdits(isDirty);
    }
  }, [formValues, definition, hasParsedTasks, isCreateMode, taskRows]);

  // Handle document change detection
  const handleFormValuesChange: FormProps['onValuesChange'] = useCallback(
    (_, allValues) => {
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
      await queryClient.invalidateQueries({ queryKey: queryKeys.assignmentDefinitionPartials() });
      // Fire-and-forget list refresh: failures only affect the AssignmentsPage table,
      // not the modal's own data. The modal continues to function with parsed tasks.
      void queryClient.fetchQuery({ queryKey: queryKeys.assignmentDefinitionPartials() });
      setHasDirtyEdits(false);
    } catch (error) {
      logFrontendError('AssignmentDefinitionWizardModal.handleParseAndContinue', error, { mode: 'create' });
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
      const taskWeightings = taskRows.map((row) => ({ taskId: row.taskId, taskWeighting: row.taskWeighting }));
      const request: UpsertAssignmentDefinitionRequest = {
        ...(definitionKey && { definitionKey }),
        primaryTitle: (values.title as string) || '',
        primaryTopicKey: values.topic as string,
        yearGroupKey: values.yearGroup as string,
        referenceDocumentUrl: values.referenceDocumentUrl as string,
        templateDocumentUrl: values.templateDocumentUrl as string,
        assignmentWeighting: (values.assignmentWeighting as number) ?? DEFAULT_WEIGHTING,
        taskWeightings,
      };
      await upsertMutation.mutateAsync(request);
      await queryClient.invalidateQueries({ queryKey: queryKeys.assignmentDefinitionPartials() });
      if (definitionKey) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.assignmentDefinitionByKey(definitionKey) });
      }
      try {
        await queryClient.fetchQuery({ queryKey: queryKeys.assignmentDefinitionPartials() });
      } catch {
        setBlockingError(BLOCKING_ERROR_MESSAGE);
        return;
      }
      onClose();
    } catch (error) {
      logFrontendError('AssignmentDefinitionWizardModal.handleSave', error, { mode, definitionKey });
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
      const request: UpsertAssignmentDefinitionRequest = {
        definitionKey,
        primaryTitle: (values.title as string) || '',
        primaryTopicKey: values.topic as string,
        yearGroupKey: values.yearGroup as string,
        referenceDocumentUrl: values.referenceDocumentUrl as string,
        templateDocumentUrl: values.templateDocumentUrl as string,
        assignmentWeighting: (values.assignmentWeighting as number) ?? DEFAULT_WEIGHTING,
        taskWeightings: [],
      };
      const response = await upsertMutation.mutateAsync(request);
      const existingWeightings = new Map(taskRows.map((row) => [row.taskId, row.taskWeighting]));
      setTaskRows(
        response.tasks.map((t) => ({
          key: t.taskId,
          taskId: t.taskId,
          taskTitle: t.taskTitle,
          taskWeighting: existingWeightings.get(t.taskId) ?? DEFAULT_WEIGHTING,
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
      // Fire-and-forget list refresh: failures only affect the AssignmentsPage table,
      // not the modal's own data. The modal continues to function with re-parsed tasks.
      void queryClient.fetchQuery({ queryKey: queryKeys.assignmentDefinitionPartials() });
      setHasDirtyEdits(false);
    } catch (error) {
      logFrontendError('AssignmentDefinitionWizardModal.handleReparse', error, { definitionKey });
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
        previous.map((row) => (row.taskId !== taskId ? row : { ...row, taskWeighting: value ?? DEFAULT_WEIGHTING }))
      );
    },
    []
  );

  const handlePrimaryAction = useCallback(() => {
    const action = isCreateMode && !hasParsedTasks ? handleParseAndContinue : handleSave;
    void action();
  }, [isCreateMode, hasParsedTasks, handleParseAndContinue, handleSave]);

  // Render content
  if (isReferenceDataBlocked) {
    return <Modal destroyOnHidden keyboard={false} onCancel={onClose} open={open} title={modalTitle} width="var(--app-modal-width-wide-data)"><Alert showIcon title={BLOCKING_ERROR_MESSAGE} type="error" /></Modal>;
  }

  if (isReferenceDataLoading || (!isCreateMode && isDefinitionLoading)) {
    return (
      <Modal destroyOnHidden keyboard onCancel={handleClose} open={open} title={modalTitle} width="var(--app-modal-width-wide-data)">
        <div aria-label="Assignment wizard loading" aria-live="polite" role="status">
          <Skeleton active paragraph={{ rows: 6 }} title={{ width: '40%' }} />
        </div>
      </Modal>
    );
  }

  if (!isCreateMode && isDefinitionError) {
    return <Modal destroyOnHidden keyboard onCancel={handleClose} open={open} title={modalTitle} width="var(--app-modal-width-wide-data)"><Alert showIcon title="Assignment definition could not be trusted or loaded." type="error" /></Modal>;
  }

  if (blockingError) {
    return <Modal destroyOnHidden keyboard onCancel={onClose} open={open} title={modalTitle} width="var(--app-modal-width-wide-data)"><Alert showIcon title={blockingError} type="error" /></Modal>;
  }

  const isClosable = !isSubmitting && !documentChange.hasPendingChange;

  return (
    <>
      <Modal
        destroyOnHidden
        keyboard={isClosable}
        mask={{ closable: isClosable }}
        onCancel={handleClose}
        open={open}
        title={modalTitle}
        width="var(--app-modal-width-wide-data)"
        footer={
          <Space>
            <Button disabled={isSubmitting} onClick={handleClose}>Cancel</Button>
            <Button disabled={isPrimaryActionDisabled || isSubmitting} loading={isSubmitting} onClick={handlePrimaryAction} type="primary">
              {primaryActionLabel}
            </Button>
          </Space>
        }
      >
        {documentChange.hasPendingChange && <Alert title={DOCUMENT_CHANGED_MESSAGE} type="warning" showIcon style={{ marginBottom: 16 }} />}
        {!hasParsedTasks && <Alert title={PARSE_REQUIRED_MESSAGE} type="info" showIcon style={{ marginBottom: 16 }} />}

        <Form
          component={false}
          disabled={documentChange.hasPendingChange || isSubmitting}
          form={form}
          layout="vertical"
          onValuesChange={handleFormValuesChange}
        >
          <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
            <Form.Item label="Assignment Title" name="title" rules={[{ required: true, message: 'Title is required' }]}>
              <Input placeholder="Enter assignment title" />
            </Form.Item>

            <div style={{ display: 'flex', gap: 16 }}>
              <Form.Item label="Assignment Topic" name="topic" rules={[{ required: true, message: 'Topic is required' }]} style={{ flex: 1 }}>
                <Select allowClear options={topicOptions} placeholder="Select topic" />
              </Form.Item>
              <Form.Item label="Assignment Year Group" name="yearGroup" rules={[{ required: true, message: 'Year group is required' }]} style={{ flex: 1 }}>
                <Select allowClear options={yearGroupOptions} placeholder="Select year group" />
              </Form.Item>
            </div>

            <Form.Item label="Reference Document URL" name="referenceDocumentUrl" rules={[{ required: true, message: 'Reference document URL is required' }]}>
              <Input disabled={hasDirtyEdits || documentChange.hasPendingChange || isSubmitting} placeholder="https://docs.google.com/..." />
            </Form.Item>

            <Form.Item label="Template Document URL" name="templateDocumentUrl" rules={[{ required: true, message: 'Template document URL is required' }]}>
              <Input disabled={hasDirtyEdits || documentChange.hasPendingChange || isSubmitting} placeholder="https://docs.google.com/..." />
            </Form.Item>

            {documentChange.hasPendingChange && (
              <Space style={{ marginTop: 8 }}>
                <Button disabled={isSubmitting} loading={isSubmitting} onClick={handleReparse} type="primary">Re-parse</Button>
                <Button disabled={isSubmitting} onClick={handleReparseCancel}>Cancel</Button>
              </Space>
            )}

            {hasParsedTasks && (
              <Form.Item label="Assignment Weighting" name="assignmentWeighting" initialValue={DEFAULT_WEIGHTING} rules={[{ required: true, message: 'Assignment weighting is required' }, { type: 'number', min: MIN_WEIGHTING, max: MAX_WEIGHTING, message: `Weighting must be between ${MIN_WEIGHTING} and ${MAX_WEIGHTING}` }]}>
                <InputNumber min={MIN_WEIGHTING} max={MAX_WEIGHTING} style={{ width: '100%' }} />
              </Form.Item>
            )}

            {hasParsedTasks && (
              <Form.Item label="Task weightings">
                <Table
                  aria-label="Task weightings"
                  columns={[
                    { title: 'Task', dataIndex: 'taskTitle', key: 'taskTitle', width: '60%' },
                    {
                      title: 'Weighting',
                      dataIndex: 'taskWeighting',
                      key: 'taskWeighting',
                      width: '40%',
                      render: (_: unknown, record: TaskRow) => (
                        <InputNumber
                          disabled={documentChange.hasPendingChange}
                          min={MIN_WEIGHTING}
                          max={MAX_WEIGHTING}
                          value={record.taskWeighting}
                          onChange={(value) => handleTaskWeightingChange(record.taskId, value)}
                        />
                      ),
                    },
                  ]}
                  dataSource={taskRows}
                  pagination={false}
                  rowKey="taskId"
                  size="small"
                />
              </Form.Item>
            )}
          </Space>
        </Form>
      </Modal>

      <Modal
        centered
        destroyOnHidden
        footer={<Space><Button onClick={handleKeepEditing}>Keep editing</Button><Button danger onClick={handleDiscardConfirm} type="primary">Discard changes</Button></Space>}
        keyboard
        onCancel={handleKeepEditing}
        open={showDiscardConfirm}
        title="Discard changes"
        transitionName=""
      >
        <Text>You have unsaved changes. Discard and close?</Text>
      </Modal>
    </>
  );
}
