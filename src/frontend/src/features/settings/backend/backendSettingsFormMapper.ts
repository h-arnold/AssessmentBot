import type {
  BackendConfig,
  BackendConfigWriteInput,
} from '../../../services/backendConfiguration/backendConfiguration.zod';
import type { BackendSettingsForm } from './backendSettingsForm.zod';

/**
 * Read payload consumed by the backend-settings form mapper.
 *
 * @remarks
 * The `BackendConfig` transport read no longer carries `authGroupEmail`/`authMode`
 * (auth fields leave the backend-config transport in lockstep with the dedicated
 * auth endpoints). The settings form still exposes those fields until the
 * Authentication tab lands, so the mapper retains them as optional legacy inputs
 * and falls back to the existing defaults (`''` group, `'googleGroups'` mode)
 * when they are absent. This transitional tolerance is removed when the form
 * fields themselves are dropped.
 */
type BackendSettingsReadSource = BackendConfig & {
  authGroupEmail?: BackendSettingsForm['authGroupEmail'];
  authMode?: BackendSettingsForm['authMode'];
};

/**
 * Maps the backend configuration payload into form values.
 *
 * @remarks
 * The backend returns a masked `apiKey` value for stored secrets, but the form must never echo
 * that masked transport value back into the password input. The field stays blank and the
 * `hasApiKey` flag carries the stored-key state instead.
 *
 * @param {BackendSettingsReadSource} backendConfig The backend configuration payload.
 * @returns {BackendSettingsForm} The backend settings form values.
 */
export function mapBackendConfigToBackendSettingsFormValues(
  backendConfig: BackendSettingsReadSource
): BackendSettingsForm {
  return {
    hasApiKey: backendConfig.hasApiKey,
    apiKey: '',
    backendUrl: backendConfig.backendUrl,
    backendAssessorBatchSize: backendConfig.backendAssessorBatchSize,
    slidesFetchBatchSize: backendConfig.slidesFetchBatchSize,
    daysUntilAuthRevoke: backendConfig.daysUntilAuthRevoke,
    jsonDbMasterIndexKey: backendConfig.jsonDbMasterIndexKey,
    jsonDbLockTimeoutMs: backendConfig.jsonDbLockTimeoutMs,
    jsonDbLogLevel:
      backendConfig.jsonDbLogLevel.toUpperCase() as BackendSettingsForm['jsonDbLogLevel'],
    jsonDbBackupOnInitialise: backendConfig.jsonDbBackupOnInitialise,
    jsonDbRootFolderId: backendConfig.jsonDbRootFolderId,
    authGroupEmail: backendConfig.authGroupEmail ?? '',
    authMode: backendConfig.authMode ?? 'googleGroups',
  };
}

/**
 * Maps backend settings form values into the backend write payload.
 *
 * @remarks
 * A blank `apiKey` means the stored key should be retained when `hasApiKey` is true, so the write
 * payload omits `apiKey` in that case instead of echoing the masked read value or sending an empty
 * string. The frontend also excludes the read-only `revokeAuthTriggerSet`, `hasApiKey`, and
 * `loadError` transport fields from writes because only editable settings belong in the save
 * payload.
 *
 * `authGroupEmail` and `authMode` are never written through `setBackendConfig`: the backend
 * rejects every auth field on that endpoint, and the strict `BackendConfigWriteInputSchema`
 * drops them, so including them would fail every save. The form still exposes those fields until
 * the Authentication tab lands, but they are read-only legacy values there — auth state is owned
 * by the dedicated authentication endpoints.
 *
 * @param {BackendSettingsForm} formValues The backend settings form values.
 * @returns {BackendConfigWriteInput} The backend configuration write payload.
 */
export function mapBackendSettingsFormValuesToBackendConfigWriteInput(
  formValues: BackendSettingsForm
): BackendConfigWriteInput {
  const writeInput = {
    backendAssessorBatchSize: formValues.backendAssessorBatchSize,
    backendUrl: formValues.backendUrl,
    daysUntilAuthRevoke: formValues.daysUntilAuthRevoke,
    slidesFetchBatchSize: formValues.slidesFetchBatchSize,
    jsonDbMasterIndexKey: formValues.jsonDbMasterIndexKey,
    jsonDbLockTimeoutMs: formValues.jsonDbLockTimeoutMs,
    jsonDbLogLevel: formValues.jsonDbLogLevel as BackendConfigWriteInput['jsonDbLogLevel'],
    jsonDbBackupOnInitialise: formValues.jsonDbBackupOnInitialise,
    jsonDbRootFolderId: formValues.jsonDbRootFolderId,
  } as BackendConfigWriteInput;

  if (formValues.apiKey !== '') {
    writeInput.apiKey = formValues.apiKey;
  }

  return writeInput;
}
