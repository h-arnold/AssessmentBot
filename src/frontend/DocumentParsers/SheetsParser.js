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
   */
  _extractFormulaeFromTaskSheets(documentId, type) {
    const tasks = {};
    if (!documentId) return tasks;
    const spreadsheet = SpreadsheetApp.openById(documentId);
    const sheets = spreadsheet.getSheets();
    for (let i = 0; i < sheets.length; i++) {
      const sheet = sheets[i];
      const taskSheet = new TaskSheet(sheet, type);
      if (typeof taskSheet.getAllFormulae === 'function') {
        taskSheet.getAllFormulae();
      }
      const taskName = taskSheet.sheetName;
      tasks[taskName] = taskSheet;
    }
    return tasks;
  }
  
  /**
   * Extracts tasks from Google Sheets documents.
   * 
   * @param {string} referenceDocumentId - The ID of the reference document
   * @param {string} templateDocumentId - An array of template document IDs
   * @return {Object} An object containing referenceTasks and templateTasks
   */
  extractTasksFromSheet(referenceDocumentId, templateDocumentId) {
    try {
      const referenceTasks = this._extractFormulaeFromTaskSheets(referenceDocumentId, 'reference');
      const templateTasks = this._extractFormulaeFromTaskSheets(templateDocumentId, 'template');
      return { referenceTasks, templateTasks };
    } catch (error) {
      console.error('Error in extractTasksFromSheet:', error);
      this.progressTracker?.logError('Failed to extract tasks from sheets');
      return { referenceTasks: {}, templateTasks: {} };
    }
  }
  
  /**
   * Compares formulae between reference and template sheets.
   * Identifies where formulae don't match between corresponding sheets.
   * 
   * @param {Object} taskData - Object containing referenceTasks and templateTasks
   * @return {Object} Object with differences organised by taskName
   */
  compareFormulae(taskData) {
    try {
      const { referenceTasks, templateTasks } = taskData;
      const results = {};
      
      // Iterate through each key in referenceTasks
      for (const taskName in referenceTasks) {
        // Skip if this sheet doesn't exist in templateTasks
        if (!templateTasks[taskName]) continue;
        
        const referenceSheet = referenceTasks[taskName];
        const templateSheet = templateTasks[taskName];
        
        // Skip if formula arrays aren't available
        if (!referenceSheet.formulaArray || !templateSheet.formulaArray) continue;
        
        // Compare formula arrays and store differences
        const differences = this._compareFormulaArrays(
          referenceSheet.formulaArray,
          templateSheet.formulaArray,
          taskName
        );
        
        if (differences.length > 0) {
          // Create a nested structure with formulas inside each taskName
          results[taskName] = {
            formulas: differences
          };
        }
      }
      
      return results;
    } catch (error) {
      console.error('Error in compareFormulae:', error);
      this.progressTracker?.logError('Failed to compare formulae between sheets');
      return {};
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
  _compareFormulaArrays(referenceArray, templateArray, taskName) {
    const differences = [];
    
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
          differences.push({
            referenceFormula: refFormula,
            location: [row, col]
          });
        }
      }
    }
    
    return differences;
  }
  
  /**
   * Processes extracted tasks and compares formulae between reference and template sheets.
   * 
   * @param {string} referenceDocumentId - The ID of the reference document
   * @param {string} templateDocumentId - The ID of the template document
   * @return {Object} Object containing formulae differences by sheet name
   */
  processAndCompareSheets(referenceDocumentId, templateDocumentId) {
    try {
      const extractedTasks = this.extractTasksFromSheet(referenceDocumentId, templateDocumentId);
      return this.compareFormulae(extractedTasks);
    } catch (error) {
      console.error('Error in processAndCompareSheets:', error);
      this.progressTracker?.logError('Failed to process and compare sheets');
      return {};
    }
  }
}

