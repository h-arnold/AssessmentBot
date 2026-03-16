/**
 * BaseRequestManager Class
 *
 * Handles generic URL requests with error handling, retries, and exponential backoff.
 */
class BaseRequestManager {
  constructor() {
    this.configManager = ConfigurationManager.getInstance(); // Lazy singleton access
    this.cache = CacheService.getScriptCache(); // Initialize the script cache
    this.progressTracker = ProgressTracker.getInstance();
    this.logger = ABLogger.getInstance();
  }

  /**
   * Determines if an HTTP status code represents a retryable error.
   * @param {number} statusCode - The HTTP status code to check.
   * @return {boolean} - True if the error is retryable, false otherwise.
   * @private
   */
  _isRetryableError(statusCode) {
    // Retryable errors (per backend error code documentation):
    // - 429: Too Many Requests (rate limiting)
    // - 500: Internal Server Error
    // - 503: Service Unavailable
    // - Any 5xx except those that indicate permanent failures
    return statusCode === 429 || statusCode >= 500;
  }

  /**
   * Determines if an HTTP status code represents a client error that should abort processing.
   * @param {number} statusCode - The HTTP status code to check.
   * @return {boolean} - True if the error should abort processing, false otherwise.
   * @private
   */
  _shouldAbort(statusCode) {
    // Errors that should abort (per backend error code documentation):
    // - 401: Unauthorised (invalid API key)
    // - 403: Forbidden (insufficient permissions)
    // - 404: Not Found (resource missing / incorrect endpoint)
    return statusCode === 401 || statusCode === 403 || statusCode === 404;
  }

  /**
   * Sends a single HTTP request with retries and exponential backoff.
   * @param {Object} request - The request object compatible with UrlFetchApp.fetch().
   * @param {number} [maxRetries=3] - Maximum number of retries.
   * @return {HTTPResponse|null} - The HTTPResponse object or null if all retries fail.
   */
  sendRequestWithRetries(request, maxRetries = 2) {
    let attempt = 0;
    let delay = 5000; // Initial delay of 5 seconds. When extracting whole slide images you get rate limited quite early. A 5 second delay seems to be the minimum needed to avoid a retry.

    while (attempt <= maxRetries) {
      try {
        const response = UrlFetchApp.fetch(request.url, request);
        const responseCode = response.getResponseCode();

        // Success responses - return immediately
        if (responseCode === 200 || responseCode === 201) {
          return response;
        }

        // Check if error should abort processing
        if (this._shouldAbort(responseCode)) {
          const errorDetails = {
            statusCode: responseCode,
            url: request.url,
            responseText: response.getContentText(),
          };
          this.progressTracker.logError(
            `Request to ${request.url} failed with status ${responseCode}. Please check your API keys in the settings.`,
            errorDetails
          );
          this.logger.error(
            'Aborting request due to authentication/permission error',
            errorDetails
          );
          throw new AbortRequestError(responseCode, request.url, response.getContentText());
        }

        // Check if error is non-retryable (client errors)
        if (responseCode >= 400 && responseCode < 500 && !this._isRetryableError(responseCode)) {
          // Non-retryable client errors (400, 413, etc.) - return response for caller to handle
          this.logger.warn(`Non-retryable client error ${responseCode} for ${request.url}`, {
            responseCode,
            responseText: response.getContentText(),
          });
          console.warn(
            `Request to ${
              request.url
            } failed with non-retryable status ${responseCode}. Response: ${response.getContentText()}`
          );
          return response;
        }

        // Any error reaching this point is retryable - log once and retry
        console.warn(
          `Request to ${
            request.url
          } failed with status ${responseCode}. Returned message: ${response.getContentText()}. Attempt ${
            attempt + 1
          } of ${maxRetries + 1}.`
        );
      } catch (error) {
        // Network exceptions or thrown errors
        if (error instanceof AbortRequestError) {
          // Re-throw abort errors to halt processing
          throw error;
        }
        // Log network errors and retry
        this.logger.error('Network error during request', {
          url: request.url,
          message: error.message,
          attempt: attempt + 1,
          maxAttempts: maxRetries + 1,
        });
        console.error(
          `Error during request to ${request.url}: ${error.message}. Attempt ${attempt + 1} of ${
            maxRetries + 1
          }.`
        );
      }

      // Increment attempt counter and apply exponential backoff
      attempt++;
      if (attempt > maxRetries) break;
      Utilities.sleep(delay);
      delay *= 1.5; // Increase the backoff by 50% as the base pause time is quite high
    }

    console.error(`All ${maxRetries + 1} attempts failed for request to ${request.url}.`);
    return null;
  }

  /**
   * Sends multiple HTTP requests in batches with retries and exponential backoff.
   * @param {Object[]} rthisequests - An array of request objects compatible with UrlFetchApp.fetchAll().
   * @return {HTTPResponse[]} - An array of HTTPResponse objects.
   */
  sendRequestsInBatches(requests) {
    const batchSize = ConfigurationManager.getInstance().getBackendAssessorBatchSize();
    const batches = [];

    // Split requests into batches
    for (let i = 0; i < requests.length; i += batchSize) {
      batches.push(requests.slice(i, i + batchSize));
    }

    const allResponses = [];

    //Gets the current step message before iterating
    const currentProgress = this.progressTracker.getCurrentProgress();
    const currentMessage = currentProgress.message; //Gets the current message before the loop so you don't end up concatentating all the previous updates.

    batches.forEach((batch, index) => {
      this.progressTracker.updateProgress(
        `${currentMessage}: Sending batch ${index + 1} of ${batches.length}.`,
        false
      );
      const fetchAllRequests = batch.map((req) => ({
        url: req.url,
        method: req.method || 'get',
        contentType: req.contentType || 'application/json',
        payload: req.payload || null,
        headers: req.headers || {},
        muteHttpExceptions: req.muteHttpExceptions || true,
      }));

      const responses = UrlFetchApp.fetchAll(fetchAllRequests);

      // Handle each response with retries if necessary
      responses.forEach((response, idx) => {
        const originalRequest = batch[idx];
        if (response.getResponseCode() !== 200 && response.getResponseCode() !== 201) {
          console.warn(
            `Batch ${index + 1}, Request ${
              idx + 1
            } failed with status ${response.getResponseCode()}. Retrying...`
          );
          const retryResponse = this.sendRequestWithRetries(originalRequest);
          if (retryResponse) {
            allResponses.push(retryResponse);
          } else {
            allResponses.push(response); // Push the failed response
          }
        } else {
          allResponses.push(response);
        }
      });
    });

    return allResponses;
  }
}

// Export for Node/Vitest environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BaseRequestManager;
}
