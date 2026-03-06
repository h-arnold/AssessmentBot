// apiHandler.js

/* global BaseSingleton, Utilities, LockService, ABLogger */

let apiAllowlist;
let lockTimeoutMs;
let activeLimit;
let staleRequestAgeMs;
let requestStoreFns;

if (typeof module !== 'undefined' && module.exports) {
  ({
    API_ALLOWLIST: apiAllowlist,
    LOCK_TIMEOUT_MS: lockTimeoutMs,
    ACTIVE_LIMIT: activeLimit,
    STALE_REQUEST_AGE_MS: staleRequestAgeMs,
  } = require('./apiConstants.js'));
  requestStoreFns = require('./requestStore.js');
} else {
  // In GAS, these are loaded as global constants and functions from the bundle.
  apiAllowlist = API_ALLOWLIST;
  lockTimeoutMs = LOCK_TIMEOUT_MS;
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
    const requestId = this._resolveRequestId(request);

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
    let data;
    try {
      data = this._invokeAllowlistedMethod(allowlistedHandler, request.params);
    } catch (error) {
      handlerError = error;
    }

    this._runCompletionPhase(requestId, handlerError);

    if (handlerError) {
      return this._failure(
        requestId,
        'DISPATCH_ERROR',
        handlerError?.message ?? 'API dispatch failed.',
        true
      );
    }

    return this._success(requestId, data);
  }

  /**
   * Acquires the user lock, prunes stale started entries, registers a started entry in the
   * request store, and releases the lock.
   * Returns a failure envelope if the lock cannot be acquired or the active limit is reached.
   */
  _runAdmissionPhase(requestId, method) {
    const lock = LockService.getUserLock();
    if (!lock.tryLock(lockTimeoutMs)) {
      return this._failure(
        requestId,
        'RATE_LIMITED',
        'Could not acquire lock. Please retry.',
        true
      );
    }
    try {
      const store = requestStoreFns.loadStore();

      const keysBefore = Object.keys(store);
      requestStoreFns.pruneStaleEntries(store, staleRequestAgeMs);
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
      store[requestId] = requestStoreFns.createStartedRecord(requestId, method);
      requestStoreFns.saveStore(store);
      return { ok: true };
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * Acquires the user lock, marks the request as success or error, compacts the store, and releases the lock.
   * Logs a warning if the completion lock cannot be acquired.
   */
  _runCompletionPhase(requestId, handlerError) {
    const lock = LockService.getUserLock();
    if (!lock.tryLock(lockTimeoutMs)) {
      ABLogger.getInstance().warn('Could not acquire completion lock for request.', { requestId });
      return;
    }
    try {
      const store = requestStoreFns.loadStore();
      if (handlerError) {
        requestStoreFns.markError(store, requestId, handlerError?.message ?? 'Unknown error');
      } else {
        requestStoreFns.markSuccess(store, requestId);
      }
      requestStoreFns.saveStore(requestStoreFns.compactStore(store));
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
   * Returns the request's requestId if valid, otherwise generates a new UUID.
   */
  _resolveRequestId(request) {
    if (
      request &&
      typeof request === 'object' &&
      !Array.isArray(request) &&
      typeof request.requestId === 'string' &&
      request.requestId.trim().length > 0
    ) {
      return request.requestId;
    }

    return Utilities.getUuid();
  }

  /**
   * Invokes the named allowlisted handler function with the given params.
   */
  _invokeAllowlistedMethod(handlerName, params) {
    if (handlerName === 'getAuthorisationStatus') {
      return getAuthorisationStatus(params);
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
