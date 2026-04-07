import { Alert, Form, InputNumber, Modal } from 'antd';
import { useState } from 'react';
import {
  bulkCourseLengthSchema,
  courseLengthValidationMessage,
} from './bulkEditValidation.zod';

export type BulkSetCourseLengthModalProperties = Readonly<{
  confirmLoading?: boolean;
  open: boolean;
  onCancel: () => void;
  onConfirm: (courseLength: number) => Promise<void>;
}>;

type FormValues = {
  courseLength: number;
};

/**
 * Renders the bulk course-length modal.
 *
 * @param {BulkSetCourseLengthModalProperties} properties Modal properties.
 * @returns {JSX.Element} The rendered modal.
 */
export function BulkSetCourseLengthModal(properties: BulkSetCourseLengthModalProperties) {
  const [form] = Form.useForm<FormValues>();
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  /**
   * Resets local modal state before delegating cancellation.
   */
  function handleCancel(): void {
    form.resetFields();
    setSubmissionError(null);
    properties.onCancel();
  }

  /**
   * Validates and submits the selected course length.
   *
   * @param {FormValues} values Submitted form values.
   * @returns {Promise<void>} Completion signal.
   */
  async function handleFinish(values: FormValues): Promise<void> {
    setSubmissionError(null);

    try {
      await properties.onConfirm(values.courseLength);
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
      title="Set course length"
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
          label="Course length"
          name="courseLength"
          rules={[
            {
              validator: async (_, value: unknown) => {
                const parsedValue = bulkCourseLengthSchema.safeParse(value);
                if (!parsedValue.success) {
                  throw new Error(courseLengthValidationMessage);
                }
              },
            },
          ]}
        >
          <InputNumber
            precision={0}
            step={1}
            disabled={properties.confirmLoading}
            style={{ width: '100%' }}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
