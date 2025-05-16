/**
 * BatchUpdateUtility Class
 *
 * Provides utility methods for executing batch update requests for Google Sheets.
 * Can be used by any class that needs to perform batch updates.
 */
class BatchUpdateUtility {
  /**
   * Executes batch update requests for a spreadsheet.
   * @param {Object[]} requests - Array of batch update request objects.
   * @param {string} spreadsheetId - The ID of the spreadsheet to update.
   * @returns {Object} The response from the batch update operation.
   * @throws {Error} If the batch update fails.
   */
  static executeBatchUpdate(requests, spreadsheetId) {
    if (!requests || requests.length === 0) {
      console.log("No batch requests to execute.");
      return;
    }

    if (!spreadsheetId) {
      throw new Error("Spreadsheet ID is required for batch updates.");
    }

    try {
      const response = Sheets.Spreadsheets.batchUpdate({ requests }, spreadsheetId);
      console.log("Batch update executed successfully.");
      return response;
    } catch (e) {
      console.error("Error executing batch update:", e);
      throw new Error(`Error applying batch update. ${e.message}`);
    }
  }

  /**
   * Executes multiple batch update requests for different spreadsheets.
   * @param {Object[]} batchUpdates - Array of objects each containing 'requests' (Object[]) and 'spreadsheetId' (string).
   * @return {Object[]} Array of responses from each batch update operation.
   * @throws {Error} If any batch update fails.
   */
  static executeMultipleBatchUpdates(batchUpdates) {
    if (!Array.isArray(batchUpdates) || batchUpdates.length === 0) {
      throw new Error("No batch updates provided.");
    }
    const responses = [];
    for (let i = 0; i < batchUpdates.length; i++) {
      const { requests, spreadsheetId } = batchUpdates[i];
      try {
        if (!requests || requests.length === 0) {
          // Skip empty requests, but log for user-facing tracking
          if (this.progressTracker && typeof this.progressTracker.logError === 'function') {
            this.progressTracker.logError(`No batch requests to execute for index ${i}.`, { batchUpdate: batchUpdates[i] });
          }
          continue;
        }
        if (!spreadsheetId) {
          throw new Error(`Spreadsheet ID is required for batch update at index ${i}.`);
        }
        const response = Sheets.Spreadsheets.batchUpdate({ requests }, spreadsheetId);
        responses.push(response);
      } catch (e) {
        if (this.progressTracker && typeof this.progressTracker.logError === 'function') {
          this.progressTracker.logError(`Error executing batch update at index ${i}: ${e.message}`, { error: e, batchUpdate: batchUpdates[i] });
        }
        throw new Error(`Error applying batch update at index ${i}. ${e.message}`);
      }
    }
    return responses;
  }
}
