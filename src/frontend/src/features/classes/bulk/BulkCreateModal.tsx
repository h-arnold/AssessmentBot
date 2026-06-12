import { Form, InputNumber } from 'antd';
import { useEffect, useMemo } from 'react';
import { BulkFormModalScaffold } from './BulkFormModalScaffold';
import type { BulkCreateOptions } from './bulkCreateFlow';
import {
  bulkCourseLengthSchema,
  bulkReferenceKeySchema,
  courseLengthValidationMessage,
} from './bulkEditValidation.zod';
import { SelectWithAddNew } from '../../../components/SelectWithAddNew';

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
  onCohortAddNew?: () => void;
  onYearGroupAddNew?: () => void;
  pendingCreatedCohortKey?: string;
  pendingCreatedYearGroupKey?: string;
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

  // When a new cohort is created, set it as the selected cohort
  useEffect(() => {
    if (properties.pendingCreatedCohortKey) {
      form.setFieldValue('cohortKey', properties.pendingCreatedCohortKey);
    }
  }, [properties.pendingCreatedCohortKey, form]);

  // When a new year group is created, set it as the selected year group
  useEffect(() => {
    if (properties.pendingCreatedYearGroupKey) {
      form.setFieldValue('yearGroupKey', properties.pendingCreatedYearGroupKey);
    }
  }, [properties.pendingCreatedYearGroupKey, form]);

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
            <SelectWithAddNew
              disabled={disabled}
              options={properties.cohortOptions}
              optionRender={(option) => option.data.label}
              placeholder="Select a cohort"
              virtual={false}
              onAddNew={properties.onCohortAddNew}
              addNewLabel="Add new cohort"
              entityType="cohort"
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
            <SelectWithAddNew
              disabled={disabled}
              options={properties.yearGroupOptions}
              optionRender={(option) => option.data.label}
              placeholder="Select a year group"
              virtual={false}
              onAddNew={properties.onYearGroupAddNew}
              addNewLabel="Add new year group"
              entityType="yearGroup"
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
