// apiHandler.js

/* global BaseSingleton, Utilities, LockService, ABLogger, ConfigurationManager */

let apiAllowlist;
let lockTimeoutMs;
let lockWaitWarnThresholdMs;
let activeLimit;
let staleRequestAgeMs;
let requestStoreFns;
let apiRateLimitErrorName;
let apiValidationErrorName;
let apiDisabledErrorName;

const API_ERROR_CODE_MAP = {
  RATE_LIMITED: 'RATE_LIMITED',
  INVALID_REQUEST: 'INVALID_REQUEST',
  UNKNOWN_METHOD: 'UNKNOWN_METHOD',
};

const API_KEY_MASK_VISIBLE_SUFFIX_LENGTH = 4;
const API_KEY_MASK_PREFIX = '****';
const DEFAULT_BACKEND_ASSESSOR_BATCH_SIZE = 30;
const DEFAULT_DAYS_UNTIL_AUTH_REVOKE = 60;
const DEFAULT_SLIDES_FETCH_BATCH_SIZE = 20;

/**
 * Masks an API key while preserving the visible suffix used by the legacy config payload.
 * @param {string} key - Raw API key value.
 * @returns {string} Masked API key.
 */
function maskApiKey(key) {
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
function getBackendConfig() {
  const errors = [];
  const configurationManager = ConfigurationManager.getInstance();

  /**
   * Reads a single configuration value while preserving legacy fallback behaviour.
   * @param {Function} getter - Getter callback.
   * @param {string} name - Public config field name.
   * @param {*} fallback - Fallback value used on read failure.
   * @returns {*} Retrieved value or fallback.
   */
  function safeGet(getter, name, fallback) {
    try {
      return getter();
    } catch (error) {
      ABLogger.getInstance().error('Error retrieving configuration value.', {
        configKey: name,
        errorName: error?.name ?? 'Error',
      });
      errors.push(`${name}: ${error?.message ?? 'REDACTED'}`);
      return fallback;
    }
  }

  const rawApiKey = safeGet(() => configurationManager.getApiKey(), 'apiKey', '');
  const config = {
    backendAssessorBatchSize: safeGet(
      () => configurationManager.getBackendAssessorBatchSize(),
      'backendAssessorBatchSize',
      DEFAULT_BACKEND_ASSESSOR_BATCH_SIZE
    ),
    apiKey: maskApiKey(rawApiKey),
    hasApiKey: !!rawApiKey,
    backendUrl: safeGet(() => configurationManager.getBackendUrl(), 'backendUrl', ''),
    revokeAuthTriggerSet: safeGet(
      () => configurationManager.getRevokeAuthTriggerSet(),
      'revokeAuthTriggerSet',
      false
    ),
    daysUntilAuthRevoke: safeGet(
      () => configurationManager.getDaysUntilAuthRevoke(),
      'daysUntilAuthRevoke',
      DEFAULT_DAYS_UNTIL_AUTH_REVOKE
    ),
    slidesFetchBatchSize: safeGet(
      () => configurationManager.getSlidesFetchBatchSize(),
      'slidesFetchBatchSize',
      DEFAULT_SLIDES_FETCH_BATCH_SIZE
    ),
    jsonDbMasterIndexKey: safeGet(
      () => configurationManager.getJsonDbMasterIndexKey(),
      'jsonDbMasterIndexKey',
      ConfigurationManager.DEFAULTS.JSON_DB_MASTER_INDEX_KEY
    ),
    jsonDbLockTimeoutMs: safeGet(
      () => configurationManager.getJsonDbLockTimeoutMs(),
      'jsonDbLockTimeoutMs',
      ConfigurationManager.DEFAULTS.JSON_DB_LOCK_TIMEOUT_MS
    ),
    jsonDbLogLevel: safeGet(
      () => configurationManager.getJsonDbLogLevel(),
      'jsonDbLogLevel',
      ConfigurationManager.DEFAULTS.JSON_DB_LOG_LEVEL
    ),
    jsonDbBackupOnInitialise: safeGet(
      () => configurationManager.getJsonDbBackupOnInitialise(),
      'jsonDbBackupOnInitialise',
      ConfigurationManager.DEFAULTS.JSON_DB_BACKUP_ON_INITIALISE
    ),
    jsonDbRootFolderId: safeGet(
      () => configurationManager.getJsonDbRootFolderId(),
      'jsonDbRootFolderId',
      ''
    ),
  };

  if (errors.length > 0) {
    config.loadError = errors.join('; ');
  }

  return config;
}

/**
 * Applies supported backend configuration updates using ConfigurationManager setters.
 * @param {Object} config - Partial configuration payload.
 * @returns {{ success: boolean, error?: string }} Result payload.
 */
function setBackendConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new ApiValidationError('params must be an object.', {
      method: 'setBackendConfig',
      fieldName: 'params',
    });
  }

  const errors = [];
  const configurationManager = ConfigurationManager.getInstance();
  const setters = [
    [
      'backendAssessorBatchSize',
      (value) => configurationManager.setBackendAssessorBatchSize(value),
    ],
    ['slidesFetchBatchSize', (value) => configurationManager.setSlidesFetchBatchSize(value)],
    ['apiKey', (value) => configurationManager.setApiKey(value)],
    ['backendUrl', (value) => configurationManager.setBackendUrl(value)],
    ['revokeAuthTriggerSet', (value) => configurationManager.setRevokeAuthTriggerSet(value)],
    ['daysUntilAuthRevoke', (value) => configurationManager.setDaysUntilAuthRevoke(value)],
    ['jsonDbMasterIndexKey', (value) => configurationManager.setJsonDbMasterIndexKey(value)],
    ['jsonDbLockTimeoutMs', (value) => configurationManager.setJsonDbLockTimeoutMs(value)],
    ['jsonDbLogLevel', (value) => configurationManager.setJsonDbLogLevel(value)],
    [
      'jsonDbBackupOnInitialise',
      (value) => configurationManager.setJsonDbBackupOnInitialise(value),
    ],
    ['jsonDbRootFolderId', (value) => configurationManager.setJsonDbRootFolderId(value)],
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

  for (const [name, applySetting] of setters) {
    if (config[name] === undefined) {
      continue;
    }

    safeSet(() => applySetting(config[name]), name);
  }

  if (errors.length > 0) {
    const message = `Failed to save some configuration values: ${errors.join('; ')}`;
    ABLogger.getInstance().error(message, { failedSettings: [...errors] });
    return { success: false, error: message };
  }

  ABLogger.getInstance().info('Configuration saved successfully.');
  return { success: true };
}

const ALLOWLISTED_METHOD_HANDLERS = Object.freeze({
  getAuthorisationStatus: (parameters) => getAuthorisationStatus(parameters),
  getABClassPartials: (parameters) => getABClassPartials(parameters),
  getGoogleClassrooms: (parameters) => getGoogleClassrooms(parameters),
  upsertABClass: (parameters) => upsertABClass(parameters),
  updateABClass: (parameters) => updateABClass(parameters),
  deleteABClass: (parameters) => deleteABClass(parameters),
  getBackendConfig: () => getBackendConfig(),
  setBackendConfig: (parameters) => setBackendConfig(parameters),
  getCohorts: (parameters) => getCohorts(parameters),
  createCohort: (parameters) => createCohort(parameters),
  updateCohort: (parameters) => updateCohort(parameters),
  deleteCohort: (parameters) => deleteCohort(parameters),
  getYearGroups: (parameters) => getYearGroups(parameters),
  createYearGroup: (parameters) => createYearGroup(parameters),
  updateYearGroup: (parameters) => updateYearGroup(parameters),
  deleteYearGroup: (parameters) => deleteYearGroup(parameters),
});

if (typeof module !== 'undefined' && module.exports) {
  ({
    API_ALLOWLIST: apiAllowlist,
    LOCK_TIMEOUT_MS: lockTimeoutMs,
    LOCK_WAIT_WARN_THRESHOLD_MS: lockWaitWarnThresholdMs,
    ACTIVE_LIMIT: activeLimit,
    STALE_REQUEST_AGE_MS: staleRequestAgeMs,
  } = require('./apiConstants.js'));
  requestStoreFns = require('./requestStore.js');
  apiRateLimitErrorName = require('../Utils/ErrorTypes/ApiRateLimitError.js').name;
  apiValidationErrorName = require('../Utils/ErrorTypes/ApiValidationError.js').name;
  apiDisabledErrorName = require('../Utils/ErrorTypes/ApiDisabledError.js').name;
} else {
  // In GAS, these are loaded as global constants and functions from the bundle.
  apiAllowlist = API_ALLOWLIST;
  lockTimeoutMs = LOCK_TIMEOUT_MS;
  lockWaitWarnThresholdMs = LOCK_WAIT_WARN_THRESHOLD_MS;
  activeLimit = ACTIVE_LIMIT;
  staleRequestAgeMs = STALE_REQUEST_AGE_MS;
  requestStoreFns = {
    loadStore,
    saveStore,
    createStartedRecord,
    markSuccess,
    markError,
    compactStore,
    pruneStaleEntries,
  };
  apiRateLimitErrorName = ApiRateLimitError.name;
  apiValidationErrorName = ApiValidationError.name;
  apiDisabledErrorName = ApiDisabledError.name;
}

/**
 * Dispatches incoming API requests to allowlisted handlers.
 * Manages request lifecycle phases (admission, handler invocation, completion) with rate limiting and state tracking.
 */
class ApiDispatcher extends BaseSingleton {
  /**
   * Validates, resolves, and dispatches the request, returning a structured response envelope.
   * As the API boundary entry point, this method always returns an envelope and never throws.
   * Always wraps errors in a structured response.
   *
   * @param {Object} request - Request object with method and optional params.
   * @param {string} request.method - The API method name to dispatch.
   * @param {*} [request.params] - Optional parameters for the handler.
   * @returns {Object} Response envelope with ok, requestId, and data or error fields.
   */
  handle(request) {
    const requestId = this._resolveRequestId();

    if (!this._isValidRequest(request)) {
      return this._failure(requestId, 'INVALID_REQUEST', 'Invalid API request payload.', false);
    }

    const methodName = request.method.trim();
    const allowlistedHandler = apiAllowlist[methodName];

    if (!allowlistedHandler) {
      return this._failure(requestId, 'UNKNOWN_METHOD', 'Unknown API method.', false);
    }

    const admissionResult = this._runAdmissionPhase(requestId, methodName);
    if (!admissionResult.ok) {
      return admissionResult;
    }

    let handlerError;
    let handlerFailed = false;
    let data;
    try {
      data = this._invokeAllowlistedMethod(allowlistedHandler, request.params);
    } catch (error) {
      handlerFailed = true;
      handlerError = error;
    }

    this._runCompletionPhase(requestId, methodName, handlerFailed, handlerError);

    if (handlerFailed) {
      return this._mapErrorToFailureEnvelope(requestId, handlerError);
    }

    return this._success(requestId, data);
  }

  /**
   * Acquires the user lock, prunes stale started entries, registers a started entry in the request store,
   * and releases the lock. Returns a failure envelope if the lock cannot be acquired or active limit is reached.
   * Inline pruning and record creation use lockAcquiredAt as the timestamp reference to minimise Date.now() calls,
   * which is required for reliable lock-timing observability tests.
   *
   * @param {string} requestId - Unique identifier for this request.
   * @param {string} method - The API method name.
   * @returns {Object} Success envelope { ok: true } or failure envelope on admission error.
   * @private
   */
  _runAdmissionPhase(requestId, method) {
    const phaseStart = Date.now();
    const lock = LockService.getUserLock();
    if (!lock.tryLock(lockTimeoutMs)) {
      return this._failure(
        requestId,
        'RATE_LIMITED',
        'Could not acquire lock. Please retry.',
        true
      );
    }
    const lockAcquiredAt = Date.now();
    const lockWaitMs = lockAcquiredAt - phaseStart;
    if (lockWaitMs > lockWaitWarnThresholdMs) {
      ABLogger.getInstance().warn('Lock wait exceeded threshold during admission.', {
        phase: 'admission',
        requestId,
        method,
        lockWaitMs,
      });
    }
    try {
      const store = requestStoreFns.loadStore();

      // Inline pruning using lockAcquiredAt as the reference to avoid an extra Date.now() call.
      const cutoffMs = lockAcquiredAt - staleRequestAgeMs;
      const keysBefore = Object.keys(store);
      for (const [id, entry] of Object.entries(store)) {
        if (entry.status === 'started' && entry.startedAtMs < cutoffMs) {
          delete store[id];
        }
      }
      const keysAfterSet = new Set(Object.keys(store));
      for (const candidateId of keysBefore) {
        if (!keysAfterSet.has(candidateId)) {
          ABLogger.getInstance().warn('Pruned stale request entry during admission.', {
            requestId,
            prunedId: candidateId,
          });
        }
      }

      // Persist pruned state immediately so stale entries don't accumulate on rate-limited paths.
      requestStoreFns.saveStore(store);

      const activeCount = Object.values(store).filter((r) => r.status === 'started').length;
      if (activeCount >= activeLimit) {
        return this._failure(
          requestId,
          'RATE_LIMITED',
          'Active request limit reached. Please retry.',
          true
        );
      }

      // Inline record creation using lockAcquiredAt as startedAtMs to avoid an extra Date.now() call.
      store[requestId] = { requestId, method, status: 'started', startedAtMs: lockAcquiredAt };
      requestStoreFns.saveStore(store);
      const endTime = Date.now();
      const stateUpdateMs = endTime - lockAcquiredAt;
      const totalPhaseMs = endTime - phaseStart;
      ABLogger.getInstance().info('Admission phase complete.', {
        phase: 'admission',
        requestId,
        method,
        lockWaitMs,
        stateUpdateMs,
        totalPhaseMs,
      });
      return { ok: true };
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * Acquires the user lock, marks the request as success or error, compacts the store, and releases the lock.
   * Logs a warning if the completion lock cannot be acquired but does not fail the overall request.
   *
   * @param {string} requestId - Unique identifier for this request.
   * @param {string} method - The API method name.
   * @param {boolean} handlerFailed - Whether the handler threw an error.
   * @param {Error} [handlerError] - The error thrown by the handler, if any.
   * @private
   */
  _runCompletionPhase(requestId, method, handlerFailed, handlerError) {
    const phaseStart = Date.now();
    const lock = LockService.getUserLock();
    if (!lock.tryLock(lockTimeoutMs)) {
      ABLogger.getInstance().warn('Could not acquire completion lock for request.', { requestId });
      return;
    }
    const lockAcquiredAt = Date.now();
    const lockWaitMs = lockAcquiredAt - phaseStart;
    if (lockWaitMs > lockWaitWarnThresholdMs) {
      ABLogger.getInstance().warn('Lock wait exceeded threshold during completion.', {
        phase: 'completion',
        requestId,
        method,
        lockWaitMs,
      });
    }
    try {
      const store = requestStoreFns.loadStore();
      if (handlerFailed) {
        requestStoreFns.markError(store, requestId, String(handlerError));
      } else {
        requestStoreFns.markSuccess(store, requestId);
      }
      requestStoreFns.saveStore(requestStoreFns.compactStore(store));
      const endTime = Date.now();
      const stateUpdateMs = endTime - lockAcquiredAt;
      const totalPhaseMs = endTime - phaseStart;
      ABLogger.getInstance().info('Completion phase complete.', {
        phase: 'completion',
        requestId,
        method,
        lockWaitMs,
        stateUpdateMs,
        totalPhaseMs,
      });
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * Determines whether the request object is valid.
   * A valid request is a non-array object with a non-empty method string.
   *
   * @param {*} request - The request object to validate.
   * @returns {boolean} True if the request is valid.
   * @private
   */
  _isValidRequest(request) {
    if (!request || typeof request !== 'object' || Array.isArray(request)) {
      return false;
    }

    return typeof request.method === 'string' && request.method.trim().length > 0;
  }

  /**
   * Generates a backend-owned request ID for transport and tracking purposes.
   *
   * @returns {string} A unique request ID.
   * @private
   */
  _resolveRequestId() {
    return Utilities.getUuid();
  }

  /**
   * Invokes the named allowlisted handler function with the given parameters.
   * Dispatches to the appropriate handler based on the method name.
   *
   * @param {string} handlerName - The allowlisted method name.
   * @param {*} parameters - Optional request parameters.
   * @returns {*} The handler response data.
   * @throws {Error} Re-throws any error from the handler or if handler name is unknown.
   * @private
   */
  _invokeAllowlistedMethod(handlerName, parameters) {
    const handler = ALLOWLISTED_METHOD_HANDLERS[handlerName];

    if (handler) {
      return handler(parameters);
    }

    throw new Error('Allowlisted handler is not implemented.');
  }

  /**
   * Builds a successful response envelope.
   *
   * @param {string} requestId - Unique request identifier.
   * @param {*} data - Response data from the handler.
   * @returns {Object} Response envelope with ok=true, requestId, and data.
   * @private
   */
  _success(requestId, data) {
    return {
      ok: true,
      requestId,
      data,
    };
  }

  /**
   * Builds a failure response envelope.
   *
   * @param {string} requestId - Unique request identifier.
   * @param {string} code - Error code (e.g. RATE_LIMITED, INVALID_REQUEST).
   * @param {string} message - Human-readable error message.
   * @param {boolean} retriable - Whether the operation can be safely retried.
   * @returns {Object} Response envelope with ok=false, error details.
   * @private
   */
  _failure(requestId, code, message, retriable) {
    return {
      ok: false,
      requestId,
      error: {
        code,
        message,
        retriable,
      },
    };
  }

  /**
   * Maps runtime errors to API failure envelopes.
   * Recognises specific error types (ApiRateLimitError, ApiValidationError, ApiDisabledError)
   * and maps them to appropriate error codes. Falls back to INTERNAL_ERROR for unknown error types.
   *
   * @param {string} requestId - Unique request identifier.
   * @param {Error} error - The runtime error to map.
   * @returns {Object} Failure response envelope.
   * @private
   */
  _mapErrorToFailureEnvelope(requestId, error) {
    const errorName = error?.name;
    let candidateCode;
    switch (errorName) {
      case apiRateLimitErrorName: {
        candidateCode = API_ERROR_CODE_MAP.RATE_LIMITED;
        break;
      }
      case apiValidationErrorName: {
        candidateCode = API_ERROR_CODE_MAP.INVALID_REQUEST;
        break;
      }
      case apiDisabledErrorName: {
        candidateCode = API_ERROR_CODE_MAP.UNKNOWN_METHOD;
        break;
      }
      default: {
        break;
      }
    }
    const hasMessage = typeof error?.message === 'string' && error.message.trim().length > 0;
    const mappedCode = candidateCode && hasMessage ? candidateCode : 'INTERNAL_ERROR';
    const mappedMessage = mappedCode === 'INTERNAL_ERROR' ? 'Internal API error.' : error.message;
    const retriable = mappedCode === 'RATE_LIMITED';

    return this._failure(requestId, mappedCode, mappedMessage, retriable);
  }
}

/**
 * Entry point for the API handler.
 * Delegates the request to the ApiDispatcher singleton, which manages all request lifecycle and validation.
 *
 * @param {Object} request - Request object with method and optional params.
 * @param {string} request.method - The API method name to dispatch.
 * @param {*} [request.params] - Optional parameters for the handler.
 * @returns {Object} Response envelope (ok, requestId, data or error).
 */
function apiHandler(request) {
  return ApiDispatcher.getInstance().handle(request);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    apiHandler,
    ApiDispatcher,
  };
}
