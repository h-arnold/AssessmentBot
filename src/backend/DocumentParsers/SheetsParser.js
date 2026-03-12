const WRAPPED_FORMULA_MIN_LENGTH = 2;
const BOUNDING_BOX_EMPTY_INDEX = -1;
const STRIP_TRAILING_QUOTE_SLICE_INDEX = -1;

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

    const preparedFormula = this._unwrapWrappedFormula(formula);
    let result = '';
    let inQuotes = false;
    let index = 0;

    while (index < preparedFormula.length) {
      const char = preparedFormula.charAt(index);

      if (char === '"') {
        if (inQuotes && preparedFormula.charAt(index + 1) === '"') {
          result += '""';
          index += WRAPPED_FORMULA_MIN_LENGTH;
          continue;
        }
        inQuotes = !inQuotes;
        result += char;
        index++;
        continue;
      }

      if (inQuotes) {
        result += char;
      } else if (char !== ' ') {
        result += char.toUpperCase();
      }

      index++;
    }

    return result;
  }

  /**
   * Removes wrapped formula quotes returned by GAS and unescapes doubled quotes.
   * @param {string} formula
   * @return {string}
   * @private
   */
  _unwrapWrappedFormula(formula) {
    const isWrappedFormula =
      formula.length >= WRAPPED_FORMULA_MIN_LENGTH &&
      formula.startsWith('"') &&
      formula.endsWith('"');

    if (!isWrappedFormula) {
      return formula;
    }

    try {
      const withoutWrapper = formula.slice(1, STRIP_TRAILING_QUOTE_SLICE_INDEX);
      return withoutWrapper.replaceAll('""', '"');
    } catch (error) {
      this.progressTracker.captureError(error, 'Error preprocessing formula');
      return formula;
    }
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
    for (const [row, element] of referenceArray.entries()) {
      const referenceRow = element || [];
      // Template row might not exist if template has fewer rows
      const temporaryRow = row < templateArray.length ? templateArray[row] : [];

      for (const [col, element] of referenceRow.entries()) {
        const referenceFormula = element || '';
        // Template cell might not exist if template row is shorter
        const temporaryFormula = temporaryRow[col] || '';

        // Check if there's a non-empty reference formula and it doesn't match the template
        if (referenceFormula && referenceFormula !== temporaryFormula) {
          // Normalise the formulae that are going to make it into the reference tasks.

          const normalisedReferenceFormula = this._normaliseFormulaCase(referenceFormula);
          referenceFormulaeArray.push({
            referenceFormula: normalisedReferenceFormula,
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
    let endRow = BOUNDING_BOX_EMPTY_INDEX;
    let endColumn = BOUNDING_BOX_EMPTY_INDEX;

    // Find minimum and maximum row/column indices
    differences.forEach((diff) => {
      const [row, col] = diff.location;
      startRow = Math.min(startRow, row);
      startColumn = Math.min(startColumn, col);
      endRow = Math.max(endRow, row);
      endColumn = Math.max(endColumn, col);
    });

    // Calculate dimensions
    const numberRows = endRow - startRow + 1;
    const numberColumns = endColumn - startColumn + 1;

    return {
      startRow: startRow + 1, // Add 1 to convert from 0-based to 1-based indexing (for Sheets API)
      startColumn: startColumn + 1,
      endRow: endRow + 1,
      endColumn: endColumn + 1,
      numRows: numberRows,
      numColumns: numberColumns,
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
      const definition = new TaskDefinition({
        taskTitle: sheetName,
        pageId: String(sheetData.sheetId),
        taskMetadata,
      });
      definition.index = index++;
      // Add primary reference SpreadsheetTaskArtifact: represent reference formulas as 2D array skeleton with normalised formulas
      // We convert differences list into a sparse array (leave nulls) sized to bbox dims
      const bbox = sheetData.boundingBox;
      let grid = [];
      if (bbox) {
        grid = Array.from({ length: bbox.numRows }, () =>
          Array.from({ length: bbox.numColumns }).fill(null)
        );
        sheetData.formulas.forEach((f) => {
          const [absR, absC] = f.location;
          const relativeRowIndex = absR - (bbox.startRow - 1);
          const relativeColumnIndex = absC - (bbox.startColumn - 1);
          if (
            relativeRowIndex >= 0 &&
            relativeRowIndex < bbox.numRows &&
            relativeColumnIndex >= 0 &&
            relativeColumnIndex < bbox.numColumns
          ) {
            grid[relativeRowIndex][relativeColumnIndex] = f.referenceFormula || f.formula || '';
          }
        });
      }
      definition.addReferenceArtifact({
        type: 'spreadsheet',
        pageId: String(sheetData.sheetId),
        content: grid,
        metadata: { sheetName, bbox },
        taskIndex: definition.index,
        documentId: referenceDocumentId,
      });
      // Template artifact: for not-attempted detection we mirror shape (all null / empty) – may extend later.
      const tplGrid = grid.map((row) => row.map(() => null));
      definition.addTemplateArtifact({
        type: 'spreadsheet',
        pageId: String(sheetData.sheetId),
        content: tplGrid,
        metadata: { sheetName, bbox, template: true },
        taskIndex: definition.index,
        documentId: templateDocumentId,
      });
      defs.push(definition);
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
    taskDefs.forEach((definition) => {
      const reference = definition.getPrimaryReference();
      const bbox =
        (definition.taskMetadata &&
          (definition.taskMetadata.bbox || definition.taskMetadata.boundingBox)) ||
        null;
      const sheet = sheetById[definition.pageId];
      if (!sheet || !bbox || !reference) return;
      const taskSheet = new TaskSheet(sheet, 'studentTask');
      let rangeFormulas = [];
      try {
        rangeFormulas = taskSheet.getRange(bbox, 'formulas');
      } catch (error) {
        this.progressTracker?.logError(
          'Failed to read formulas for sheet ' + definition.taskTitle,
          error
        );
        return;
      }
      // Reconstruct sparse grid like reference for hashing consistency
      const grid = reference.content ? reference.content.map((row) => row.map(() => null)) : [];
      for (let r = 0; r < bbox.numRows; r++) {
        for (let c = 0; c < bbox.numColumns; c++) {
          const formula = rangeFormulas[r] && rangeFormulas[r][c] ? rangeFormulas[r][c] : '';
          if (formula) {
            grid[r][c] = formula; // SpreadsheetTaskArtifact will canonicalise
          }
        }
      }
      artifacts.push({
        taskId: definition.getId(),
        pageId: definition.pageId,
        documentId: studentDocumentId,
        content: grid,
        metadata: { sheetName: definition.taskTitle },
      });
    });
    return artifacts;
  }
}

if (typeof module !== 'undefined') {
  module.exports = { SheetsParser };
}
