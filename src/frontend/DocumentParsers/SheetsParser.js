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
   * Extracts Task instances from a Google Sheets document.
   * @param {string} documentId - The ID of the Google Sheets document.
   * @param {string|null} contentType - Type of content to extract: "reference", "empty", or null for default.
   * @return {Task[]} - An array of Task instances extracted from the sheets.
   */
  extractTasks(documentId, contentType = "reference") {
    return this.extractTasksFromSheets(documentId, contentType);
  }

  /**
   * Extracts Task instances from a Google Sheets document.
   * @param {string} documentId - The ID of the Google Sheets document.
   * @param {string|null} contentType - Type of content to extract: "reference", "empty", or null for default.
   * @return {Task[]} - An array of Task instances extracted from the sheets.
   * @deprecated Use extractTasks() instead
   */
  extractTasksFromSheets(documentId, contentType = "reference") {
    const spreadsheet = SpreadsheetApp.openById(documentId);
    const sheets = spreadsheet.getSheets();
    let tasks = [];

    sheets.forEach((sheet) => {
      // Extract data from the current sheet
      const data = this.getSheetData(sheet);
      
      // Process the data to identify tasks
      const sheetTasks = this.processSheetData(data, sheet.getName(), contentType);
      
      // Add tasks to the collection
      if (sheetTasks && sheetTasks.length) {
        tasks = tasks.concat(sheetTasks);
      }
    });

    return tasks;
  }

  /**
   * Retrieves all data from a sheet.
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The sheet to extract data from.
   * @return {Array<Array<string>>} - 2D array containing the sheet data.
   */
  getSheetData(sheet) {
    const dataRange = sheet.getDataRange();
    return dataRange.getValues();
  }

  /**
   * Processes sheet data to extract tasks.
   * @param {Array<Array<string>>} data - 2D array containing the sheet data.
   * @param {string} sheetName - Name of the sheet being processed.
   * @param {string} contentType - Type of content: "reference", "empty", or null.
   * @return {Task[]} - Array of Task instances extracted from the sheet data.
   */
  processSheetData(data, sheetName, contentType) {
    const tasks = [];
    
    // Find rows with task markers (# for text, ~| for images)
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      // Check if this row contains a task marker
      for (let j = 0; j < row.length; j++) {
        const cell = String(row[j]).trim();
        
        // Process text tasks (marked with #)
        if (cell.startsWith('#')) {
          const key = cell.substring(1).trim();
          const task = this.createTextTask(key, data, i, j, sheetName, contentType);
          if (task) tasks.push(task);
        }
        
        // Process image tasks (marked with ~| or |)
        else if (cell.startsWith('~') || cell.startsWith('|')) {
          const key = cell.substring(1).trim();
          const task = this.createImageTask(key, data, i, j, sheetName, contentType);
          if (task) tasks.push(task);
        }
      }
    }
    
    return tasks;
  }

  /**
   * Creates a text-based task from sheet data.
   * @param {string} key - The task key extracted from the sheet.
   * @param {Array<Array<string>>} data - 2D array containing the sheet data.
   * @param {number} row - Row index of the task marker.
   * @param {number} col - Column index of the task marker.
   * @param {string} sheetName - Name of the sheet.
   * @param {string} contentType - Type of content: "reference", "empty", or null.
   * @return {Task|null} - The Task instance or null if creation fails.
   */
  createTextTask(key, data, row, col, sheetName, contentType) {
    // Assume content is in the next column
    const content = (col + 1 < data[row].length) ? String(data[row][col + 1]) : '';
    
    // Look for notes in the next row (if marked with ^)
    let notes = null;
    if (row + 1 < data.length) {
      const nextRowFirstCell = String(data[row + 1][col]).trim();
      if (nextRowFirstCell.startsWith('^')) {
        notes = (col + 1 < data[row + 1].length) ? String(data[row + 1][col + 1]) : '';
      }
    }
    
    return this.parseTask(key, content, `${sheetName}_${row}_${col}`, "Text", contentType, notes);
  }

  /**
   * Creates an image-based task from sheet data.
   * @param {string} key - The task key extracted from the sheet.
   * @param {Array<Array<string>>} data - 2D array containing the sheet data.
   * @param {number} row - Row index of the task marker.
   * @param {number} col - Column index of the task marker.
   * @param {string} sheetName - Name of the sheet.
   * @param {string} contentType - Type of content: "reference", "empty", or null.
   * @return {Task|null} - The Task instance or null if creation fails.
   */
  createImageTask(key, data, row, col, sheetName, contentType) {
    // Assume image URL is in the next column
    const imageUrl = (col + 1 < data[row].length) ? String(data[row][col + 1]) : '';
    
    // Look for notes in the next row (if marked with ^)
    let notes = null;
    if (row + 1 < data.length) {
      const nextRowFirstCell = String(data[row + 1][col]).trim();
      if (nextRowFirstCell.startsWith('^')) {
        notes = (col + 1 < data[row + 1].length) ? String(data[row + 1][col + 1]) : '';
      }
    }
    
    return this.parseTask(key, imageUrl, `${sheetName}_${row}_${col}`, "Image", contentType, notes);
  }

  /**
   * Parses raw task content to create a Task instance.
   * @param {string} key - The task key extracted from the sheet.
   * @param {string} content - The raw content of the task (string or URL).
   * @param {string} identifier - The unique identifier for the task location.
   * @param {string} taskType - The type of the task: "Text", "Table", "Image".
   * @param {string|null} contentType - Type of content: "reference", "empty", or null for default.
   * @param {string|null} taskNotes - Optional notes for the task.
   * @return {Task|null} - The Task instance or null if parsing fails.
   * @deprecated Use the superclass parseTask() method instead
   */
  parseTask(key, content, identifier, taskType, contentType, taskNotes = null) {
    let taskReference = null;
    let emptyContent = null;
    let contentHash = null;
    let emptyContentHash = null;

    if (contentType === "reference") {
      taskReference = content;
      contentHash = Utils.generateHash(content);
    } else if (contentType === "empty") {
      emptyContent = content;
      emptyContentHash = Utils.generateHash(content);
    } else {
      taskReference = content;
      contentHash = Utils.generateHash(content);
    }

    return new Task(
      key,
      taskType,
      identifier,
      null,            // imageCategory
      taskReference,
      taskNotes,
      emptyContent,
      contentHash,
      emptyContentHash
    );
  }

  /**
   * Converts sheet data to a Markdown-formatted table.
   * @param {Array<Array<string>>} data - 2D array containing the data to convert.
   * @return {string} - The Markdown-formatted table.
   */
  convertToMarkdownTable(data) {
    if (!data || !data.length || !data[0].length) {
      console.log("The provided data is empty or invalid.");
      return '';
    }

    let markdownTable = '';
    
    // Create header row
    markdownTable += '| ' + data[0].join(' | ') + ' |\n';
    
    // Create separator row
    markdownTable += '| ' + data[0].map(() => '---').join(' | ') + ' |\n';
    
    // Create data rows
    for (let i = 1; i < data.length; i++) {
      // Escape pipe characters in Markdown
      const escapedRow = data[i].map(cell => 
        String(cell).replace(/\\/g, '\\\\').replace(/\|/g, '\\|')
      );
      markdownTable += '| ' + escapedRow.join(' | ') + ' |\n';
    }
    
    return markdownTable;
  }

  /**
   * Extracts a specific range of data from a sheet and converts to appropriate format.
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The sheet to extract from.
   * @param {string} rangeNotation - A1 notation of the range to extract.
   * @param {string} format - The output format ("markdown", "csv", "text").
   * @return {string} - The formatted data.
   */
  extractFormattedRange(sheet, rangeNotation, format = "markdown") {
    const range = sheet.getRange(rangeNotation);
    const data = range.getValues();
    
    switch (format.toLowerCase()) {
      case "markdown":
        return this.convertToMarkdownTable(data);
      case "csv":
        return data.map(row => row.join(',')).join('\n');
      case "text":
      default:
        return data.map(row => row.join('\t')).join('\n');
    }
  }
}
