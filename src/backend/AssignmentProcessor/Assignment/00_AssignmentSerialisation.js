/**
 * AssignmentSerialisation — Serialisation sub-class
 *
 * Owns toJSON(), toPartialJSON(), _extractFullDefinitionFields(), _extractPartialRootFields().
 * Operates on the parent Assignment instance's state via this._assignment.
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
    // Prefer definition.toJSON(), but a partial AssignmentDefinition (tasks as an
    // array) throws from its toJSON() guard.  Fall back to toPartialJSON() so that
    // serialisation survives when the class body stores a partial assignment —
    // e.g. after persistAssignmentRun replaces the full assignment with a partial.
    let definitionJson;
    if (this._assignment.assignmentDefinition?.toJSON) {
      try {
        definitionJson = this._assignment.assignmentDefinition.toJSON();
      } catch {
        definitionJson =
          typeof this._assignment.assignmentDefinition.toPartialJSON === 'function'
            ? this._assignment.assignmentDefinition.toPartialJSON()
            : this._assignment.assignmentDefinition;
      }
    } else {
      definitionJson = this._assignment.assignmentDefinition;
    }

    const submissions = (this._assignment.submissions || []).map((sub) => {
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

    return {
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

    const partialSubmissions = (this._assignment.submissions || []).map((submission) =>
      submission.toPartialJSON()
    );

    return {
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
  }
}

// Export for Node/Vitest environment (ignored in GAS runtime)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AssignmentSerialisation;
}
