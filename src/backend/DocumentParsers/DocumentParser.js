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
   * @param {string} referenceDocumentId - The ID of the reference document.
   * @param {string=} templateDocumentId - Optional ID of the template document.
   * @returns {TaskDefinition[]} Ordered task definitions extracted from reference and template documents.
   */
  extractTaskDefinitions(referenceDocumentId, templateDocumentId) {
    throw new Error("Method 'extractTaskDefinitions' must be implemented by subclass");
  }

  /**
   * Phase 2 abstract: extract primitive submission artifact records (no hashing) for a student document.
   * @param {string} documentId - The ID of the student submission document.
   * @param {TaskDefinition[]} taskDefinitions - Definitions of tasks to extract.
   * @returns {Array<{taskId:string,pageId:string|null,content:any,metadata:Object,documentId:string,type:string}>} Submission artefacts indexed by task ID.
   */
  extractSubmissionArtifacts(documentId, taskDefinitions) {
    throw new Error("Method 'extractSubmissionArtifacts' must be implemented by subclass");
  }

  /**
   * Converts a table to a Markdown-formatted string.
   * Malformed input (a non-array container, an empty table, a non-array or
   * empty first row, or any non-array row) returns an empty string after the
   * existing warning.
   * @param {Array<Array<string>>} tableData - 2D array containing the table data.
   * @returns {string} The Markdown-formatted table.
   */
  convertToMarkdownTable(tableData) {
    // Preserve exact historic diagnostics: a truthy tableData with a null length
    // must still report rowCount null, so only fall back to zero when the
    // container itself is missing. Optional chaining keeps the Sonar S6582
    // improvement without coercing valid falsy lengths via nullish coalescing.
    const rowCount = tableData ? tableData?.length : 0;
    const columnCount = tableData?.[0] ? tableData?.[0]?.length : 0;

    if (!this._isConvertibleTable(tableData)) {
      ABLogger.getInstance().warn('The provided data is empty or invalid.', {
        workflow: 'DocumentParser.convertToMarkdownTable',
        rowCount,
        columnCount,
      });
      return '';
    }

    let markdownTable = '';

    // Create header row (escaped consistently with data rows so pipes cannot corrupt columns)
    const escapedHeader = tableData[0].map((cell) =>
      String(cell)
        .replaceAll('\\', '\\\\')
        .replaceAll('|', String.raw`\|`)
    );
    markdownTable += '| ' + escapedHeader.join(' | ') + ' |\n';

    // Create separator row
    markdownTable += '| ' + tableData[0].map(() => '---').join(' | ') + ' |\n';

    // Create data rows
    for (let index = 1; index < tableData.length; index++) {
      // Escape pipe characters in Markdown
      const escapedRow = tableData[index].map((cell) =>
        String(cell)
          .replaceAll('\\', '\\\\')
          .replaceAll('|', String.raw`\|`)
      );
      markdownTable += '| ' + escapedRow.join(' | ') + ' |\n';
    }

    return markdownTable;
  }

  /**
   * True when the value is a non-empty 2D array: every entry is an array and
   * the first row has at least one cell.
   * @private
   * @param {*} tableData - Candidate table data.
   * @returns {boolean} True when the value can be converted to Markdown.
   */
  _isConvertibleTable(tableData) {
    if (!Array.isArray(tableData) || tableData.length === 0) return false;
    for (const tableDatum of tableData) {
      if (!Array.isArray(tableDatum)) return false;
    }
    return tableData[0].length > 0;
  }
}

// Export for Node/test environments
if (typeof module !== 'undefined') {
  module.exports = { DocumentParser };
}
