import { Alert, Modal, Skeleton } from 'antd';
import { type FormInstance } from 'antd';
import type { JSX } from 'react';
import {
  AssignmentDefinitionWizardReviewContent,
  AssignmentDefinitionWizardReviewFooter,
  type AssignmentDefinitionWizardReviewContentProperties,
} from './AssignmentDefinitionWizardReviewContent';
import { type DocumentChangeState, type TaskRow } from './useAssignmentDefinitionWizard';

const CREATE_TITLE = 'Create assignment';
const UPDATE_TITLE = 'Update assignment';
const BLOCKING_ERROR_MESSAGE = 'Required reference data could not be trusted or loaded.';

export type AssignmentDefinitionWizardModalShellProperties = Readonly<{
  open: boolean;
  mode: 'create' | 'update';
  title: string | null;
  isReferenceDataBlocked?: boolean;
  isHydrating: boolean;
  blockingError: string | null;
  isMutationBusy: boolean;
  isClosable: boolean;
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
  onFormValuesChange?: (changedValues: Record<string, unknown>, allValues: Record<string, unknown>) => void;
  onReparse?: () => Promise<void>;
  onReparseCancel?: () => void;
  onReparseDocuments?: () => Promise<void>;
  canReparseDocuments?: boolean;
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
      <Modal destroyOnHidden keyboard={false} onCancel={properties.onCancel} open={properties.open} title={modalTitle} width="var(--app-modal-width-wide-data)">
        <Alert showIcon title={BLOCKING_ERROR_MESSAGE} type="error" />
      </Modal>
    );
  }

  if (properties.isHydrating) {
    return (
      <Modal destroyOnHidden keyboard onCancel={properties.onCancel} open={properties.open} title={modalTitle} width="var(--app-modal-width-wide-data)">
        <div aria-label="Assignment wizard loading" aria-live="polite" role="status">
          <Skeleton active paragraph={{ rows: 6 }} title={{ width: '40%' }} />
        </div>
      </Modal>
    );
  }

  if (properties.blockingError) {
    return (
      <Modal destroyOnHidden keyboard onCancel={properties.onCancel} open={properties.open} title={modalTitle} width="var(--app-modal-width-wide-data)">
        <Alert showIcon title={properties.blockingError} type="error" />
      </Modal>
    );
  }

  return renderReadyState(properties, modalTitle);
}

/**
 * Maps shell properties to the chrome-free review-content contract.
 * Resolves the mode-dependent primary-action label so the shell keeps its own `Modal` chrome.
 *
 * @param {AssignmentDefinitionWizardModalShellProperties} properties Shell properties.
 * @returns {AssignmentDefinitionWizardReviewContentProperties} Review content properties.
 */
function toReviewContentProperties(
  properties: AssignmentDefinitionWizardModalShellProperties
): AssignmentDefinitionWizardReviewContentProperties {
  return {
    hasParsedTasks: properties.hasParsedTasks,
    taskRows: properties.taskRows,
    documentChange: properties.documentChange,
    form: properties.form,
    topicOptions: properties.topicOptions,
    yearGroupOptions: properties.yearGroupOptions,
    hasDirtyEdits: properties.hasDirtyEdits,
    primaryActionLabel:
      properties.primaryActionLabel ?? (properties.mode === 'create' ? 'Parse and continue' : 'Save'),
    isPrimaryActionDisabled: properties.isPrimaryActionDisabled,
    isMutationBusy: properties.isMutationBusy,
    selectedTopicKey: properties.selectedTopicKey,
    selectedYearGroupKey: properties.selectedYearGroupKey,
    onCancel: properties.onCancel,
    onPrimaryAction: properties.onPrimaryAction,
    onSubmit: properties.onSubmit,
    onFormValuesChange: properties.onFormValuesChange,
    onReparse: properties.onReparse,
    onReparseCancel: properties.onReparseCancel,
    onReparseDocuments: properties.onReparseDocuments,
    canReparseDocuments: properties.canReparseDocuments,
    onTaskWeightingChange: properties.onTaskWeightingChange,
    onTopicAddNew: properties.onTopicAddNew,
    onYearGroupAddNew: properties.onYearGroupAddNew,
  };
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
  const reviewContentProperties = toReviewContentProperties(properties);

  return (
    <Modal
      closable={properties.isClosable}
      destroyOnHidden
      keyboard={properties.isClosable}
      mask={{ closable: properties.isClosable }}
      onCancel={properties.onCancel}
      open={properties.open}
      title={modalTitle}
      width="var(--app-modal-width-wide-data)"
      footer={<AssignmentDefinitionWizardReviewFooter {...reviewContentProperties} />}
    >
      <AssignmentDefinitionWizardReviewContent {...reviewContentProperties} includeFooter={false} />
    </Modal>
  );
}
