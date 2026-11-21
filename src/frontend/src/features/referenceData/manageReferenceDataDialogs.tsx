/**
 * Shared inline-dialog sections for the Manage Cohorts and Manage Year Groups
 * modal workflows.
 *
 * Extracted here to avoid duplicating the same form and delete confirmation
 * markup across both modal modules. Keep this file local to the classes feature.
 */

import { createElement, type ReactElement } from 'react';
import { Alert, Button, Form, Input, Space } from 'antd';
import { InlineDialog } from './InlineDialog';
import type {
  DeleteDialogProperties,
  FormDialogProperties,
} from './useReferenceDataManagement/useReferenceDataManagement.types';

/**
 * Form values for reference data entities.
 * Base type includes name; can be extended by types like AssignmentTopic with yearGroupKeys.
 */
export type ReferenceDataFormValues = Readonly<{
  name: string;
  yearGroupKeys?: string[];
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

/**
 * Renders the default create/edit inline dialog from the management hook's form-dialog properties.
 *
 * @param {string} labelId Accessible label id for the inline dialog.
 * @param {string} validationMessage Validation message for the required name field.
 * @param {FormDialogProperties<T>} properties Form dialog state and callbacks from the management hook.
 * @returns {ReactElement | null} The inline form dialog, or null when no form is open.
 */
export function DefaultReferenceDataFormDialogRenderer<T extends { key: string; name: string }>(
  labelId: string,
  validationMessage: string,
  properties: FormDialogProperties<T>
): ReactElement | null {
  if (properties.formMode === null) {
    return null;
  }

  return createElement(ReferenceDataFormDialog, {
    formKey: properties.editingEntity?.key ?? 'create',
    form: properties.form,
    initialName: properties.editingEntity?.name ?? null,
    labelId,
    title: properties.formDialogTitle,
    formError: properties.formError,
    formSubmitting: properties.formSubmitting,
    validationMessage,
    onClose: properties.onClose,
    onFinish: properties.onFinish,
    onOk: properties.onOk,
  });
}

/**
 * Renders the default delete confirmation inline dialog from the management hook's delete state.
 *
 * @param {string} labelId Accessible label id for the inline dialog.
 * @param {string} title Title for the delete confirmation dialog.
 * @param {string} entityLabel Singular lower-case label for the entity being deleted.
 * @param {DeleteDialogProperties<T>} properties Delete dialog state and callbacks from the management hook.
 * @returns {ReactElement | null} The inline delete dialog, or null when it is closed.
 */
export function DefaultReferenceDataDeleteDialogRenderer<T extends { key: string; name: string }>(
  labelId: string,
  title: string,
  entityLabel: string,
  properties: DeleteDialogProperties<T>
): ReactElement | null {
  if (!properties.deleteState.open) {
    return null;
  }

  return createElement(ReferenceDataDeleteDialog, {
    blocked: properties.deleteState.blocked,
    entityLabel,
    entityName: properties.deleteState.entity?.name ?? null,
    error: properties.deleteState.error,
    labelId,
    submitting: properties.deleteState.submitting,
    title,
    onClose: properties.onClose,
    onConfirm: properties.onConfirm,
  });
}
