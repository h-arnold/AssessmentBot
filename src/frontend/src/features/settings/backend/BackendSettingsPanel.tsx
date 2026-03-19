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
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { useEffect, useState } from 'react';
import { BackendSettingsFormSchema, type BackendSettingsForm } from './backendSettingsForm.zod';
import { useBackendSettings } from './useBackendSettings';

const { Text, Title } = Typography;

const jsonDatabaseLogLevelOptions = [
  { label: 'DEBUG', value: 'DEBUG' },
  { label: 'INFO', value: 'INFO' },
  { label: 'WARN', value: 'WARN' },
  { label: 'ERROR', value: 'ERROR' },
];

type BackendSettingsFieldName = Exclude<keyof BackendSettingsForm, 'hasApiKey'>;

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
 * Converts a field error message into a validateStatus value.
 *
 * @param {string | undefined} fieldErrorMessage The current field error message.
 * @returns {'error' | undefined} The Ant Design validation state.
 */
function getFieldValidateStatus(
  fieldErrorMessage: string | undefined
): 'error' | undefined {
  return fieldErrorMessage === undefined ? undefined : 'error';
}

/**
 * Returns the inline error message for a backend settings field.
 *
 * @param {Map<BackendSettingsFieldName, string>} fieldErrorMessages The current field error messages.
 * @param {BackendSettingsFieldName} fieldName The field name to inspect.
 * @returns {string | undefined} The field error message, if present.
 */
function getBackendSettingsFieldErrorMessage(
  fieldErrorMessages: Map<BackendSettingsFieldName, string>,
  fieldName: BackendSettingsFieldName
): string | undefined {
  return fieldErrorMessages.get(fieldName);
}

/**
 * Clears form validation errors for the provided backend settings fields.
 *
 * @param {FormInstance<BackendSettingsForm>} form The Ant Design form instance.
 * @param {ReadonlyArray<BackendSettingsFieldName>} fieldNames The fields whose validation state should be cleared.
 * @param {Dispatch<SetStateAction<Map<BackendSettingsFieldName, string>>>} setFieldErrorMessages The inline error state setter.
 * @returns {void} Nothing.
 */
function clearBackendSettingsFieldErrors(
  form: FormInstance<BackendSettingsForm>,
  fieldNames: ReadonlyArray<BackendSettingsFieldName>,
  setFieldErrorMessages: Dispatch<SetStateAction<Map<BackendSettingsFieldName, string>>>
): void {
  if (fieldNames.length === 0) {
    return;
  }

  form.setFields(fieldNames.map((fieldName) => ({ name: [fieldName], errors: [] })));

  setFieldErrorMessages((currentFieldErrorMessages) => {
    if (currentFieldErrorMessages.size === 0) {
      return currentFieldErrorMessages;
    }

    const nextFieldErrorMessages = new Map(currentFieldErrorMessages);
    for (const fieldName of fieldNames) {
      nextFieldErrorMessages.delete(fieldName);
    }

    return nextFieldErrorMessages;
  });
}

/**
 * Mirrors backend-settings validation issues into both the form meta and the controlled inline help state.
 *
 * @param {FormInstance<BackendSettingsForm>} form The Ant Design form instance.
 * @param {ReadonlyArray<{ fieldName: BackendSettingsFieldName; message: string }>} fieldErrors The validation issues to surface.
 * @param {Dispatch<SetStateAction<Map<BackendSettingsFieldName, string>>>} setFieldErrorMessages The inline error state setter.
 * @returns {void} Nothing.
 */
function setBackendSettingsFieldErrors(
  form: FormInstance<BackendSettingsForm>,
  fieldErrors: ReadonlyArray<{
    fieldName: BackendSettingsFieldName;
    message: string;
  }>,
  setFieldErrorMessages: Dispatch<SetStateAction<Map<BackendSettingsFieldName, string>>>
): void {
  if (fieldErrors.length === 0) {
    setFieldErrorMessages(new Map());
    return;
  }

  const nextFieldErrorMessages = new Map<BackendSettingsFieldName, string>();

  form.setFields(
    fieldErrors.map((fieldError) => {
      nextFieldErrorMessages.set(fieldError.fieldName, fieldError.message);
      return {
        name: [fieldError.fieldName],
        errors: [fieldError.message],
      };
    })
  );

  setFieldErrorMessages(nextFieldErrorMessages);
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
    loadError,
    partialLoadError,
    saveBackendSettings,
    saveError,
  } = useBackendSettings();
  const [form] = Form.useForm<BackendSettingsForm>();
  const [fieldErrorMessages, setFieldErrorMessages] = useState(
    () => new Map<BackendSettingsFieldName, string>()
  );

  useEffect(() => {
    if (backendSettingsFormValues !== null) {
      form.setFieldsValue(backendSettingsFormValues);
      clearBackendSettingsFieldErrors(form, backendSettingsFieldNames, setFieldErrorMessages);
    }
  }, [backendSettingsFormValues, form]);

  const handleFinish = async (): Promise<void> => {
    const formValues = {
      ...form.getFieldsValue(true),
      hasApiKey,
    } satisfies BackendSettingsForm;

  const validationResult = BackendSettingsFormSchema.safeParse(formValues);
  if (!validationResult.success) {
    setBackendSettingsFieldErrors(
      form,
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
      }),
      setFieldErrorMessages
    );
    return;
  }

    clearBackendSettingsFieldErrors(form, backendSettingsFieldNames, setFieldErrorMessages);

    await saveBackendSettings(validationResult.data);
  };

  /**
   * Mirrors Ant Design submit validation failures into the panel's controlled inline help state.
   *
   * @remarks
   * The panel keeps these messages local so they can be cleared as soon as the user fixes the
   * relevant field or the hook rebases the form after a successful save or fresh load.
   *
   * @param {object} properties The submit failure details from Ant Design.
   * @param {Array<{ errors: string[]; name: Array<string | number>; }>} properties.errorFields The
   * submit validation errors.
   * @returns {void} Nothing.
   */
  const handleFinishFailed = (properties: {
    errorFields: Array<{
      errors: string[];
      name: Array<string | number>;
    }>;
  }): void => {
    setBackendSettingsFieldErrors(
      form,
      properties.errorFields.flatMap((errorField) => {
        const [fieldName] = errorField.name;

        if (typeof fieldName !== 'string' || fieldName === 'hasApiKey') {
          return [];
        }

        return [
          {
            fieldName: fieldName as BackendSettingsFieldName,
            message: errorField.errors[0],
          },
        ];
      }),
      setFieldErrorMessages
    );
  };

  const handleValuesChange = (
    changedValues: Partial<BackendSettingsForm>,
    allValues: BackendSettingsForm
  ): void => {
    const changedFieldNames = Object.keys(changedValues).filter(
      (fieldName) => fieldName !== 'hasApiKey'
    ) as BackendSettingsFieldName[];

    if (changedFieldNames.length === 0) {
      return;
    }

    const validationResult = BackendSettingsFormSchema.safeParse({
      ...allValues,
      hasApiKey,
    } satisfies BackendSettingsForm);

    const fieldNamesToClear = validationResult.success
      ? changedFieldNames
      : changedFieldNames.filter(
          (fieldName) =>
            !validationResult.error.issues.some((issue) => issue.path[0] === fieldName)
        );

    clearBackendSettingsFieldErrors(form, fieldNamesToClear, setFieldErrorMessages);
  };

  if (loadError !== null) {
    return (
      <Alert
        title={loadError}
        showIcon
        type="error"
      />
    );
  }

  if (isInitialLoading) {
    return (
      <div aria-label="Loading backend settings" role="status">
        <Skeleton active paragraph={{ rows: 10 }} />
      </div>
    );
  }

  return (
    <Card className="settings-tab-panel" role="region" aria-label="Backend settings panel">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
        {partialLoadError !== null && (
          <Alert
            title={partialLoadError}
            showIcon
            type="warning"
          />
        )}

        {saveError !== null && (
          <Alert
            title={saveError}
            showIcon
            type="error"
          />
        )}

        <Form<BackendSettingsForm>
          form={form}
          layout="vertical"
          name="backend-settings"
          onFinishFailed={handleFinishFailed}
          onFinish={handleFinish}
          onValuesChange={handleValuesChange}
          scrollToFirstError={{ focus: true }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
            <SettingsSectionCard title="Backend">
              <Form.Item
                label="API key"
                name="apiKey"
                help={getBackendSettingsFieldErrorMessage(fieldErrorMessages, 'apiKey')}
                validateStatus={getFieldValidateStatus(
                  getBackendSettingsFieldErrorMessage(fieldErrorMessages, 'apiKey')
                )}
                rules={[
                  {
                    validator: createBackendSettingsFieldValidator(form, hasApiKey, 'apiKey'),
                  },
                ]}
              >
                <Input.Password autoComplete="new-password" />
              </Form.Item>

              <Text
                type="secondary"
                style={{ display: 'block', marginBottom: 24, marginTop: -16 }}
              >
                {getApiKeyHelperCopy(hasApiKey)}
              </Text>

              <Form.Item
                label="Backend URL"
                name="backendUrl"
                help={getBackendSettingsFieldErrorMessage(fieldErrorMessages, 'backendUrl')}
                validateStatus={getFieldValidateStatus(
                  getBackendSettingsFieldErrorMessage(fieldErrorMessages, 'backendUrl')
                )}
                rules={[
                  {
                    validator: createBackendSettingsFieldValidator(form, hasApiKey, 'backendUrl'),
                  },
                ]}
              >
                <Input autoComplete="url" />
              </Form.Item>
            </SettingsSectionCard>

            <SettingsSectionCard title="Advanced">
              <Form.Item
                label="Backend assessor batch size"
                name="backendAssessorBatchSize"
                help={getBackendSettingsFieldErrorMessage(
                  fieldErrorMessages,
                  'backendAssessorBatchSize'
                )}
                validateStatus={getFieldValidateStatus(
                  getBackendSettingsFieldErrorMessage(
                    fieldErrorMessages,
                    'backendAssessorBatchSize'
                  )
                )}
                rules={[
                  {
                    validator: createBackendSettingsFieldValidator(
                      form,
                      hasApiKey,
                      'backendAssessorBatchSize'
                    ),
                  },
                ]}
              >
                <InputNumber min={1} max={500} precision={0} style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item
                label="Slides fetch batch size"
                name="slidesFetchBatchSize"
                help={getBackendSettingsFieldErrorMessage(
                  fieldErrorMessages,
                  'slidesFetchBatchSize'
                )}
                validateStatus={getFieldValidateStatus(
                  getBackendSettingsFieldErrorMessage(
                    fieldErrorMessages,
                    'slidesFetchBatchSize'
                  )
                )}
                rules={[
                  {
                    validator: createBackendSettingsFieldValidator(
                      form,
                      hasApiKey,
                      'slidesFetchBatchSize'
                    ),
                  },
                ]}
              >
                <InputNumber min={1} max={100} precision={0} style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item
                label="Days until auth revoke"
                name="daysUntilAuthRevoke"
                help={getBackendSettingsFieldErrorMessage(
                  fieldErrorMessages,
                  'daysUntilAuthRevoke'
                )}
                validateStatus={getFieldValidateStatus(
                  getBackendSettingsFieldErrorMessage(
                    fieldErrorMessages,
                    'daysUntilAuthRevoke'
                  )
                )}
                rules={[
                  {
                    validator: createBackendSettingsFieldValidator(
                      form,
                      hasApiKey,
                      'daysUntilAuthRevoke'
                    ),
                  },
                ]}
              >
                <InputNumber min={1} max={365} precision={0} style={{ width: '100%' }} />
              </Form.Item>
            </SettingsSectionCard>

            <SettingsSectionCard title="Database">
              <Form.Item
                label="JSON DB master index key"
                name="jsonDbMasterIndexKey"
                help={getBackendSettingsFieldErrorMessage(
                  fieldErrorMessages,
                  'jsonDbMasterIndexKey'
                )}
                validateStatus={getFieldValidateStatus(
                  getBackendSettingsFieldErrorMessage(
                    fieldErrorMessages,
                    'jsonDbMasterIndexKey'
                  )
                )}
                rules={[
                  {
                    validator: createBackendSettingsFieldValidator(
                      form,
                      hasApiKey,
                      'jsonDbMasterIndexKey'
                    ),
                  },
                ]}
              >
                <Input autoComplete="off" />
              </Form.Item>

              <Form.Item
                label="JSON DB lock timeout"
                name="jsonDbLockTimeoutMs"
                help={getBackendSettingsFieldErrorMessage(
                  fieldErrorMessages,
                  'jsonDbLockTimeoutMs'
                )}
                validateStatus={getFieldValidateStatus(
                  getBackendSettingsFieldErrorMessage(
                    fieldErrorMessages,
                    'jsonDbLockTimeoutMs'
                  )
                )}
                rules={[
                  {
                    validator: createBackendSettingsFieldValidator(
                      form,
                      hasApiKey,
                      'jsonDbLockTimeoutMs'
                    ),
                  },
                ]}
              >
                <InputNumber min={1000} max={600_000} precision={0} style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item
                label="JSON DB log level"
                name="jsonDbLogLevel"
                help={getBackendSettingsFieldErrorMessage(fieldErrorMessages, 'jsonDbLogLevel')}
                validateStatus={getFieldValidateStatus(
                  getBackendSettingsFieldErrorMessage(fieldErrorMessages, 'jsonDbLogLevel')
                )}
                rules={[
                  {
                    validator: createBackendSettingsFieldValidator(
                      form,
                      hasApiKey,
                      'jsonDbLogLevel'
                    ),
                  },
                ]}
              >
                <Select options={jsonDatabaseLogLevelOptions} />
              </Form.Item>

              <Form.Item
                label="JSON DB backup on initialise"
                name="jsonDbBackupOnInitialise"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Form.Item
                label="JSON DB root folder ID"
                name="jsonDbRootFolderId"
                help={getBackendSettingsFieldErrorMessage(
                  fieldErrorMessages,
                  'jsonDbRootFolderId'
                )}
                validateStatus={getFieldValidateStatus(
                  getBackendSettingsFieldErrorMessage(
                    fieldErrorMessages,
                    'jsonDbRootFolderId'
                  )
                )}
                rules={[
                  {
                    validator: createBackendSettingsFieldValidator(
                      form,
                      hasApiKey,
                      'jsonDbRootFolderId'
                    ),
                  },
                ]}
              >
                <Input autoComplete="off" />
              </Form.Item>
            </SettingsSectionCard>

            <Form.Item>
              <Button
                htmlType="submit"
                loading={isSaving}
                disabled={isSaveBlocked || isSaving}
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
