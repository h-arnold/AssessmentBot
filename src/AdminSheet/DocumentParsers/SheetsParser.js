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
      this.progressTracker.captureError(error, 'Failed to extract tasks from sheets');
      return { referenceTasks: {}, templateTasks: {} };
    }
  }

  // Legacy extractTasks removed; replaced by extractTaskDefinitions per refactor.

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

        if (!referenceSheet.formulaArray || !templateSheet.formulaArray) continue;

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
        sheetDifferences.boundingBox = this._calculateBoundingBox(sheetDifferences.formulas);
      }

      return results;
    } catch (error) {
      this.progressTracker.captureError(error, 'Failed to compare formulae between sheets');
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
    if (formula.length >= 2 && formula.startsWith('"') && formula.endsWith('"')) {
      // Extract the content between quotes, handling escape sequences
      try {
        // Use a safe way to remove the surrounding quotes
        formula = formula.substring(1, formula.length - 1);
        // Un-escape any doubled quotes within the formula (literal replace of all occurrences)
        // Use replaceAll for clarity and to avoid regex pitfalls — safe because we're replacing a literal string.
        formula = formula.replaceAll('""', '"');
      } catch (error) {
        this.progressTracker.captureError(error, 'Error preprocessing formula');
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
        // Trim spaces when not in quotes
        if (char !== ' ') {
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
        const refFormula = refRow[col] || '';
        // Template cell might not exist if template row is shorter
        const tempFormula = tempRow[col] || '';

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
      const extractedTasks = this._extractRawSheetData(referenceDocumentId, templateDocumentId);
      return this.compareFormulae(extractedTasks);
    } catch (error) {
      this.progressTracker.captureError(error, 'Failed to process and compare sheets');
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
  // Legacy extractStudentTasks removed – replaced by extractSubmissionArtifacts.

  /**
   * New Phase 2: create TaskDefinitions for spreadsheet tasks.
   */
  extractTaskDefinitions(referenceDocumentId, templateDocumentId) {
    const diffs = this.processAndCompareSheets(referenceDocumentId, templateDocumentId);
    const defs = [];
    let index = 0;
    for (const sheetName in diffs) {
      const sheetData = diffs[sheetName];
      const referenceLocationsMap = this._createReferenceLocationsMap(sheetData.formulas);
      const taskMetadata = {
        bbox: sheetData.boundingBox,
        referenceLocationsMap,
        sheetId: sheetData.sheetId,
      };
      const def = new TaskDefinition({
        taskTitle: sheetName,
        pageId: String(sheetData.sheetId),
        taskMetadata,
      });
      def.index = index++;
      // Add primary reference SpreadsheetTaskArtifact: represent reference formulas as 2D array skeleton with normalised formulas
      // We convert differences list into a sparse array (leave nulls) sized to bbox dims
      const bbox = sheetData.boundingBox;
      let grid = [];
      if (bbox) {
        for (let r = 0; r < bbox.numRows; r++) {
          grid[r] = new Array(bbox.numColumns).fill(null);
        }
        sheetData.formulas.forEach((f) => {
          const [absR, absC] = f.location;
          const relR = absR - (bbox.startRow - 1);
          const relC = absC - (bbox.startColumn - 1);
          if (relR >= 0 && relR < bbox.numRows && relC >= 0 && relC < bbox.numColumns) {
            grid[relR][relC] = f.referenceFormula || f.formula || '';
          }
        });
      }
      def.addReferenceArtifact({
        type: 'spreadsheet',
        pageId: String(sheetData.sheetId),
        content: grid,
        metadata: { sheetName, bbox },
        taskIndex: def.index,
        documentId: referenceDocumentId,
      });
      // Template artifact: for not-attempted detection we mirror shape (all null / empty) – may extend later.
      const tplGrid = grid.map((row) => row.map(() => null));
      def.addTemplateArtifact({
        type: 'spreadsheet',
        pageId: String(sheetData.sheetId),
        content: tplGrid,
        metadata: { sheetName, bbox, template: true },
        taskIndex: def.index,
        documentId: templateDocumentId,
      });
      defs.push(def);
    }
    return defs;
  }

  /**
   * Extract student submission artifacts by reading only reference formula locations.
   */
  extractSubmissionArtifacts(studentDocumentId, taskDefs) {
    if (!studentDocumentId) return [];
    const spreadsheet = SpreadsheetApp.openById(studentDocumentId);
    const sheets = spreadsheet.getSheets();
    const sheetById = {};
    sheets.forEach((s) => {
      sheetById[String(s.getSheetId())] = s;
    });
    const artifacts = [];
    taskDefs.forEach((def) => {
      const ref = def.getPrimaryReference();
      const bbox =
        (def.taskMetadata && (def.taskMetadata.bbox || def.taskMetadata.boundingBox)) || null;
      const sheet = sheetById[def.pageId];
      if (!sheet || !bbox || !ref) return;
      const taskSheet = new TaskSheet(sheet, 'studentTask');
      let rangeFormulas = [];
      try {
        rangeFormulas = taskSheet.getRange(bbox, 'formulas');
      } catch (e) {
        this.progressTracker?.logError('Failed to read formulas for sheet ' + def.taskTitle, e);
        return;
      }
      // Reconstruct sparse grid like reference for hashing consistency
      const grid = ref.content ? ref.content.map((row) => row.map(() => null)) : [];
      for (let r = 0; r < bbox.numRows; r++) {
        for (let c = 0; c < bbox.numColumns; c++) {
          const formula = rangeFormulas[r] && rangeFormulas[r][c] ? rangeFormulas[r][c] : '';
          if (formula) {
            grid[r][c] = formula; // SpreadsheetTaskArtifact will canonicalise
          }
        }
      }
      artifacts.push({
        taskId: def.getId(),
        pageId: def.pageId,
        documentId: studentDocumentId,
        content: grid,
        metadata: { sheetName: def.taskTitle },
      });
    });
    return artifacts;
  }
}

if (typeof module !== 'undefined') {
  module.exports = { SheetsParser };
}
