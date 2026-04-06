import { Alert, Form, Modal, Select } from 'antd';
import { useMemo, useState } from 'react';
import { bulkReferenceKeySchema } from './bulkEditValidation.zod';

type SelectOption = Readonly<{
  label: string;
  value: string;
}>;

export type BulkSetSelectModalProperties = Readonly<{
  confirmLoading?: boolean;
  fieldLabel: string;
  open: boolean;
  title: string;
  options: SelectOption[];
  onCancel: () => void;
  onConfirm: (value: string) => Promise<void>;
}>;

type FormValues = {
  value: string;
};

/**
 * Renders a reusable select-driven bulk-edit modal.
 *
 * @param {BulkSetSelectModalProperties} properties Modal properties.
 * @returns {JSX.Element} The rendered modal.
 */
export function BulkSetSelectModal(properties: BulkSetSelectModalProperties) {
  const [form] = Form.useForm<FormValues>();
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const allowedValues = useMemo(
    () => new Set(properties.options.map((option) => option.value)),
    [properties.options],
  );
  const requiredMessage = `Please select a ${properties.fieldLabel.toLowerCase()}.`;
  const invalidMessage = `Please select a valid ${properties.fieldLabel.toLowerCase()}.`;

  /**
   * Resets local modal state before delegating cancellation.
   */
  function handleCancel(): void {
    form.resetFields();
    setSubmissionError(null);
    properties.onCancel();
  }

  /**
   * Validates and submits the selected reference-data key.
   *
   * @param {FormValues} values Submitted form values.
   * @returns {Promise<void>} Completion signal.
   */
  async function handleFinish(values: FormValues): Promise<void> {
    setSubmissionError(null);

    try {
      await properties.onConfirm(values.value);
    } catch (error: unknown) {
      setSubmissionError(error instanceof Error ? error.message : 'Unable to update the selected classes.');
    }
  }

  /**
   * Submits the modal form through the standard Modal OK action.
   */
  function handleOk(): void {
    form.submit();
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
      <Form<FormValues> form={form} layout="vertical" onFinish={handleFinish}>
        <Form.Item
          label={properties.fieldLabel}
          name="value"
          rules={[
            {
              validator: async (_, value: unknown) => {
                const parsedValue = bulkReferenceKeySchema.safeParse(value);
                if (!parsedValue.success) {
                  throw new Error(requiredMessage);
                }
                if (!allowedValues.has(parsedValue.data)) {
                  throw new Error(invalidMessage);
                }
              },
            },
          ]}
        >
          <Select
            disabled={properties.confirmLoading}
            options={properties.options}
            optionRender={(option) => option.data.label}
            placeholder={`Select a ${properties.fieldLabel.toLowerCase()}`}
            virtual={false}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
