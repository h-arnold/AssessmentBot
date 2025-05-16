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
  constructor(studentTasks) {
    this.studentTasks = studentTasks;
    this.progressTracker = ProgressTracker.getInstance();
  }

  /**
   * Applies visual feedback to all student spreadsheets based on their assessments.
   * Uses different colors for correct, incorrect, and not attempted cells.
   */
  applyFeedback() {
    try {
      const batchUpdates = [];
      
      this.studentTasks.forEach((studentTask) => {
        if (!studentTask || !studentTask.documentId) {
          console.warn(`Missing student task or document ID for student: ${studentTask?.student?.name || 'Unknown'}`);
          return;
        }

        this.progressTracker.updateProgress(`Applying feedback to ${studentTask.student.name}'s spreadsheet.`, false);
        
        // Generate batch update requests for this student's spreadsheet
        const requests = this.generateBatchRequestsForStudent(studentTask);
        
        if (requests && requests.length > 0) {
          batchUpdates.push({
            requests: requests,
            spreadsheetId: studentTask.documentId
          });
        }
      });
      
      // Execute all batch updates
      if (batchUpdates.length > 0) {
        BatchUpdateUtility.executeMultipleBatchUpdates(batchUpdates);
        this.progressTracker.updateProgress(`Applied cell colour feedback to ${batchUpdates.length} student sheets.`, false);
      } else {
        this.progressTracker.updateProgress("No spreadsheet feedback to apply.", false);
      }
    } catch (error) {
      console.error("Error applying spreadsheet feedback:", error);
      this.progressTracker.logError("Failed to apply spreadsheet feedback", error);
    }
  }

  /**
   * Generates all batch update requests for a single student's spreadsheet.
   * @param {StudentTask} studentTask - The student task to generate requests for.
   * @return {Array} Array of batch update request objects.
   */
  generateBatchRequestsForStudent(studentTask) {
    const requests = [];
    
    Object.entries(studentTask.responses).forEach(([taskKey, response]) => {
      // Skip if no response or no feedback
      if (!response || !response.feedback) {
        return;
      }
      
      // Look for cell reference feedback
      const cellFeedback = response.feedback.cellReference;
      if (cellFeedback && cellFeedback.getItems) {
        const feedbackItems = cellFeedback.getItems();
        
        feedbackItems.forEach(item => {
          // Create cell format request based on row and column indices
          const rowIndex = item.rowIndex || 0;
          const colIndex = item.colIndex || 0;
          const sheetId = item.sheetId || 0;
          
          const cellRequest = this.createCellFormatRequest(
            rowIndex, 
            colIndex, 
            item.status, 
            sheetId
          );
          
          if (cellRequest) {
            requests.push(cellRequest);
          }
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