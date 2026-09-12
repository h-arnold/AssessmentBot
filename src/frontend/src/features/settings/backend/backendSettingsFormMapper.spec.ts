import { describe, expect, it } from 'vitest';
import type { BackendConfig } from '../../../services/backendConfiguration/backendConfiguration.zod';
import { BackendConfigWriteInputSchema } from '../../../services/backendConfiguration/backendConfiguration.zod';
import type { BackendSettingsForm } from './backendSettingsForm.zod';
import {
  mapBackendConfigToBackendSettingsFormValues,
  mapBackendSettingsFormValuesToBackendConfigWriteInput,
} from './backendSettingsFormMapper';

const validTrimmedBackendUrl = 'https://backend.example.com';

type BackendSettingsFormTestValues = {
  hasApiKey: boolean;
  apiKey: string;
  backendUrl: string;
  backendAssessorBatchSize: number;
  slidesFetchBatchSize: number;
  daysUntilAuthRevoke: number;
  jsonDbMasterIndexKey: string;
  jsonDbLockTimeoutMs: number;
  jsonDbLogLevel: string;
  jsonDbBackupOnInitialise: boolean;
  jsonDbRootFolderId: string;
};

const maskedBackendConfig = {
  backendAssessorBatchSize: 30,
  apiKey: '****cdef',
  hasApiKey: true,
  backendUrl: validTrimmedBackendUrl,
  revokeAuthTriggerSet: false,
  daysUntilAuthRevoke: 60,
  slidesFetchBatchSize: 20,
  jsonDbMasterIndexKey: 'master-index',
  jsonDbLockTimeoutMs: 30_000,
  jsonDbLogLevel: 'INFO',
  jsonDbBackupOnInitialise: true,
  jsonDbRootFolderId: 'folder-1234',
  loadError: 'apiKey: REDACTED',
};

const storedKeyFormValues = {
  hasApiKey: true,
  apiKey: '',
  backendUrl: validTrimmedBackendUrl,
  backendAssessorBatchSize: 30,
  slidesFetchBatchSize: 20,
  daysUntilAuthRevoke: 60,
  jsonDbMasterIndexKey: 'master-index',
  jsonDbLockTimeoutMs: 30_000,
  jsonDbLogLevel: 'INFO',
  jsonDbBackupOnInitialise: true,
  jsonDbRootFolderId: 'folder-1234',
} satisfies BackendSettingsForm;

describe('backendSettingsFormMapper', () => {
  it('maps a masked backend payload to a blank API key input', () => {
    const formValues = mapBackendConfigToBackendSettingsFormValues(
      maskedBackendConfig
    ) as unknown as BackendSettingsFormTestValues;

    expect(formValues).toMatchObject({
      hasApiKey: true,
      apiKey: '',
      backendUrl: validTrimmedBackendUrl,
      backendAssessorBatchSize: 30,
      slidesFetchBatchSize: 20,
      daysUntilAuthRevoke: 60,
      jsonDbMasterIndexKey: 'master-index',
      jsonDbLockTimeoutMs: 30_000,
      jsonDbLogLevel: 'INFO',
      jsonDbBackupOnInitialise: true,
      jsonDbRootFolderId: 'folder-1234',
    });
    expect(formValues.apiKey).toBe('');
    expect(formValues.apiKey).not.toBe(maskedBackendConfig.apiKey);
  });

  it('omits apiKey when a stored key exists and the replacement field is blank', () => {
    const writePayload = mapBackendSettingsFormValuesToBackendConfigWriteInput({
      ...storedKeyFormValues,
      apiKey: '',
    });

    expect(writePayload).not.toHaveProperty('apiKey');
    expect(writePayload).not.toHaveProperty('revokeAuthTriggerSet');
    expect(writePayload).not.toHaveProperty('hasApiKey');
    expect(writePayload).not.toHaveProperty('loadError');
  });

  it('includes apiKey when a replacement value is entered', () => {
    const writePayload = mapBackendSettingsFormValuesToBackendConfigWriteInput({
      ...storedKeyFormValues,
      apiKey: 'abt_7pC98PCoGJOcjN-qz6rNlSzKkgySJF-1',
    });

    expect(writePayload).toMatchObject({
      apiKey: 'abt_7pC98PCoGJOcjN-qz6rNlSzKkgySJF-1',
    });
    expect(writePayload).not.toHaveProperty('revokeAuthTriggerSet');
    expect(writePayload).not.toHaveProperty('hasApiKey');
    expect(writePayload).not.toHaveProperty('loadError');
  });

  // Contract: the mapper never emits auth fields. The read payload never carries them and the
  // form schema no longer declares them, so both mapped form values and the write payload stay
  // auth-free — even when a transitional read payload still carries the auth keys.
  it('maps a backend payload without auth fields into form values that carry no auth fields', () => {
    const formValues = mapBackendConfigToBackendSettingsFormValues(maskedBackendConfig);

    expect(formValues).not.toHaveProperty('authGroupEmail');
    expect(formValues).not.toHaveProperty('authMode');
  });

  it('drops auth fields from mapped form values even when the read payload still carries them', () => {
    const transitionalReadPayload = {
      ...maskedBackendConfig,
      authGroupEmail: 'teachers@school.edu',
      authMode: 'scriptProperties',
    } as BackendConfig;

    const formValues = mapBackendConfigToBackendSettingsFormValues(transitionalReadPayload);

    expect(formValues).not.toHaveProperty('authGroupEmail');
    expect(formValues).not.toHaveProperty('authMode');
  });

  it('omits auth fields from the backend write payload', () => {
    const writePayload = mapBackendSettingsFormValuesToBackendConfigWriteInput(storedKeyFormValues);

    expect(writePayload).not.toHaveProperty('authGroupEmail');
    expect(writePayload).not.toHaveProperty('authMode');
  });

  it('produces a backend write payload that parses with the strict BackendConfigWriteInputSchema', () => {
    const writePayload = mapBackendSettingsFormValuesToBackendConfigWriteInput(storedKeyFormValues);

    const parseResult = BackendConfigWriteInputSchema.safeParse(writePayload);
    expect(parseResult.success).toBe(true);
  });
});
