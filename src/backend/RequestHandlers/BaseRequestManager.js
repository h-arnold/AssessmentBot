/**
 * BaseRequestManager Class
 *
 * Owns bounded HTTP dispatch and retry policy for request-handler callers.
 */
const DEFAULT_MAX_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 5000;
const RETRY_DELAY_MULTIPLIER = 1.5;
const HTTP_STATUS_OK = 200;
const HTTP_STATUS_CREATED = 201;
const HTTP_STATUS_TOO_MANY_REQUESTS = 429;
const HTTP_STATUS_SERVER_ERROR = 500;
const HTTP_STATUS_SERVER_ERROR_MAX = 599;

/** Base request manager. */
class BaseRequestManager {
  /** Initialises shared services and constructor-owned transport defaults. */
  constructor() {
    this.configManager = ConfigurationManager.getInstance();
    this.cache = CacheService.getScriptCache();
    this.progressTracker = ProgressTracker.getInstance();
    this.logger = ABLogger.getInstance();
    this.maxAttempts = DEFAULT_MAX_ATTEMPTS;
    this.initialRetryDelayMs = INITIAL_RETRY_DELAY_MS;
    this.retryDelayMultiplier = RETRY_DELAY_MULTIPLIER;
    this.nativeRequestDefaults = {
      method: 'get',
      contentType: 'application/json',
      payload: null,
      headers: {},
      muteHttpExceptions: true,
    };
  }

  /**
   * Validates the request identity and URL.
   * @param {Object} request Request to validate.
   * @returns {void}
   * @private
   */
  _validateRequest(request) {
    Validate.requireParams({ request }, 'BaseRequestManager request');
    Validate.requireParams({ uid: request.uid, url: request.url }, 'BaseRequestManager request');
    Validate.validateNonEmptyString('request.uid', request.uid);
    Validate.validateNonEmptyString('request.url', request.url);
  }

  /**
   * Validates the caller's accepted and stop status policies.
   * @param {Object} policy Status policy to validate.
   * @returns {void}
   * @private
   */
  _validatePolicy(policy) {
    Validate.requireParams({ policy }, 'BaseRequestManager policy');
    Validate.requireParams(
      { acceptedStatuses: policy.acceptedStatuses, stopStatuses: policy.stopStatuses },
      'BaseRequestManager policy'
    );
    if (!Array.isArray(policy.acceptedStatuses) || !Array.isArray(policy.stopStatuses)) {
      throw new TypeError('HTTP status policies must be arrays');
    }
  }

  /**
   * Projects supported UrlFetchApp fields, preserving explicit false values.
   * @param {Object} request Request to project.
   * @returns {Object} Native fetch options.
   * @private
   */
  _projectNativeRequest(request) {
    return {
      url: request.url,
      method: request.method === undefined ? this.nativeRequestDefaults.method : request.method,
      contentType:
        request.contentType === undefined
          ? this.nativeRequestDefaults.contentType
          : request.contentType,
      payload: request.payload === undefined ? this.nativeRequestDefaults.payload : request.payload,
      headers: request.headers === undefined ? this.nativeRequestDefaults.headers : request.headers,
      muteHttpExceptions:
        request.muteHttpExceptions === undefined
          ? this.nativeRequestDefaults.muteHttpExceptions
          : request.muteHttpExceptions,
    };
  }

  /**
   * Classifies one received HTTP response.
   * @param {Object} response Native HTTP response.
   * @param {Object} policy Caller status policy.
   * @returns {{status:number,accepted:boolean,stopped:boolean,retryable:boolean}} Classification.
   * @private
   */
  _classifyResponse(response, policy) {
    const status = response.getResponseCode();
    return {
      status,
      accepted: policy.acceptedStatuses.includes(status),
      stopped: policy.stopStatuses.includes(status),
      retryable:
        status === HTTP_STATUS_TOO_MANY_REQUESTS ||
        (status >= HTTP_STATUS_SERVER_ERROR && status <= HTTP_STATUS_SERVER_ERROR_MAX),
    };
  }

  /**
   * Sends one request within the shared attempt budget.
   * @param {Object} request A request carrying its opaque UID.
   * @param {{acceptedStatuses:number[], stopStatuses:number[]}} policy Caller HTTP policy.
   * @returns {{uid:string,response:Object|null,error:Error|null,attempts:number}} Final outcome.
   * @remarks The dispatch that supplies an initial response counts as attempt one; waits occur only before actual subsequent dispatches.
   */
  sendRequestWithRetries(request, policy) {
    this._validateRequest(request);
    this._validatePolicy(policy);
    return this._runRetryEngine(request, policy, { attempts: 0, response: null, error: null });
  }

  /**
   * Sends native fetchAll batches and consumes each completed batch before continuing.
   * @param {Object[]} requests UID-tagged requests.
   * @param {{batchSize:number,acceptedStatuses:number[],stopStatuses:number[],onBatchComplete:function}} options Caller-owned batch and status policy. Returning exactly false from the callback stops this sender; other return values continue.
   * @returns {void}
   * @remarks All responses received in a batch are classified before any retry, and the callback runs before any later batch dispatch. A callback may return exactly false to stop subsequent retries and batches in this invocation; this sender remains void and does not return aggregate outcomes.
   */
  sendRequestsInBatches(requests, options) {
    this._validateBatchInput(requests, options);
    const currentMessage = this.progressTracker.getCurrentProgress().message;
    const batchCount = Math.ceil(requests.length / options.batchSize);
    let isStopped = false;
    for (let offset = 0; offset < requests.length && !isStopped; offset += options.batchSize) {
      const batch = requests.slice(offset, offset + options.batchSize);
      const batchNumber = Math.floor(offset / options.batchSize) + 1;
      this.progressTracker.updateProgress(
        `${currentMessage}: Sending batch ${batchNumber} of ${batchCount}.`,
        false
      );
      const initialOutcomes = this._dispatchBatch(batch, options);
      isStopped = initialOutcomes.some((outcome) => outcome.classification?.stopped);
      const outcomes = this._consumeBatch(initialOutcomes, options, isStopped);
      if (
        outcomes.some(
          (outcome) =>
            outcome.response && options.stopStatuses.includes(outcome.response.getResponseCode())
        )
      ) {
        isStopped = true;
      }
      if (options.onBatchComplete && options.onBatchComplete(outcomes) === false) {
        isStopped = true;
      }
    }
  }

  /**
   * Validates a batch call before any native dispatch.
   * @param {Object[]} requests UID-tagged requests.
   * @param {Object} options Caller batch policy.
   * @returns {void}
   * @private
   */
  _validateBatchInput(requests, options) {
    Validate.requireParams({ requests, options }, 'sendRequestsInBatches');
    if (!Array.isArray(requests)) throw new TypeError('requests must be an array');
    Validate.requireParams(
      {
        batchSize: options.batchSize,
        acceptedStatuses: options.acceptedStatuses,
        stopStatuses: options.stopStatuses,
      },
      'sendRequestsInBatches options'
    );
    Validate.validateIntegerInRange('batchSize', options.batchSize, 1, Number.MAX_SAFE_INTEGER);
    this._validatePolicy(options);
    if (options.onBatchComplete !== undefined && typeof options.onBatchComplete !== 'function')
      throw new Error('onBatchComplete must be a function');
    const seenUids = new Set();
    requests.forEach((request) => {
      this._validateRequest(request);
      if (seenUids.has(request.uid)) throw new Error(`Duplicate request UID: ${request.uid}`);
      seenUids.add(request.uid);
    });
  }

  /**
   * Dispatches once and classifies every received member before returning.
   * @param {Object[]} batch Requests in this batch.
   * @param {Object} policy Caller status policy.
   * @returns {Object[]} Initial identity-tagged classifications.
   * @private
   */
  _dispatchBatch(batch, policy) {
    const nativeRequests = batch.map((request) => this._projectNativeRequest(request));
    let nativeResponses;
    let isFailed = false;
    let batchError;
    try {
      nativeResponses = UrlFetchApp.fetchAll(nativeRequests);
    } catch (networkError) {
      isFailed = true;
      batchError = networkError;
    }
    if (isFailed) return batch.map((request) => ({ request, error: batchError, failed: true }));
    if (!Array.isArray(nativeResponses) || nativeResponses.length !== batch.length) {
      throw new TypeError(
        `fetchAll response count ${nativeResponses?.length} did not match request count ${batch.length}`
      );
    }
    return batch.map((request, index) => {
      const response = nativeResponses[index];
      return {
        request,
        response,
        classification: this._classifyResponse(response, policy),
        failed: false,
      };
    });
  }

  /**
   * Consumes initial responses and handles bounded sequential member retries.
   * @param {Object[]} initialOutcomes Initial outcomes from fetchAll.
   * @param {Object} policy Caller status policy.
   * @param {boolean} isStopped Whether a stop response was received in this batch.
   * @returns {Object[]} Final outcomes for this batch.
   * @private
   */
  _consumeBatch(initialOutcomes, policy, isStopped) {
    const outcomes = [];
    for (const initial of initialOutcomes) {
      const classification = initial.classification;
      if (isStopped || classification?.stopped || (classification && !classification.retryable)) {
        outcomes.push({
          uid: initial.request.uid,
          response: initial.response ?? null,
          error: initial.error ?? null,
          attempts: 1,
        });
        continue;
      }
      const outcome = this._runRetryEngine(initial.request, policy, {
        attempts: 1,
        response: initial.failed ? null : initial.response,
        error: initial.failed ? initial.error : null,
        classification,
      });
      outcomes.push(outcome);
      if (outcome.response && policy.stopStatuses.includes(outcome.response.getResponseCode())) {
        isStopped = true;
      }
    }
    return outcomes;
  }

  /** One retry owner for single dispatch and fetchAll members.
   * @param {Object} request UID-tagged request.
   * @param {Object} policy Accepted and stop statuses.
   * @param {{attempts:number,response:Object|null,error:*,classification?:Object}} state Attempt state, including an already-classified batch response.
   * @returns {{uid:string,response:Object|null,error:*,attempts:number}} Final outcome.
   * @private
   */
  _runRetryEngine(request, policy, state) {
    let { attempts, response, error, classification } = state;
    if (
      classification &&
      (classification.accepted || classification.stopped || !classification.retryable)
    ) {
      return { uid: request.uid, response, error: null, attempts };
    }
    while (attempts < this.maxAttempts) {
      if (attempts > 0) {
        Utilities.sleep(this.initialRetryDelayMs * this.retryDelayMultiplier ** (attempts - 1));
      }
      attempts += 1;
      const nativeRequest = this._projectNativeRequest(request);
      let isFailed = false;
      try {
        response = UrlFetchApp.fetch(request.url, nativeRequest);
      } catch (networkError) {
        isFailed = true;
        response = null;
        error = networkError;
      }
      if (isFailed) {
        this.logger.warn('HTTP request encountered a network failure.', {
          uid: request.uid,
          attempt: attempts,
        });
        classification = null;
        continue;
      }
      error = null;
      classification = this._classifyResponse(response, policy);
      if (classification.accepted || classification.stopped || !classification.retryable) {
        return { uid: request.uid, response, error: null, attempts };
      }
      this.logger.warn('HTTP request received a retryable response.', {
        uid: request.uid,
        status: classification.status,
        attempt: attempts,
      });
    }
    this.logger.error('HTTP request exhausted its transport attempts.', {
      uid: request.uid,
      attempts,
    });
    return { uid: request.uid, response, error, attempts };
  }
}

BaseRequestManager.HTTP_STATUS_OK = HTTP_STATUS_OK;
BaseRequestManager.HTTP_STATUS_CREATED = HTTP_STATUS_CREATED;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = BaseRequestManager;
}
