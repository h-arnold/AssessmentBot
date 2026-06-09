/**
 * AssignmentDefinitionTaskParser
 *
 * Parses task definitions from Google Slides and Sheets documents.
 * Dispatches to type-specific parsers based on document type.
 */
class AssignmentDefinitionTaskParser {
  /**
   * Creates the instance with injected dependencies.
   * @param {Object} deps - Dependency injection.
   * @param {Object} deps.progressTracker - Progress tracker instance.
   */
  constructor({ progressTracker } = {}) {
    this.progressTracker = progressTracker;
  }

  /**
   * Parses task definitions from reference and template documents.
   * Dispatches to type-specific parsers based on document type.
   *
   * @param {Object} params - Destructured parameters.
   * @param {string} params.documentType - Document type ('SLIDES' or 'SHEETS').
   * @param {string} params.referenceDocumentId - Reference document Google ID.
   * @param {string} params.templateDocumentId - Template document Google ID.
   * @returns {Object} Task definitions map with task ID as key.
   * @throws {Error} If document type is unknown or parsing fails.
   */
  parseTasks({ documentType, referenceDocumentId, templateDocumentId }) {
    const type = documentType.toUpperCase();
    /* global SlidesParser, SheetsParser, TaskDefinition */
    if (type === 'SLIDES') {
      return this._parseSlidesTasks(referenceDocumentId, templateDocumentId);
    }
    if (type === 'SHEETS') {
      return this._parseSheetsTasks(referenceDocumentId, templateDocumentId);
    }
    this.progressTracker.logAndThrowError(
      `Unknown documentType '${documentType}' when parsing tasks.`
    );
  }

  /**
   * Parses task definitions from Google Slides documents.
   * Validates each task definition and logs errors for invalid tasks.
   *
   * @param {string} referenceDocumentId - Reference slides Google ID.
   * @param {string} templateDocumentId - Template slides Google ID.
   * @returns {Object} Map of valid task definitions indexed by task ID.
   * @private
   */
  _parseSlidesTasks(referenceDocumentId, templateDocumentId) {
    /* global SlidesParser, ABLogger, TaskDefinition */
    const parser = new SlidesParser();
    const definitions = parser.extractTaskDefinitions(referenceDocumentId, templateDocumentId);
    const validDefs = [];

    definitions.forEach((definition) => {
      const validation = definition.validate();
      if (!validation.ok) {
        this.progressTracker.logError('TaskDefinition missing required slide artifacts.', {
          taskId: definition.getId(),
          errors: validation.errors,
        });
        return;
      }
      validDefs.push(definition);
    });

    ABLogger.getInstance().info('Parsed slide task definitions', {
      parsed: definitions.length,
      valid: validDefs.length,
    });

    return Object.fromEntries(
      validDefs.map((td) => [td.getId(), TaskDefinition.fromJSON(td.toJSON())])
    );
  }

  /**
   * Parses task definitions from Google Sheets documents.
   * Validates each task definition and logs errors for invalid tasks.
   *
   * @param {string} referenceDocumentId - Reference spreadsheet Google ID.
   * @param {string} templateDocumentId - Template spreadsheet Google ID.
   * @returns {Object} Map of valid task definitions indexed by task ID.
   * @private
   */
  _parseSheetsTasks(referenceDocumentId, templateDocumentId) {
    /* global SheetsParser, ABLogger, TaskDefinition */
    const parser = new SheetsParser();
    const definitions = parser.extractTaskDefinitions(referenceDocumentId, templateDocumentId);
    ABLogger.getInstance().info('Parsed sheet task definitions', { parsed: definitions.length });
    return Object.fromEntries(
      definitions.map((td) => [td.getId(), TaskDefinition.fromJSON(td.toJSON())])
    );
  }
}

// Export for Node tests / CommonJS environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AssignmentDefinitionTaskParser;
}
