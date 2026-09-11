// z_apiHandler.js

/* global BaseSingleton, Utilities, LockService, ABLogger, ScriptAppManager, ABClassController, ReferenceDataController, AuthService */

let lockTimeoutMs;
let lockWaitWarnThresholdMs;
let activeLimit;
let staleRequestAgeMs;
let requestStoreFns;
let apiRateLimitErrorName,
  apiValidationErrorName,
  apiDisabledErrorName,
  apiDefinitionStaleErrorName;

const API_ERROR_CODE_MAP = {
  RATE_LIMITED: 'RATE_LIMITED',
  INVALID_REQUEST: 'INVALID_REQUEST',
  UNKNOWN_METHOD: 'UNKNOWN_METHOD',
  IN_USE: 'IN_USE',
  DEFINITION_STALE: 'DEFINITION_STALE',
  FORBIDDEN: 'FORBIDDEN', // authenticated but denied access (non-member or non-admin)
};

// Gate-exempt methods skip the auth gate and run their own handlers (OAuth status precedent).
const GATE_EXEMPT_METHOD_NAMES = Object.freeze(['getAuthorisationStatus', 'getApplicationAccess']);

// Admin-only methods resolve access FRESH (provider cache bypassed); non-admin roles get FORBIDDEN.
const ADMIN_REQUIRED_METHOD_NAMES = Object.freeze([
  'getAuthenticationSettings',
  'setAuthenticationSettings',
]);

const PII_LOG_METHODS = Object.freeze(['setAuthenticationSettings']);
const ALLOWLISTED_METHOD_HANDLERS = Object.freeze({
  getAuthorisationStatus: () => new ScriptAppManager().isAuthorised(),
  getApplicationAccess: () => getApplicationAccess_(),
  getAuthenticationSettings: () => getAuthenticationSettings_(),
  setAuthenticationSettings: (parameters) => setAuthenticationSettings_(parameters),
  getABClassPartials: () => new ABClassController().getAllClassPartials(),
  getAssignmentDefinitionPartials: (parameters) => getAssignmentDefinitionPartials_(parameters),
  getAssignmentDefinition: (parameters) => getAssignmentDefinition_(parameters),
  deleteAssignmentDefinition: (parameters) => deleteAssignmentDefinition_(parameters),
  upsertAssignmentDefinition: (parameters) => upsertAssignmentDefinition_(parameters),
  getAssignment: (parameters) => getAssignment_(parameters),
  getGoogleClassroomAssignments: (parameters) => getGoogleClassroomAssignments_(parameters),
  getGoogleClassrooms: (parameters) => getGoogleClassrooms_(parameters),
  upsertABClass: (parameters) => upsertABClass_(parameters),
  updateABClass: (parameters) => updateABClass_(parameters),
  deleteABClass: (parameters) => deleteABClass_(parameters),
  getABClass: (parameters) => getABClass_(parameters),
  getBackendConfig: () => getBackendConfig_(),
  setBackendConfig: (parameters) => setBackendConfig_(parameters),
  startAssessmentRun: (parameters) => startAssessmentRun_(parameters),
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
  apiDefinitionStaleErrorName = require('../Utils/ErrorTypes/DefinitionStaleError.js').name;
  globalThis.startAssessmentRun_ = require('./assignmentAssessment.js').startAssessmentRun_;
  globalThis.getAssignment_ = require('./assignmentAssessment.js').getAssignment_;
  const apiAuthFns = require('./apiAuth.js');
  globalThis.getApplicationAccess_ = apiAuthFns.getApplicationAccess_;
  globalThis.getAuthenticationSettings_ = apiAuthFns.getAuthenticationSettings_;
  globalThis.setAuthenticationSettings_ = apiAuthFns.setAuthenticationSettings_;
  // Wire only if not already set (allows test harness to install mocks before this module loads).
  if (globalThis.upsertABClass_ === undefined) {
    const abclassMutationsFns = require('./abclass/abclassMutations.js');
    globalThis.upsertABClass_ = abclassMutationsFns.upsertABClass_;
    globalThis.updateABClass_ = abclassMutationsFns.updateABClass_;
    globalThis.deleteABClass_ = abclassMutationsFns.deleteABClass_;
  }
  if (globalThis.getABClass_ === undefined) {
    const abclassReadFns = require('./abclass/abclassRead.js');
    globalThis.getABClass_ = abclassReadFns.getABClass_;
  }
} else {
  // In GAS, these are loaded as global constants and functions from the bundle.
  lockTimeoutMs = LOCK_TIMEOUT_MS;
  lockWaitWarnThresholdMs = LOCK_WAIT_WARN_THRESHOLD_MS;
  activeLimit = ACTIVE_LIMIT;
  staleRequestAgeMs = STALE_REQUEST_AGE_MS;
  requestStoreFns = {
    loadStore_,
    saveStore_,
    createStartedRecord_,
    markSuccess_,
    markError_,
    compactStore_,
    pruneStaleEntries_,
  };
  apiRateLimitErrorName = ApiRateLimitError.name;
  apiValidationErrorName = ApiValidationError.name;
  apiDisabledErrorName = ApiDisabledError.name;
  apiDefinitionStaleErrorName = DefinitionStaleError.name;
}

/** Dispatches allowlisted API requests with rate limiting and lifecycle state tracking. */
class ApiDispatcher extends BaseSingleton {
  /**
   * Validates, resolves, and dispatches a request, returning a structured envelope; never throws.
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

    // Every log, the allowlist lookup, and the auth audit trail use this canonical (trimmed) method name.
    const methodName = request.method.trim();

    ABLogger.getInstance().debug('API request received.', {
      requestId,
      method: methodName,
      ...(PII_LOG_METHODS.includes(methodName) ? {} : { params: JSON.stringify(request.params) }),
    });

    // Auth gate: runs before the allowlist lookup so non-members get FORBIDDEN uniformly and
    // cannot probe the method surface; gate-exempt methods skip the group check and run handlers.
    if (!GATE_EXEMPT_METHOD_NAMES.includes(methodName)) {
      // Admin-required methods resolve access FRESH (provider cache bypassed); the fresh role gates below.
      const isAdminRequired = ADMIN_REQUIRED_METHOD_NAMES.includes(methodName);
      let access;
      try {
        access = AuthService.getInstance().checkAccess({
          method: methodName,
          bypassCache: isAdminRequired,
        });
      } catch (error) {
        // A thrown auth check is a transport-boundary failure, not a denial: map it to INTERNAL_ERROR.
        ABLogger.getInstance().error(
          'Auth check failed.',
          { requestId, method: methodName },
          error
        );
        return this._mapErrorToFailureEnvelope(requestId, error);
      }
      if (!access.allowed || (isAdminRequired && access.role !== 'admin')) {
        return this._failure(requestId, API_ERROR_CODE_MAP.FORBIDDEN, 'Access denied.', false);
      }
    }

    const handler = ALLOWLISTED_METHOD_HANDLERS[methodName];

    if (!handler) {
      return this._failure(requestId, 'UNKNOWN_METHOD', 'Unknown API method.', false);
    }

    const admissionResult = this._runAdmissionPhase(requestId, methodName);
    if (!admissionResult.ok) {
      const response = admissionResult;
      this._logResponseSent(requestId, methodName, response);
      return response;
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
        { requestId, method: methodName },
        handlerError
      );
    }

    this._runCompletionPhase(requestId, methodName, handlerFailed, handlerError);

    if (handlerFailed) {
      const response = this._mapErrorToFailureEnvelope(requestId, handlerError);
      this._logResponseSent(requestId, methodName, response);
      return response;
    }

    const response = this._success(requestId, data);
    this._logResponseSent(requestId, methodName, response);
    return response;
  }

  /**
   * Logs the transport response envelope at debug level with request correlation.
   * @param {string} requestId - Unique identifier for this request.
   * @param {string} method - The canonical allowlisted method name.
   * @param {Object} response - The response envelope to log.
   */
  _logResponseSent(requestId, method, response) {
    ABLogger.getInstance().debug('API response sent.', {
      requestId,
      method,
      ...(PII_LOG_METHODS.includes(method) ? {} : { response: JSON.stringify(response) }),
    });
  }

  /**
   * Acquires the lock, prunes stale entries, registers the started entry, then releases it.
   * @param {string} requestId - Unique identifier for this request.
   * @param {string} method - The API method name.
   * @returns {Object} Success envelope { ok: true } or failure envelope on admission error.
   */
  _runAdmissionPhase(requestId, method) {
    const acquired = this._acquireLock(requestId, method, 'admission');
    if (!acquired.lock) {
      return this._failure(
        requestId,
        'RATE_LIMITED',
        'Could not acquire lock. Please retry.',
        true
      );
    }
    const { lock, phaseStart, lockAcquiredAt, lockWaitMs } = acquired;
    try {
      const store = requestStoreFns.loadStore_();

      const { prunedIds } = requestStoreFns.pruneStaleEntries_(
        store,
        staleRequestAgeMs,
        lockAcquiredAt
      );
      for (const prunedId of prunedIds) {
        ABLogger.getInstance().warn('Pruned stale request entry during admission.', {
          requestId,
          prunedId,
        });
      }

      // Persist pruned state immediately so stale entries don't accumulate on rate-limited paths.
      requestStoreFns.saveStore_(store);

      const activeCount = Object.values(store).filter((r) => r.status === 'started').length;
      if (activeCount >= activeLimit) {
        return this._failure(
          requestId,
          'RATE_LIMITED',
          'Active request limit reached. Please retry.',
          true
        );
      }

      store[requestId] = requestStoreFns.createStartedRecord_(requestId, method, lockAcquiredAt);
      requestStoreFns.saveStore_(store);
      this._logPhaseComplete(
        'admission',
        requestId,
        method,
        phaseStart,
        lockAcquiredAt,
        lockWaitMs
      );
      return { ok: true };
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * Acquires the lock, marks the request success/error, compacts the store, and releases it.
   * @param {string} requestId - Unique identifier for this request.
   * @param {string} method - The API method name.
   * @param {boolean} handlerFailed - Whether the handler threw an error.
   * @param {*} [handlerError] - The value thrown by the handler, if any.
   */
  _runCompletionPhase(requestId, method, handlerFailed, handlerError) {
    const acquired = this._acquireLock(requestId, method, 'completion');
    if (!acquired.lock) {
      ABLogger.getInstance().warn('Could not acquire completion lock for request.', { requestId });
      return;
    }
    const { lock, phaseStart, lockAcquiredAt, lockWaitMs } = acquired;
    try {
      const store = requestStoreFns.loadStore_();
      if (handlerFailed) {
        requestStoreFns.markError_(store, requestId, String(handlerError));
      } else {
        requestStoreFns.markSuccess_(store, requestId);
      }
      requestStoreFns.saveStore_(requestStoreFns.compactStore_(store));
      this._logPhaseComplete(
        'completion',
        requestId,
        method,
        phaseStart,
        lockAcquiredAt,
        lockWaitMs
      );
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * Acquires the user lock, warning when the wait exceeds the threshold.
   * @param {string} requestId - Unique identifier for this request.
   * @param {string} method - The API method name.
   * @param {string} phase - The lifecycle phase ('admission' or 'completion').
   * @returns {{ lock: Object|null, phaseStart?: number, lockAcquiredAt?: number, lockWaitMs?: number }}
   *   `lock: null` when the lock could not be acquired.
   */
  _acquireLock(requestId, method, phase) {
    const phaseStart = Date.now();
    const lock = LockService.getUserLock();
    if (!lock.tryLock(lockTimeoutMs)) {
      return { lock: null };
    }
    const lockAcquiredAt = Date.now();
    const lockWaitMs = lockAcquiredAt - phaseStart;
    if (lockWaitMs > lockWaitWarnThresholdMs) {
      ABLogger.getInstance().warn(`Lock wait exceeded threshold during ${phase}.`, {
        phase,
        requestId,
        method,
        lockWaitMs,
      });
    }
    return { lock, phaseStart, lockAcquiredAt, lockWaitMs };
  }

  /**
   * Logs an admission/completion lifecycle phase with timing metadata.
   * @param {string} phase - Lifecycle phase ('admission' or 'completion').
   * @param {string} requestId - Unique identifier for this request.
   * @param {string} method - The API method name.
   * @param {number} phaseStart - Timestamp when the phase started.
   * @param {number} lockAcquiredAt - Timestamp when the lock was acquired.
   * @param {number} lockWaitMs - Lock wait duration.
   */
  _logPhaseComplete(phase, requestId, method, phaseStart, lockAcquiredAt, lockWaitMs) {
    const endTime = Date.now();
    const stateUpdateMs = endTime - lockAcquiredAt;
    const totalPhaseMs = endTime - phaseStart;
    ABLogger.getInstance().info(
      `${phase === 'admission' ? 'Admission' : 'Completion'} phase complete.`,
      {
        phase,
        requestId,
        method,
        lockWaitMs,
        stateUpdateMs,
        totalPhaseMs,
      }
    );
  }

  /**
   * Determines whether the request object is valid (a non-array object with a non-empty method string).
   * @param {*} request - The request object to validate.
   * @returns {boolean} True if the request is valid.
   */
  _isValidRequest(request) {
    if (!request || typeof request !== 'object' || Array.isArray(request)) {
      return false;
    }

    return typeof request.method === 'string' && request.method.trim().length > 0;
  }

  /**
   * Generates a backend-owned request ID for transport and tracking purposes.
   * @returns {string} A unique request ID.
   */
  _resolveRequestId() {
    return Utilities.getUuid();
  }

  /**
   * Builds a successful response envelope without reshaping the handler payload contract.
   * @param {string} requestId - Unique request identifier.
   * @param {*} data - Response data from the handler.
   * @returns {Object} Response envelope with ok=true, requestId, and data.
   */
  _success(requestId, data) {
    // Defensive check: log and coerce undefined to null (frontend Zod rejects undefined envelope data).
    if (data === undefined) {
      ABLogger.getInstance().warn('Success response with undefined data', { requestId });
    }
    return {
      ok: true,
      requestId,
      data: data ?? null,
    };
  }

  /**
   * Builds a failure response envelope.
   * @param {string} requestId - Unique request identifier.
   * @param {string} code - Error code (e.g. RATE_LIMITED, INVALID_REQUEST, DEFINITION_STALE).
   * @param {string} message - Human-readable error message.
   * @param {boolean} retriable - Whether the operation can be safely retried.
   * @param {Object} [details] - Optional structured metadata to include in the error block.
   * @returns {Object} Response envelope with ok=false and error details.
   */
  _failure(requestId, code, message, retriable, details) {
    const error = { code, message, retriable };
    if (details !== undefined && details !== null) {
      error.details = details;
    }
    return {
      ok: false,
      requestId,
      error,
    };
  }

  /**
   * Maps known runtime errors to failure envelopes, else INTERNAL_ERROR; a DefinitionStaleError
   * maps to DEFINITION_STALE and adds the structured details block.
   * @param {string} requestId - Unique request identifier.
   * @param {*} error - The runtime error value to map.
   * @returns {Object} Failure response envelope.
   */
  _mapErrorToFailureEnvelope(requestId, error) {
    const errorName = error?.name;
    const codeByErrorName = {
      [apiRateLimitErrorName]: API_ERROR_CODE_MAP.RATE_LIMITED,
      [apiValidationErrorName]: API_ERROR_CODE_MAP.INVALID_REQUEST,
      [apiDisabledErrorName]: API_ERROR_CODE_MAP.UNKNOWN_METHOD,
      [apiDefinitionStaleErrorName]: API_ERROR_CODE_MAP.DEFINITION_STALE,
    };
    let candidateCode =
      errorName === apiValidationErrorName && error.code ? error.code : codeByErrorName[errorName];
    const isDefinitionStale = errorName === apiDefinitionStaleErrorName;
    if (!candidateCode && error?.reason === 'IN_USE') {
      candidateCode = API_ERROR_CODE_MAP.IN_USE;
    }
    const hasMessage = typeof error?.message === 'string' && error.message.trim().length > 0;
    const mappedCode =
      candidateCode && (hasMessage || isDefinitionStale) ? candidateCode : 'INTERNAL_ERROR';
    const mappedMessage = mappedCode === 'INTERNAL_ERROR' ? 'Internal API error.' : error.message;
    const retriable = mappedCode === 'RATE_LIMITED';

    if (isDefinitionStale) {
      return this._failure(requestId, mappedCode, mappedMessage, retriable, {
        definitionKey: error.definitionKey,
        referenceStale: error.referenceStale,
        templateStale: error.templateStale,
        referenceLastModified: error.referenceLastModified,
        templateLastModified: error.templateLastModified,
      });
    }

    return this._failure(requestId, mappedCode, mappedMessage, retriable);
  }
}

/**
 * Entry point for the API handler; delegates to the ApiDispatcher singleton.
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
