/**
 * Assignment — Facade
 *
 * Thin facade over 7 focused sub-classes, each injected via the constructor,
 * plus a private lifecycle initialiser (fetchAssignmentName).
 *
 * @remarks This class follows the facade decomposition pattern described in
 * src/backend/AGENTS.md §11. It delegates to 7 sub-classes injected at
 * construction time: AssignmentSerialisation, AssignmentFactory (static),
 * AssignmentRehydration (static), AssignmentTimestamps, AssignmentSubmissions,
 * AssignmentAssessmentBase, and AssignmentLLMOrchestration.
 *
 * Public API contract is preserved from the original monolithic class.
 */
/* global ProgressTracker */

/**
 * Assignment class.
 */
class Assignment {
  /**
   * Constructs an Assignment instance.
   * @param {string} courseId - The ID of the course.
   * @param {string} assignmentId - The ID of the assignment.
   * @param {AssignmentDefinition|Object} assignmentDefinition - Embedded definition containing document type, reference/template IDs, and task metadata.
   */
  constructor(courseId, assignmentId, assignmentDefinition) {
    this.courseId = courseId;
    this.assignmentId = assignmentId;
    this.assignmentName = this.fetchAssignmentName(courseId, assignmentId);
    this.dueDate = null; //to be implemented later with the homework tracker.
    // Timestamp for when this assignment was last updated. Use Date or null.
    this.updatedAt = null;
    // Timestamp from Google Classroom indicating when the assignment was created.
    // Set by fetchAssignmentName() during construction.

    // Embedded definition copy (source of truth for tasks, doc IDs, weighting, documentType)
    this.assignmentDefinition = assignmentDefinition;

    // New model: submissions array of StudentSubmission
    this.submissions = []; // Array<StudentSubmission>
    // Legacy studentTasks alias removed – callers must use this.submissions.
    this.progressTracker = ProgressTracker.getInstance();
    // Controllers may temporarily attach `assignment.students` while an assessment run is active
    // to keep the hydrated roster handy. That property is transient and must never be persisted
    // (see docs/developer/DATA_SHAPES.md and rehydration.md).
    this._hydrationLevel = 'full';
    // Sub-class instances are lazily initialised via prototype getters defined below.
    // Constructor-created instances will get own properties on first access.
  }

  // ---------------------------------------------------------------------------
  // Static delegations — Factory
  // ---------------------------------------------------------------------------

  /**
   * Factory method to create the correct Assignment subclass based on documentType.
   * @param {AssignmentDefinition|Object} assignmentDefinition - Embedded definition containing docType and task metadata.
   * @param {string} courseId - The ID of the course.
   * @param {string} assignmentId - The ID of the assignment.
   * @returns {Assignment} Instance of appropriate subclass.
   */
  static create(assignmentDefinition, courseId, assignmentId) {
    return AssignmentFactory.create(assignmentDefinition, courseId, assignmentId);
  }

  /**
   * Polymorphic deserialisation routing based on documentType field.
   * @param {object} data - JSON data object.
   * @returns {Assignment} Instance of appropriate class.
   */
  static fromJSON(data) {
    return AssignmentFactory.fromJSON(data);
  }

  // ---------------------------------------------------------------------------
  // Static delegations — Rehydration
  // ---------------------------------------------------------------------------

  /**
   * Internal helper to restore base Assignment fields from JSON data.
   * Sub-class instances are lazily initialised via prototype getters
   * when first accessed.
   * @param {object} data - JSON data object.
   * @returns {Assignment} Assignment instance with base fields populated.
   */
  static _baseFromJSON(data) {
    return AssignmentRehydration._baseFromJSON(data);
  }

  /**
   * Rehydrates a submission object from JSON data.
   * @param {Assignment} inst - The Assignment instance to add the submission to.
   * @param {object} subObject - The submission object to rehydrate.
   * @returns {void}
   */
  static _rehydrateSubmission(inst, subObject) {
    return AssignmentRehydration._rehydrateSubmission(inst, subObject);
  }

  // ---------------------------------------------------------------------------
  // Private lifecycle initialiser (on the facade directly)
  // ---------------------------------------------------------------------------

  /**
   * Fetches the assignment name from Google Classroom.
   * @param {string} courseId - The ID of the course.
   * @param {string} assignmentId - The ID of the assignment.
   * @returns {string} The name/title of the assignment.
   */
  fetchAssignmentName(courseId, assignmentId) {
    const courseWork = Classroom.Courses.CourseWork.get(courseId, assignmentId);
    if (!courseWork.creationTime) {
      throw new Error(
        `Google Classroom assignment ${assignmentId} (course ${courseId}) has no creationTime.`
      );
    }
    this.createdAt = new Date(courseWork.creationTime);
    return courseWork.title || `Assignment ${assignmentId}`;
  }

  // ---------------------------------------------------------------------------
  // Instance delegations — Serialisation
  // ---------------------------------------------------------------------------

  /**
   * Serialises this Assignment to a plain JSON-friendly object.
   * @returns {object} Assignment data with course/assignment IDs, dates, definition, and submissions.
   */
  toJSON() {
    return this._serialisation.toJSON();
  }

  /**
   * Produces a lightweight JSON payload with heavy artifact fields redacted.
   * @returns {object} Assignment data with redacted definition.
   */
  toPartialJSON() {
    return this._serialisation.toPartialJSON();
  }

  /**
   * Extracts full definition fields from the serialised definition object.
   * @param {object} definitionJson - The serialised definition object.
   * @returns {object} Full definition fields including documentType, IDs, and tasks.
   */
  _extractFullDefinitionFields(definitionJson) {
    return this._serialisation._extractFullDefinitionFields(definitionJson);
  }

  /**
   * Extracts minimal root fields for partial definitions.
   * @param {object} definitionJson - The serialised definition object.
   * @returns {object} Minimal root fields with only documentType.
   */
  _extractPartialRootFields(definitionJson) {
    return this._serialisation._extractPartialRootFields(definitionJson);
  }

  // ---------------------------------------------------------------------------
  // Instance delegations — Timestamps
  // ---------------------------------------------------------------------------

  /**
   * Updates the updatedAt timestamp to the current date/time.
   * @returns {Date} The new updatedAt value.
   */
  touchUpdated() {
    return this._timestamps.touchUpdated();
  }

  /**
   * Returns the updatedAt Date or null if not set.
   * @returns {Date|null} The updatedAt Date or null.
   */
  getUpdatedAt() {
    return this._timestamps.getUpdatedAt();
  }

  /**
   * Sets the updatedAt timestamp from a JavaScript Date object (or null to clear).
   * @param {Date|null} date - The Date to set, or null to clear the timestamp.
   * @returns {Date|null} The stored Date instance or null.
   * @throws {TypeError} If the provided value is not a Date or null.
   */
  setUpdatedAt(date) {
    return this._timestamps.setUpdatedAt(date);
  }

  /**
   * Returns the createdAt Date.
   * @returns {Date} The createdAt Date.
   */
  getCreatedAt() {
    return this._timestamps.getCreatedAt();
  }

  /**
   * Sets the createdAt timestamp from a JavaScript Date object.
   * @param {Date} date - The Date to set.
   * @returns {Date} The stored Date instance.
   * @throws {TypeError} If the provided value is not a valid Date.
   */
  setCreatedAt(date) {
    return this._timestamps.setCreatedAt(date);
  }

  // ---------------------------------------------------------------------------
  // Instance delegations — Submissions
  // ---------------------------------------------------------------------------

  /**
   * Adds a student to the assignment.
   * @param {Student} student - The Student instance to add.
   * @returns {StudentSubmission|null} The created StudentSubmission, or null if studentId is not resolvable.
   */
  addStudent(student) {
    return this._submissions.addStudent(student);
  }

  /**
   * Processes a single attachment for a student's submission.
   * @param {object} attachment - The attachment object from Classroom submission.
   * @param {string} studentId - The Google Classroom student ID.
   * @param {string} mimeType - The expected MIME type to validate against.
   * @returns {void}
   */
  _processAttachmentForSubmission(attachment, studentId, mimeType) {
    return this._submissions._processAttachmentForSubmission(attachment, studentId, mimeType);
  }

  /**
   * Fetches and assigns submitted Google Drive documents for each student, filtered by the provided MIME type.
   * @param {string} mimeType - The Google Drive MIME type to filter for.
   * @returns {void}
   */
  fetchSubmittedDocumentsByMimeType(mimeType) {
    return this._submissions.fetchSubmittedDocumentsByMimeType(mimeType);
  }

  /**
   * Validates if the file's MIME type matches the expected type.
   * @param {string} fileMimeType - The MIME type of the file from Drive.
   * @param {string} expectedMimeType - The expected Google MIME type.
   * @returns {boolean} True if valid, false otherwise.
   */
  isValidMimeType(fileMimeType, expectedMimeType) {
    return this._submissions.isValidMimeType(fileMimeType, expectedMimeType);
  }

  // ---------------------------------------------------------------------------
  // Instance delegations — Assessment Base
  // ---------------------------------------------------------------------------

  /**
   * Fetches and assigns submitted documents for each student.
   * @returns {void}
   */
  fetchSubmittedDocuments() {
    return this._assessmentBase.fetchSubmittedDocuments();
  }

  /**
   * Populates tasks from reference documents.
   * @returns {void}
   */
  populateTasks() {
    return this._assessmentBase.populateTasks();
  }

  /**
   * Processes all student submissions by extracting responses.
   * @returns {void}
   */
  processAllSubmissions() {
    return this._assessmentBase.processAllSubmissions();
  }

  /**
   * Small helper used by base-class methods that must be implemented by subclasses.
   * @param {string} methodName - Name of the method that should be implemented
   * @returns {void}
   */
  _requireImplementation(methodName) {
    return this._assessmentBase._requireImplementation(methodName);
  }

  /**
   * Gets the tasks object from the assignment definition.
   * @returns {Object|null} Task definitions keyed by task ID, or null if not set.
   */
  getTasks() {
    return this._assessmentBase.getTasks();
  }

  /**
   * Sets the tasks object in the assignment definition.
   * @param {Object} tasks - Task definitions keyed by task ID.
   * @returns {Object} The assigned tasks object.
   */
  setTasks(tasks) {
    return this._assessmentBase.setTasks(tasks);
  }

  /**
   * Gets the document type from the assignment definition.
   * @returns {string|null} The document type (e.g., 'SLIDES', 'SHEETS'), or null if not set.
   */
  getDocumentType() {
    return this._assessmentBase.getDocumentType();
  }

  /**
   * Gets the reference document ID from the assignment definition.
   * @returns {string|null} The reference document ID, or null if not set.
   */
  getReferenceDocumentId() {
    return this._assessmentBase.getReferenceDocumentId();
  }

  /**
   * Gets the template document ID from the assignment definition.
   * @returns {string|null} The template document ID, or null if not set.
   */
  getTemplateDocumentId() {
    return this._assessmentBase.getTemplateDocumentId();
  }

  // ---------------------------------------------------------------------------
  // Instance delegations — LLM Orchestration
  // ---------------------------------------------------------------------------

  /**
   * Generates an array of request objects ready to be sent to the LLM.
   * @returns {Object[]} An array of request objects.
   */
  generateLLMRequests() {
    return this._llmOrchestration.generateLLMRequests();
  }

  /**
   * Assesses student responses by interacting with the LLM.
   * @returns {void}
   */
  assessResponses() {
    return this._llmOrchestration.assessResponses();
  }

  /**
   * Creates and returns an LLMRequestManager instance.
   * @returns {LLMRequestManager} A new LLMRequestManager instance.
   */
  _getLLMManager() {
    return this._llmOrchestration._getLLMManager();
  }
}

// ---------------------------------------------------------------------------
// Lazy sub-class getters — handle bare prototype instances created via
// Object.create(Assignment.prototype) without running the constructor
// (e.g. in _baseFromJSON or test code). Constructor-created instances have
// own properties set in the constructor, which shadow these prototype getters.
// ---------------------------------------------------------------------------

/**
 * Defines a lazy getter on the Assignment prototype that creates a
 * sub-class instance on first access. Subsequent accesses return the
 * cached instance (own property set by the getter).
 * @param {string} property - The property name for the sub-class instance.
 * @param {Function} Subclass - The sub-class constructor to instantiate.
 * @returns {void}
 */
function defineLazySubclass_(property, Subclass) {
  Object.defineProperty(Assignment.prototype, property, {
    get() {
      const value = new Subclass(this);
      Object.defineProperty(this, property, {
        value: value,
        writable: true,
        configurable: true,
        enumerable: false,
      });
      return value;
    },
    configurable: true,
    enumerable: false,
  });
}

defineLazySubclass_('_serialisation', AssignmentSerialisation);
defineLazySubclass_('_timestamps', AssignmentTimestamps);
defineLazySubclass_('_submissions', AssignmentSubmissions);
defineLazySubclass_('_assessmentBase', AssignmentAssessmentBase);
defineLazySubclass_('_llmOrchestration', AssignmentLLMOrchestration);

// Export for Node/Vitest environment (ignored in GAS runtime)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Assignment;
}
