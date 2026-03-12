/**
 * BatchUpdateUtility Class
 *
 * Provides utility methods for executing batch update requests for Google Sheets.
 * Can be used by any class that needs to perform batch updates.
 */
const BatchUpdateUtility = {
  /**
   * Executes batch update requests for a spreadsheet.
   * @param {Object[]} requests - Array of batch update request objects.
   * @param {string} spreadsheetId - The ID of the spreadsheet to update.
   * @returns {Object} The response from the batch update operation.
   * @throws {Error} If the batch update fails.
   */
  executeBatchUpdate(requests, spreadsheetId) {
    if (!requests || requests.length === 0) {
      const progressTracker = ProgressTracker.getInstance();
      progressTracker.logError('No batch requests to execute.');
      return;
    }

    const progressTracker = ProgressTracker.getInstance();

    if (!spreadsheetId) {
      progressTracker.logAndThrowError('Spreadsheet ID is required for batch updates.');
    }

    try {
      const response = Sheets.Spreadsheets.batchUpdate({ requests }, spreadsheetId);
      console.log('Batch update executed successfully.');
      return response;
    } catch (error) {
      progressTracker.logAndThrowError(`Error applying batch update.`, error);
    }
  },

  /**
   * Executes multiple batch update requests for different spreadsheets.
   * @param {Object[]} batchUpdates - Array of objects each containing 'requests' (Object[]) and 'spreadsheetId' (string).
   * @return {Object[]} Array of responses from each batch update operation.
   * @throws {Error} If any batch update fails.
   */
  executeMultipleBatchUpdates(batchUpdates) {
    const progressTracker = ProgressTracker.getInstance();

    if (!Array.isArray(batchUpdates) || batchUpdates.length === 0) {
      progressTracker.logAndThrowError('No batch updates provided.');
    }

    const responses = [];
    for (const [index, batchUpdate] of batchUpdates.entries()) {
      const { requests, spreadsheetId } = batchUpdate;
      try {
        if (!requests || requests.length === 0) {
          // Skip empty requests, but log for user-facing tracking
          progressTracker.logError(`No batch requests to execute for index ${index}.`, {
            batchUpdate: batchUpdate,
          });
          continue;
        }

        if (!spreadsheetId) {
          progressTracker.logAndThrowError(
            `Spreadsheet ID is required for batch update at index ${index}.`
          );
        }

        const response = Sheets.Spreadsheets.batchUpdate({ requests }, spreadsheetId);
        responses.push(response);
      } catch (error) {
        progressTracker.logAndThrowError(`Error applying batch update at index ${index}.`, {
          error: error,
          batchUpdate: batchUpdate,
        });
      }
    }
    return responses;
  },
};
