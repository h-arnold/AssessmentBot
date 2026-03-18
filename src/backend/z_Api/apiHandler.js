// apiHandler.js

/* global BaseSingleton, Utilities, LockService, ABLogger */

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
    if (handlerName === 'getAuthorisationStatus') {
      return getAuthorisationStatus(parameters);
    }
    if (handlerName === 'getABClassPartials') {
      return getABClassPartials(parameters);
    }
    if (handlerName === 'getGoogleClassrooms') {
      return getGoogleClassrooms(parameters);
    }
    if (handlerName === 'upsertABClass') {
      return upsertABClass(parameters);
    }
    if (handlerName === 'updateABClass') {
      return updateABClass(parameters);
    }
    if (handlerName === 'deleteABClass') {
      return deleteABClass(parameters);
    }
    if (handlerName === 'getCohorts') {
      return getCohorts(parameters);
    }
    if (handlerName === 'createCohort') {
      return createCohort(parameters);
    }
    if (handlerName === 'updateCohort') {
      return updateCohort(parameters);
    }
    if (handlerName === 'deleteCohort') {
      return deleteCohort(parameters);
    }
    if (handlerName === 'getYearGroups') {
      return getYearGroups(parameters);
    }
    if (handlerName === 'createYearGroup') {
      return createYearGroup(parameters);
    }
    if (handlerName === 'updateYearGroup') {
      return updateYearGroup(parameters);
    }
    if (handlerName === 'deleteYearGroup') {
      return deleteYearGroup(parameters);
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
