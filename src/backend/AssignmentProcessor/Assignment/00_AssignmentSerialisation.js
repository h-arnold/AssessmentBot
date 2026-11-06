/**
 * AssignmentSerialisation — Serialisation sub-class
 *
 * Owns toJSON(), toPartialJSON(), toReadJSON(), _rootOutput(), _applyContractMarker(),
 * _extractFullDefinitionFields(), _extractPartialRootFields() and the plain-object
 * submission fallback.
 * Operates on the parent Assignment instance's state via this._assignment.
 *
 * Legacy (non-marker-1) records are restored into normal instance state, so every
 * emit path reads `submissions` and the stored marker from the instance itself.
 * @class
 */
class AssignmentSerialisation {
  /**
   * Constructor.
   * @param {import('./index.js')} assignment - The parent Assignment instance.
   */
  constructor(assignment) {
    /** @type {import('./index.js')} */
    this._assignment = assignment;
  }

  /**
   * Serialises this Assignment to a plain JSON-friendly object.
   * Dates are converted to ISO strings. If TaskDefinition or StudentSubmission provide toJSON, those are used.
   * progressTracker is intentionally not serialised (singleton/session-specific).
   * @returns {object} Assignment data with course/assignment IDs, dates, definition, and submissions.
   */
  toJSON() {
    // A restored partial definition (tasks as an array) is emitted through its
    // partial serialiser; a full definition through toJSON(), whose errors propagate.
    const definitionJson = Array.isArray(this._assignment.assignmentDefinition.tasks)
      ? this._assignment.assignmentDefinition.toPartialJSON()
      : this._assignment.assignmentDefinition.toJSON();

    // An array body maps through the submission serialiser; a present non-array
    // legacy value is preserved (date-normalised, independently copied).
    const submissions = Array.isArray(this._assignment.submissions)
      ? this._assignment.submissions.map((submission) =>
          AssignmentSerialisation._submissionJSON(submission, 'toJSON')
        )
      : AssignmentSerialisation._plainSubmissionJSON(this._assignment.submissions);

    const output = this._rootOutput(
      this._extractFullDefinitionFields(definitionJson),
      submissions,
      definitionJson || this._assignment.assignmentDefinition
    );
    this._applyContractMarker(output);
    return output;
  }

  /**
   * Serialises one submission, falling back to a plain-object copy for stored
   * records that are not model instances.
   * @param {*} submission - Model instance or plain stored record.
   * @param {'toJSON'|'toPartialJSON'} method - Model serialiser to prefer.
   * @returns {*} JSON-friendly submission record.
   */
  static _submissionJSON(submission, method) {
    if (submission && typeof submission[method] === 'function') return submission[method]();
    return AssignmentSerialisation._plainSubmissionJSON(submission);
  }

  /**
   * Copies a stored submission record without a model serialiser, converting live
   * `Date` values to ISO strings. A `Date` has no own enumerable keys, so copying
   * one key by key would otherwise produce `{}`; arrays and other non-plain values
   * are therefore converted through `DateUtils.deepConvertDates()`.
   * @param {*} submission - Plain stored submission record.
   * @returns {*} Independently owned JSON-friendly record.
   */
  static _plainSubmissionJSON(submission) {
    if (!submission || typeof submission !== 'object') {
      return submission;
    }
    if (Array.isArray(submission) || submission instanceof Date) {
      return DateUtils.deepConvertDates(submission);
    }
    const output = {};
    Object.keys(submission).forEach((key) => {
      output[key] = DateUtils.deepConvertDates(submission[key]);
    });
    return output;
  }

  /**
   * Builds the assignment root fields shared by the full and partial payloads.
   * @param {object} definitionRootFields - Root definition fields for this payload form.
   * @param {Array<object>} submissions - Serialised submissions for this payload form.
   * @param {object} assignmentDefinition - Definition payload for this payload form.
   * @returns {object} Root output object without the contract marker.
   */
  _rootOutput(definitionRootFields, submissions, assignmentDefinition) {
    return {
      courseId: this._assignment.courseId,
      assignmentId: this._assignment.assignmentId,
      assignmentName: this._assignment.assignmentName,
      dueDate: this._assignment.dueDate ? this._assignment.dueDate.toISOString() : null,
      updatedAt: this._assignment.updatedAt ? this._assignment.updatedAt.toISOString() : null,
      createdAt: this._assignment.createdAt.toISOString(),
      ...definitionRootFields,
      submissions,
      assignmentDefinition,
    };
  }

  /**
   * Writes the contract marker onto a serialised payload: the stored legacy marker
   * when the record is not current, otherwise `1` for current-format assignments.
   * @param {object} output - Serialised payload to annotate in place.
   * @returns {void}
   */
  _applyContractMarker(output) {
    if (this._assignment.assessmentContractVersion === 1) {
      output.assessmentContractVersion = 1;
    } else if (this._assignment._legacyMarkerPresent) {
      output.assessmentContractVersion = this._assignment.assessmentContractVersion;
    }
  }

  /**
   * Serialises this assignment for a full read response.
   * @returns {object} Full read payload.
   */
  toReadJSON() {
    const output = this.toJSON();
    if (this._assignment.assessmentContractVersion !== 1) {
      output.submissions = AssignmentRehydration.projectReassessmentSubmissions(
        this._assignment,
        [],
        'full'
      ).map((submission) => submission.toJSON());
      output.assessmentContractVersion = null;
    }
    return output;
  }

  /**
   * Extracts full definition fields from the serialised definition object.
   * Used by toJSON to include complete definition data (document type, IDs, and tasks).
   * @param {object} definitionJson - The serialised definition object.
   * @returns {object} Full definition fields including documentType, IDs, and tasks.
   */
  _extractFullDefinitionFields(definitionJson) {
    return {
      documentType: definitionJson?.documentType ?? null,
      referenceDocumentId: definitionJson?.referenceDocumentId ?? null,
      templateDocumentId: definitionJson?.templateDocumentId ?? null,
      tasks: definitionJson?.tasks ?? null,
    };
  }

  /**
   * Extracts minimal root fields for partial definitions.
   * Only includes documentType (for routing); omits doc IDs and tasks.
   * @param {object} definitionJson - The serialised definition object.
   * @returns {object} Minimal root fields with only documentType.
   */
  _extractPartialRootFields(definitionJson) {
    return {
      documentType: definitionJson?.documentType ?? null,
    };
  }

  /**
   * Produces a lightweight JSON payload with heavy artifact fields redacted.
   * @returns {object} Assignment data with redacted definition.
   */
  toPartialJSON() {
    const definitionJson = this._assignment.assignmentDefinition.toPartialJSON();

    // An array body maps through the submission serialiser; a present non-array
    // legacy value is preserved (date-normalised, independently copied).
    const partialSubmissions = Array.isArray(this._assignment.submissions)
      ? this._assignment.submissions.map((submission) =>
          AssignmentSerialisation._submissionJSON(submission, 'toPartialJSON')
        )
      : AssignmentSerialisation._plainSubmissionJSON(this._assignment.submissions);

    const output = this._rootOutput(
      this._extractPartialRootFields(definitionJson),
      partialSubmissions,
      definitionJson
    );
    this._applyContractMarker(output);
    return output;
  }
}

// Export for Node/Vitest environment (ignored in GAS runtime)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AssignmentSerialisation;
}
