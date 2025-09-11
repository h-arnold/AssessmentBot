/** 
 * Sheets Feedback Class
 * This class is responsible for handling the provision of feedback to student spreadsheets when completing a spreadsheet task.
 * At some point this will need to be split off into a `BaseFeedback` class and a `SlidesFeedback` class will also be necessary.
 * However, today is not that day.
 * @class SheetsFeedback
 */

class SheetsFeedback {
  /**
   * Creates an instance of SheetsFeedback.
   * @param {Array} studentTasks - Array of StudentTask objects to process feedback for.
   */
  constructor(studentTasksOrSubmissions) {
    // Accept new model submissions array; fall back for backward compatibility.
    this.submissions = studentTasksOrSubmissions;
    this.progressTracker = ProgressTracker.getInstance();
  }

  /**
   * Applies visual feedback to all student spreadsheets based on their assessments.
   * Uses different colors for correct, incorrect, and not attempted cells.
   */
  applyFeedback() {
    try {
      const batchUpdates = [];
      (this.submissions || []).forEach(sub => {
        if (!sub || !sub.documentId) {
          console.warn(`Missing submission or document ID for student: ${sub?.studentId || 'Unknown'}`);
          return;
        }
        const studentLabel = sub.student?.name || sub.studentName || sub.studentId;
        this.progressTracker.updateProgress(`Generating feedback for ${studentLabel}'s spreadsheet.`, false);
        const requests = this.generateBatchRequestsForSubmission(sub);
        if (requests && requests.length) {
          batchUpdates.push({ requests, spreadsheetId: sub.documentId });
        }
      });
      this.progressTracker.updateProgress(`Applying feedback to student sheets`);
      if (batchUpdates.length) {
        BatchUpdateUtility.executeMultipleBatchUpdates(batchUpdates);
        this.progressTracker.updateProgress(`Applied cell colour feedback to ${batchUpdates.length} student sheets.`, false);
      } else {
        this.progressTracker.updateProgress('No spreadsheet feedback to apply.', false);
      }
    } catch (e) {
      console.error('Error applying spreadsheet feedback:', e);
      this.progressTracker.logError('Failed to apply spreadsheet feedback', e);
    }
  }

  /**
   * Generates all batch update requests for a single student's spreadsheet.
   * @param {StudentTask} studentTask - The student task to generate requests for.
   * @return {Array} Array of batch update request objects.
   */
  generateBatchRequestsForSubmission(sub) {
    const requests = [];
    const items = sub.items || {};
    Object.values(items).forEach(item => {
      if (!item || !item.feedback || item.pageId === undefined || item.pageId === null) return;
      const sheetId = item.pageId; // spreadsheet sheetId
      const cellFeedback = item.getFeedback ? item.getFeedback('cellReference') : (item.feedback.cellReference || null);
      if (cellFeedback && cellFeedback.getItems) {
        cellFeedback.getItems().forEach(cfItem => {
          const rowIndex = cfItem.location[0] || 0;
          const colIndex = cfItem.location[1] || 0;
          const req = this.createCellFormatRequest(rowIndex, colIndex, cfItem.status, sheetId);
          if (req) requests.push(req);
        });
      }
    });
    return requests;
  }

  /**
   * Creates a batch update request from row and column indices.
   * @param {number} rowIndex - Zero-based row index.
   * @param {number} colIndex - Zero-based column index.
   * @param {string} status - The status of the cell ("correct", "incorrect", "notAttempted").
   * @param {number} sheetId - The sheet ID (defaults to 0 for the first sheet).
   * @return {Object} A batch update request object for formatting the cell.
   */
  createCellFormatRequest(rowIndex, colIndex, status, sheetId = 0) {
    // Create a grid range directly from indices
    const gridRange = {
      sheetId: sheetId,
      startRowIndex: rowIndex,
      endRowIndex: rowIndex + 1,
      startColumnIndex: colIndex,
      endColumnIndex: colIndex + 1
    };

    // Get the appropriate color format based on status
    const userEnteredFormat = this.getFormatForStatus(status);
    
    // Return the complete request
    return {
      repeatCell: {
        range: gridRange,
        cell: {
          userEnteredFormat: userEnteredFormat
        },
        fields: "userEnteredFormat.backgroundColor"
      }
    };
  }

  /**
   * Gets the appropriate cell format based on the status.
   * @param {string} status - The status of the cell ("correct", "incorrect", "notAttempted").
   * @return {Object} A format object with background color.
   */
  getFormatForStatus(status) {
    switch (status) {
      case 'correct':
        return {
          backgroundColor: {
            red: 0.7137,    // #b6
            green: 0.8431,  // #d7
            blue: 0.6588,   // #a8
            alpha: 1.0
          }
        };
      case 'incorrect':
        return {
          backgroundColor: {
            red: 0.9176,    // #ea
            green: 0.6,     // #99
            blue: 0.6,      // #99
            alpha: 1.0
          }
        };
      case 'notAttempted':
        return {
          backgroundColor: {
            red: 1.0,       // #ff
            green: 0.898,   // #e5
            blue: 0.6,      // #99
            alpha: 1.0
          }
        };
      default:
        return {
          backgroundColor: {
            red: 1.0,
            green: 1.0,
            blue: 1.0,
            alpha: 1.0
          }
        };
    }
  }
}