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

  // Legacy parseTask/extractTasks removed – subclasses must implement Phase 2 API only.

  /**
   * Phase 2 abstract: extract ordered TaskDefinitions from reference/template docs.
   * @param {string} referenceDocumentId
   * @param {string=} templateDocumentId
   * @return {TaskDefinition[]}
   */
  extractTaskDefinitions(referenceDocumentId, templateDocumentId) {
    throw new Error("The method 'extractTaskDefinitions' must be implemented by a subclass.");
  }

  /**
   * Phase 2 abstract: extract primitive submission artifact records (no hashing) for a student document.
   * @param {string} documentId
   * @param {TaskDefinition[]} taskDefinitions
   * @return {Array<{taskId:string,pageId?:string,content:any,metadata?:Object}>}
   */
  extractSubmissionArtifacts(documentId, taskDefinitions) {
    throw new Error(
      'DocumentParser.extractSubmissionArtifacts() is abstract and must be implemented by subclass'
    );
  }

  /**
   * Converts a table to a Markdown-formatted string.
   * @param {Array<Array<string>>} tableData - 2D array containing the table data.
   * @return {string} - The Markdown-formatted table.
   */
  convertToMarkdownTable(tableData) {
    if (!tableData || !tableData.length || !tableData[0].length) {
      ABLogger.getInstance().warn('The provided data is empty or invalid.');
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
      const escapedRow = tableData[i].map((cell) =>
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
