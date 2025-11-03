/**
 * Configuration keys and schema definitions for ConfigurationManager.
 */

// Validator functions are provided by a shared module in tests and at runtime
// through the global scope (Apps Script global-like environment). Do not
// require them here to avoid duplicate declaration errors when running in
// the GAS runtime where these are already present on the global object.
// Tests will populate these on globalThis in `tests/setupGlobals.js`.
/* global validateIntegerInRange, validateNonEmptyString, validateUrl, validateBoolean, validateLogLevel, validateApiKey, toBooleanString */

const CONFIG_KEYS = Object.freeze({
  BACKEND_ASSESSOR_BATCH_SIZE: 'backendAssessorBatchSize',
  SLIDES_FETCH_BATCH_SIZE: 'slidesFetchBatchSize',
  API_KEY: 'apiKey',
  BACKEND_URL: 'backendUrl',
  ASSESSMENT_RECORD_TEMPLATE_ID: 'assessmentRecordTemplateId',
  ASSESSMENT_RECORD_DESTINATION_FOLDER: 'assessmentRecordDestinationFolder',
  ASSESSMENT_RECORD_COURSE_ID: 'assessmentRecordCourseId',
  UPDATE_DETAILS_URL: 'updateDetailsUrl',
  UPDATE_STAGE: 'updateStage',
  IS_ADMIN_SHEET: 'isAdminSheet',
  REVOKE_AUTH_TRIGGER_SET: 'revokeAuthTriggerSet',
  DAYS_UNTIL_AUTH_REVOKE: 'daysUntilAuthRevoke',
  JSON_DB_MASTER_INDEX_KEY: 'jsonDbMasterIndexKey',
  JSON_DB_AUTO_CREATE_COLLECTIONS: 'jsonDbAutoCreateCollections',
  JSON_DB_LOCK_TIMEOUT_MS: 'jsonDbLockTimeoutMs',
  JSON_DB_LOG_LEVEL: 'jsonDbLogLevel',
  JSON_DB_BACKUP_ON_INITIALISE: 'jsonDbBackupOnInitialise',
  JSON_DB_ROOT_FOLDER_ID: 'jsonDbRootFolderId',
});

const CONFIG_SCHEMA = Object.freeze({
  [CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE]: {
    storage: 'script',
    validate: (v) => validateIntegerInRange('Backend Assessor Batch Size', v, 1, 500),
  },
  [CONFIG_KEYS.SLIDES_FETCH_BATCH_SIZE]: {
    storage: 'script',
    validate: (v) => validateIntegerInRange('Slides Fetch Batch Size', v, 1, 100),
  },
  [CONFIG_KEYS.DAYS_UNTIL_AUTH_REVOKE]: {
    storage: 'script',
    validate: (v) => validateIntegerInRange('Days Until Auth Revoke', v, 1, 365),
  },
  [CONFIG_KEYS.API_KEY]: {
    storage: 'script',
    validate: validateApiKey,
  },
  [CONFIG_KEYS.BACKEND_URL]: {
    storage: 'script',
    validate: (v) => validateUrl('Backend Url', v),
  },
  [CONFIG_KEYS.UPDATE_DETAILS_URL]: {
    storage: 'script',
    validate: (v) => validateUrl('Update Details Url', v),
  },
  [CONFIG_KEYS.ASSESSMENT_RECORD_TEMPLATE_ID]: {
    storage: 'script',
    validate: (v, instance) => {
      validateNonEmptyString('Assessment Record Template Id', v);
      if (!instance.isValidGoogleSheetId(v)) {
        throw new Error('Assessment Record Template ID must be a valid Google Sheet ID.');
      }
      return v;
    },
  },
  [CONFIG_KEYS.ASSESSMENT_RECORD_COURSE_ID]: {
    storage: 'document',
    validate: (v) => {
      if (v == null || (typeof v === 'string' && v.trim() === '')) return v;
      if (typeof v !== 'string') {
        throw new Error('Assessment Record Course ID must be a string.');
      }
      return v;
    },
  },
  [CONFIG_KEYS.ASSESSMENT_RECORD_DESTINATION_FOLDER]: {
    storage: 'script',
    validate: (v, instance) => {
      validateNonEmptyString('Assessment Record Destination Folder', v);
      if (!instance.isValidGoogleDriveFolderId(v)) {
        throw new Error(
          'Assessment Record Destination Folder must be a valid Google Drive Folder ID.'
        );
      }
      return v;
    },
  },
  [CONFIG_KEYS.UPDATE_STAGE]: {
    storage: 'script',
    validate: (v) => {
      const stage = parseInt(v, 10);
      if (!Number.isInteger(stage) || stage < 0 || stage > 2) {
        throw new Error('Update Stage must be 0, 1, or 2');
      }
      return stage;
    },
  },
  [CONFIG_KEYS.IS_ADMIN_SHEET]: {
    storage: 'document',
    validate: (v) => validateBoolean('Is Admin Sheet', v),
    normalize: toBooleanString,
  },
  [CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET]: {
    storage: 'document',
    validate: (v) => validateBoolean('Revoke Auth Trigger Set', v),
    normalize: toBooleanString,
  },
  [CONFIG_KEYS.JSON_DB_MASTER_INDEX_KEY]: {
    storage: 'script',
    validate: (v) => validateNonEmptyString('JSON DB Master Index Key', v),
  },
  [CONFIG_KEYS.JSON_DB_AUTO_CREATE_COLLECTIONS]: {
    storage: 'script',
    validate: (v) => validateBoolean('JSON DB Auto Create Collections', v),
    normalize: toBooleanString,
  },
  [CONFIG_KEYS.JSON_DB_LOCK_TIMEOUT_MS]: {
    storage: 'script',
    validate: (v) => validateIntegerInRange('JSON DB Lock Timeout (ms)', v, 1000, 600000),
  },
  [CONFIG_KEYS.JSON_DB_LOG_LEVEL]: {
    storage: 'script',
    validate: (v) => validateLogLevel('JSON DB Log Level', v),
    normalize: (v) => validateLogLevel('JSON DB Log Level', v),
  },
  [CONFIG_KEYS.JSON_DB_BACKUP_ON_INITIALISE]: {
    storage: 'script',
    validate: (v) => validateBoolean('JSON DB Backup On Initialise', v),
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
