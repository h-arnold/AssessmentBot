import { Form, Select } from 'antd';
import { useMemo } from 'react';
import { BulkFormModalScaffold } from './BulkFormModalScaffold';
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
  const allowedValues = useMemo(
    () => new Set(properties.options.map((option) => option.value)),
    [properties.options],
  );
  const requiredMessage = `Please select a ${properties.fieldLabel.toLowerCase()}.`;
  const invalidMessage = `Please select a valid ${properties.fieldLabel.toLowerCase()}.`;

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
          <Select
            disabled={disabled}
            options={properties.options}
            optionRender={(option) => option.data.label}
            placeholder={`Select a ${properties.fieldLabel.toLowerCase()}`}
            virtual={false}
          />
        </Form.Item>
      )}
    </BulkFormModalScaffold>
  );
}
