/* global ABLogger, ConfigurationManager, ApiValidationError, ApiRateLimitError */

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
 * Each descriptor carries the field name ONCE; the read behaviour is derived from
 * that single `field` value so the name can never drift from the read closure.
 * @type {Array<{ field: string, read: function(Object): * }>}
 */
const BACKEND_CONFIG_WRITABLE_FIELDS = Object.freeze([
  {
    field: 'backendAssessorBatchSize',
    read(config) {
      return config[this.field];
    },
  },
  {
    field: 'slidesFetchBatchSize',
    read(config) {
      return config[this.field];
    },
  },
  {
    field: 'apiKey',
    read(config) {
      return config[this.field];
    },
  },
  {
    field: 'backendUrl',
    read(config) {
      return config[this.field];
    },
  },
  {
    field: 'revokeAuthTriggerSet',
    read(config) {
      return config[this.field];
    },
  },
  {
    field: 'daysUntilAuthRevoke',
    read(config) {
      return config[this.field];
    },
  },
  {
    field: 'jsonDbMasterIndexKey',
    read(config) {
      return config[this.field];
    },
  },
  {
    field: 'jsonDbLockTimeoutMs',
    read(config) {
      return config[this.field];
    },
  },
  {
    field: 'jsonDbLogLevel',
    read(config) {
      return config[this.field];
    },
  },
  {
    field: 'jsonDbBackupOnInitialise',
    read(config) {
      return config[this.field];
    },
  },
  {
    field: 'jsonDbRootFolderId',
    read(config) {
      return config[this.field];
    },
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
 * Stages each supplied ordinary field through the manager-owned validate/normalise
 * seam, collecting a redacted aggregate error list for any failures.
 * @param {Object} configManager - The ConfigurationManager instance.
 * @param {Object} config - Partial configuration payload.
 * @returns {{ patch: Object, errors: string[], failedErrors: Error[] }} Staged
 *   patch entries plus the redacted aggregate errors and their causes.
 */
function stageBackendConfigPatch_(configManager, config) {
  const errors = [];
  const failedErrors = [];
  const stagedEntries = [];

  for (const descriptor of BACKEND_CONFIG_WRITABLE_FIELDS) {
    const { field } = descriptor;
    const value = descriptor.read(config);
    if (value === undefined) {
      continue;
    }

    try {
      stagedEntries.push([field, configManager.preparePropertyValue(field, value)]);
    } catch (error) {
      errors.push(`${field}: ${error?.message ?? 'REDACTED'}`);
      failedErrors.push(error);
    }
  }

  return { patch: Object.fromEntries(stagedEntries), errors, failedErrors };
}

/**
 * Commits a staged ordinary-configuration patch as ONE atomic locked write.
 * @remarks Lock contention is transient and is rethrown as a retriable
 *   `ApiRateLimitError` (mapped to the RATE_LIMITED envelope by the dispatcher)
 *   rather than being flattened into the domain failure result.
 * @param {Object} configManager - The ConfigurationManager instance.
 * @param {Object} patch - Staged serialised field values keyed by field name.
 * @returns {string|null} A redacted aggregate failure message, or null on success.
 * @throws {ApiRateLimitError} On configuration-lock contention.
 */
function commitBackendConfigPatch_(configManager, patch) {
  if (Object.keys(patch).length === 0) {
    return null;
  }

  try {
    configManager.writeConfigurationLocked((current) => ({ ...current, ...patch }));
    return null;
  } catch (error) {
    if (error?.code === 'CONFIG_LOCK_CONTENTION') {
      // SPEC decision 12: configuration-lock contention is transient and must
      // surface as the retriable RATE_LIMITED envelope (ApiRateLimitError →
      // RATE_LIMITED), never as a non-retriable INTERNAL_ERROR or a domain-level
      // `{ success: false }` result. The raw lock signal is not frontend-safe.
      ABLogger.getInstance().warn('setBackendConfig: configuration lock contention during save.', {
        method: 'setBackendConfig',
        cause: error,
      });
      throw new ApiRateLimitError(
        'Configuration could not be saved because the configuration lock is busy. Please retry.',
        { method: 'setBackendConfig', cause: error }
      );
    }
    const message = `Failed to save some configuration values: ${Object.keys(patch)
      .map((name) => `${name}: ${error?.message ?? 'REDACTED'}`)
      .join('; ')}`;
    ABLogger.getInstance().error('Error saving configuration values.', {
      configKeys: Object.keys(patch),
      error,
    });
    return message;
  }
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
  const { patch, errors, failedErrors } = stageBackendConfigPatch_(configManager, config);

  if (errors.length > 0) {
    const message = `Failed to save some configuration values: ${errors.join('; ')}`;
    ABLogger.getInstance().error(message, { failedSettings: [...errors], errors: failedErrors });
    return { success: false, error: message };
  }

  const writeFailure = commitBackendConfigPatch_(configManager, patch);
  if (writeFailure) {
    return { success: false, error: writeFailure };
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
