import { Alert, Button, Form, Input, InputNumber, Space, Table, Typography } from 'antd';
import { type FormInstance } from 'antd';
import type { JSX, ReactNode } from 'react';
import {
  DEFAULT_WEIGHTING_VALUE,
  MAX_WEIGHTING_VALUE,
  MIN_WEIGHTING_VALUE,
} from '../../services/assignmentDefinition/assignmentDefinition.zod';
import { SelectWithAddNew } from '../../components/SelectWithAddNew/SelectWithAddNew';
import {
  APP_GAP_MD,
  APP_GAP_SM,
  APP_SPACE_SIZE_DEFAULT,
  APP_SPACE_SIZE_TIGHT,
} from '../../theme/spacing';
import {
  type DocumentChangeState,
  type TaskRow,
} from './assignmentWizardFormState';
import { AssignmentDefinitionWizardReviewFooter } from './AssignmentDefinitionWizardReviewFooter';

export { AssignmentDefinitionWizardReviewFooter } from './AssignmentDefinitionWizardReviewFooter';

const { Text } = Typography;

const PARSE_REQUIRED_MESSAGE = 'Parsing is required before task weightings can be edited.';
const DOCUMENT_CHANGED_MESSAGE = 'Document changed. Re-parse to continue editing.';
const REPARSE_DOCUMENTS_DISABLED_MESSAGE =
  'Save or discard your edits before reparsing the documents.';

export type AssignmentDefinitionWizardReviewContentProperties = Readonly<{
  mode: 'create' | 'update';
  hasParsedTasks?: boolean;
  taskRows?: TaskRow[];
  documentChange?: DocumentChangeState;
  /**
   * Whether document URL inputs may remain editable while a document change is pending.
   * The update wizard opts in; shared create and recovery consumers retain the locked form.
   */
  allowDocumentUrlEditingWhilePending?: boolean;
  form?: FormInstance;
  topicOptions?: Array<{ value: string; label: string }>;
  yearGroupOptions?: Array<{ value: string; label: string }>;
  hasDirtyEdits?: boolean;
  primaryActionLabel?: string;
  isPrimaryActionDisabled?: boolean;
  isMutationBusy: boolean;
  selectedTopicKey?: string;
  selectedYearGroupKey?: string;
  includeFooter?: boolean;
  showAlerts: boolean;
  onCancel: () => void;
  onPrimaryAction?: () => void;
  onSubmit?: () => void;
  onFormValuesChange?: (
    changedValues: Record<string, unknown>,
    allValues: Record<string, unknown>
  ) => void;
  onReparse?: () => Promise<void>;
  onReparseCancel?: () => void;
  onReparseDocuments?: () => Promise<void>;
  canReparseDocuments?: boolean;
  onTaskWeightingChange?: (taskId: string, value: number | null) => void;
  onTopicAddNew?: () => void;
  onYearGroupAddNew?: () => void;
}>;

/**
 * Renders the assignment-definition wizard review content without modal chrome.
 *
 * @remarks
 * This chrome-free extraction exists to satisfy the one-modal rule: recovery and
 * in-modal flows must render the wizard body and footer inside a single owning modal
 * rather than stacking a second Ant Design `Modal`. It covers both wizard stages via
 * `hasParsedTasks` gating (stage-one URL entry versus stage-two metadata and weighting
 * review) and renders no `Modal` chrome of its own.
 *
 * Expected consumers: the Assignments-page wizard shell
 * `AssignmentDefinitionWizardModalShell`, the converted in-modal create path
 * (`AssessTaskCreateReview`) and the stale-recovery review surface
 * (`AssessTaskRecoverySurface`) inside `AssessTaskModal`. The latter two render
 * this content inside the single owning assessment modal; the shell keeps its own
 * `Modal` chrome and re-composes from this component.
 *
 * Alert visibility is explicit through `showAlerts`, and the label fallback
 * uses the shared `derivePrimaryActionState` derivation.
 *
 * @param {AssignmentDefinitionWizardReviewContentProperties} properties Review content state and handlers.
 * @returns {JSX.Element} Assignment-definition wizard review content.
 */
export function AssignmentDefinitionWizardReviewContent(
  properties: AssignmentDefinitionWizardReviewContentProperties
): JSX.Element {
  const documentChange = properties.documentChange ?? {
    hasPendingChange: false,
    previousReferenceUrl: '',
    previousTemplateUrl: '',
  };

  return (
    <>
      {properties.showAlerts && renderAlerts(documentChange, properties.hasParsedTasks ?? false)}
      {renderForm(properties, documentChange)}
      {properties.includeFooter !== false && (
        <AssignmentDefinitionWizardReviewFooter {...properties} />
      )}
    </>
  );
}

/**
 * Renders the alert messages for document change and parse required states.
 *
 * @param {DocumentChangeState} documentChange Resolved document change state.
 * @param {boolean} hasParsedTasks Whether tasks have been parsed.
 * @returns {JSX.Element} The alert elements.
 */
function renderAlerts(
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
          style={{ marginBottom: APP_GAP_MD }}
        />
      )}
      {showParseRequiredAlert && (
        <Alert
          title={PARSE_REQUIRED_MESSAGE}
          type="info"
          showIcon
          style={{ marginBottom: APP_GAP_MD }}
        />
      )}
    </>
  );
}

/**
 * Renders the main form content.
 *
 * @param {AssignmentDefinitionWizardReviewContentProperties} properties Review content properties.
 * @param {DocumentChangeState} documentChange Resolved document change state.
 * @returns {JSX.Element} The form element.
 */
function renderForm(
  properties: AssignmentDefinitionWizardReviewContentProperties,
  documentChange: DocumentChangeState
): JSX.Element {
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
      <Space orientation="vertical" size={APP_SPACE_SIZE_DEFAULT} style={{ width: '100%' }}>
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
 * @param {AssignmentDefinitionWizardReviewContentProperties} properties Review content properties.
 * @param {boolean} hasDirtyEdits Whether there are dirty edits.
 * @param {DocumentChangeState} documentChange Document change state.
 * @param {Array<{value: string; label: string}>} topicOptions Topic options.
 * @param {Array<{value: string; label: string}>} yearGroupOptions Year group options.
 * @returns {JSX.Element} The base form fields.
 */
function renderBaseFormFields(
  properties: AssignmentDefinitionWizardReviewContentProperties,
  hasDirtyEdits: boolean,
  documentChange: DocumentChangeState,
  topicOptions: Array<{ value: string; label: string }>,
  yearGroupOptions: Array<{ value: string; label: string }>
): JSX.Element {
  // The update wizard opts in so both URL inputs stay editable while a document
  // change is pending; create and stale-recovery consumers keep the locked form.
  const canEditDocumentUrlsWhilePending = properties.allowDocumentUrlEditingWhilePending === true;
  const documentUrlInputsDisabled =
    properties.isMutationBusy ||
    (documentChange.hasPendingChange ? !canEditDocumentUrlsWhilePending : hasDirtyEdits);

  return (
    <>
      <Form.Item
        label="Assignment Title"
        name="title"
        rules={[{ required: true, message: 'Title is required' }]}
      >
        <Input placeholder="Enter assignment title" />
      </Form.Item>

      <div style={{ display: 'flex', gap: APP_GAP_MD }}>
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
          disabled={documentUrlInputsDisabled}
          placeholder="https://docs.google.com/..."
        />
      </Form.Item>

      <Form.Item
        label="Template Document URL"
        name="templateDocumentUrl"
        rules={[{ required: true, message: 'Template document URL is required' }]}
      >
        <Input
          disabled={documentUrlInputsDisabled}
          placeholder="https://docs.google.com/..."
        />
      </Form.Item>

      {properties.onReparseDocuments && renderReparseDocumentsAction(properties)}
    </>
  );
}

/**
 * Renders the explicit Reparse documents action for the Assignments-page update
 * wizard. Update-mode only; absent whenever the wiring omits `onReparseDocuments`.
 *
 * @remarks
 * The button is disabled whenever `canReparseDocuments` is false, but the visible
 * explanation is bound to the hook's unsaved-edits state directly rather than to
 * that combined gating result. It therefore appears only when unsaved edits are
 * the blocking reason; a pending URL change, a definition error or an in-flight
 * mutation never renders this copy.
 *
 * @param {AssignmentDefinitionWizardReviewContentProperties} properties Review content properties.
 * @returns {JSX.Element} The reparse documents action region.
 */
function renderReparseDocumentsAction(
  properties: AssignmentDefinitionWizardReviewContentProperties
): JSX.Element {
  const canReparseDocuments = properties.canReparseDocuments ?? false;
  // Bound to the unsaved-edits reason directly (hasDirtyEdits implies
  // !canReparseDocuments), so other disabled reasons never render this copy.
  const showDisabledExplanation = properties.hasDirtyEdits ?? false;

  return (
    <Space orientation="vertical" size={APP_SPACE_SIZE_TIGHT}>
      <Button
        disabled={!canReparseDocuments || properties.isMutationBusy}
        loading={properties.isMutationBusy}
        onClick={properties.onReparseDocuments}
      >
        Reparse documents
      </Button>
      {showDisabledExplanation && (
        <Text type="secondary">{REPARSE_DOCUMENTS_DISABLED_MESSAGE}</Text>
      )}
    </Space>
  );
}

/**
 * Renders the conditional form sections based on state.
 * Note: document change actions and post-parse sections can both be rendered simultaneously.
 *
 * @param {AssignmentDefinitionWizardReviewContentProperties} properties Review content properties.
 * @param {DocumentChangeState} documentChange Document change state.
 * @returns {JSX.Element} The conditional form sections.
 */
function renderConditionalFormSections(
  properties: AssignmentDefinitionWizardReviewContentProperties,
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
 * @param {AssignmentDefinitionWizardReviewContentProperties} properties Review content properties.
 * @param {DocumentChangeState} documentChange Document change state.
 * @returns {JSX.Element} The post-parse form sections.
 */
function renderPostParseSections(
  properties: AssignmentDefinitionWizardReviewContentProperties,
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
 * Renders the re-parse and URL-restoration action buttons for document change state.
 * The separate Cancel restores the baseline document URLs; it does not dismiss the owning modal.
 *
 * @param {AssignmentDefinitionWizardReviewContentProperties} properties Review content properties.
 * @returns {JSX.Element} The action buttons.
 */
function renderDocumentChangeActions(
  properties: AssignmentDefinitionWizardReviewContentProperties
): JSX.Element {
  return (
    <Space size={APP_SPACE_SIZE_DEFAULT} style={{ marginTop: APP_GAP_SM }}>
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
 * @param {AssignmentDefinitionWizardReviewContentProperties} properties Review content properties.
 * @param {DocumentChangeState} documentChange Document change state.
 * @param {TaskRow[]} taskRows Task rows.
 * @returns {JSX.Element} The task weightings table form item.
 */
function renderTaskWeightingsTable(
  properties: AssignmentDefinitionWizardReviewContentProperties,
  documentChange: DocumentChangeState,
  taskRows: TaskRow[]
): JSX.Element {
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
 * @remarks
 * The busy state is included explicitly because Ant Design resolves
 * `disabled` as `customDisabled ?? formDisabledContext`; passing only the
 * document-change flag would send `false` and override the form-level busy lock
 * applied while a mutation is in flight.
 *
 * @param {DocumentChangeState} documentChange Document change state.
 * @param {AssignmentDefinitionWizardReviewContentProperties} properties Review content properties.
 * @returns {function} Render function for table cell.
 */
function renderTaskWeightingInputCell(
  documentChange: DocumentChangeState,
  properties: AssignmentDefinitionWizardReviewContentProperties
): (value: unknown, record: TaskRow, index: number) => ReactNode {
  return (_: unknown, record: TaskRow) => (
    <InputNumber
      disabled={documentChange.hasPendingChange || properties.isMutationBusy}
      min={MIN_WEIGHTING_VALUE}
      max={MAX_WEIGHTING_VALUE}
      value={record.taskWeighting}
      onChange={(value) => properties.onTaskWeightingChange!(record.taskId, value)}
    />
  );
}
