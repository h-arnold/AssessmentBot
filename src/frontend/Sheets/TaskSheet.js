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
      const noTypeError = `A type must be provided for sheet "${this.sheetName}". Valid types are 'reference', 'template', 'studentTask'.`;
      this.progressTracker.logError(noTypeError);
      console.error(`Dev Info: ${noTypeError} (constructor for sheet "${this.sheetName}")`);
      throw new Error(noTypeError);
    }
    
    this.setType(type);

    if (!this.type) { // Check if setType resulted in a null type (due to invalid input)
      const invalidTypeError = `Invalid type "${type}" provided for sheet "${this.sheetName}" during construction. Valid types are 'reference', 'template', 'studentTask'.`;
      // setType already logs an error, so we might not need to log again, but throwing is important.
      console.error(`Dev Info: ${invalidTypeError} (constructor for sheet "${this.sheetName}")`);
      throw new Error(invalidTypeError);
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
      const errorMessage = `Invalid sheet type: "${type}". Must be one of ${validTypes.join(', ')}.`;
      this.progressTracker.logError(errorMessage);
      console.error(`Dev Info: ${errorMessage} (setType for sheet "${this.sheetName}")`);
      // Optionally, throw an error to halt execution if an invalid type is critical
      // throw new Error(errorMessage);
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
   * @returns {Array<Array<string>>} A 2D array of formulae from the sheet.
   *                                 Cells without formulae will be represented by empty strings.
   */
  getAllFormulae() {
    try {
      if (!this.sheet) {
        const noSheetError = `Sheet object is not available for sheet "${this.sheetName || 'Unknown Sheet'}".`;
        this.progressTracker.logError(noSheetError);
        console.error(`Dev Info: ${noSheetError} (getAllFormulae)`);
        throw new Error(noSheetError);
      }
      const formulae = this.sheet.getDataRange().getFormulas();
      this.formulaArray = formulae; // Populate the attribute
      return formulae;
    } catch (e) {
      const errorMessage = `Error retrieving formulae from sheet "${this.sheetName}": ${e.message}`;
      this.progressTracker.logError(errorMessage);
      console.error(`Dev Info: ${errorMessage}\nStack: ${e.stack} (getAllFormulae)`);
      // Depending on requirements, you might re-throw, return an empty array, or handle differently.
      this.formulaArray = null; // Ensure formulaArray is reset or cleared on error
      throw e; // Re-throwing for now, as the caller might need to know about the failure.
    }
  }
}