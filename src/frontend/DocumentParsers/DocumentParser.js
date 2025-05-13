/**
 * DocumentParser Class
 * 
 * Base class for all document parser implementations.
 * Provides common functionality for extracting and processing content from Google documents.
 */
class DocumentParser {
  /**
   * Constructs a DocumentParser instance.
   */
  constructor() {
    // Base initialization
  }

  /**
   * Parses raw task content to create a Task instance.
   * @param {string} key - The task key extracted from the document.
   * @param {string} content - The raw content of the task (string or URL).
   * @param {string} identifier - The unique identifier for the task location.
   * @param {string} taskType - The type of the task: "Text", "Table", "Image".
   * @param {string|null} contentType - Type of content: "reference", "empty", or null for default.
   * @param {string|null} taskNotes - Optional notes for the task.
   * @return {Task|null} - The Task instance or null if parsing fails.
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
   * Extracts Task instances from a Google document.
   * This is an abstract method that must be implemented by subclasses.
   * @param {string} documentId - The ID of the Google document.
   * @param {string|null} contentType - Type of content to extract: "reference", "empty", or null for default.
   * @return {Task[]} - An array of Task instances extracted from the document.
   */
  extractTasks(documentId, contentType = "reference") {
    throw new Error("Method 'extractTasks' must be implemented by subclasses");
  }

  /**
   * Converts a table to a Markdown-formatted string.
   * @param {Array<Array<string>>} tableData - 2D array containing the table data.
   * @return {string} - The Markdown-formatted table.
   */
  convertToMarkdownTable(tableData) {
    if (!tableData || !tableData.length || !tableData[0].length) {
      console.log("The provided data is empty or invalid.");
      return '';
    }

    let markdownTable = '';
    
    // Create header row
    markdownTable += '| ' + tableData[0].join(' | ') + ' |\n';
    
    // Create separator row
    markdownTable += '| ' + tableData[0].map(() => '---').join(' | ') + ' |\n';
    
    // Create data rows
    for (let i = 1; i < tableData.length; i++) {
      // Escape pipe characters in Markdown
      const escapedRow = tableData[i].map(cell => 
        String(cell).replace(/\\/g, '\\\\').replace(/\|/g, '\\|')
      );
      markdownTable += '| ' + escapedRow.join(' | ') + ' |\n';
    }
    
    return markdownTable;
  }
}
