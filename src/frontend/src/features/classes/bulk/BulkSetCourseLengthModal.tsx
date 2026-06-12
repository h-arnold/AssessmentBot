import { Form, InputNumber } from 'antd';
import { BulkFormModalScaffold } from './BulkFormModalScaffold';
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

  /**
   * Validates and submits the selected course length.
   *
   * @param {FormValues} values Submitted form values.
   * @returns {Promise<void>} Completion signal.
   */
  async function handleFinish(values: FormValues): Promise<void> {
    await properties.onConfirm(values.courseLength);
  }

  return (
    <BulkFormModalScaffold
      open={properties.open}
      title="Set course length"
      confirmLoading={properties.confirmLoading}
      onCancel={properties.onCancel}
      form={form}
      onFinish={handleFinish}
      fallbackErrorMessage="Unable to update the selected classes."
    >
      {({ disabled }) => (
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
            disabled={disabled}
            style={{ width: '100%' }}
          />
        </Form.Item>
      )}
    </BulkFormModalScaffold>
  );
}
