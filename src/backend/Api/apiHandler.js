// apiHandler.js

/* global BaseSingleton, Utilities */

let apiAllowlist;

if (typeof module !== 'undefined' && module.exports) {
  ({ API_ALLOWLIST: apiAllowlist } = require('./apiConstants.js'));
} else {
  // In GAS, API_ALLOWLIST is loaded as a global constant from apiConstants.js.
  apiAllowlist = API_ALLOWLIST;
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

    try {
      const data = this._invokeAllowlistedMethod(allowlistedHandler, request.params);
      return this._success(requestId, data);
    } catch (error) {
      return this._failure(
        requestId,
        'DISPATCH_ERROR',
        error?.message ?? 'API dispatch failed.',
        true
      );
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
