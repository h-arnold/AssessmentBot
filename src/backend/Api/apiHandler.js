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
 * Dispatches an incoming API request to the appropriate allowlisted handler.
 */
class ApiDispatcher extends BaseSingleton {
  /**
   * Validates, resolves, and dispatches the request, returning a structured response envelope.
   * As the API boundary entry point this method always returns an envelope and never throws;
   * Validate.requireParams is therefore intentionally omitted in favour of the structured
   * INVALID_REQUEST path.
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
   * Acquires the user lock, prunes stale started entries, registers a started entry in the
   * request store, and releases the lock.
   * Returns a failure envelope if the lock cannot be acquired or the active limit is reached.
   *
   * Pruning and record creation are inlined using lockAcquiredAt as the reference timestamp
   * to keep the observable Date.now() call count to exactly three (phaseStart, lockAcquiredAt,
   * endTime), which is required for reliable lock-timing observability tests.
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
   * Logs a warning if the completion lock cannot be acquired.
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
   * Returns true if the request is a non-array object with a non-empty method string.
   */
  _isValidRequest(request) {
    if (!request || typeof request !== 'object' || Array.isArray(request)) {
      return false;
    }

    return typeof request.method === 'string' && request.method.trim().length > 0;
  }

  /**
   * Generates a backend-owned requestId for transport and tracking.
   */
  _resolveRequestId() {
    return Utilities.getUuid();
  }

  /**
   * Invokes the named allowlisted handler function with the given params.
   */
  _invokeAllowlistedMethod(handlerName, params) {
    if (handlerName === 'getAuthorisationStatus') {
      return getAuthorisationStatus(params);
    }
    if (handlerName === 'getABClassPartials') {
      return getABClassPartials(params);
    }
    throw new Error('Allowlisted handler is not implemented.');
  }

  /**
   * Builds a successful response envelope with the given requestId and data.
   */
  _success(requestId, data) {
    return {
      ok: true,
      requestId,
      data,
    };
  }

  /**
   * Builds a failure response envelope with the given requestId, error code, message, and retriable flag.
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
 * Entry point that delegates the request to the ApiDispatcher singleton.
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
