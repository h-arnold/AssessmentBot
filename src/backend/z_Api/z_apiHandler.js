// z_apiHandler.js

/* global BaseSingleton, Utilities, LockService, ABLogger, ScriptAppManager, ABClassController, ReferenceDataController */

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
  IN_USE: 'IN_USE',
};

const ALLOWLISTED_METHOD_HANDLERS = Object.freeze({
  getAuthorisationStatus: () => new ScriptAppManager().isAuthorised(),
  getABClassPartials: () => new ABClassController().getAllClassPartials(),
  getAssignmentDefinitionPartials: (parameters) => getAssignmentDefinitionPartials_(parameters),
  getAssignmentDefinition: (parameters) => getAssignmentDefinition_(parameters),
  deleteAssignmentDefinition: (parameters) => deleteAssignmentDefinition_(parameters),
  upsertAssignmentDefinition: (parameters) => upsertAssignmentDefinition_(parameters),
  getGoogleClassrooms: (parameters) => getGoogleClassrooms_(parameters),
  upsertABClass: (parameters) => upsertABClass_(parameters),
  updateABClass: (parameters) => updateABClass_(parameters),
  deleteABClass: (parameters) => deleteABClass_(parameters),
  getBackendConfig: () => getBackendConfig_(),
  setBackendConfig: (parameters) => setBackendConfig_(parameters),
  getCohorts: () => new ReferenceDataController().listCohorts(),
  createCohort: (parameters) => new ReferenceDataController().createCohort(parameters.record),
  updateCohort: (parameters) => new ReferenceDataController().updateCohort(parameters),
  deleteCohort: (parameters) => new ReferenceDataController().deleteCohort(parameters.key),
  getYearGroups: () => new ReferenceDataController().listYearGroups(),
  createYearGroup: (parameters) => new ReferenceDataController().createYearGroup(parameters.record),
  updateYearGroup: (parameters) => new ReferenceDataController().updateYearGroup(parameters),
  deleteYearGroup: (parameters) => new ReferenceDataController().deleteYearGroup(parameters.key),
  getAssignmentTopics: () => new ReferenceDataController().listAssignmentTopics(),
  createAssignmentTopic: (parameters) =>
    new ReferenceDataController().createAssignmentTopic(parameters.record),
  updateAssignmentTopic: (parameters) =>
    new ReferenceDataController().updateAssignmentTopic(parameters),
  deleteAssignmentTopic: (parameters) =>
    new ReferenceDataController().deleteAssignmentTopic(parameters.key),
});

if (typeof module !== 'undefined' && module.exports) {
  const apiConfigFns = require('./apiConfig.js');
  globalThis.getBackendConfig_ = apiConfigFns.getBackendConfig_;
  globalThis.setBackendConfig_ = apiConfigFns.setBackendConfig_;
  ({
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
   * @remarks Downstream handler failures are logged once at the transport boundary with the original thrown value
   * for execution-log diagnostics, then mapped to the frontend-safe envelope contract without exposing raw
   * exception details to callers.
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
    const handler = ALLOWLISTED_METHOD_HANDLERS[methodName];

    if (!handler) {
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
      data = handler(request.params);
    } catch (error) {
      handlerFailed = true;
      handlerError = error;
    }

    if (handlerFailed) {
      ABLogger.getInstance().error(
        'API request failed.',
        {
          requestId,
          method: methodName,
        },
        handlerError
      );
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
   * Request-store helpers reuse the pre-captured lockAcquiredAt timestamp to minimise Date.now() calls,
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

      const keysBefore = Object.keys(store);
      requestStoreFns.pruneStaleEntries(store, staleRequestAgeMs, lockAcquiredAt);
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

      store[requestId] = requestStoreFns.createStartedRecord(requestId, method, lockAcquiredAt);
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
   * @param {*} [handlerError] - The value thrown by the handler, if any.
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
   * Builds a successful response envelope.
   *
   * @remarks This transport layer must not reshape handler payload contracts.
   * It wraps method data in the stable envelope only; domain-field derivation
   * (for example class label enrichment) must remain outside the backend API boundary.
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
   * @param {*} error - The runtime error value to map.
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
    if (!candidateCode && error?.reason === 'IN_USE') {
      candidateCode = API_ERROR_CODE_MAP.IN_USE;
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
    ALLOWLISTED_METHOD_HANDLERS,
  };
}
