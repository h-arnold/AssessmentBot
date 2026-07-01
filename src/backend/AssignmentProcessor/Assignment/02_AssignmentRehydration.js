/**
 * AssignmentRehydration — Rehydration sub-class
 *
 * Owns static _baseFromJSON(), _rehydrateSubmission(), and the knownFields set
 * for deserialising Assignment instances from JSON data.
 *
 * Depends on global `AssignmentDefinition`, `StudentSubmission`, `ProgressTracker`,
 * `ABLogger`, and `Validate` (GAS runtime globals).
 * @class
 */
const AssignmentRehydration = {
  /**
   * Internal helper to restore base Assignment fields from JSON data.
   * Used by both base Assignment and subclass fromJSON methods.
   * @param {object} data - JSON data object.
   * @returns {Assignment} Assignment instance with base fields populated.
   */
  _baseFromJSON(data) {
    if (!data || typeof data !== 'object')
      throw new Error('Invalid data supplied to Assignment._baseFromJSON');

    if (!data.courseId || !data.assignmentId) {
      throw new Error('courseId and assignmentId are required fields in Assignment data');
    }

    const inst = Object.create(Assignment.prototype);
    inst.courseId = data.courseId;
    inst.assignmentId = data.assignmentId;
    inst.assignmentName = data.assignmentName || `Assignment ${data.assignmentId}`;
    inst.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    inst.updatedAt = data.updatedAt ? new Date(data.updatedAt) : null;
    if (!data.createdAt) {
      throw new Error(`createdAt is required to deserialize Assignment ${data.assignmentId}`);
    }
    inst.createdAt = new Date(data.createdAt);
    inst.assignmentDefinition = data.assignmentDefinition
      ? AssignmentDefinition.fromJSON(data.assignmentDefinition)
      : null;
    inst.submissions = [];
    // Do not set transient hydration marker here — remain absent/undefined so
    // that deserialized objects don't claim a persisted hydration level.

    if (Array.isArray(data.submissions)) {
      data.submissions.forEach((subObject) => Assignment._rehydrateSubmission(inst, subObject));
    }

    // restore progress tracker singleton if available
    inst.progressTracker = ProgressTracker.getInstance();

    // Copy any additional fields that aren't already handled (e.g., referenceDocumentId, templateDocumentId for graceful degradation)
    const knownFields = new Set([
      'courseId',
      'assignmentId',
      'assignmentName',
      'dueDate',
      'updatedAt',
      'createdAt',
      'assignmentDefinition',
      'submissions',
      'students', // Transient, don't restore
      'progressTracker', // Transient, don't restore
      '_hydrationLevel', // Transient, don't restore
    ]);
    Object.entries(data).forEach(([key, value]) => {
      if (!knownFields.has(key)) {
        Object.defineProperty(inst, key, {
          value,
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
    });

    // Do not populate `inst.students` here; any roster data should be sourced from ABClass at runtime
    // and treated as ephemeral to avoid duplicate persistence.

    return inst;
  },

  /**
   * Rehydrates a submission object from JSON data and adds it to the assignment's submissions array.
   * Handles StudentSubmission deserialisation or falls back to plain object reconstruction.
   * @param {Assignment} inst - The Assignment instance to add the submission to.
   * @param {object} subObject - The submission object to rehydrate.
   */
  _rehydrateSubmission(inst, subObject) {
    const identifier = subObject && (subObject.studentId || subObject.userId);

    try {
      if (
        typeof StudentSubmission !== 'undefined' &&
        typeof StudentSubmission.fromJSON === 'function'
      ) {
        const submission = StudentSubmission.fromJSON(subObject);
        inst.submissions.push(submission);
        return;
      }
    } catch (error) {
      ABLogger.getInstance().warn(
        `StudentSubmission.fromJSON threw for studentId=${identifier}:`,
        error
      );
    }

    try {
      const submission = new StudentSubmission(
        identifier || null,
        inst.assignmentId,
        subObject.documentId || null,
        subObject.studentName || subObject.name || null
      );
      Object.entries(subObject || {}).forEach(([key, value]) => {
        if (key === 'updatedAt' && subObject.updatedAt) {
          submission.updatedAt = value instanceof Date ? value : new Date(value);
          return;
        }
        Object.defineProperty(submission, key, {
          value,
          enumerable: true,
          writable: true,
          configurable: true,
        });
      });
      inst.submissions.push(submission);
    } catch (error_) {
      ABLogger.getInstance().warn(
        `StudentSubmission reconstruction failed for studentId=${identifier}:`,
        error_
      );
      const raw = { ...subObject };
      if (raw.updatedAt) {
        if (raw.updatedAt instanceof Date) raw.updatedAt = raw.updatedAt.toISOString();
        else if (Validate.isString(raw.updatedAt)) {
          const parsed = new Date(raw.updatedAt);
          if (!Number.isNaN(parsed.getTime())) raw.updatedAt = parsed.toISOString();
        }
      }
      inst.submissions.push(raw);
    }
  },
};

// Export for Node/Vitest environment (ignored in GAS runtime)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AssignmentRehydration;
}
