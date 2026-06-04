import type {
  BackendConfig,
  BackendConfigWriteInput,
} from '../../../../services/backendConfiguration.zod';
import type { BackendSettingsForm } from '../backendSettingsForm.zod';

export const baseBackendConfig = {
  backendAssessorBatchSize: 30,
  apiKey: '****cdef',
  hasApiKey: true,
  backendUrl: 'https://backend.example.com',
  revokeAuthTriggerSet: false,
  daysUntilAuthRevoke: 60,
  slidesFetchBatchSize: 20,
  jsonDbMasterIndexKey: 'master-index',
  jsonDbLockTimeoutMs: 15_000,
  jsonDbLogLevel: 'INFO',
  jsonDbBackupOnInitialise: true,
  jsonDbRootFolderId: 'folder-1234',
} satisfies BackendConfig;

export const baseStoredKeyFormValues = {
  hasApiKey: true,
  apiKey: '',
  backendUrl: 'https://backend.example.com',
  backendAssessorBatchSize: 30,
  slidesFetchBatchSize: 20,
  daysUntilAuthRevoke: 60,
  jsonDbMasterIndexKey: 'master-index',
  jsonDbLockTimeoutMs: 15_000,
  jsonDbLogLevel: 'INFO',
  jsonDbBackupOnInitialise: true,
  jsonDbRootFolderId: 'folder-1234',
} satisfies BackendSettingsForm;

export const baseReplacementFormValues = {
  ...baseStoredKeyFormValues,
  hasApiKey: true,
  apiKey: 'replacement-key-123',
} satisfies BackendSettingsForm;

export const baseNoKeyBackendConfig = {
  ...baseBackendConfig,
  apiKey: '',
  hasApiKey: false,
} satisfies BackendConfig;

export const baseNoKeyFormValues = {
  ...baseStoredKeyFormValues,
  hasApiKey: false,
  apiKey: '',
} satisfies BackendSettingsForm;

export const baseWriteInputWithoutApiKey = {
  backendAssessorBatchSize: 30,
  backendUrl: 'https://backend.example.com',
  daysUntilAuthRevoke: 60,
  slidesFetchBatchSize: 20,
  jsonDbMasterIndexKey: 'master-index',
  jsonDbLockTimeoutMs: 15_000,
  jsonDbLogLevel: 'INFO',
  jsonDbBackupOnInitialise: true,
  jsonDbRootFolderId: 'folder-1234',
} satisfies BackendConfigWriteInput;

export const baseWriteInputWithApiKey = {
  ...baseWriteInputWithoutApiKey,
  apiKey: 'replacement-key-123',
} satisfies BackendConfigWriteInput;

export const partialLoadBackendConfig = {
  ...baseBackendConfig,
  backendUrl: '',
  loadError: 'apiKey: REDACTED',
} satisfies BackendConfig;

export const refreshedBackendConfig = {
  ...baseBackendConfig,
  backendAssessorBatchSize: 45,
  slidesFetchBatchSize: 25,
  jsonDbMasterIndexKey: 'refreshed-master-index',
  jsonDbRootFolderId: 'folder-5678',
} satisfies BackendConfig;

export const refreshedFormValues = {
  hasApiKey: true,
  apiKey: '',
  backendUrl: 'https://backend.example.com',
  backendAssessorBatchSize: 45,
  slidesFetchBatchSize: 25,
  daysUntilAuthRevoke: 60,
  jsonDbMasterIndexKey: 'refreshed-master-index',
  jsonDbLockTimeoutMs: 15_000,
  jsonDbLogLevel: 'INFO',
  jsonDbBackupOnInitialise: true,
  jsonDbRootFolderId: 'folder-5678',
} satisfies BackendSettingsForm;

export const blankApiKeyWriteInput = baseWriteInputWithoutApiKey;
export const secondCallIndex = 2;
export const backendConfigReloadCallCount = 2;

export type BackendSettingsHookValue = {
  backendSettingsFormValues: BackendSettingsForm | null;
  hasApiKey: boolean;
  isInitialLoading: boolean;
  isSaveBlocked: boolean;
  isSaving: boolean;
  isRefreshing: boolean;
  loadError: string | null;
  saveBackendSettings: (formValues: BackendSettingsForm) => Promise<void>;
  saveError: string | null;
};

export type BackendSettingsProbeHandle = {
  getCurrentState: () => BackendSettingsHookValue;
};
