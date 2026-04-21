/* global ABLogger, ConfigurationManager, ApiValidationError */

const API_KEY_MASK_VISIBLE_SUFFIX_LENGTH = 4;
const API_KEY_MASK_PREFIX = '****';

/**
 * Masks an API key while preserving the visible suffix used by the legacy config payload.
 * @param {string} key - Raw API key value.
 * @returns {string} Masked API key.
 */
function maskApiKey_(key) {
  if (!key) {
    return '';
  }

  const asString = String(key);
  if (asString.length <= API_KEY_MASK_VISIBLE_SUFFIX_LENGTH) {
    return API_KEY_MASK_PREFIX;
  }

  return API_KEY_MASK_PREFIX + asString.slice(-API_KEY_MASK_VISIBLE_SUFFIX_LENGTH);
}

/**
 * Reads the current backend configuration using the legacy public payload shape.
 * @returns {Object} Public configuration payload.
 */
function getBackendConfig_() {
  const configManager = ConfigurationManager.getInstance();
  configManager.ensureDefaultConfiguration();

  const rawApiKey = configManager.getApiKey();
  const jsonDatabaseRootFolderId = configManager.getJsonDbRootFolderId();
  const config = {
    backendAssessorBatchSize: configManager.getBackendAssessorBatchSize(),
    apiKey: maskApiKey_(rawApiKey),
    hasApiKey: !!rawApiKey,
    backendUrl: configManager.getBackendUrl(),
    revokeAuthTriggerSet: configManager.getRevokeAuthTriggerSet(),
    daysUntilAuthRevoke: configManager.getDaysUntilAuthRevoke(),
    slidesFetchBatchSize: configManager.getSlidesFetchBatchSize(),
    jsonDbMasterIndexKey: configManager.getJsonDbMasterIndexKey(),
    jsonDbLockTimeoutMs: configManager.getJsonDbLockTimeoutMs(),
    jsonDbLogLevel: configManager.getJsonDbLogLevel(),
    jsonDbBackupOnInitialise: configManager.getJsonDbBackupOnInitialise(),
    jsonDbRootFolderId: jsonDatabaseRootFolderId || '',
  };

  return config;
}

/**
 * Applies supported backend configuration updates using ConfigurationManager setters.
 * @param {Object} config - Partial configuration payload.
 * @returns {{ success: boolean, error?: string }} Result payload.
 */
function setBackendConfig_(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new ApiValidationError('params must be an object.', {
      method: 'setBackendConfig',
      fieldName: 'params',
    });
  }

  const errors = [];
  const configManager = ConfigurationManager.getInstance();
  const updates = [
    {
      name: 'backendAssessorBatchSize',
      value: config.backendAssessorBatchSize,
      applySetting: (value) => configManager.setBackendAssessorBatchSize(value),
    },
    {
      name: 'slidesFetchBatchSize',
      value: config.slidesFetchBatchSize,
      applySetting: (value) => configManager.setSlidesFetchBatchSize(value),
    },
    {
      name: 'apiKey',
      value: config.apiKey,
      applySetting: (value) => configManager.setApiKey(value),
    },
    {
      name: 'backendUrl',
      value: config.backendUrl,
      applySetting: (value) => configManager.setBackendUrl(value),
    },
    {
      name: 'revokeAuthTriggerSet',
      value: config.revokeAuthTriggerSet,
      applySetting: (value) => configManager.setRevokeAuthTriggerSet(value),
    },
    {
      name: 'daysUntilAuthRevoke',
      value: config.daysUntilAuthRevoke,
      applySetting: (value) => configManager.setDaysUntilAuthRevoke(value),
    },
    {
      name: 'jsonDbMasterIndexKey',
      value: config.jsonDbMasterIndexKey,
      applySetting: (value) => configManager.setJsonDbMasterIndexKey(value),
    },
    {
      name: 'jsonDbLockTimeoutMs',
      value: config.jsonDbLockTimeoutMs,
      applySetting: (value) => configManager.setJsonDbLockTimeoutMs(value),
    },
    {
      name: 'jsonDbLogLevel',
      value: config.jsonDbLogLevel,
      applySetting: (value) => configManager.setJsonDbLogLevel(value),
    },
    {
      name: 'jsonDbBackupOnInitialise',
      value: config.jsonDbBackupOnInitialise,
      applySetting: (value) => configManager.setJsonDbBackupOnInitialise(value),
    },
    {
      name: 'jsonDbRootFolderId',
      value: config.jsonDbRootFolderId,
      applySetting: (value) => configManager.setJsonDbRootFolderId(value),
    },
  ];

  /**
   * Persists a single configuration update while preserving legacy error aggregation.
   * @param {Function} action - Setter callback.
   * @param {string} name - Public config field name.
   * @returns {boolean} True when the update succeeds.
   */
  function safeSet(action, name) {
    try {
      action();
      return true;
    } catch (error) {
      ABLogger.getInstance().error('Error saving configuration value.', {
        configKey: name,
        errorName: error?.name ?? 'Error',
      });
      errors.push(`${name}: REDACTED`);
      return false;
    }
  }

  for (const { name, value, applySetting } of updates) {
    if (value === undefined) {
      continue;
    }

    safeSet(() => applySetting(value), name);
  }

  if (errors.length > 0) {
    const message = `Failed to save some configuration values: ${errors.join('; ')}`;
    ABLogger.getInstance().error(message, { failedSettings: [...errors] });
    return { success: false, error: message };
  }

  ABLogger.getInstance().info('Configuration saved successfully.');
  return { success: true };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getBackendConfig_,
    setBackendConfig_,
  };
}
