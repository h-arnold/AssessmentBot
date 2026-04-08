/**
 * Shared inline-dialog sections for the Manage Cohorts and Manage Year Groups
 * modal workflows.
 *
 * Extracted here to avoid duplicating the same form and delete confirmation
 * markup across both modal modules. Keep this file local to the classes feature.
 */

import { Alert, Button, Form, Input, Space } from 'antd';
import { InlineDialog } from './InlineDialog';

export type ReferenceDataFormValues = Readonly<{
  name: string;
}>;

type ReferenceDataFormDialogProperties = Readonly<{
  labelId: string;
  title: string;
  formKey: string;
  form: ReturnType<typeof Form.useForm<ReferenceDataFormValues>>[0];
  initialName: string | null;
  formError: string | null;
  formSubmitting: boolean;
  validationMessage: string;
  onClose: () => void;
  onFinish: (values: ReferenceDataFormValues) => Promise<void>;
  onOk: () => void;
}>;

/**
 * Renders the shared create/edit inline dialog.
 *
 * @param {ReferenceDataFormDialogProperties} properties Section properties.
 * @returns {JSX.Element} The inline form dialog section.
 */
export function ReferenceDataFormDialog(properties: ReferenceDataFormDialogProperties) {
  return (
    <InlineDialog labelId={properties.labelId} title={properties.title}>
      {properties.formError === null ? null : (
        <Alert
          description={properties.formError}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      <Form<ReferenceDataFormValues>
        key={properties.formKey}
        form={properties.form}
        layout="vertical"
        onFinish={properties.onFinish}
        initialValues={properties.initialName === null ? undefined : { name: properties.initialName }}
      >
        <Form.Item
          label="Name"
          name="name"
          rules={[{ required: true, message: properties.validationMessage }]}
        >
          <Input disabled={properties.formSubmitting} />
        </Form.Item>
      </Form>
      <Space style={{ marginTop: 16 }}>
        <Button onClick={properties.onClose}>Cancel</Button>
        <Button type="primary" loading={properties.formSubmitting} onClick={properties.onOk}>
          OK
        </Button>
      </Space>
    </InlineDialog>
  );
}

type ReferenceDataDeleteDialogProperties = Readonly<{
  labelId: string;
  title: string;
  entityLabel: string;
  entityName: string | null;
  error: string | null;
  blocked: boolean;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}>;

/**
 * Renders the shared delete confirmation inline dialog.
 *
 * @param {ReferenceDataDeleteDialogProperties} properties Section properties.
 * @returns {JSX.Element} The inline delete dialog section.
 */
export function ReferenceDataDeleteDialog(properties: ReferenceDataDeleteDialogProperties) {
  return (
    <InlineDialog labelId={properties.labelId} title={properties.title}>
      {properties.error === null ? (
        <p>
          Are you sure you want to delete{' '}
          <strong>{properties.entityName ?? `this ${properties.entityLabel}`}</strong>?
        </p>
      ) : (
        <Alert
          description={properties.error}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      <Space style={{ marginTop: 16 }}>
        <Button onClick={properties.onClose}>Cancel</Button>
        <Button
          danger
          disabled={properties.blocked || properties.submitting}
          loading={properties.submitting}
          onClick={properties.onConfirm}
        >
          Delete
        </Button>
      </Space>
    </InlineDialog>
  );
}
