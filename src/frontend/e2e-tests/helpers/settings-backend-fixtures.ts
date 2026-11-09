import type {
  BackendConfig,
  BackendConfigWriteResult,
} from '@/services/backendConfiguration/backendConfiguration.zod';
import { partialLoadWarning } from './settings-backend-journey';

/** Baseline masked backend configuration served by the settings read. */
export const baseBackendConfig = {
  backendAssessorBatchSize: 30,
  apiKey: '****cdef',
  hasApiKey: true,
  backendUrl: 'https://backend.example.com',
  revokeAuthTriggerSet: false,
  daysUntilAuthRevoke: 60,
  slidesFetchBatchSize: 20,
  jsonDbMasterIndexKey: 'master-index',
  jsonDbLockTimeoutMs: 30_000,
  jsonDbLogLevel: 'INFO',
  jsonDbBackupOnInitialise: true,
  jsonDbRootFolderId: 'folder-1234',
} satisfies BackendConfig;

/** Configuration returned by the post-save refresh. */
export const refreshedBackendConfig = {
  ...baseBackendConfig,
  backendAssessorBatchSize: 48,
  jsonDbMasterIndexKey: 'refreshed-master-index',
  jsonDbRootFolderId: 'folder-5678',
} satisfies BackendConfig;

/** Configuration carrying a load warning for the incomplete-payload journey. */
export const partialLoadBackendConfig = {
  ...baseBackendConfig,
  backendUrl: '',
  loadError: partialLoadWarning,
} satisfies BackendConfig;

/** Configuration with no stored API key, used by the validation journey. */
export const noStoredKeyBackendConfig = {
  ...baseBackendConfig,
  apiKey: '',
  hasApiKey: false,
} satisfies BackendConfig;

/** Successful write result returned by the settings save. */
export const refreshedWriteResult = {
  success: true,
} satisfies BackendConfigWriteResult;
