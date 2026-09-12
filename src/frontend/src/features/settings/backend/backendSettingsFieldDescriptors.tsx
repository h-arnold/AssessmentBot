import { Input, InputNumber, Select, Switch } from 'antd';
import type { FormInstance } from 'antd';
import type { ReactNode } from 'react';
import { BackendSettingsFormSchema, type BackendSettingsForm } from './backendSettingsForm.zod';

const jsonDatabaseLogLevelOptions = [
  { label: 'DEBUG', value: 'DEBUG' },
  { label: 'INFO', value: 'INFO' },
  { label: 'WARN', value: 'WARN' },
  { label: 'ERROR', value: 'ERROR' },
];

export type BackendSettingsFieldName = Exclude<keyof BackendSettingsForm, 'hasApiKey'>;
export type BackendSettingsFieldSection = 'Backend' | 'Advanced' | 'Database';

export type BackendSettingsFieldDescriptor = Readonly<{
  name: BackendSettingsFieldName;
  label: string;
  renderInput: () => ReactNode;
  section: BackendSettingsFieldSection;
  valuePropName?: 'checked';
  withSchemaValidation?: boolean;
  helperText?: string;
}>;

export const backendSettingsFieldNames = [
  'apiKey',
  'backendUrl',
  'backendAssessorBatchSize',
  'slidesFetchBatchSize',
  'daysUntilAuthRevoke',
  'jsonDbMasterIndexKey',
  'jsonDbLockTimeoutMs',
  'jsonDbLogLevel',
  'jsonDbBackupOnInitialise',
  'jsonDbRootFolderId',
] as const satisfies ReadonlyArray<BackendSettingsFieldName>;

export const backendSettingsFieldDescriptors = [
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
    renderInput: () => (
      <InputNumber min={1000} max={600_000} precision={0} style={{ width: '100%' }} />
    ),
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

export const backendSettingsSectionOrder = [
  'Backend',
  'Advanced',
  'Database',
] as const satisfies ReadonlyArray<BackendSettingsFieldSection>;

/**
 * Creates a schema-backed field validator for the backend settings form.
 *
 * @param {FormInstance<BackendSettingsForm>} form The Ant Design form instance.
 * @param {boolean} hasApiKey Whether a stored API key already exists.
 * @param {BackendSettingsFieldName} fieldName The field name to validate.
 * @returns {NonNullable<Parameters<typeof Form.Item>[0]['rules']>[number]['validator']} The validator callback.
 */
export function createBackendSettingsFieldValidator(
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