/**
 * AssignmentSerialisation — Serialisation sub-class
 *
 * Owns toJSON(), toPartialJSON(), _extractFullDefinitionFields(), _extractPartialRootFields().
 * Operates on the parent Assignment instance's state via this._assignment.
 * @class
 */
class AssignmentSerialisation {
  /**
   * Copies a JSON snapshot without normalising historical values.
   * @param {*} value - A JSON scalar, array, or plain object.
   * @returns {*} An independently owned snapshot value.
   */
  static copyJsonSnapshot(value) {
    if (Array.isArray(value))
      return value.map((entry) => AssignmentSerialisation.copyJsonSnapshot(entry));
    if (value !== null && typeof value === 'object') {
      const copy = {};
      Object.keys(value).forEach((key) => {
        Object.defineProperty(copy, key, {
          value: AssignmentSerialisation.copyJsonSnapshot(value[key]),
          enumerable: true,
          writable: true,
          configurable: true,
        });
      });
      return copy;
    }
    return value;
  }
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
    // toJSON() emits the full definition; partial definitions are expected to be
    // replaced with full ones by callers before serialisation, so
    // assignmentDefinition.toJSON() is called directly and any error propagates.
    const legacy = this._assignment._legacyPersistenceSnapshot;
    const definitionJson =
      legacy && Array.isArray(this._assignment.assignmentDefinition.tasks)
        ? this._assignment.assignmentDefinition.toPartialJSON()
        : this._assignment.assignmentDefinition.toJSON();

    const submissions = legacy
      ? AssignmentSerialisation.copyJsonSnapshot(legacy.submissions)
      : (this._assignment.submissions || []).map((sub) => {
          if (sub && typeof sub.toJSON === 'function') return sub.toJSON();
          // Fallback serialisation for StudentSubmission-like objects
          const out = {};
          if (sub && typeof sub === 'object') {
            out.studentId = sub.studentId || sub.userId || null;
            if ('documentId' in sub) out.documentId = sub.documentId;
            if ('score' in sub) out.score = sub.score;
            if ('feedback' in sub) out.feedback = sub.feedback;
            if (sub.updatedAt instanceof Date && !Number.isNaN(sub.updatedAt.getTime()))
              out.updatedAt = sub.updatedAt.toISOString();
            else if (sub.updatedAt) out.updatedAt = sub.updatedAt;
            // copy any other enumerable properties (non-enumerable like methods are ignored)
            Object.assign(
              out,
              Object.fromEntries(Object.entries(sub).filter(([key]) => !Object.hasOwn(out, key)))
            );
          }
          return out;
        });

    const output = {
      courseId: this._assignment.courseId,
      assignmentId: this._assignment.assignmentId,
      assignmentName: this._assignment.assignmentName,
      dueDate: this._assignment.dueDate ? this._assignment.dueDate.toISOString() : null,
      updatedAt: this._assignment.updatedAt ? this._assignment.updatedAt.toISOString() : null,
      createdAt: this._assignment.createdAt.toISOString(),
      ...this._extractFullDefinitionFields(definitionJson),
      submissions,
      assignmentDefinition: definitionJson || this._assignment.assignmentDefinition,
    };
    if (legacy) {
      if (legacy.markerPresent)
        output.assessmentContractVersion = AssignmentSerialisation.copyJsonSnapshot(legacy.marker);
    } else if (this._assignment.assessmentContractVersion === 1) {
      output.assessmentContractVersion = 1;
    }
    return output;
  }

  /**
   * Serialises this assignment for a full read response.
   * @returns {object} Full read payload.
   */
  toReadJSON() {
    const output = this.toJSON();
    const legacy = this._assignment._legacyPersistenceSnapshot;
    if (legacy) {
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

    const legacy = this._assignment._legacyPersistenceSnapshot;
    const partialSubmissions = legacy
      ? AssignmentSerialisation.copyJsonSnapshot(legacy.submissions)
      : (this._assignment.submissions || []).map((submission) => submission.toPartialJSON());

    const output = {
      courseId: this._assignment.courseId,
      assignmentId: this._assignment.assignmentId,
      assignmentName: this._assignment.assignmentName,
      dueDate: this._assignment.dueDate ? this._assignment.dueDate.toISOString() : null,
      updatedAt: this._assignment.updatedAt ? this._assignment.updatedAt.toISOString() : null,
      createdAt: this._assignment.createdAt.toISOString(),
      ...this._extractPartialRootFields(definitionJson),
      submissions: partialSubmissions,
      assignmentDefinition: definitionJson,
    };
    if (legacy) {
      if (legacy.markerPresent)
        output.assessmentContractVersion = AssignmentSerialisation.copyJsonSnapshot(legacy.marker);
    } else if (this._assignment.assessmentContractVersion === 1) {
      output.assessmentContractVersion = 1;
    }
    return output;
  }
}

// Export for Node/Vitest environment (ignored in GAS runtime)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AssignmentSerialisation;
}
