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
      // Get formula differences directly
      const formulaDifferences = this.processAndCompareSheets(referenceDocumentId, templateDocumentId);
      const tasks = [];
      
      // Iterate through each sheet/challenge
      for (const sheetName in formulaDifferences) {
        const sheetData = formulaDifferences[sheetName];
        
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
          null                      // templateContentHash is null
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
          // Add sheetId to each taskName entry
          results[taskName] = {
            sheetId: referenceSheet.sheetId,
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
      const extractedTasks = this._extractRawSheetData(referenceDocumentId, templateDocumentId);
      return this.compareFormulae(extractedTasks);
    } catch (error) {
      console.error('Error in processAndCompareSheets:', error);
      this.progressTracker?.logError('Failed to process and compare sheets');
      return {};
    }
  }
}

