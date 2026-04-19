import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Skeleton,
  Switch,
  Typography,
} from 'antd';
import type { FormInstance } from 'antd';
import type { ReactNode } from 'react';
import { Fragment, useEffect } from 'react';
import { BackendSettingsFormSchema, type BackendSettingsForm } from './backendSettingsForm.zod';
import { useBackendSettings } from './useBackendSettings';

const { Text, Title } = Typography;

const backendSettingsRefreshStatusCopy = 'Refreshing backend settings...';

const jsonDatabaseLogLevelOptions = [
  { label: 'DEBUG', value: 'DEBUG' },
  { label: 'INFO', value: 'INFO' },
  { label: 'WARN', value: 'WARN' },
  { label: 'ERROR', value: 'ERROR' },
];

type BackendSettingsFieldName = Exclude<keyof BackendSettingsForm, 'hasApiKey'>;
type BackendSettingsFieldSection = 'Backend' | 'Advanced' | 'Database';

type BackendSettingsFieldDescriptor = Readonly<{
  name: BackendSettingsFieldName | 'jsonDbBackupOnInitialise';
  label: string;
  renderInput: () => ReactNode;
  section: BackendSettingsFieldSection;
  valuePropName?: 'checked';
  withSchemaValidation?: boolean;
}>;

const backendSettingsFieldNames = [
  'apiKey',
  'backendUrl',
  'backendAssessorBatchSize',
  'slidesFetchBatchSize',
  'daysUntilAuthRevoke',
  'jsonDbMasterIndexKey',
  'jsonDbLockTimeoutMs',
  'jsonDbLogLevel',
  'jsonDbRootFolderId',
] as const satisfies ReadonlyArray<BackendSettingsFieldName>;

const backendSettingsFieldDescriptors = [
  {
    name: 'apiKey',
    label: 'API key',
    renderInput: () => <Input.Password autoComplete="new-password" />,
    section: 'Backend',
    withSchemaValidation: true,
  },
  {
    name: 'backendUrl',
    label: 'Backend URL',
    renderInput: () => <Input autoComplete="url" />,
    section: 'Backend',
    withSchemaValidation: true,
  },
  {
    name: 'backendAssessorBatchSize',
    label: 'Backend assessor batch size',
    renderInput: () => <InputNumber min={1} max={500} precision={0} style={{ width: '100%' }} />,
    section: 'Advanced',
    withSchemaValidation: true,
  },
  {
    name: 'slidesFetchBatchSize',
    label: 'Slides fetch batch size',
    renderInput: () => <InputNumber min={1} max={100} precision={0} style={{ width: '100%' }} />,
    section: 'Advanced',
    withSchemaValidation: true,
  },
  {
    name: 'daysUntilAuthRevoke',
    label: 'Days until auth revoke',
    renderInput: () => <InputNumber min={1} max={365} precision={0} style={{ width: '100%' }} />,
    section: 'Advanced',
    withSchemaValidation: true,
  },
  {
    name: 'jsonDbMasterIndexKey',
    label: 'JSON DB master index key',
    renderInput: () => <Input autoComplete="off" />,
    section: 'Database',
    withSchemaValidation: true,
  },
  {
    name: 'jsonDbLockTimeoutMs',
    label: 'JSON DB lock timeout',
    renderInput: () => <InputNumber min={1000} max={600_000} precision={0} style={{ width: '100%' }} />,
    section: 'Database',
    withSchemaValidation: true,
  },
  {
    name: 'jsonDbLogLevel',
    label: 'JSON DB log level',
    renderInput: () => <Select options={jsonDatabaseLogLevelOptions} />,
    section: 'Database',
    withSchemaValidation: true,
  },
  {
    name: 'jsonDbBackupOnInitialise',
    label: 'JSON DB backup on initialise',
    renderInput: () => <Switch />,
    section: 'Database',
    valuePropName: 'checked',
  },
  {
    name: 'jsonDbRootFolderId',
    label: 'JSON DB root folder ID',
    renderInput: () => <Input autoComplete="off" />,
    section: 'Database',
    withSchemaValidation: true,
  },
] as const satisfies ReadonlyArray<BackendSettingsFieldDescriptor>;

const backendSettingsSectionOrder = ['Backend', 'Advanced', 'Database'] as const satisfies ReadonlyArray<BackendSettingsFieldSection>;

type SettingsSectionCardProperties = Readonly<{
  title: string;
  children: ReactNode;
}>;

/**
 * Renders a section card with a semantic heading for the backend settings form.
 *
 * @param {SettingsSectionCardProperties} properties Section card properties.
 * @returns {JSX.Element} The section card.
 */
function SettingsSectionCard(properties: SettingsSectionCardProperties) {
  const { children, title } = properties;

  return (
    <Card
      className="settings-section-card"
      title={
        <Title level={3} style={{ margin: 0 }}>
          {title}
        </Title>
      }
    >
      {children}
    </Card>
  );
}

/**
 * Creates a schema-backed field validator for the backend settings form.
 *
 * @param {FormInstance<BackendSettingsForm>} form The Ant Design form instance.
 * @param {boolean} hasApiKey Whether a stored API key already exists.
 * @param {BackendSettingsFieldName} fieldName The field name to validate.
 * @returns {NonNullable<Parameters<typeof Form.Item>[0]['rules']>[number]['validator']} The validator callback.
 */
function createBackendSettingsFieldValidator(
  form: FormInstance<BackendSettingsForm>,
  hasApiKey: boolean,
  fieldName: BackendSettingsFieldName
) {
  return (_rule: unknown, value: unknown) => {
    const candidateValues = {
      ...form.getFieldsValue(true),
      hasApiKey,
      [fieldName]: value,
    } as BackendSettingsForm;

    const validationResult = BackendSettingsFormSchema.safeParse(candidateValues);
    if (validationResult.success) {
      return Promise.resolve();
    }

    const issue = validationResult.error.issues.find(
      (candidateIssue) => candidateIssue.path[0] === fieldName
    );
    if (issue !== undefined) {
      return Promise.reject(new Error(issue.message));
    }

    return Promise.resolve();
  };
}

/**
 * Returns the helper copy for the API key field.
 *
 * @param {boolean} hasApiKey Whether a stored API key already exists.
 * @returns {string} The helper copy.
 *
 * @remarks
 * The helper stays intentionally narrow because the field only supports replacement or retention.
 * Explicit clearing remains out of scope, so the copy should continue to steer users towards
 * either providing a replacement key or leaving the field blank.
 */
function getApiKeyHelperCopy(hasApiKey: boolean): string {
  if (hasApiKey) {
    return 'Stored API key already exists. Leave this field blank to keep it.';
  }

  return 'Enter a new API key.';
}

/**
 * Clears form validation errors for the provided backend settings fields.
 *
 * @param {FormInstance<BackendSettingsForm>} form The Ant Design form instance.
 * @param {ReadonlyArray<BackendSettingsFieldName>} fieldNames The fields whose validation state should be cleared.
 * @returns {void} Nothing.
 */
function clearBackendSettingsFieldErrors(
  form: FormInstance<BackendSettingsForm>,
  fieldNames: ReadonlyArray<BackendSettingsFieldName>
): void {
  if (fieldNames.length === 0) {
    return;
  }

  form.setFields(fieldNames.map((fieldName) => ({ name: [fieldName], errors: [] })));
}

/**
 * Maps backend-settings validation issues into Ant Design field-error records.
 *
 * @param {ReadonlyArray<{ fieldName: BackendSettingsFieldName; message: string }>} fieldErrors Validation issues.
 * @returns {Array<{ name: [BackendSettingsFieldName]; errors: [string] }>} Ant Design field-error records.
 */
function mapBackendSettingsFieldErrorsToFormRecords(
  fieldErrors: ReadonlyArray<{
    fieldName: BackendSettingsFieldName;
    message: string;
  }>
): Array<{ name: [BackendSettingsFieldName]; errors: [string] }> {
  return fieldErrors.map((fieldError) => ({
    name: [fieldError.fieldName],
    errors: [fieldError.message],
  }));
}

/**
 * Renders one backend settings form item from a local field descriptor.
 *
 * @param {Readonly<{ descriptor: BackendSettingsFieldDescriptor; form: FormInstance<BackendSettingsForm>; hasApiKey: boolean; }>} properties Field-render dependencies.
 * @returns {JSX.Element} The rendered form item.
 */
function renderBackendSettingsField(properties: Readonly<{
  descriptor: BackendSettingsFieldDescriptor;
  form: FormInstance<BackendSettingsForm>;
  hasApiKey: boolean;
}>) {
  const { descriptor, form, hasApiKey } = properties;

  return (
    <Form.Item
      key={descriptor.name}
      label={descriptor.label}
      name={descriptor.name}
      rules={
        descriptor.withSchemaValidation
          ? [
              {
                validator: createBackendSettingsFieldValidator(
                  form,
                  hasApiKey,
                  descriptor.name as BackendSettingsFieldName
                ),
              },
            ]
          : undefined
      }
      valuePropName={descriptor.valuePropName}
    >
      {descriptor.renderInput()}
    </Form.Item>
  );
}

/**
 * Renders panel-level backend settings status notices.
 *
 * @param {Readonly<{ isRefreshing: boolean; saveError: string | null; }>} properties Status flags.
 * @returns {JSX.Element} The status notice content.
 */
function renderBackendSettingsPanelStatus(
  properties: Readonly<{
    isRefreshing: boolean;
    saveError: string | null;
  }>
) {
  return (
    <>
      {properties.isRefreshing ? (
        <div aria-live="polite" role="status">
          <Text type="secondary">{backendSettingsRefreshStatusCopy}</Text>
        </div>
      ) : null}
      {properties.saveError === null ? null : (
        <Alert title={properties.saveError} showIcon type="error" />
      )}
    </>
  );
}

/**
 * Renders the backend settings feature panel for the Settings page.
 *
 * @remarks
 * The panel owns the Ant Design `FormInstance` so it can stay declarative while still rebasing the
 * visible inputs with `form.setFieldsValue(...)` when the hook publishes fresh backend values.
 *
 * The API key helper text is intentionally limited to replacement or retention guidance because
 * explicit clearing is out of scope for this feature and the backend only accepts a blank field as
 * "keep the stored key".
 *
 * Submit failures rely on `scrollToFirstError={{ focus: true }}` so browser-visible validation
 * behaviour stays accessible and the first invalid field receives focus without custom scrolling
 * logic.
 *
 * @returns {JSX.Element} The backend settings panel.
 */
export function BackendSettingsPanel() {
  const {
    backendSettingsFormValues,
    hasApiKey,
    isInitialLoading,
    isSaveBlocked,
    isSaving,
    isRefreshing,
    loadError,
    saveBackendSettings,
    saveError,
  } = useBackendSettings();
  const [form] = Form.useForm<BackendSettingsForm>();

  useEffect(() => {
    if (backendSettingsFormValues !== null) {
      form.setFieldsValue(backendSettingsFormValues);
      clearBackendSettingsFieldErrors(form, backendSettingsFieldNames);
    }
  }, [backendSettingsFormValues, form]);

  const handleFinish = async (): Promise<void> => {
    const formValues = {
      ...form.getFieldsValue(true),
      hasApiKey,
    } satisfies BackendSettingsForm;

    const validationResult = BackendSettingsFormSchema.safeParse(formValues);
    if (!validationResult.success) {
      form.setFields(
        mapBackendSettingsFieldErrorsToFormRecords(
          validationResult.error.issues.flatMap((issue) => {
            const [fieldName] = issue.path;

            if (typeof fieldName !== 'string' || fieldName === 'hasApiKey') {
              return [];
            }

            return [
              {
                fieldName: fieldName as BackendSettingsFieldName,
                message: issue.message,
              },
            ];
          })
        )
      );
      return;
    }

    clearBackendSettingsFieldErrors(form, backendSettingsFieldNames);
    await saveBackendSettings(validationResult.data);
  };

  if (loadError !== null) {
    return (
      <Card
        className="settings-tab-panel settings-tab-panel--backend"
        role="region"
        aria-label="Backend settings panel"
      >
        <Alert title={loadError} showIcon type="error" />
      </Card>
    );
  }

  if (isInitialLoading) {
    return (
      <Card
        className="settings-tab-panel settings-tab-panel--backend"
        role="region"
        aria-label="Backend settings panel"
      >
        <div aria-label="Loading backend settings" role="status">
          <Skeleton active paragraph={{ rows: 10 }} />
        </div>
      </Card>
    );
  }

  return (
    <Card
      className="settings-tab-panel settings-tab-panel--backend"
      role="region"
      aria-label="Backend settings panel"
      aria-busy={isRefreshing ? 'true' : undefined}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
        {renderBackendSettingsPanelStatus({ isRefreshing, saveError })}

        <Form<BackendSettingsForm>
          form={form}
          layout="vertical"
          name="backend-settings"
          onFinish={handleFinish}
          scrollToFirstError={{ focus: true }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
            {backendSettingsSectionOrder.map((section) => (
              <SettingsSectionCard key={section} title={section}>
                {backendSettingsFieldDescriptors
                  .filter((fieldDescriptor) => fieldDescriptor.section === section)
                  .map((fieldDescriptor) => (
                    <Fragment key={fieldDescriptor.name}>
                      {renderBackendSettingsField({
                        descriptor: fieldDescriptor,
                        form,
                        hasApiKey,
                      })}

                      {section === 'Backend' && fieldDescriptor.name === 'apiKey' ? (
                        <Text
                          type="secondary"
                          style={{ display: 'block', marginBottom: 24, marginTop: -16 }}
                        >
                          {getApiKeyHelperCopy(hasApiKey)}
                        </Text>
                      ) : null}
                    </Fragment>
                  ))}
              </SettingsSectionCard>
            ))}

            <Form.Item>
              <Button
                htmlType="submit"
                loading={isSaving && !isRefreshing}
                disabled={isSaveBlocked || isSaving || isRefreshing}
                type="primary"
              >
                Save
              </Button>
            </Form.Item>
          </div>
        </Form>
      </div>
    </Card>
  );
}
