/**
 * BaseRequestManager Class
 * 
 * Handles generic URL requests with error handling, retries, and exponential backoff.
 */
class BaseRequestManager {
    /**
     * Constructs a BaseRequestManager instance.
     */
    constructor() {
        this.configManager = configurationManager; // Reference to the singleton ConfigurationManager
        this.cache = CacheService.getScriptCache(); // Initialize the script cache
    }

    /**
     * Sends a single HTTP request with retries and exponential backoff.
     * @param {Object} request - The request object compatible with UrlFetchApp.fetch().
     * @param {number} [maxRetries=3] - Maximum number of retries.
     * @return {HTTPResponse|null} - The HTTPResponse object or null if all retries fail.
     */
    sendRequestWithRetries(request, maxRetries = 3) {
        let attempt = 0;
        let delay = 1000; // Initial delay of 1 second

        while (attempt <= maxRetries) {
            try {
                const response = UrlFetchApp.fetch(request.url, request);
                if (response.getResponseCode() === 200) {
                    return response;
                } else {
                    console.warn(`Request to ${request.url} failed with status ${response.getResponseCode()}. Attempt ${attempt + 1} of ${maxRetries + 1}.`);
                }
            } catch (error) {
                console.error(`Error during request to ${request.url}: ${error.message}. Attempt ${attempt + 1} of ${maxRetries + 1}.`);
            }

            // Increment attempt counter and apply exponential backoff
            attempt++;
            if (attempt > maxRetries) break;
            Utilities.sleep(delay);
            delay *= 2; // Exponential backoff
        }

        console.error(`All ${maxRetries + 1} attempts failed for request to ${request.url}.`);
        return null;
    }

    /**
     * Sends multiple HTTP requests in batches with retries and exponential backoff.
     * @param {Object[]} requests - An array of request objects compatible with UrlFetchApp.fetchAll().
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

        batches.forEach((batch, index) => {
            console.log(`Sending batch ${index + 1} of ${batches.length}.`);
            const responses = UrlFetchApp.fetchAll(batch.map(req => ({
                url: req.url,
                method: req.method || "get",
                contentType: req.contentType || "application/json",
                payload: req.payload || null,
                headers: req.headers || {},
                muteHttpExceptions: req.muteHttpExceptions || true
            })));

            // Handle each response with retries if necessary
            responses.forEach((response, idx) => {
                const originalRequest = batch[idx];
                if (response.getResponseCode() !== 200) {
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
