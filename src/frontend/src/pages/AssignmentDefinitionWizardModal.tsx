import { Alert, Button, Form, Input, InputNumber, Modal, Select, Skeleton, Space, Table, Typography } from 'antd';
import { useAssignmentDefinitionWizard } from './useAssignmentDefinitionWizard';
import {
  DEFAULT_WEIGHTING_VALUE,
  MAX_WEIGHTING_VALUE,
  MIN_WEIGHTING_VALUE,
} from '../services/assignmentDefinition.zod';

const { Text } = Typography;

const CREATE_TITLE = 'Create assignment';
const UPDATE_TITLE = 'Update assignment';
const BLOCKING_ERROR_MESSAGE = 'Required reference data could not be trusted or loaded.';
const PARSE_REQUIRED_MESSAGE = 'Parsing is required before task weightings can be edited.';
const DOCUMENT_CHANGED_MESSAGE = 'Document changed. Re-parse to continue editing.';

type ModalMode = 'create' | 'update';

export type AssignmentDefinitionWizardModalProperties = Readonly<{
  open: boolean;
  mode: ModalMode;
  definitionKey: string | null;
  onClose: () => void;
}>;

/**
 * Renders the assignment-definition wizard modal for create and update workflows.
 *
 * @remarks
 * The modal implements a two-stage workflow:
 * - Stage one (create mode): parse document URLs first, then proceed to edit metadata and task weightings.
 * - Stage two (shared edit surface): edit metadata, year group, assignment weighting, and task weightings.
 *
 * Document change re-parse gating: when document URLs change after initial parse, other edits are disabled
 * until the user either re-parses (refreshes tasks from new URLs) or cancels (restores persisted URLs).
 *
 * Dirty state tracking: unsaved metadata or weighting edits disable document URL fields. Closing the modal
 * with dirty edits requires explicit discard confirmation.
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

  const {
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
  } = useAssignmentDefinitionWizard({ open, mode, definitionKey, onClose });

  // Render content
  if (isReferenceDataBlocked) {
    return (
      <Modal destroyOnHidden keyboard={false} onCancel={onClose} open={open} title={modalTitle} width="var(--app-modal-width-wide-data)">
        <Alert showIcon title={BLOCKING_ERROR_MESSAGE} type="error" />
      </Modal>
    );
  }

  if (isReferenceDataLoading) {
    return (
      <Modal destroyOnHidden keyboard onCancel={handleClose} open={open} title={modalTitle} width="var(--app-modal-width-wide-data)">
        <div aria-label="Assignment wizard loading" aria-live="polite" role="status">
          <Skeleton active paragraph={{ rows: 6 }} title={{ width: '40%' }} />
        </div>
      </Modal>
    );
  }

  if (blockingError) {
    return (
      <Modal destroyOnHidden keyboard onCancel={onClose} open={open} title={modalTitle} width="var(--app-modal-width-wide-data)">
        <Alert showIcon title={blockingError} type="error" />
      </Modal>
    );
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
              <Form.Item label="Assignment Weighting" name="assignmentWeighting" initialValue={DEFAULT_WEIGHTING_VALUE} rules={[{ required: true, message: 'Assignment weighting is required' }, { type: 'number', min: MIN_WEIGHTING_VALUE, max: MAX_WEIGHTING_VALUE, message: `Weighting must be between ${MIN_WEIGHTING_VALUE} and ${MAX_WEIGHTING_VALUE}` }]}>
                <InputNumber min={MIN_WEIGHTING_VALUE} max={MAX_WEIGHTING_VALUE} style={{ width: '100%' }} />
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
                          min={MIN_WEIGHTING_VALUE}
                          max={MAX_WEIGHTING_VALUE}
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
