/**
 * AssignmentAssessmentBase — Abstract assessment base sub-class
 *
 * Owns fetchSubmittedDocuments(), populateTasks(), processAllSubmissions(),
 * _requireImplementation(), getTasks(), setTasks(), getDocumentType(),
 * getReferenceDocumentId(), and getTemplateDocumentId().
 *
 * Operates on the parent Assignment instance's assignmentDefinition via this._assignment.
 * @class
 */
class AssignmentAssessmentBase {
  /**
   * Constructor.
   * @param {import('./index.js')} assignment - The parent Assignment instance.
   */
  constructor(assignment) {
    /** @type {import('./index.js')} */
    this._assignment = assignment;
  }

  /**
   * Fetches and assigns submitted documents for each student.
   * This is a base method that should be implemented by subclasses.
   * @returns {void}
   */
  fetchSubmittedDocuments() {
    this._requireImplementation('fetchSubmittedDocuments');
  }

  /**
   * Populates tasks from reference documents.
   * This is a base method that should be implemented by subclasses.
   * @returns {void}
   */
  populateTasks() {
    this._requireImplementation('populateTasks');
  }

  /**
   * Processes all student submissions by extracting responses.
   * This is a base method that should be implemented by subclasses.
   * @returns {void}
   */
  processAllSubmissions() {
    this._requireImplementation('processAllSubmissions');
  }

  /**
   * Small helper used by base-class methods that must be implemented by subclasses.
   * Centralising the throw here reduces the duplicated error message logic across
   * multiple tiny abstract-style methods.
   * @param {string} methodName - Name of the method that should be implemented
   */
  _requireImplementation(methodName) {
    throw new Error(`${methodName} must be implemented by subclasses`);
  }

  /**
   * Gets the tasks object from the assignment definition.
   * @returns {Object|null} Task definitions keyed by task ID, or null if not set.
   */
  getTasks() {
    return this._assignment.assignmentDefinition?.tasks ?? null;
  }

  /**
   * Sets the tasks object in the assignment definition.
   * @param {Object} tasks - Task definitions keyed by task ID.
   * @returns {Object} The assigned tasks object.
   */
  setTasks(tasks) {
    this._assignment.assignmentDefinition.tasks = tasks;
    return tasks;
  }

  /**
   * Gets the document type from the assignment definition.
   * @returns {string|null} The document type (e.g., 'SLIDES', 'SHEETS'), or null if not set.
   */
  getDocumentType() {
    return this._assignment.assignmentDefinition?.documentType ?? null;
  }

  /**
   * Gets the reference document ID from the assignment definition.
   * @returns {string|null} The reference document ID, or null if not set.
   */
  getReferenceDocumentId() {
    return this._assignment.assignmentDefinition?.referenceDocumentId ?? null;
  }

  /**
   * Gets the template document ID from the assignment definition.
   * @returns {string|null} The template document ID, or null if not set.
   */
  getTemplateDocumentId() {
    return this._assignment.assignmentDefinition?.templateDocumentId ?? null;
  }
}

// Export for Node/Vitest environment (ignored in GAS runtime)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AssignmentAssessmentBase;
}
