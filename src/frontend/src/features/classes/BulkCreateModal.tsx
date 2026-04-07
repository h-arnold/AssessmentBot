import { Alert, Form, InputNumber, Modal, Select } from 'antd';
import { useMemo, useState } from 'react';
import type { BulkCreateOptions } from './bulkCreateFlow';
import {
  bulkCourseLengthSchema,
  bulkReferenceKeySchema,
  courseLengthValidationMessage,
} from './bulkEditValidation.zod';

type SelectOption = Readonly<{
  label: string;
  value: string;
}>;

export type BulkCreateModalProperties = Readonly<{
  confirmLoading?: boolean;
  open: boolean;
  cohortOptions: SelectOption[];
  yearGroupOptions: SelectOption[];
  onCancel: () => void;
  onConfirm: (options: BulkCreateOptions) => Promise<void>;
}>;

type FormValues = Readonly<{
  cohortKey: string;
  courseLength: number;
  yearGroupKey: string;
}>;

/**
 * Renders the bulk create modal.
 *
 * @param {BulkCreateModalProperties} properties Modal properties.
 * @returns {JSX.Element} The rendered modal.
 */
export function BulkCreateModal(properties: BulkCreateModalProperties) {
  const [form] = Form.useForm<FormValues>();
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const allowedCohortKeys = useMemo(
    () => new Set(properties.cohortOptions.map((option) => option.value)),
    [properties.cohortOptions],
  );
  const allowedYearGroupKeys = useMemo(
    () => new Set(properties.yearGroupOptions.map((option) => option.value)),
    [properties.yearGroupOptions],
  );

  /**
   * Resets local modal state before delegating cancellation.
   */
  function handleCancel(): void {
    form.resetFields();
    setSubmissionError(null);
    properties.onCancel();
  }

  /**
   * Validates and submits a bulk-create request.
   *
   * @param {FormValues} values Submitted form values.
   * @returns {Promise<void>} Completion signal.
   */
  async function handleFinish(values: FormValues): Promise<void> {
    setSubmissionError(null);

    try {
      await properties.onConfirm({
        cohortKey: values.cohortKey,
        yearGroupKey: values.yearGroupKey,
        courseLength: values.courseLength,
      });
    } catch (error: unknown) {
      setSubmissionError(error instanceof Error ? error.message : 'Unable to create the selected classes.');
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
      title="Create ABClass"
      confirmLoading={properties.confirmLoading}
      onOk={handleOk}
      onCancel={handleCancel}
      cancelButtonProps={{ disabled: properties.confirmLoading }}
      destroyOnHidden
    >
      {submissionError ? (
        <Alert description={submissionError} type="error" showIcon style={{ marginBottom: 16 }} />
      ) : null}
      <Form<FormValues>
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        initialValues={{ courseLength: 1 }}
      >
        <Form.Item
          label="Cohort"
          name="cohortKey"
          rules={[
            {
              validator: async (_, value: unknown) => {
                const parsedValue = bulkReferenceKeySchema.safeParse(value);
                if (!parsedValue.success) {
                  throw new Error('Please select a cohort.');
                }
                if (!allowedCohortKeys.has(parsedValue.data)) {
                  throw new Error('Please select a valid cohort.');
                }
              },
            },
          ]}
        >
          <Select
            disabled={properties.confirmLoading}
            options={properties.cohortOptions}
            optionRender={(option) => option.data.label}
            placeholder="Select a cohort"
            virtual={false}
          />
        </Form.Item>
        <Form.Item
          label="Year group"
          name="yearGroupKey"
          rules={[
            {
              validator: async (_, value: unknown) => {
                const parsedValue = bulkReferenceKeySchema.safeParse(value);
                if (!parsedValue.success) {
                  throw new Error('Please select a year group.');
                }
                if (!allowedYearGroupKeys.has(parsedValue.data)) {
                  throw new Error('Please select a valid year group.');
                }
              },
            },
          ]}
        >
          <Select
            disabled={properties.confirmLoading}
            options={properties.yearGroupOptions}
            optionRender={(option) => option.data.label}
            placeholder="Select a year group"
            virtual={false}
          />
        </Form.Item>
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
            min={1}
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
