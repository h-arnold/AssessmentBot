import { Alert, Button, Form, Input, InputNumber, Modal, Skeleton, Space, Table } from 'antd';
import { type FormInstance } from 'antd';
import type { JSX, ReactNode } from 'react';
import {
  DEFAULT_WEIGHTING_VALUE,
  MAX_WEIGHTING_VALUE,
  MIN_WEIGHTING_VALUE,
} from '../services/assignmentDefinition/assignmentDefinition.zod';
import { SelectWithAddNew } from '../components/SelectWithAddNew';
import { type DocumentChangeState, type TaskRow } from './useAssignmentDefinitionWizard';

const CREATE_TITLE = 'Create assignment';
const UPDATE_TITLE = 'Update assignment';
const BLOCKING_ERROR_MESSAGE = 'Required reference data could not be trusted or loaded.';
const PARSE_REQUIRED_MESSAGE = 'Parsing is required before task weightings can be edited.';
const DOCUMENT_CHANGED_MESSAGE = 'Document changed. Re-parse to continue editing.';

export type AssignmentDefinitionWizardModalShellProperties = Readonly<{
  open: boolean;
  mode: 'create' | 'update';
  title: string | null;
  isReferenceDataBlocked?: boolean;
  isHydrating: boolean;
  blockingError: string | null;
  isMutationBusy: boolean;
  isClosable?: boolean;
  hasDirtyEdits?: boolean;
  hasParsedTasks?: boolean;
  taskRows?: TaskRow[];
  documentChange?: DocumentChangeState;
  form?: FormInstance;
  topicOptions?: Array<{ value: string; label: string }>;
  yearGroupOptions?: Array<{ value: string; label: string }>;
  primaryActionLabel?: string;
  isPrimaryActionDisabled?: boolean;
  onCancel: () => void;
  onPrimaryAction?: () => void;
  onSubmit?: () => void;
  onFormValuesChange?: (
    changedValues: Record<string, unknown>,
    allValues: Record<string, unknown>
  ) => void;
  onReparse?: () => Promise<void>;
  onReparseCancel?: () => void;
  onTaskWeightingChange?: (taskId: string, value: number | null) => void;
  onTopicAddNew?: () => void;
  onYearGroupAddNew?: () => void;
  selectedTopicKey?: string;
  selectedYearGroupKey?: string;
}>;

/**
 * Renders the assignment-definition wizard modal shell for create/update workflows.
 * Handles all view states: blocked (untrustworthy reference data), loading, error, and ready.
 *
 * @param {AssignmentDefinitionWizardModalShellProperties} properties Modal shell state and handlers.
 * @returns {JSX.Element} Assignment-definition wizard modal shell.
 */
export function AssignmentDefinitionWizardModalShell(
  properties: AssignmentDefinitionWizardModalShellProperties
): JSX.Element {
  const isCreateMode = properties.mode === 'create';
  const defaultTitle = isCreateMode ? CREATE_TITLE : UPDATE_TITLE;
  const modalTitle = properties.title ?? defaultTitle;

  if (properties.isReferenceDataBlocked) {
    return (
      <Modal
        destroyOnHidden
        keyboard={false}
        onCancel={properties.onCancel}
        open={properties.open}
        title={modalTitle}
        width="var(--app-modal-width-wide-data)"
      >
        <Alert showIcon title={BLOCKING_ERROR_MESSAGE} type="error" />
      </Modal>
    );
  }

  if (properties.isHydrating) {
    return (
      <Modal
        destroyOnHidden
        keyboard
        onCancel={properties.onCancel}
        open={properties.open}
        title={modalTitle}
        width="var(--app-modal-width-wide-data)"
      >
        <div aria-label="Assignment wizard loading" aria-live="polite" role="status">
          <Skeleton active paragraph={{ rows: 6 }} title={{ width: '40%' }} />
        </div>
      </Modal>
    );
  }

  if (properties.blockingError) {
    return (
      <Modal
        destroyOnHidden
        keyboard
        onCancel={properties.onCancel}
        open={properties.open}
        title={modalTitle}
        width="var(--app-modal-width-wide-data)"
      >
        <Alert showIcon title={properties.blockingError} type="error" />
      </Modal>
    );
  }

  return renderReadyState(properties, modalTitle);
}

/**
 * Renders the ready state modal content with full form.
 * Extracted to reduce component complexity.
 *
 * @param {AssignmentDefinitionWizardModalShellProperties} properties Shell properties.
 * @param {string} modalTitle The modal title.
 * @returns {JSX.Element} The modal with form content.
 */
function renderReadyState(
  properties: AssignmentDefinitionWizardModalShellProperties,
  modalTitle: string
): JSX.Element {
  // For backward compatibility: if isClosable not provided, compute from isMutationBusy (old shell behaviour)
  const isClosable = properties.isClosable ?? !properties.isMutationBusy;
  const documentChange = properties.documentChange ?? {
    hasPendingChange: false,
    previousReferenceUrl: '',
    previousTemplateUrl: '',
  };
  const hasParsedTasks = properties.hasParsedTasks ?? false;

  return (
    <Modal
      destroyOnHidden
      keyboard={isClosable}
      mask={{ closable: isClosable }}
      onCancel={properties.onCancel}
      open={properties.open}
      title={modalTitle}
      width="var(--app-modal-width-wide-data)"
      footer={renderModalFooter(properties)}
    >
      {properties.hasParsedTasks !== undefined &&
        renderAlerts(properties, documentChange, hasParsedTasks)}
      {renderForm(properties, documentChange)}
    </Modal>
  );
}

/**
 * Renders the alert messages for document change and parse required states.
 *
 * @param {AssignmentDefinitionWizardModalShellProperties} _properties Shell properties (unused but required for interface consistency).
 * @param {DocumentChangeState} documentChange Resolved document change state.
 * @param {boolean} hasParsedTasks Whether tasks have been parsed.
 * @returns {JSX.Element} The alert elements.
 */
function renderAlerts(
  _properties: AssignmentDefinitionWizardModalShellProperties,
  documentChange: DocumentChangeState,
  hasParsedTasks: boolean
): JSX.Element {
  const showDocumentChangeAlert = documentChange.hasPendingChange;
  const showParseRequiredAlert = !hasParsedTasks;

  return (
    <>
      {showDocumentChangeAlert && (
        <Alert
          title={DOCUMENT_CHANGED_MESSAGE}
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      {showParseRequiredAlert && (
        <Alert title={PARSE_REQUIRED_MESSAGE} type="info" showIcon style={{ marginBottom: 16 }} />
      )}
    </>
  );
}

/**
 * Renders the modal footer with cancel and primary action buttons.
 *
 * @param {AssignmentDefinitionWizardModalShellProperties} properties Shell properties.
 * @returns {JSX.Element} The footer element.
 */
function renderModalFooter(
  properties: AssignmentDefinitionWizardModalShellProperties
): JSX.Element {
  const onPrimaryClick = properties.onPrimaryAction ?? properties.onSubmit;
  if (!onPrimaryClick) {
    return (
      <Space>
        <Button disabled={properties.isMutationBusy} onClick={properties.onCancel}>
          Cancel
        </Button>
      </Space>
    );
  }

  const primaryActionLabel =
    properties.primaryActionLabel ??
    (properties.mode === 'create' ? 'Parse and continue' : 'Save changes');
  const isPrimaryActionDisabled = properties.isPrimaryActionDisabled ?? false;

  return (
    <Space>
      <Button disabled={properties.isMutationBusy} onClick={properties.onCancel}>
        Cancel
      </Button>
      <Button
        disabled={isPrimaryActionDisabled || properties.isMutationBusy}
        loading={properties.isMutationBusy}
        onClick={onPrimaryClick}
        type="primary"
      >
        {primaryActionLabel}
      </Button>
    </Space>
  );
}

/**
 * Renders the main form content.
 *
 * @param {AssignmentDefinitionWizardModalShellProperties} properties Shell properties.
 * @param {DocumentChangeState} documentChange Resolved document change state.
 * @returns {JSX.Element} The form element.
 */
function renderForm(
  properties: AssignmentDefinitionWizardModalShellProperties,
  documentChange: DocumentChangeState
): JSX.Element {
  if (!properties.form || !properties.onFormValuesChange) {
    // Fallback for tests that don't provide form props - render old shell contract
    return (
      <Form component={false} disabled={properties.isMutationBusy} layout="vertical">
        <form>
          <Form.Item label="Reference document URL" name="referenceDocumentUrl">
            <Input placeholder="https://docs.google.com/..." />
          </Form.Item>
          <Form.Item label="Template document URL" name="templateDocumentUrl">
            <Input placeholder="https://docs.google.com/..." />
          </Form.Item>
        </form>
      </Form>
    );
  }

  const hasDirtyEdits = properties.hasDirtyEdits ?? false;
  const topicOptions = properties.topicOptions ?? [];
  const yearGroupOptions = properties.yearGroupOptions ?? [];

  return (
    <Form
      component={false}
      disabled={documentChange.hasPendingChange || properties.isMutationBusy}
      form={properties.form}
      layout="vertical"
      onValuesChange={properties.onFormValuesChange}
    >
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        {renderBaseFormFields(
          properties,
          hasDirtyEdits,
          documentChange,
          topicOptions,
          yearGroupOptions
        )}
        {renderConditionalFormSections(properties, documentChange)}
      </Space>
    </Form>
  );
}

/**
 * Renders the base form fields that are always visible.
 *
 * @param {AssignmentDefinitionWizardModalShellProperties} properties Shell properties.
 * @param {boolean} hasDirtyEdits Whether there are dirty edits.
 * @param {DocumentChangeState} documentChange Document change state.
 * @param {Array<{value: string; label: string}>} topicOptions Topic options.
 * @param {Array<{value: string; label: string}>} yearGroupOptions Year group options.
 * @returns {JSX.Element} The base form fields.
 */
function renderBaseFormFields(
  properties: AssignmentDefinitionWizardModalShellProperties,
  hasDirtyEdits: boolean,
  documentChange: DocumentChangeState,
  topicOptions: Array<{ value: string; label: string }>,
  yearGroupOptions: Array<{ value: string; label: string }>
): JSX.Element {
  return (
    <>
      <Form.Item
        label="Assignment Title"
        name="title"
        rules={[{ required: true, message: 'Title is required' }]}
      >
        <Input placeholder="Enter assignment title" />
      </Form.Item>

      <div style={{ display: 'flex', gap: 16 }}>
        <Form.Item
          label="Assignment Topic"
          name="topic"
          rules={[{ required: true, message: 'Topic is required' }]}
          style={{ flex: 1 }}
        >
          <SelectWithAddNew
            allowClear
            options={topicOptions}
            placeholder="Select topic"
            value={properties.selectedTopicKey}
            onAddNew={properties.onTopicAddNew}
            addNewLabel="Add new topic"
            entityType="topic"
          />
        </Form.Item>
        <Form.Item
          label="Assignment Year Group"
          name="yearGroup"
          rules={[{ required: true, message: 'Year group is required' }]}
          style={{ flex: 1 }}
        >
          <SelectWithAddNew
            allowClear
            options={yearGroupOptions}
            placeholder="Select year group"
            value={properties.selectedYearGroupKey}
            onAddNew={properties.onYearGroupAddNew}
            addNewLabel="Add new year group"
            entityType="yearGroup"
          />
        </Form.Item>
      </div>

      <Form.Item
        label="Reference Document URL"
        name="referenceDocumentUrl"
        rules={[{ required: true, message: 'Reference document URL is required' }]}
      >
        <Input
          disabled={hasDirtyEdits || documentChange.hasPendingChange || properties.isMutationBusy}
          placeholder="https://docs.google.com/..."
        />
      </Form.Item>

      <Form.Item
        label="Template Document URL"
        name="templateDocumentUrl"
        rules={[{ required: true, message: 'Template document URL is required' }]}
      >
        <Input
          disabled={hasDirtyEdits || documentChange.hasPendingChange || properties.isMutationBusy}
          placeholder="https://docs.google.com/..."
        />
      </Form.Item>
    </>
  );
}

/**
 * Renders the conditional form sections based on state.
 * Note: document change actions and post-parse sections can both be rendered simultaneously.
 *
 * @param {AssignmentDefinitionWizardModalShellProperties} properties Shell properties.
 * @param {DocumentChangeState} documentChange Document change state.
 * @returns {JSX.Element} The conditional form sections.
 */
function renderConditionalFormSections(
  properties: AssignmentDefinitionWizardModalShellProperties,
  documentChange: DocumentChangeState
): JSX.Element {
  const hasParsedTasks = properties.hasParsedTasks ?? false;

  return (
    <>
      {documentChange.hasPendingChange &&
        properties.onReparse &&
        properties.onReparseCancel &&
        renderDocumentChangeActions(properties)}
      {hasParsedTasks && renderPostParseSections(properties, documentChange)}
    </>
  );
}

/**
 * Renders the form sections that appear after tasks have been parsed.
 *
 * @param {AssignmentDefinitionWizardModalShellProperties} properties Shell properties.
 * @param {DocumentChangeState} documentChange Document change state.
 * @returns {JSX.Element} The post-parse form sections.
 */
function renderPostParseSections(
  properties: AssignmentDefinitionWizardModalShellProperties,
  documentChange: DocumentChangeState
): JSX.Element {
  if (properties.onTaskWeightingChange && properties.taskRows) {
    return (
      <>
        {renderAssignmentWeightingInput()}
        {renderTaskWeightingsTable(properties, documentChange, properties.taskRows)}
      </>
    );
  }
  return renderAssignmentWeightingInput();
}

/**
 * Renders the re-parse and cancel action buttons for document change state.
 *
 * @param {AssignmentDefinitionWizardModalShellProperties} properties Shell properties.
 * @returns {JSX.Element} The action buttons.
 */
function renderDocumentChangeActions(
  properties: AssignmentDefinitionWizardModalShellProperties
): JSX.Element {
  return (
    <Space style={{ marginTop: 8 }}>
      <Button
        disabled={properties.isMutationBusy}
        loading={properties.isMutationBusy}
        onClick={properties.onReparse}
        type="primary"
      >
        Re-parse
      </Button>
      <Button disabled={properties.isMutationBusy} onClick={properties.onReparseCancel}>
        Cancel
      </Button>
    </Space>
  );
}

/**
 * Renders the assignment weighting input field.
 *
 * @returns {JSX.Element} The assignment weighting form item.
 */
function renderAssignmentWeightingInput(): JSX.Element {
  return (
    <Form.Item
      label="Assignment Weighting"
      name="assignmentWeighting"
      initialValue={DEFAULT_WEIGHTING_VALUE}
      rules={[
        { required: true, message: 'Assignment weighting is required' },
        {
          type: 'number',
          min: MIN_WEIGHTING_VALUE,
          max: MAX_WEIGHTING_VALUE,
          message: `Weighting must be between ${MIN_WEIGHTING_VALUE} and ${MAX_WEIGHTING_VALUE}`,
        },
      ]}
    >
      <InputNumber min={MIN_WEIGHTING_VALUE} max={MAX_WEIGHTING_VALUE} style={{ width: '100%' }} />
    </Form.Item>
  );
}

/**
 * Renders the task weightings table.
 *
 * @param {AssignmentDefinitionWizardModalShellProperties} properties Shell properties.
 * @param {DocumentChangeState} documentChange Document change state.
 * @param {TaskRow[]} taskRows Task rows.
 * @returns {JSX.Element} The task weightings table form item.
 */
function renderTaskWeightingsTable(
  properties: AssignmentDefinitionWizardModalShellProperties,
  documentChange: DocumentChangeState,
  taskRows: TaskRow[]
): JSX.Element | null {
  if (properties.onTaskWeightingChange === undefined) {
    return null;
  }

  return (
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
            render: renderTaskWeightingInputCell(documentChange, properties),
          },
        ]}
        dataSource={taskRows}
        pagination={false}
        rowKey="taskId"
        size="small"
      />
    </Form.Item>
  );
}

/**
 * Renders the task weighting input cell for the table.
 *
 * @param {DocumentChangeState} documentChange Document change state.
 * @param {AssignmentDefinitionWizardModalShellProperties} properties Shell properties.
 * @returns {function} Render function for table cell.
 */
function renderTaskWeightingInputCell(
  documentChange: DocumentChangeState,
  properties: AssignmentDefinitionWizardModalShellProperties
): (value: unknown, record: TaskRow, index: number) => ReactNode {
  if (properties.onTaskWeightingChange === undefined) {
    return () => null;
  }

  return (_: unknown, record: TaskRow) => (
    <InputNumber
      disabled={documentChange.hasPendingChange}
      min={MIN_WEIGHTING_VALUE}
      max={MAX_WEIGHTING_VALUE}
      value={record.taskWeighting}
      onChange={(value) => properties.onTaskWeightingChange!(record.taskId, value)}
    />
  );
}
