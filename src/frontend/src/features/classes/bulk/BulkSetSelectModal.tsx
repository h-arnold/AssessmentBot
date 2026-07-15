import { Form } from 'antd';
import { useEffect, useMemo } from 'react';
import { BulkFormModalScaffold } from './BulkFormModalScaffold';
import { bulkReferenceKeySchema } from './bulkEditValidation.zod';
import { SelectWithAddNew } from '../../../components/SelectWithAddNew/SelectWithAddNew';

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
  onAddNew?: () => void;
  pendingCreatedKey?: string;
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
  const allowedValues = useMemo(
    () => new Set(properties.options.map((option) => option.value)),
    [properties.options],
  );
  const requiredMessage = `Please select a ${properties.fieldLabel.toLowerCase()}.`;
  const invalidMessage = `Please select a valid ${properties.fieldLabel.toLowerCase()}.`;

  // Determine entity type from fieldLabel for addNewLabel
  const entityType = useMemo(() => {
    const lowerLabel = properties.fieldLabel.toLowerCase();
    if (lowerLabel.includes('cohort')) {
      return 'cohort' as const;
    }
    if (lowerLabel.includes('year group')) {
      return 'yearGroup' as const;
    }
    if (lowerLabel.includes('topic')) {
      return 'topic' as const;
    }
  }, [properties.fieldLabel]);

  // When a new entity is created, set it as the selected value
  useEffect(() => {
    if (properties.pendingCreatedKey) {
      form.setFieldValue('value', properties.pendingCreatedKey);
    }
  }, [properties.pendingCreatedKey, form]);

  /**
   * Validates and submits the selected reference-data key.
   *
   * @param {FormValues} values Submitted form values.
   * @returns {Promise<void>} Completion signal.
   */
  async function handleFinish(values: FormValues): Promise<void> {
    await properties.onConfirm(values.value);
  }

  return (
    <BulkFormModalScaffold
      open={properties.open}
      title={properties.title}
      confirmLoading={properties.confirmLoading}
      onCancel={properties.onCancel}
      form={form}
      onFinish={handleFinish}
      fallbackErrorMessage="Unable to update the selected classes."
    >
      {({ disabled }) => (
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
          <SelectWithAddNew
            disabled={disabled}
            options={properties.options}
            optionRender={(option) => option.data.label}
            placeholder={`Select a ${properties.fieldLabel.toLowerCase()}`}
            virtual={false}
            onAddNew={properties.onAddNew}
            entityType={entityType}
            debounceMs={300}
          />
        </Form.Item>
      )}
    </BulkFormModalScaffold>
  );
}
