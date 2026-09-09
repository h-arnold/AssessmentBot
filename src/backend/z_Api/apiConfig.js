/* global ABLogger, ConfigurationManager, ApiValidationError */

const API_KEY_MASK_VISIBLE_SUFFIX_LENGTH = 4;
const API_KEY_MASK_PREFIX = '****';

/**
 * Auth fields that are read and managed exclusively through the dedicated auth
 * endpoints (getApplicationAccess / getAuthenticationSettings). They must never
 * reach the ordinary backend-configuration read or write transport.
 * @type {string[]}
 */
const AUTH_MANAGED_CONFIG_FIELDS = ['authMode', 'authGroupEmail', 'authUsers', 'authRevision'];

/**
 * Ordinary (non-auth) writable backend configuration fields, in canonical order.
 * Each descriptor reads its value via a static property access so the security
 * object-injection lint rule is not needed for this transport allowlist.
 * @type {Array<{ field: string, read: function(Object): * }>}
 */
const BACKEND_CONFIG_WRITABLE_FIELDS = Object.freeze([
  {
    field: 'backendAssessorBatchSize',
    read: (config) => config.backendAssessorBatchSize,
  },
  {
    field: 'slidesFetchBatchSize',
    read: (config) => config.slidesFetchBatchSize,
  },
  {
    field: 'apiKey',
    read: (config) => config.apiKey,
  },
  {
    field: 'backendUrl',
    read: (config) => config.backendUrl,
  },
  {
    field: 'revokeAuthTriggerSet',
    read: (config) => config.revokeAuthTriggerSet,
  },
  {
    field: 'daysUntilAuthRevoke',
    read: (config) => config.daysUntilAuthRevoke,
  },
  {
    field: 'jsonDbMasterIndexKey',
    read: (config) => config.jsonDbMasterIndexKey,
  },
  {
    field: 'jsonDbLockTimeoutMs',
    read: (config) => config.jsonDbLockTimeoutMs,
  },
  {
    field: 'jsonDbLogLevel',
    read: (config) => config.jsonDbLogLevel,
  },
  {
    field: 'jsonDbBackupOnInitialise',
    read: (config) => config.jsonDbBackupOnInitialise,
  },
  {
    field: 'jsonDbRootFolderId',
    read: (config) => config.jsonDbRootFolderId,
  },
]);

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
 * Applies supported backend configuration updates as ONE atomic locked write.
 * @remarks Rejecting the auth fields (authMode, authGroupEmail, authUsers,
 * authRevision) for every caller — including admins — is deliberate transport
 * defence-in-depth: auth settings are managed only through the dedicated
 * authentication endpoints (getApplicationAccess / getAuthenticationSettings),
 * never through the ordinary backend-configuration write transport.
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

  for (const field of AUTH_MANAGED_CONFIG_FIELDS) {
    if (Object.hasOwn(config, field)) {
      // Auth state is read and managed exclusively through the dedicated auth
      // endpoints for every caller, including admins. Rejecting the auth fields
      // here is transport defence-in-depth so no authMode/authGroupEmail/
      // authUsers/authRevision can reach an ordinary config write.
      throw new ApiValidationError(
        `${field} is managed through the dedicated authentication endpoints and cannot be set through setBackendConfig.`,
        { method: 'setBackendConfig', fieldName: field }
      );
    }
  }

  const configManager = ConfigurationManager.getInstance();
  const errors = [];
  const failedErrors = [];
  const stagedEntries = [];

  for (const { field, read } of BACKEND_CONFIG_WRITABLE_FIELDS) {
    const value = read(config);
    if (value === undefined) {
      continue;
    }

    // Stage every supplied field through the manager-owned validate/normalise
    // seam; per-field failures keep the existing redacted aggregate format.
    try {
      stagedEntries.push([field, configManager.preparePropertyValue(field, value)]);
    } catch (error) {
      ABLogger.getInstance().error('Error saving configuration value.', {
        configKey: field,
        error,
      });
      errors.push(`${field}: ${error?.message ?? 'REDACTED'}`);
      failedErrors.push(error);
    }
  }

  if (errors.length > 0) {
    const message = `Failed to save some configuration values: ${errors.join('; ')}`;
    ABLogger.getInstance().error(message, { failedSettings: [...errors], errors: failedErrors });
    return { success: false, error: message };
  }

  const patch = Object.fromEntries(stagedEntries);
  if (Object.keys(patch).length > 0) {
    // One atomic locked mutation for the whole save: the locked path re-reads
    // the fresh blob under the lock and merges, so a concurrent writer's changes
    // are preserved and no per-field lock is taken.
    try {
      configManager.writeConfigurationLocked((current) => ({ ...current, ...patch }));
    } catch (error) {
      const message = `Failed to save some configuration values: ${Object.keys(patch)
        .map((name) => `${name}: ${error?.message ?? 'REDACTED'}`)
        .join('; ')}`;
      ABLogger.getInstance().error('Error saving configuration values.', {
        configKeys: Object.keys(patch),
        error,
      });
      return { success: false, error: message };
    }
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
