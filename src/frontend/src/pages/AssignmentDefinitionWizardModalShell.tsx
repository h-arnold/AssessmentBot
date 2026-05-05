import { Alert, Button, Form, Input, Modal, Skeleton, Space } from 'antd';

export type AssignmentDefinitionWizardModalShellProperties = Readonly<{
  open: boolean;
  mode: 'create' | 'update';
  title: string | null;
  isHydrating: boolean;
  blockingError: string | null;
  isMutationBusy: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}>;

const CREATE_TITLE = 'Create assignment';
const UPDATE_TITLE = 'Update assignment';

/**
 * Renders the assignment-definition wizard modal shell for create/update workflows.
 *
 * @param {AssignmentDefinitionWizardModalShellProperties} properties Modal shell state and handlers.
 * @returns {JSX.Element} Assignment-definition wizard modal shell.
 */
export function AssignmentDefinitionWizardModalShell(
  properties: AssignmentDefinitionWizardModalShellProperties
) {
  const isCreateMode = properties.mode === 'create';
  const defaultTitle = isCreateMode ? CREATE_TITLE : UPDATE_TITLE;
  const modalTitle = properties.title ?? defaultTitle;
  const primaryActionLabel = isCreateMode ? 'Parse and continue' : 'Save changes';

  let modalContent;
  if (properties.isHydrating) {
    modalContent = (
      <div aria-label="Assignment wizard loading" aria-live="polite" role="status">
        <Skeleton active paragraph={{ rows: 6 }} title={{ width: '40%' }} />
      </div>
    );
  } else if (properties.blockingError) {
    modalContent = <Alert showIcon title={properties.blockingError} type="error" />;
  } else {
    modalContent = (
      <Form component={false} disabled={properties.isMutationBusy} layout="vertical">
        <form role="form">
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

  return (
    <Modal
      destroyOnHidden
      keyboard={!properties.isMutationBusy}
      mask={{ closable: !properties.isMutationBusy }}
      onCancel={properties.onCancel}
      open={properties.open}
      title={modalTitle}
      width="var(--app-modal-width-wide-data)"
      footer={
        <Space>
          <Button disabled={properties.isMutationBusy} onClick={properties.onCancel}>
            Cancel
          </Button>
          <Button
            disabled={properties.isMutationBusy}
            loading={properties.isMutationBusy}
            onClick={properties.onSubmit}
            type="primary"
          >
            {primaryActionLabel}
          </Button>
        </Space>
      }
    >
      {modalContent}
    </Modal>
  );
}
