/**
 * AssignmentDefinitionController — Facade
 *
 * Thin facade delegating to focused sub-classes for persistence,
 * upsert orchestration, reference data resolution, task parsing,
 * task weighting, response mapping, and validation.
 *
 * Public API contract is preserved from the original monolithic class.
 */
/* global DbManager, ProgressTracker */
/* global AssignmentDefinitionValidation, AssignmentDefinitionReferenceData */
/* global AssignmentDefinitionTaskParser, AssignmentDefinitionTaskWeighting, AssignmentDefinitionPersistence */
/* global AssignmentDefinitionUpsertOrchestrator, AssignmentDefinitionResponseMapper */

/**
 * Controller for assignment-definition lifecycle operations.
 *
 * Delegates to seven focused sub-classes injected at construction time.
 * @class
 */
class AssignmentDefinitionController {
  /**
   * Creates the controller with all sub-class dependencies wired up.
   */
  constructor() {
    const databaseManager = DbManager.getInstance();
    const progressTracker = ProgressTracker.getInstance();
    const cache = new Map();

    this._validation = new AssignmentDefinitionValidation();
    this._referenceData = new AssignmentDefinitionReferenceData();
    this._taskParser = new AssignmentDefinitionTaskParser({ progressTracker });
    this._taskWeighting = new AssignmentDefinitionTaskWeighting({ validation: this._validation });
    this._persistence = new AssignmentDefinitionPersistence({
      dbManager: databaseManager,
      cache,
      validation: this._validation,
    });
    this._upsertOrchestrator = new AssignmentDefinitionUpsertOrchestrator({
      dbManager: databaseManager,
      persistence: this._persistence,
      taskParser: this._taskParser,
      taskWeighting: this._taskWeighting,
      referenceData: this._referenceData,
      validation: this._validation,
    });
    this._responseMapper = new AssignmentDefinitionResponseMapper({
      referenceData: this._referenceData,
      validation: this._validation,
    });
  }

  /**
   * Creates or updates a full assignment definition and synchronised registry partial.
   *
   * @param {Object} payload - Upsert payload with required and optional fields.
   * @returns {Object} Canonical full-definition response shape.
   */
  upsertDefinition(payload) {
    return this._upsertOrchestrator.upsert(payload);
  }
  /**
   * Reads one full assignment definition by key.
   *
   * @param {string} key - The definition key to look up.
   * @param {Object} [options] - Optional lookup options.
   * @returns {Object|null} Full definition or null if not found.
   */
  getDefinitionByKey(key, options) {
    return this._persistence.getByKey(key, options);
  }
  /**
   * Returns all assignment-definition registry partials.
   *
   * @returns {Array<Object>} Array of partial definition rows.
   */
  getAllPartialDefinitions() {
    return this._persistence.getAllPartials();
  }
  /**
   * Deletes one assignment definition by key from both stores.
   *
   * @param {string} key - The definition key to delete.
   * @returns {Object} Delete result with boolean flags.
   */
  deleteDefinitionByKey(key) {
    return this._persistence.delete(key);
  }
  /**
   * Maps a stored definition into the canonical full-definition response shape.
   *
   * @param {Object} definition - The stored full definition.
   * @returns {Object} Canonical full-definition response.
   */
  toCanonicalFullDefinitionResponse(definition) {
    return this._responseMapper.getFull(definition);
  }
}

// Export for Node tests / CommonJS environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AssignmentDefinitionController;
}
