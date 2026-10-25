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
   * Builds detached placeholders for a legacy read; historical assessment bodies are ignored.
   * @param {object} assignment - Raw or opaque legacy assignment snapshot.
   * @param {Array<object>} students - Loaded roster for partial projections.
   * @param {'full'|'partial'} form - Projection representation.
   * @returns {StudentSubmission[]} Detached reassessment submissions.
   */
  projectReassessmentSubmissions(assignment, students, form) {
    return AssignmentReadProjection.projectReassessmentSubmissions(assignment, students, form);
  },
  /**
   * Internal helper to restore base Assignment fields from JSON data.
   * Used by both base Assignment and subclass fromJSON methods.
   * @param {object} data - JSON data object.
   * @param {string} representationMode - Representation mode used to restore submissions.
   * @returns {Assignment} Assignment instance with base fields populated.
   */
  _baseFromJSON(data, representationMode) {
    if (!data || typeof data !== 'object')
      throw new Error('Invalid data supplied to Assignment._baseFromJSON');

    const isCurrent = data.assessmentContractVersion === 1;
    if (isCurrent) AssignmentCurrentRestoration._validateCurrentAssignment(data);

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
    if (isCurrent) {
      inst.assessmentContractVersion = 1;
    } else {
      inst._legacyPersistenceSnapshot = AssignmentSerialisation.copyJsonSnapshot({
        submissions: data.submissions === undefined ? [] : data.submissions,
        markerPresent: Object.prototype.hasOwnProperty.call(data, 'assessmentContractVersion'),
        marker: data.assessmentContractVersion,
      });
    }
    // Do not set transient hydration marker here — remain absent/undefined so
    // that deserialized objects don't claim a persisted hydration level.

    if (isCurrent && Array.isArray(data.submissions)) {
      data.submissions.forEach((subObject) =>
        this._rehydrateSubmission(inst, subObject, data, representationMode)
      );
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
      'assessmentContractVersion',
      '_legacyPersistenceSnapshot',
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
   * @param {object} assignmentData - The assignment JSON containing restoration metadata.
   * @param {string} representationMode - Representation mode used to restore submissions.
   * @returns {void}
   */
  _rehydrateSubmission(inst, subObject, assignmentData, representationMode) {
    if (assignmentData?.assessmentContractVersion === 1) {
      this._rehydrateCurrentSubmission(
        inst,
        subObject,
        assignmentData,
        representationMode || assignmentData.representationMode || 'full'
      );
      return;
    }
    const submission = StudentSubmission.fromJSON(subObject);
    inst.submissions.push(submission);
  },

  /**
   * Preserve the rehydration method seam while delegating current records.
   * @param {Assignment} inst - The Assignment instance receiving the submission.
   * @param {object} raw - The raw submission data to restore.
   * @param {object} assignmentData - The assignment JSON containing restoration metadata.
   * @param {string} mode - Representation mode used to restore the submission.
   * @returns {void} The restoration result.
   */
  _rehydrateCurrentSubmission(inst, raw, assignmentData, mode) {
    return AssignmentCurrentRestoration._rehydrateCurrentSubmission(
      inst,
      raw,
      assignmentData,
      mode
    );
  },
};

// Export for Node/Vitest environment (ignored in GAS runtime)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AssignmentRehydration;
}
