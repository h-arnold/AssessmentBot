import { Alert, Form, Modal, type FormInstance } from 'antd';
import { useState, type ReactNode } from 'react';

type BulkFormModalScaffoldChildrenProperties = Readonly<{
  disabled: boolean;
}>;

export type BulkFormModalScaffoldProperties<TValues extends object> = Readonly<{
  children: (properties: BulkFormModalScaffoldChildrenProperties) => ReactNode;
  confirmLoading?: boolean;
  fallbackErrorMessage: string;
  form: FormInstance<TValues>;
  initialValues?: Partial<TValues>;
  open: boolean;
  title: string;
  onCancel: () => void;
  onFinish: (values: TValues) => Promise<void>;
}>;

/**
 * Renders the shared shell for the classes bulk form modal family.
 *
 * @param {BulkFormModalScaffoldProperties<TValues>} properties Modal properties.
 * @returns {JSX.Element} Shared bulk-form modal shell.
 */
export function BulkFormModalScaffold<TValues extends object>(
  properties: BulkFormModalScaffoldProperties<TValues>,
) {
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  /**
   * Resets the local form and closes the modal.
   */
  function handleCancel(): void {
    properties.form.resetFields();
    setSubmissionError(null);
    properties.onCancel();
  }

  /**
   * Submits the modal form through the standard Modal OK action.
   */
  function handleOk(): void {
    properties.form.submit();
  }

  /**
   * Validates and submits the current form values.
   *
   * @param {TValues} values Submitted form values.
   * @returns {Promise<void>} Completion signal.
   */
  async function handleFinish(values: TValues): Promise<void> {
    setSubmissionError(null);

    try {
      await properties.onFinish(values);
    } catch (error: unknown) {
      setSubmissionError(error instanceof Error ? error.message : properties.fallbackErrorMessage);
    }
  }

  return (
    <Modal
      open={properties.open}
      title={properties.title}
      confirmLoading={properties.confirmLoading}
      onOk={handleOk}
      onCancel={handleCancel}
      cancelButtonProps={{ disabled: properties.confirmLoading }}
      destroyOnHidden
    >
      {submissionError ? (
        <Alert description={submissionError} type="error" showIcon style={{ marginBottom: 16 }} />
      ) : null}
      <Form<TValues>
        form={properties.form}
        layout="vertical"
        onFinish={handleFinish}
        initialValues={properties.initialValues}
      >
        {properties.children({ disabled: properties.confirmLoading === true })}
      </Form>
    </Modal>
  );
}
