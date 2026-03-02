/**
 * @file TaskSheet.js
 * @description Manages operations for an individual sheet within a Google Sheets document,
 *              specifically for tasks related to assessment. This class extends
 *              BaseSheetManager to inherit common sheet functionalities. It is
 *              responsible for handling a specific sheet, retrieving its name,
 *              accessing its formulae, and integrating with progress tracking.
 *
 * @class TaskSheet
 * @extends BaseSheetManager
 * @property {GoogleAppsScript.Spreadsheet.Sheet} sheet - The underlying Google Sheet object (inherited from BaseSheetManager).
 * @property {string} sheetName - The name of the Google Sheet.
 * @property {string} sheetId - The ID of the Google Sheet.
 * @property {ProgressTracker} progressTracker - An instance of the ProgressTracker singleton for logging progress and errors.
 * @property {Array<Array<string>> | null} formulaArray - A 2D array storing all formulae from the sheet. Null if not yet populated or if an error occurred.
 * @property {string | null} type - The type of the sheet, can be 'reference', 'template', or 'studentTask'. Null if not set or invalid.
 */
class TaskSheet extends BaseSheetManager {
  /**
   * Constructor for TaskSheet.
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The Google Sheet object for this task.
   * @param {string} type - The type of the sheet ('reference', 'template', 'studentTask').
   * @throws {Error} If no sheet object is provided, or if an invalid or no type is provided.
   */
  constructor(sheet, type) {
    if (!sheet || typeof sheet.getName !== 'function') {
      throw new Error('A valid Google Sheet object must be provided to the TaskSheet constructor.');
    }
    super(sheet); // Initializes this.sheet via BaseSheetManager
    this.sheetName = sheet.getName();
    this.sheetId = sheet.getSheetId(); // Add and populate sheetId
    this.progressTracker = ProgressTracker.getInstance();
    this.formulaArray = null; // Initialize formulaArray
    this.type = null; // Initialize type

    if (!type) {
      const noTypeError = `A type must be provided for sheet \"${this.sheetName}\". Valid types are 'reference', 'template', 'studentTask'.`;
      this.progressTracker.logAndThrowError(noTypeError);
    }

    this.setType(type);

    if (!this.type) {
      // Check if setType resulted in a null type (due to invalid input)
      const invalidTypeError = `Invalid type \"${type}\" provided for sheet \"${this.sheetName}\" during construction. Valid types are 'reference', 'template', 'studentTask'.`;
      this.progressTracker.logAndThrowError(invalidTypeError);
    }
  }

  /**
   * Sets the type of the sheet.
   * Valid types are 'reference', 'template', or 'studentTask'.
   * @param {string} type - The type to set for the sheet.
   * @throws {Error} If the provided type is invalid.
   */
  setType(type) {
    const validTypes = ['reference', 'template', 'studentTask'];
    if (validTypes.includes(type)) {
      this.type = type;
    } else {
      const errorMessage = `Invalid sheet type: \"${type}\". Must be one of ${validTypes.join(
        ', '
      )}.`;
      this.progressTracker.logError(errorMessage);
      // Optionally, throw an error to halt execution if an invalid type is critical
      // this.progressTracker.logAndThrowError(errorMessage);
      // Or set to null / default if preferred
      this.type = null;
    }
  }

  /**
   * Gets the type of the sheet.
   * @returns {string | null} The type of the sheet, or null if not set or invalid.
   */
  getType() {
    return this.type;
  }

  /**
   * Retrieves all formulae from the sheet and populates the formulaArray attribute.
   * NOTE (Phase 5 Refactor): This helper must only return primitive arrays (strings/numbers/null) and MUST NOT
   * perform hashing or formula canonicalisation. Canonicalisation & hashing are handled inside SpreadsheetTaskArtifact.
   * @returns {Array<Array<string>>} A 2D array of formulae from the sheet.
   *                                 Cells without formulae will be represented by empty strings.
   */
  getAllFormulae() {
    try {
      if (!this.sheet) {
        const noSheetError = `Sheet object is not available for sheet \"${
          this.sheetName || 'Unknown Sheet'
        }\".`;
        this.progressTracker.logAndThrowError(noSheetError);
      }
      const formulae = this.sheet.getDataRange().getFormulas();
      this.formulaArray = formulae; // Populate the attribute
      return formulae;
    } catch (e) {
      const errorMessage = `Error retrieving formulae from sheet \"${this.sheetName}\": ${e.message}`;
      this.progressTracker.logError(errorMessage, e);
      this.formulaArray = null; // Ensure formulaArray is reset or cleared on error
      return [];
    }
  }

  /**
   * Retrieves data from a specific range in the sheet.
   * @param {string|object} range - The range to fetch, either as A1 notation string (e.g., "A1:B5")
   *                                or as {startRow, startColumn, numRows, numColumns} object.
   * @param {string} valueType - Type of data to return: 'values', 'formulas', or 'displayValues'. Defaults to 'values'.
   * @returns {Array<Array<any>>} A 2D array of values from the specified range.
   * @throws {Error} If an invalid range or valueType is provided or if an error occurs.
   */
  getRange(range, valueType = 'values') {
    try {
      if (!this.sheet) {
        const noSheetError = `Sheet object is not available for sheet \"${
          this.sheetName || 'Unknown Sheet'
        }\".`;
        this.progressTracker.logAndThrowError(noSheetError);
      }

      // Determine the range to fetch
      let sheetRange;
      if (Validate.isString(range)) {
        // A1 notation, e.g., "A1:B5"
        sheetRange = this.sheet.getRange(range);
      } else if (
        typeof range === 'object' &&
        'startRow' in range &&
        'startColumn' in range &&
        'numRows' in range &&
        'numColumns' in range
      ) {
        // Object notation, e.g., {startRow: 1, startColumn: 1, numRows: 5, numColumns: 2}
        sheetRange = this.sheet.getRange(
          range.startRow,
          range.startColumn,
          range.numRows,
          range.numColumns
        );
      } else {
        const invalidRangeError =
          'Invalid range specification. Use A1 notation or {startRow, startColumn, numRows, numColumns} object.';
        this.progressTracker.logError(
          invalidRangeError,
          `Dev Info: ${invalidRangeError} (getRange for sheet "${this.sheetName}")`
        );
        throw new Error(invalidRangeError);
      }

      // Get the requested data type
      switch (valueType.toLowerCase()) {
        case 'values':
          return sheetRange.getValues();
        case 'formulas':
          return sheetRange.getFormulas();
        case 'displayvalues':
          return sheetRange.getDisplayValues();
        default:
          const invalidTypeError = `Invalid valueType: "${valueType}". Must be 'values', 'formulas', or 'displayValues'.`;
          this.progressTracker.logError(
            invalidTypeError,
            `Dev Info: ${invalidTypeError} (getRange for sheet "${this.sheetName}")`
          );
          throw new Error(invalidTypeError);
      }
    } catch (e) {
      const errorMessage = `Error retrieving range from sheet "${this.sheetName}": ${e.message}`;
      this.progressTracker.logError(
        errorMessage,
        `Dev Info: ${errorMessage}\nStack: ${e.stack} (getRange)`
      );
      throw e;
    }
  }
}
