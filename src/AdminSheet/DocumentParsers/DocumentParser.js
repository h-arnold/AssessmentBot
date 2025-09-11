/**
 * DocumentParser Class
 * 
 * Base class for all document parser implementations.
 * Provides common functionality for extracting and processing content from Google documents.
 */
class DocumentParser {
  /**
   * Base constructor is abstract – prevent direct instantiation in Phase 2 refactor.
   */
  constructor() {
    if (new.target === DocumentParser) {
      throw new Error('DocumentParser is abstract and cannot be instantiated directly');
    }
    // ProgressTracker may not exist in pure test environment; guard.
    if (typeof ProgressTracker !== 'undefined' && ProgressTracker.getInstance) {
      this.progressTracker = ProgressTracker.getInstance();
    }
  }

  /**
   * Parses raw task content to create a Task instance.
   * @param {string} key - The task key extracted from the document.
   * @param {string} content - The raw content of the task (string or URL).
   * @param {string} identifier - The unique identifier for the task location.
   * @param {string} taskType - The type of the task: "Text", "Table", "Image".
   * @param {string|null} contentType - Type of content: "reference", "template", or null for default.
   * @param {string|null} taskNotes - Optional notes for the task.
   * @return {Task|null} - The Task instance or null if parsing fails.
   */
  // DEPRECATED: legacy parseTask retained temporarily for migration. Will be removed after Phase 3.
  parseTask(key, content, identifier, taskType, contentType, taskNotes = null) {
    let taskReference = null;
    let templateContent = null;
    let contentHash = null;
    let templateContentHash = null;

    if (contentType === "reference") {
      taskReference = content;
      contentHash = Utils.generateHash(content);
    } else if (contentType === "template") {
      templateContent = content;
      templateContentHash = Utils.generateHash(content);
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
      templateContent,
      contentHash,
      templateContentHash
    );
  }

  /**
   * Extracts Task instances from a Google document.
   * This is an abstract method that must be implemented by subclasses.
   * @param {string} documentId - The ID of the Google document.
   * @param {string|null} contentType - Type of content to extract: "reference", "template", or null for default.
   * @return {Task[]} - An array of Task instances extracted from the document.
   */
  extractTasks(documentId, contentType = "reference") { // legacy abstract method
    throw new Error("Method 'extractTasks' is deprecated – use extractTaskDefinitions / extractSubmissionArtifacts");
  }

  /**
   * Phase 2 abstract: extract ordered TaskDefinitions from reference/template docs.
   * @param {string} referenceDocumentId
   * @param {string=} templateDocumentId
   * @return {TaskDefinition[]}
   */
  extractTaskDefinitions(referenceDocumentId, templateDocumentId) { // eslint-disable-line no-unused-vars
    throw new Error("Method 'extractTaskDefinitions' must be implemented by subclass");
  }

  /**
   * Phase 2 abstract: extract primitive submission artifact records (no hashing) for a student document.
   * @param {string} documentId
   * @param {TaskDefinition[]} taskDefinitions
   * @return {Array<{taskId:string,pageId?:string,content:any,metadata?:Object}>}
   */
  extractSubmissionArtifacts(documentId, taskDefinitions) { // eslint-disable-line no-unused-vars
    throw new Error("Method 'extractSubmissionArtifacts' must be implemented by subclass");
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

// Export for Node/test environments
if (typeof module !== 'undefined') {
  module.exports = { DocumentParser };
}
