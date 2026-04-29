/**
 * Sheets Feedback Class
 * This class is responsible for handling the provision of feedback to student spreadsheets when completing a spreadsheet task.
 * At some point this will need to be split off into a `BaseFeedback` class and a `SlidesFeedback` class will also be necessary.
 * However, today is not that day.
 * @class SheetsFeedback
 */

/**
 *
 */
class SheetsFeedback {
  /**
   * Creates an instance of SheetsFeedback.
   * @param {Array<StudentSubmission>} studentTasksOrSubmissions - Array of StudentSubmission objects to process feedback for.
   */
  constructor(studentTasksOrSubmissions) {
    // Accept new model submissions array; fall back for backward compatibility.
    this.submissions = studentTasksOrSubmissions;
    this.progressTracker = ProgressTracker.getInstance();
  }

  /**
   * Applies visual feedback to all student spreadsheets based on their assessments.
   * Uses different colors for correct, incorrect, and not attempted cells.   * @returns {void}   */
  applyFeedback() {
    const batchUpdates = [];
    (this.submissions || []).forEach((sub) => {
      if (!sub || !sub.documentId) {
        ABLogger.getInstance().warn(
          `Missing submission or document ID for student: ${sub?.studentId || 'Unknown'}`
        );
        return;
      }
      const studentLabel = sub.student?.name || sub.studentName || sub.studentId;
      this.progressTracker.updateProgress(
        `Generating feedback for ${studentLabel}'s spreadsheet.`,
        false
      );
      const requests = this.generateBatchRequestsForSubmission(sub);
      if (requests.length > 0) {
        batchUpdates.push({ requests, spreadsheetId: sub.documentId });
      }
    });
    this.progressTracker.updateProgress('Applying feedback to student sheets');
    if (batchUpdates.length > 0) {
      BatchUpdateUtility.executeMultipleBatchUpdates(batchUpdates);
      this.progressTracker.updateProgress(
        `Applied cell colour feedback to ${batchUpdates.length} student sheets.`,
        false
      );
    } else {
      this.progressTracker.updateProgress('No spreadsheet feedback to apply.', false);
    }
  }

  /**
   * Generates all batch update requests for a single student's spreadsheet.
   * @param {StudentSubmission} sub - The student submission to generate requests for.
   * @returns {Array} Array of batch update request objects.
   */
  generateBatchRequestsForSubmission(sub) {
    const requests = [];
    const items = sub.items || {};
    Object.values(items).forEach((item) => {
      if (!item || !item.feedback) return;

      const sheetId = item.artifact?.pageId ?? item.pageId;
      if (sheetId === undefined || sheetId === null) {
        ABLogger.getInstance().warn(
          `Skipping spreadsheet feedback item without pageId for task ${item.taskId || 'Unknown'}`
        );
        return;
      }

      const cellFeedback = item.getFeedback
        ? item.getFeedback('cellReference')
        : item.feedback.cellReference || null;
      const feedbackItems = cellFeedback?.getItems ? cellFeedback.getItems() : cellFeedback?.items;
      if (!Array.isArray(feedbackItems)) return;

      feedbackItems.forEach((cfItem) => {
        const rowIndex = cfItem.location[0] || 0;
        const colIndex = cfItem.location[1] || 0;
        const request = this.createCellFormatRequest(rowIndex, colIndex, cfItem.status, sheetId);
        if (request) requests.push(request);
      });
    });
    return requests;
  }

  /**
   * Creates a batch update request from row and column indices.
   * @param {number} rowIndex - Zero-based row index.
   * @param {number} colIndex - Zero-based column index.
   * @param {string} status - The status of the cell ("correct", "incorrect", "notAttempted").
   * @param {number} sheetId - The sheet ID (defaults to 0 for the first sheet).
   * @returns {Object} A batch update request object for formatting the cell.
   */
  createCellFormatRequest(rowIndex, colIndex, status, sheetId = 0) {
    // Create a grid range directly from indices
    const gridRange = {
      sheetId: sheetId,
      startRowIndex: rowIndex,
      endRowIndex: rowIndex + 1,
      startColumnIndex: colIndex,
      endColumnIndex: colIndex + 1,
    };

    // Get the appropriate color format based on status
    const userEnteredFormat = this.getFormatForStatus(status);

    // Return the complete request
    return {
      repeatCell: {
        range: gridRange,
        cell: {
          userEnteredFormat: userEnteredFormat,
        },
        fields: 'userEnteredFormat.backgroundColor',
      },
    };
  }

  /**
   * Gets the appropriate cell format based on the status.
   * @param {string} status - The status of the cell ("correct", "incorrect", "notAttempted").
   * @returns {Object} A format object with background colour.
   */
  getFormatForStatus(status) {
    switch (status) {
      case 'correct': {
        return {
          backgroundColor: {
            red: 0.7137, // #b6
            green: 0.8431, // #d7
            blue: 0.6588, // #a8
            alpha: 1,
          },
        };
      }
      case 'incorrect': {
        return {
          backgroundColor: {
            red: 0.9176, // #ea
            green: 0.6, // #99
            blue: 0.6, // #99
            alpha: 1,
          },
        };
      }
      case 'notAttempted': {
        return {
          backgroundColor: {
            red: 1, // #ff
            green: 0.898, // #e5
            blue: 0.6, // #99
            alpha: 1,
          },
        };
      }
      default: {
        return {
          backgroundColor: {
            red: 1,
            green: 1,
            blue: 1,
            alpha: 1,
          },
        };
      }
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SheetsFeedback;
}
