import { Form, InputNumber, Select } from 'antd';
import { useMemo } from 'react';
import { BulkFormModalScaffold } from './BulkFormModalScaffold';
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
  const allowedCohortKeys = useMemo(
    () => new Set(properties.cohortOptions.map((option) => option.value)),
    [properties.cohortOptions],
  );
  const allowedYearGroupKeys = useMemo(
    () => new Set(properties.yearGroupOptions.map((option) => option.value)),
    [properties.yearGroupOptions],
  );

  /**
   * Validates and submits a bulk-create request.
   *
   * @param {FormValues} values Submitted form values.
   * @returns {Promise<void>} Completion signal.
   */
  async function handleFinish(values: FormValues): Promise<void> {
    await properties.onConfirm({
      cohortKey: values.cohortKey,
      yearGroupKey: values.yearGroupKey,
      courseLength: values.courseLength,
    });
  }

  return (
    <BulkFormModalScaffold
      open={properties.open}
      title="Create ABClass"
      confirmLoading={properties.confirmLoading}
      onCancel={properties.onCancel}
      form={form}
      onFinish={handleFinish}
      fallbackErrorMessage="Unable to create the selected classes."
      initialValues={{ courseLength: 1 }}
    >
      {({ disabled }) => (
        <>
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
              disabled={disabled}
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
              disabled={disabled}
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
              disabled={disabled}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </>
      )}
    </BulkFormModalScaffold>
  );
}
