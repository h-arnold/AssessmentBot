/**
 * SheetsParser Class
 * 
 * Handles extraction and processing of content from Google Sheets documents.
 * Processes structured data in spreadsheets for assessment purposes.
 */
class SheetsParser extends DocumentParser {
  /**
   * Constructs a SheetsParser instance.
   */
  constructor() {
    super(); // Call parent constructor
    // Initialization if needed
  }

  /**
   * Helper to extract TaskSheet objects from a spreadsheet.
   * 
   * @param {string} documentId - The ID of the spreadsheet document
   * @param {string} type - 'reference' or 'template'
   * @return {Object} Map of sheet names to TaskSheet objects
   * @private
   */
  _extractFormulaeFromTaskSheets(documentId, type) {
    const tasks = {};
    if (!documentId) return tasks;
    const spreadsheet = SpreadsheetApp.openById(documentId);
    const sheets = spreadsheet.getSheets();
    sheets.forEach(sheet => {
      const taskSheet = new TaskSheet(sheet, type);
      if (typeof taskSheet.getAllFormulae === 'function') {
        taskSheet.getAllFormulae();
      }
      const taskName = taskSheet.sheetName;
      tasks[taskName] = taskSheet;
    });
    return tasks;
  }

  /**
   * Extracts raw formulae data from Google Sheets documents.
   * 
   * @param {string} referenceDocumentId - The ID of the reference document
   * @param {string} templateDocumentId - The ID of the template document
   * @return {Object} An object containing referenceTasks and templateTasks with raw formula data
   * @private
   */
  _extractRawSheetData(referenceDocumentId, templateDocumentId) {
    try {
      const referenceTasks = this._extractFormulaeFromTaskSheets(referenceDocumentId, 'reference');
      const templateTasks = this._extractFormulaeFromTaskSheets(templateDocumentId, 'template');
      return { referenceTasks, templateTasks };
    } catch (error) {
      console.error('Error in _extractRawSheetData:', error);
      this.progressTracker?.logError('Failed to extract tasks from sheets');
      return { referenceTasks: {}, templateTasks: {} };
    }
  }

  /**
   * Extracts Task instances from Google Sheets documents.
   * Implementation of the abstract method from DocumentParser.
   * @param {string} referenceDocumentId - The ID of the reference document.
   * @param {string} templateDocumentId - The ID of the template document.
   * @return {Task[]} - An array of Task instances extracted from the sheets.
   */
  extractTasks(referenceDocumentId, templateDocumentId) {
    try {
      // Get formula differences with bounding boxes
      const formulaDifferences = this.processAndCompareSheets(referenceDocumentId, templateDocumentId);
      const tasks = [];

      // Iterate through each sheet/challenge
      for (const sheetName in formulaDifferences) {
        const sheetData = formulaDifferences[sheetName];

        // Create task metadata with bounding box information
        const taskMetadata = {
          boundingBox: sheetData.boundingBox,
          totalFormulas: sheetData.formulas.length
        };

        // Create a Task object for each sheet with formula differences
        const task = new Task(
          sheetName,                // key (sheet name like "Challenge 1")
          "spreadsheet",            // taskType always "spreadsheet"
          sheetData.sheetId,        // pageId is the sheetId
          null,                     // imageCategory is null
          sheetData.formulas,       // taskReference is the array of formulae and locations
          null,                     // taskNotes is null
          null,                     // templateContent is null
          Utils.generateHash(JSON.stringify(sheetData.formulas)), // contentHash
          null,                     // templateContentHash is null
          taskMetadata              // Add the taskMetadata with bounding box
        );

        tasks.push(task);
      }

      return tasks;
    } catch (error) {
      console.error('Error in extractTasks:', error);
      this.progressTracker?.logError('Failed to extract tasks from sheets');
      return [];
    }
  }

  /**
   * Compares formulae between reference and template sheets, including bounding box calculations.
   * 
   * @param {Object} taskData - Object containing referenceTasks and templateTasks
   * @return {Object} Object with differences organised by taskName, including bounding boxes
   */
  compareFormulae(taskData) {
    try {
      // Use the previous bounding box logic
      const { referenceTasks, templateTasks } = taskData;
      const results = {};

      // Iterate through each key in referenceTasks
      for (const taskName in referenceTasks) {
        if (!templateTasks[taskName]) continue;

        const referenceSheet = referenceTasks[taskName];
        const templateSheet = templateTasks[taskName];

        if (!referenceSheet.formulaArray || !templateSheet.formulaArray) continue;

        const differences = this._compareFormulaArrays(
          referenceSheet.formulaArray,
          templateSheet.formulaArray,
          taskName
        );

        if (differences.length > 0) {
          results[taskName] = {
            sheetId: referenceSheet.sheetId,
            formulas: differences
          };
        }
      }

      // Add bounding box calculations
      for (const taskName in results) {
        const sheetDifferences = results[taskName];
        sheetDifferences.boundingBox = this._calculateBoundingBox(sheetDifferences.formulas);
      }

      return results;
    } catch (error) {
      console.error('Error in compareFormulae:', error);
      this.progressTracker?.logError('Failed to compare formulae between sheets');
      return {};
    }
  }

  /**
   * Normalises the case of a spreadsheet formula by converting all characters to upper case
   * except for those within double quotes (string literals). Handles escaped quotes.
   * Also handles formulas returned by Google Apps Script which are wrapped in quotes.
   *
   * @param {string} formula - The formula to normalise
   * @return {string} The normalised formula
   * @private
   */
  _normaliseFormulaCase(formula) {
    if (!formula) return formula;
    
    // Remove surrounding quotes if they exist (as returned by getFormulas in GAS)
    if (formula.length >= 2 && formula.charAt(0) === '"' && formula.charAt(formula.length - 1) === '"') {
      // Extract the content between quotes, handling escape sequences
      try {
        // Use a safe way to remove the surrounding quotes
        formula = formula.substring(1, formula.length - 1);
        // Un-escape any doubled quotes within the formula
        formula = formula.replace(/""/g, '"');
      } catch (error) {
        console.error('Error preprocessing formula:', error);
      }
    }
    
    // Now process the formula normally
    let result = '';
    let inQuotes = false;
    for (let i = 0; i < formula.length; i++) {
      const char = formula.charAt(i);
      if (char === '"') {
        // Handle escaped quotes inside string literals
        if (inQuotes && i + 1 < formula.length && formula.charAt(i + 1) === '"') {
          result += '""';
          i++; // Skip next char
        } else {
          inQuotes = !inQuotes;
          result += char;
        }
      } else if (inQuotes) {
        result += char;
      } else {
        result += char.toUpperCase();
      }
    }
    return result;
  }

  /**
   * Compares two formula arrays and identifies differences.
   * 
   * @param {Array<Array<string>>} referenceArray - The reference formula array
   * @param {Array<Array<string>>} templateArray - The template formula array
   * @param {string} taskName - The name of the task sheet being compared
   * @return {Array} Array of differences with formula and location info
   * @private
   */
  _compareFormulaArrays(referenceArray, templateArray) {
    const referenceFormulaeArray = [];

    // Use reference array dimensions as the bounds for comparison
    for (let row = 0; row < referenceArray.length; row++) {
      const refRow = referenceArray[row] || [];
      // Template row might not exist if template has fewer rows
      const tempRow = row < templateArray.length ? templateArray[row] : [];

      for (let col = 0; col < refRow.length; col++) {
        const refFormula = refRow[col] || '';
        // Template cell might not exist if template row is shorter
        const tempFormula = tempRow[col] || '';

        // Check if there's a non-empty reference formula and it doesn't match the template
        if (refFormula && refFormula !== tempFormula) {

          // Normalise the formulae that are going to make it into the reference tasks.

          const normalisedRefFormula = this._normaliseFormulaCase(refFormula);
          referenceFormulaeArray.push({
            referenceFormula: normalisedRefFormula,
            location: [row, col]
          });
        }
      }
    }

    return referenceFormulaeArray;
  }

  /**
   * Processes extracted tasks and compares formulae between reference and template sheets, including bounding box calculations.
   * 
   * @param {string} referenceDocumentId - The ID of the reference document
   * @param {string} templateDocumentId - The ID of the template document
   * @return {Object} Object containing formulae differences by sheet name with bounding boxes
   */
  processAndCompareSheets(referenceDocumentId, templateDocumentId) {
    try {
      const extractedTasks = this._extractRawSheetData(referenceDocumentId, templateDocumentId);
      return this.compareFormulae(extractedTasks);
    } catch (error) {
      console.error('Error in processAndCompareSheets:', error);
      this.progressTracker?.logError('Failed to process and compare sheets');
      return {};
    }
  }

  /**
   * Calculates the bounding box for a collection of formula differences.
   * The bounding box represents the smallest rectangular area that contains all differences.
   * 
   * @param {Array} differences - Array of formula differences with location information
   * @return {Object} Bounding box as {startRow, startColumn, endRow, endColumn, numRows, numColumns}
   * @private
   */
  _calculateBoundingBox(differences) {
    if (!differences || differences.length === 0) {
      return null;
    }

    // Initialize with extreme values
    let startRow = Infinity;
    let startColumn = Infinity;
    let endRow = -1;
    let endColumn = -1;

    // Find minimum and maximum row/column indices
    differences.forEach(diff => {
      const [row, col] = diff.location;
      startRow = Math.min(startRow, row);
      startColumn = Math.min(startColumn, col);
      endRow = Math.max(endRow, row);
      endColumn = Math.max(endColumn, col);
    });

    // Calculate dimensions
    const numRows = endRow - startRow + 1;
    const numColumns = endColumn - startColumn + 1;

    return {
      startRow: startRow + 1, // Add 1 to convert from 0-based to 1-based indexing (for Sheets API)
      startColumn: startColumn + 1,
      endRow: endRow + 1,
      endColumn: endColumn + 1,
      numRows,
      numColumns
    };
  }

  /**
   * Extracts student Task instances from a student's Google Sheets document based on reference tasks.
   * 
   * @param {string} studentDocumentId - The ID of the student's document.
   * @param {Task[]} referenceTasks - Array of reference Task instances to compare against.
   * @return {Task[]} - An array of Task instances extracted from the student's sheets.
   */
  extractStudentTasks(studentDocumentId, referenceTasks) {
    try {
      this.progressTracker?.logProgress('Extracting student tasks from sheets');
      const studentTasks = [];

      if (!studentDocumentId) {
        this.progressTracker?.logError('No student document ID provided');
        return studentTasks;
      }

      // Create a map of task titles to reference tasks for quick lookup
      const taskTitleMap = {};
      referenceTasks.forEach(task => {
        taskTitleMap[task.taskTitle] = task;
      });

      // Open the student's spreadsheet
      const spreadsheet = SpreadsheetApp.openById(studentDocumentId);
      const sheets = spreadsheet.getSheets();

      // Process each sheet in the student document
      sheets.forEach(sheet => {
        const sheetName = sheet.getName();

        // Check if this sheet matches any reference task
        if (taskTitleMap[sheetName]) {
          const referenceTask = taskTitleMap[sheetName];

          // Create a TaskSheet object for the student's sheet
          const taskSheet = new TaskSheet(sheet, 'studentTask');

          // Extract the bounding box from the reference task metadata
          const boundingBox = referenceTask.taskMetadata.boundingBox;
          if (!boundingBox) {
            console.error(`No bounding box found for task: ${sheetName}`);
            return; // Skip this task
          }

          // Extract student formulas from the bounding box region
          const studentFormulas = [];
          try {
            // Get formulas from the specific bounding box region
            const rangeFormulas = taskSheet.getRange(boundingBox, 'formulas');

            // Convert to the format used by reference tasks
            for (let r = 0; r < rangeFormulas.length; r++) {
              for (let c = 0; c < rangeFormulas[r].length; c++) {
                const formula = rangeFormulas[r][c];
                // Include all formulas (empty or not)

                if (formula) {
                  const normalisedStudentFormula = this._normaliseFormulaCase(formula); // If the formula isn't empty, normalise it.
                }

                studentFormulas.push({
                  formula: normalisedStudentFormula || "", // Store empty string if formula is null/undefined
                  location: [boundingBox.startRow - 1 + r, boundingBox.startColumn - 1 + c]
                });
              }
            }
          } catch (error) {
            console.error(`Error extracting formulas from ${sheetName}: ${error}`);
            this.progressTracker?.logError(`Failed to extract formulas from ${sheetName}`);
          }

          // Create a Task object for this student submission
          const studentTask = new Task(
            sheetName,                     // taskTitle (same as reference)
            "spreadsheet",                 // taskType
            sheet.getSheetId(),            // pageId
            null,                          // imageCategory
            studentFormulas,               // taskReference contains the student's formulas
            null,                          // taskNotes
            null,                          // templateContent
            Utils.generateHash(JSON.stringify(studentFormulas)), // contentHash
            null,                          // templateContentHash
            {                              // taskMetadata
              boundingBox: boundingBox,    // Use same boundingBox as reference
              totalFormulas: studentFormulas.length
            }
          );

          studentTasks.push(studentTask);
        }
      }
      );

      this.progressTracker?.logProgress(`Extracted ${studentTasks.length} student tasks from sheets`);
      return studentTasks;
    } catch (error) {
      console.error('Error in extractStudentTasks:', error);
      this.progressTracker?.logError('Failed to extract student tasks from sheets');
      return [];
    }
  }
}

