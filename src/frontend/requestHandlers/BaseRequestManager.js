
    /**
     * Sends an HTTP request to the specified URL with retry logic.
     *
     * @param {Object} request The request object, containing the URL and other options.
     * @param {number} maxRetries The maximum number of retry attempts.
     * @return {GoogleAppsScript.URL_Fetch.HTTPResponse} The HTTP response object.
     * @throws {Error} If the request fails after the maximum number of retries, or if a 403 or 404 error occurs.
     */
    sendRequestWithRetries(request, maxRetries = 3) {
      let attempt = 1;

      while (attempt <= maxRetries) {
        try {
          const response = UrlFetchApp.fetch(request.url, request);
          const responseCode = response.getResponseCode();

          if (responseCode === 200 || responseCode === 201) {
            return response;
          } else if (responseCode === 403 || responseCode === 404) {
            throw new Error(`Request to ${request.url} failed with status ${responseCode}. Error message: ${response.getContentText()}`);
          } else {
            console.warn(`Request to ${request.url} failed with status ${response.getResponseCode()}. 
 Returned message: ${response.getContentText()} 
 Attempt ${attempt + 1} of ${maxRetries + 1}.`);
          }
        } catch (error) {
          console.error(`Error during request to ${request.url}: ${error.message}. Attempt ${attempt + 1} of ${maxRetries + 1}.`);
        }

        attempt++;
      }

      throw new Error(`Request to ${request.url} failed after ${maxRetries} attempts.`);
    }
