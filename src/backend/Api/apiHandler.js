// apiHandler.js

/* global BaseSingleton, Utilities */

let apiAllowlist;

if (typeof require === 'function') {
  ({ API_ALLOWLIST: apiAllowlist } = require('./apiConstants.js'));
} else if (typeof API_ALLOWLIST !== 'undefined') {
  apiAllowlist = API_ALLOWLIST;
}

/**
 *
 */
class ApiDispatcher extends BaseSingleton {
  /**
   *
   */
  handle(request) {
    const requestId = this._resolveRequestId(request);

    if (!this._isValidRequest(request)) {
      return this._failure(requestId, 'INVALID_REQUEST', 'Invalid API request payload.', false);
    }

    const methodName = request.method.trim();
    const allowlistedHandler = apiAllowlist?.[methodName];

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
        error && error.message ? error.message : 'API dispatch failed.',
        true
      );
    }
  }

  /**
   *
   */
  _isValidRequest(request) {
    if (!request || typeof request !== 'object' || Array.isArray(request)) {
      return false;
    }

    return typeof request.method === 'string' && request.method.trim().length > 0;
  }

  /**
   *
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
   *
   */
  _invokeAllowlistedMethod(handlerName, params) {
    if (handlerName === 'getAuthorisationStatus') {
      return getAuthorisationStatus(params);
    }
    throw new Error('Allowlisted handler is not implemented.');
  }

  /**
   *
   */
  _success(requestId, data) {
    return {
      ok: true,
      requestId,
      data,
    };
  }

  /**
   *
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
 *
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
