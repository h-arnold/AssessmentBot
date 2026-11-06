/**
 * AssignmentLegacyRead — prepares an independent read result for a restored
 * legacy assignment.
 *
 * Depends on global `AssignmentCurrentRestoration` and `Assignment`
 * (GAS runtime globals).
 *
 * Saved raw legacy records are never mutated. Preparation runs the existing
 * current-format validation on an independent receiver so saved state and later
 * persistence output stay untouched. Validation mode follows the embedded
 * definition representation (array summary: partial; keyed map: full); the
 * requested `form` selects output serialisation only.
 * @class
 */
class AssignmentLegacyRead {
  /**
   * Prepares JSON-friendly read submissions for a restored legacy assignment.
   *
   * @param {Assignment} assignment - Restored legacy assignment.
   * @param {'full'|'partial'} form - Output serialisation form.
   * @returns {Array<object>|null} Prepared submissions in the requested form, or
   *   `null` when the submissions root is present but not an array.
   * @throws {Error} When the form is unsupported or the assignment state is untrustworthy.
   */
  prepare(assignment, form) {
    if (form !== 'full' && form !== 'partial')
      throw new Error(`Invalid legacy read preparation form: ${form}`);
    if (!assignment || !Array.isArray(assignment.submissions)) return null;
    const definition = assignment.assignmentDefinition;
    if (!definition || typeof definition.tasks !== 'object')
      throw new Error('Legacy read preparation requires an embedded task universe');
    // A summary array selects partial validation, matching current restoration;
    // a keyed task map selects full validation.
    const mode = Array.isArray(definition.tasks) ? 'partial' : 'full';
    const assignmentData = {
      assignmentId: assignment.assignmentId,
      assignmentDefinition: definition,
      createdAt: AssignmentLegacyRead._toTimestamp(assignment.createdAt),
      updatedAt: AssignmentLegacyRead._toTimestamp(assignment.updatedAt),
    };
    const receiver = this._createReceiver(assignment);
    for (const stored of assignment.submissions) {
      // Identity and unknown-task faults propagate from the current-format owner;
      // only explicit raw-data validation failures become CORRUPT_RECORD E.
      const isolated = this._selectStoredItems(stored);
      AssignmentCurrentRestoration._rehydrateCurrentSubmission(
        receiver,
        isolated,
        assignmentData,
        mode
      );
    }
    return receiver.submissions.map((submission) =>
      form === 'partial' ? submission.toPartialJSON() : submission.toJSON()
    );
  }

  /**
   * Converts a timestamp to an ISO string, leaving non-values untouched for the
   * current-format owner to validate.
   * @param {*} value - Candidate timestamp.
   * @returns {*} ISO string when convertible, otherwise the original value.
   */
  static _toTimestamp(value) {
    if (!(typeof value === 'string' || value instanceof Date)) return value;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString();
  }

  /**
   * Builds an independent receiver carrying the legacy marker state verbatim and
   * the requested task universe, without fetching or stamping anything.
   * @param {Assignment} assignment - Restored legacy assignment.
   * @returns {Assignment} Empty receiver instance.
   */
  _createReceiver(assignment) {
    const receiver = new Assignment(assignment.courseId, assignment.assignmentId, null, {
      assignmentName: assignment.assignmentName,
      createdAt: assignment.createdAt,
      representationMode: 'full',
    });
    receiver.dueDate = assignment.dueDate;
    receiver.updatedAt = assignment.updatedAt;
    receiver.assignmentDefinition = assignment.assignmentDefinition;
    receiver.submissions = [];
    receiver.assessmentContractVersion = assignment.assessmentContractVersion;
    receiver._legacyMarkerPresent = assignment._legacyMarkerPresent;
    return receiver;
  }

  /**
   * Builds an isolated stored-item carrier: a shallow record copy whose `items`
   * holds independent copies of each stored item. The current-format owner
   * materialises malformed maps, missing-task coverage and broken items.
   * @param {object} stored - Stored raw submission record.
   * @returns {object} Isolated carrier for the current-format owner.
   */
  _selectStoredItems(stored) {
    const record = { ...stored };
    const items = stored.items;
    if (!items || typeof items !== 'object' || Array.isArray(items)) {
      record.items = undefined;
      return record;
    }
    const isolatedItems = {};
    for (const [key, value] of Object.entries(items)) {
      // Deep copy discards any model class identity so the existing item is found
      // and validated as a raw record.
      isolatedItems[key] = structuredClone(value);
    }
    record.items = isolatedItems;
    return record;
  }
}

// Export for Node/Vitest environment (ignored in GAS runtime)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AssignmentLegacyRead;
}
