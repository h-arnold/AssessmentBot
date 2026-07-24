/**
 * AssignmentRehydration — Rehydration sub-class
 *
 * Owns static _baseFromJSON(), _rehydrateSubmission(), and the knownFields set
 * for deserialising Assignment instances from JSON data.
 *
 * Depends on global `AssignmentDefinition`, `StudentSubmission`, `ProgressTracker`,
 * `ABLogger`, and `Validate` (GAS runtime globals).
 * @namespace
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
      throw new Error(`createdAt is required to deserialise Assignment ${data.assignmentId}`);
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
        inst[key] = value;
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
    const identifier = subObject?.studentId || subObject?.userId;

    try {
      const submission = StudentSubmission.fromJSON(subObject);
      inst.submissions.push(submission);
      return;
    } catch (error) {
      // The model layer refused the submission (typically a malformed/legacy
      // artifact). Surface the corruption with enough context to diagnose, then
      // fall back to a resilient reconstruction below rather than throwing —
      // throwing here would lose every student's data for the whole assignment.
      ABLogger.getInstance().warn(
        'rehydrateAssignment: submission deserialisation failed; reconstructing resiliently',
        {
          studentId: identifier,
          err: error,
          corruptArtifacts: this._summariseCorruptArtifacts(subObject),
        }
      );
    }

    try {
      const submission = new StudentSubmission(
        identifier || null,
        inst.assignmentId,
        subObject.documentId || null,
        subObject.studentName || subObject.name || null
      );
      if (subObject.createdAt) {
        submission.createdAt =
          subObject.createdAt instanceof Date
            ? subObject.createdAt.toISOString()
            : subObject.createdAt;
      }
      if (subObject.updatedAt) {
        submission.updatedAt =
          subObject.updatedAt instanceof Date
            ? subObject.updatedAt.toISOString()
            : subObject.updatedAt;
      }
      const items = subObject.items || {};
      Object.entries(items).forEach(([taskId, itemJson]) => {
        try {
          submission.items[taskId] = StudentSubmissionItem.fromJSON(itemJson);
        } catch (itemError) {
          // A single corrupt item must not break serialisation of the whole
          // submission. Drop it but log it so the corruption is visible.
          ABLogger.getInstance().warn(
            'rehydrateAssignment: dropped corrupt submission item during resilient reconstruction',
            {
              studentId: identifier,
              taskId,
              itemId: itemJson?.id,
              artifactType: itemJson?.artifact?.type,
              err: itemError,
            }
          );
        }
      });
      inst.submissions.push(submission);
    } catch (error_) {
      // As a last resort, never return a raw object: that bypasses the model's
      // serialisation contract and reproduces the transport validation failure.
      // Log and omit the submission instead.
      ABLogger.getInstance().error(
        'rehydrateAssignment: submission reconstruction failed; submission omitted',
        { studentId: identifier, err: error_ }
      );
    }
  },

  /**
   * Summarises artifacts in a submission JSON that are missing the fields
   * required for the model layer to accept them. Used only for diagnostic
   * logging so corruption is visible without dumping full payloads.
   * @param {Object} subObject - Raw submission JSON.
   * @returns {Array<{taskId: string, itemId: (string|undefined), missing: string[]}>} A list of items whose artifact is missing one or more required fields.
   */
  _summariseCorruptArtifacts(subObject) {
    const items = subObject?.items;
    if (!items || typeof items !== 'object') return [];
    return Object.entries(items)
      .map(([taskId, item]) => {
        const art = item?.artifact;
        const missing = [];
        if (!art || typeof art !== 'object') {
          missing.push('artifact');
        } else {
          if (art.contentHash === undefined) missing.push('contentHash');
          if (art.content === undefined) missing.push('content');
          if (art.type === undefined) missing.push('type');
          if (art.role === undefined) missing.push('role');
        }
        return { taskId, itemId: item?.id, missing };
      })
      .filter((entry) => entry.missing.length > 0);
  },
};

// Export for Node/Vitest environment (ignored in GAS runtime)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AssignmentRehydration;
}
