/**
 * Configuration keys and schema definitions for ConfigurationManager.
 */

// Validator functions are provided by a shared module in tests and at runtime
// through the global scope (Apps Script global-like environment). Do not
// require them here to avoid duplicate declaration errors when running in
// the GAS runtime where these are already present on the global object.
// Tests will populate these on globalThis in `tests/setupGlobals.js`.
/* global validateLogLevel, validateApiKey, toBooleanString, Validate */

const BACKEND_ASSESSOR_BATCH_MAX = 500;
const SLIDES_FETCH_BATCH_MAX = 100;
const DAYS_UNTIL_AUTH_REVOKE_MAX = 365;
const JSON_DB_LOCK_TIMEOUT_MIN_MS = 1000;
const JSON_DB_LOCK_TIMEOUT_MAX_MS = 600000;

const CONFIG_KEYS = Object.freeze({
  BACKEND_ASSESSOR_BATCH_SIZE: 'backendAssessorBatchSize',
  SLIDES_FETCH_BATCH_SIZE: 'slidesFetchBatchSize',
  API_KEY: 'apiKey',
  BACKEND_URL: 'backendUrl',
  IS_ADMIN_SHEET: 'isAdminSheet',
  REVOKE_AUTH_TRIGGER_SET: 'revokeAuthTriggerSet',
  DAYS_UNTIL_AUTH_REVOKE: 'daysUntilAuthRevoke',
  JSON_DB_MASTER_INDEX_KEY: 'jsonDbMasterIndexKey',
  JSON_DB_LOCK_TIMEOUT_MS: 'jsonDbLockTimeoutMs',
  JSON_DB_LOG_LEVEL: 'jsonDbLogLevel',
  JSON_DB_BACKUP_ON_INITIALISE: 'jsonDbBackupOnInitialise',
  JSON_DB_ROOT_FOLDER_ID: 'jsonDbRootFolderId',
});

const CONFIG_SCHEMA = Object.freeze({
  [CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE]: {
    storage: 'script',
    validate: (v) =>
      Validate.validateIntegerInRange(
        'Backend Assessor Batch Size',
        v,
        1,
        BACKEND_ASSESSOR_BATCH_MAX
      ),
  },
  [CONFIG_KEYS.SLIDES_FETCH_BATCH_SIZE]: {
    storage: 'script',
    validate: (v) =>
      Validate.validateIntegerInRange('Slides Fetch Batch Size', v, 1, SLIDES_FETCH_BATCH_MAX),
  },
  [CONFIG_KEYS.DAYS_UNTIL_AUTH_REVOKE]: {
    storage: 'script',
    validate: (v) =>
      Validate.validateIntegerInRange('Days Until Auth Revoke', v, 1, DAYS_UNTIL_AUTH_REVOKE_MAX),
  },
  [CONFIG_KEYS.API_KEY]: {
    storage: 'script',
    validate: validateApiKey,
  },
  [CONFIG_KEYS.BACKEND_URL]: {
    storage: 'script',
    validate: (v) => Validate.validateUrl('Backend Url', v),
  },
  [CONFIG_KEYS.IS_ADMIN_SHEET]: {
    storage: 'document',
    validate: (v) => Validate.validateBoolean('Is Admin Sheet', v),
    normalize: toBooleanString,
  },
  [CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET]: {
    storage: 'document',
    validate: (v) => Validate.validateBoolean('Revoke Auth Trigger Set', v),
    normalize: toBooleanString,
  },
  [CONFIG_KEYS.JSON_DB_MASTER_INDEX_KEY]: {
    storage: 'script',
    validate: (v) => Validate.validateNonEmptyString('JSON DB Master Index Key', v),
  },
  [CONFIG_KEYS.JSON_DB_LOCK_TIMEOUT_MS]: {
    storage: 'script',
    validate: (v) =>
      Validate.validateIntegerInRange(
        'JSON DB Lock Timeout (ms)',
        v,
        JSON_DB_LOCK_TIMEOUT_MIN_MS,
        JSON_DB_LOCK_TIMEOUT_MAX_MS
      ),
  },
  [CONFIG_KEYS.JSON_DB_LOG_LEVEL]: {
    storage: 'script',
    validate: (v) => validateLogLevel('JSON DB Log Level', v),
    normalize: (v) => validateLogLevel('JSON DB Log Level', v),
  },
  [CONFIG_KEYS.JSON_DB_BACKUP_ON_INITIALISE]: {
    storage: 'script',
    validate: (v) => Validate.validateBoolean('JSON DB Backup On Initialise', v),
    normalize: toBooleanString,
  },
  [CONFIG_KEYS.JSON_DB_ROOT_FOLDER_ID]: {
    storage: 'script',
    validate: (v, instance) => {
      if (v == null || String(v).trim() === '') {
        return '';
      }
      const trimmed = String(v).trim();
      if (!instance.isValidGoogleDriveFolderId(trimmed)) {
        throw new Error('JSON DB Root Folder ID must be a valid Google Drive Folder ID.');
      }
      return trimmed;
    },
  },
});

if (!globalThis.__CONFIG_MANAGER_STATICS_INITIALISED__) {
  globalThis.__CONFIG_MANAGER_STATICS_INITIALISED__ = true;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CONFIG_KEYS,
    CONFIG_SCHEMA,
  };
}
