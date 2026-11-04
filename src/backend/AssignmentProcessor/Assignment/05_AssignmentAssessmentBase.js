/**
 * AssignmentAssessmentBase — Abstract assessment base sub-class
 *
 * Owns fetchSubmittedDocuments(), populateTasks(), processAllSubmissions(),
 * _applyExtractedArtifacts(), _requireImplementation(), getTasks(), setTasks(),
 * getDocumentType(), getReferenceDocumentId(), and getTemplateDocumentId().
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
   * Applies one submission's extraction outcome to its items.
   *
   * Shared by the Slides and Sheets runners once each has handled its own
   * progress reporting and document-id check. A null extraction marks every
   * known task SOURCE_UNREADABLE; otherwise extracted artifacts are upserted,
   * known tasks with no artifact are marked SOURCE_CONTENT_UNAVAILABLE, and
   * artifacts left without content are marked likewise unless `isPendingArtifact`
   * reports that the artifact is legitimately awaiting later hydration.
   * @param {StudentSubmission} submission - The submission receiving the outcome.
   * @param {Array<Object>|null} artifacts - Extracted artifacts, or null when the source could not be read.
   * @param {Array<Object>} taskDefinitions - Every known task definition for the assignment.
   * @param {{onUnknownTask: function(Object): void, isPendingArtifact: function(Object): boolean}} handlers -
   *   `onUnknownTask` warns about an artifact whose taskId is unknown; `isPendingArtifact`
   *   reports artifacts that must not be marked content-unavailable.
   * @returns {void}
   */
  _applyExtractedArtifacts(submission, artifacts, taskDefinitions, handlers) {
    if (artifacts === null) {
      taskDefinitions.forEach((taskDefinition) => {
        const item = submission.upsertItemFromExtraction(taskDefinition, {
          pageId: null,
          content: null,
          documentId: submission.documentId,
          missingContentLogged: true,
        });
        item.setError('acquisition', 'SOURCE_UNREADABLE');
      });
      return;
    }

    const processedTaskIds = new Set();
    artifacts.forEach((artifact) => {
      const taskDefinition = this._assignment.assignmentDefinition.tasks[artifact.taskId];
      if (!taskDefinition) {
        handlers.onUnknownTask(artifact);
        return;
      }
      submission.upsertItemFromExtraction(taskDefinition, {
        pageId: artifact.pageId,
        content: artifact.content,
        metadata: artifact.metadata,
        documentId: artifact.documentId,
        // Parser placeholders already carry the single missing-content diagnostic,
        // so the model layer stores them silently without duplicate warnings.
        missingContentLogged: artifact.content == null,
      });
      processedTaskIds.add(artifact.taskId);
    });

    taskDefinitions.forEach((taskDefinition) => {
      if (processedTaskIds.has(taskDefinition.getId())) return;
      const item = submission.upsertItemFromExtraction(taskDefinition, {
        pageId: null,
        content: null,
        documentId: submission.documentId,
        missingContentLogged: true,
      });
      item.setError('extraction', 'SOURCE_CONTENT_UNAVAILABLE');
    });

    artifacts.forEach((artifact) => {
      if (artifact.content != null || handlers.isPendingArtifact(artifact)) return;
      const item = submission.getItem(artifact.taskId);
      if (item) item.setError('extraction', 'SOURCE_CONTENT_UNAVAILABLE');
    });
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
