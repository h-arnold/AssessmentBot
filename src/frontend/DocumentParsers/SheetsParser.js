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
    sheets.forEach((sheet) => {
      const taskSheet = new TaskSheet(sheet, type);
      if (typeof taskSheet.getAllFormulae === "function") {
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
      const referenceTasks = this._extractFormulaeFromTaskSheets(
        referenceDocumentId,
        "reference"
      );
      const templateTasks = this._extractFormulaeFromTaskSheets(
        templateDocumentId,
        "template"
      );
      return { referenceTasks, templateTasks };
    } catch (error) {
      this.progressTracker.captureError(error, "Failed to extract tasks from sheets");
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
      const formulaDifferences = this.processAndCompareSheets(
        referenceDocumentId,
        templateDocumentId
      );
      const tasks = [];

      // Iterate through each sheet/challenge
      for (const sheetName in formulaDifferences) {
        const sheetData = formulaDifferences[sheetName];

        // Create reference locations map for faster lookup during student task extraction
        const referenceLocationsMap = this._createReferenceLocationsMap(
          sheetData.formulas
        );

        // Create task metadata with bounding box information
        const taskMetadata = {
          boundingBox: sheetData.boundingBox,
          totalFormulas: sheetData.formulas.length,
          referenceLocationsMap: referenceLocationsMap,
        };

        // Create a Task object for each sheet with formula differences
        const task = new Task(
          sheetName, // key (sheet name like "Challenge 1")
          "spreadsheet", // taskType always "spreadsheet"
          sheetData.sheetId, // pageId is the sheetId
          null, // imageCategory is null
          sheetData.formulas, // taskReference is the array of formulae and locations
          null, // taskNotes is null
          null, // templateContent is null
          Utils.generateHash(JSON.stringify(sheetData.formulas)), // contentHash
          null, // templateContentHash is null
          taskMetadata // Add the taskMetadata with bounding box and reference locations map
        );

        tasks.push(task);
      }

      return tasks;
    } catch (error) {
      this.progressTracker.captureError(error, "Failed to extract tasks from sheets");
      return [];
    }
  }

  /**
   * Creates a map of reference formula locations for efficient lookup.
   * Maps location keys to the corresponding formula index in the array.
   *
   * Note: We store the array indices rather than simple boolean values to allow direct access
   * to the full formula objects when needed. This approach maintains efficient lookup while
   * providing more utility than a simple presence check. The combination of this map and
   * the original location data in the formula objects gives us flexibility for both random
   * access and iteration scenarios without duplicating the full formula objects.
   *
   * @param {Array} formulas - Array of formula differences with location information
   * @return {Object} Map with location keys and formula indices as values
   * @private
   */
  _createReferenceLocationsMap(formulas) {
    const locationsMap = {};
    formulas.forEach((item, index) => {
      const [row, col] = item.location;
      const key = `${row},${col}`;
      locationsMap[key] = index; // Store the index instead of just true
    });
    return locationsMap;
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

        if (!referenceSheet.formulaArray || !templateSheet.formulaArray)
          continue;

        const differences = this._compareFormulaArrays(
          referenceSheet.formulaArray,
          templateSheet.formulaArray,
          taskName
        );

        if (differences.length > 0) {
          results[taskName] = {
            sheetId: referenceSheet.sheetId,
            formulas: differences,
          };
        }
      }

      // Add bounding box calculations
      for (const taskName in results) {
        const sheetDifferences = results[taskName];
        sheetDifferences.boundingBox = this._calculateBoundingBox(
          sheetDifferences.formulas
        );
      }

      return results;
    } catch (error) {
      this.progressTracker.captureError(error, "Failed to compare formulae between sheets");
      return {};
    }
  }

  /**
   * Normalises the case of a spreadsheet formula by converting all characters to upper case
   * except for those within double quotes (string literals). Handles escaped quotes.
   * Also handles formulas returned by Google Apps Script which are wrapped in quotes.
   * Trims spaces from any formulae when they are not in quotes.
   *
   * @param {string} formula - The formula to normalise
   * @return {string} The normalised formula
   * @private
   */
  _normaliseFormulaCase(formula) {
    if (!formula) return formula;

    // Remove surrounding quotes if they exist (as returned by getFormulas in GAS)
    if (
      formula.length >= 2 &&
      formula.charAt(0) === '"' &&
      formula.charAt(formula.length - 1) === '"'
    ) {
      // Extract the content between quotes, handling escape sequences
      try {
        // Use a safe way to remove the surrounding quotes
        formula = formula.substring(1, formula.length - 1);
        // Un-escape any doubled quotes within the formula
        formula = formula.replace(/""/g, '"');
      } catch (error) {
        this.progressTracker.captureError(error, "Error preprocessing formula");
      }
    }

    // Now process the formula normally
    let result = "";
    let inQuotes = false;
    for (let i = 0; i < formula.length; i++) {
      const char = formula.charAt(i);
      if (char === '"') {
        // Handle escaped quotes inside string literals
        if (
          inQuotes &&
          i + 1 < formula.length &&
          formula.charAt(i + 1) === '"'
        ) {
          result += '""';
          i++; // Skip next char
        } else {
          inQuotes = !inQuotes;
          result += char;
        }
      } else if (inQuotes) {
        result += char;
      } else {
        // Trim spaces when not in quotes
        if (char !== " ") {
          result += char.toUpperCase();
        }
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
        const refFormula = refRow[col] || "";
        // Template cell might not exist if template row is shorter
        const tempFormula = tempRow[col] || "";

        // Check if there's a non-empty reference formula and it doesn't match the template
        if (refFormula && refFormula !== tempFormula) {
          // Normalise the formulae that are going to make it into the reference tasks.

          const normalisedRefFormula = this._normaliseFormulaCase(refFormula);
          referenceFormulaeArray.push({
            referenceFormula: normalisedRefFormula,
            location: [row, col],
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
      const extractedTasks = this._extractRawSheetData(
        referenceDocumentId,
        templateDocumentId
      );
      return this.compareFormulae(extractedTasks);
    } catch (error) {
      this.progressTracker.captureError(error, "Failed to process and compare sheets");
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
    differences.forEach((diff) => {
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
      numColumns,
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
      const studentTasks = [];

      if (!studentDocumentId) {
        this.progressTracker.logAndThrowError("No student document ID provided");
        return studentTasks;
      }

      // Create a map of task titles to reference tasks for quick lookup
      const taskTitleMap = {};
      referenceTasks.forEach((task) => {
        taskTitleMap[task.taskTitle] = task;
      });

      // Open the student's spreadsheet
      const spreadsheet = SpreadsheetApp.openById(studentDocumentId);
      const sheets = spreadsheet.getSheets();

      // Process each sheet in the student document
      sheets.forEach((sheet) => {
        const sheetName = sheet.getName();

        // Check if this sheet matches any reference task
        if (taskTitleMap[sheetName]) {
          const referenceTask = taskTitleMap[sheetName];

          // Create a TaskSheet object for the student's sheet
          const taskSheet = new TaskSheet(sheet, "studentTask");

          // Extract the bounding box from the reference task metadata
          const boundingBox = referenceTask.taskMetadata.boundingBox;
          if (!boundingBox) {
            this.progressTracker.logError(`No bounding box found for task: ${sheetName}`);
            return; // Skip this task
          }

          // Extract student formulas from the bounding box region
          const studentFormulas = [];
          try {
            // Get formulas from the specific bounding box region
            const rangeFormulas = taskSheet.getRange(boundingBox, "formulas");

            // Only extract formulas from locations that exist in the reference task
            referenceTask.taskReference.forEach((refItem) => {
              const [refRow, refCol] = refItem.location;

              // Calculate the relative position within our extracted range
              const rangeRow = refRow - (boundingBox.startRow - 1);
              const rangeCol = refCol - (boundingBox.startColumn - 1);

              // Check if this position is within our extracted range
              let formula = "";
              if (
                rangeRow >= 0 &&
                rangeRow < rangeFormulas.length &&
                rangeCol >= 0 &&
                rangeCol < (rangeFormulas[rangeRow] || []).length
              ) {
                formula = rangeFormulas[rangeRow][rangeCol] || "";
              }

              // Normalise if needed
              let normalisedStudentFormula = formula;
              if (formula) {
                normalisedStudentFormula = this._normaliseFormulaCase(formula);
              }

              studentFormulas.push({
                formula: normalisedStudentFormula || "", // Store empty string if formula is null/undefined
                location: [refRow, refCol], // Use the original reference location
              });
            });
          } catch (error) {
            this.progressTracker.captureError(
              error,
              `Failed to extract formulas from ${sheetName}`
            );
          }

          // Create a Task object for this student submission
          const studentTask = new Task(
            sheetName, // taskTitle (same as reference)
            "spreadsheet", // taskType
            sheet.getSheetId(), // pageId
            null, // imageCategory
            studentFormulas, // taskReference contains the student's formulas
            null, // taskNotes
            null, // templateContent
            Utils.generateHash(JSON.stringify(studentFormulas)), // contentHash
            null, // templateContentHash
            {
              // taskMetadata
              boundingBox: boundingBox, // Use same boundingBox as reference
              totalFormulas: studentFormulas.length,
            }
          );

          studentTasks.push(studentTask);
        }
      });

      return studentTasks;
    } catch (error) {
      this.progressTracker.captureError(error, "Failed to extract student tasks from sheets");
      return [];
    }
  }
}
