/**
 * BaseRequestManager Class
 * 
 * Handles generic URL requests with error handling, retries, and exponential backoff.
 */
class BaseRequestManager {
  constructor() {
    this.configManager = configurationManager; // Reference to the singleton ConfigurationManager
    this.cache = CacheService.getScriptCache(); // Initialize the script cache
    this.progressTracker = ProgressTracker.getInstance();
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
        if (responseCode === 200 || responseCode === 201) {
          return response;
        } else if (responseCode === 403) {
          this.progressTracker.Error(`Request to ${request.url} failed. Please check your API Keys in the settings.`);
          throw new Error(`Request to ${request.url} failed with status 403. Error message: ${response.getContentText()}`);
        } else {
          console.warn(`Request to ${request.url} failed with status ${response.getResponseCode()}. \n Returned message: ${response.getContentText()} \n Attempt ${attempt + 1} of ${maxRetries + 1}.`);
        }
      } catch (error) {
        console.error(`Error during request to ${request.url}: ${error.message}. Attempt ${attempt + 1} of ${maxRetries + 1}.`);
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
    const batchSize = this.configManager.getBatchSize();
    const batches = [];

    // Split requests into batches
    for (let i = 0; i < requests.length; i += batchSize) {
      batches.push(requests.slice(i, i + batchSize));
    }

    const allResponses = [];

    //Gets the current step message before iterating
    const currentProgress = this.progressTracker.getCurrentProgress();
    const currentMessage = currentProgress.message //Gets the current message before the loop so you don't end up concatentating all the previous updates.


    batches.forEach((batch, index) => {

      this.progressTracker.updateProgress(currentProgress.step, `${currentMessage}: Sending batch ${index + 1} of ${batches.length}.`)
      const fetchAllRequests = batch.map(req => ({
        url: req.url,
        method: req.method || "get",
        contentType: req.contentType || "application/json",
        payload: req.payload || null,
        headers: req.headers || {},
        muteHttpExceptions: req.muteHttpExceptions || true
      }));

      const responses = UrlFetchApp.fetchAll(fetchAllRequests);

      // Handle each response with retries if necessary
      responses.forEach((response, idx) => {
        const originalRequest = batch[idx];
        if (response.getResponseCode() !== 200 && response.getResponseCode() !== 201) {
          console.warn(`Batch ${index + 1}, Request ${idx + 1} failed with status ${response.getResponseCode()}. Retrying...`);
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