/**
 * AssignmentSerialisation — Serialisation sub-class
 *
 * Owns toJSON(), toPartialJSON(), toReadJSON(), _readRootWithoutSubmissions(),
 * _applyLegacyReadOverlay(), _rootOutput(), _applyContractMarker(),
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

    const submissions = AssignmentSerialisation._submissionsJSON(
      this._assignment.submissions,
      'toJSON'
    );

    const output = this._rootOutput(
      this._extractFullDefinitionFields(definitionJson),
      submissions,
      definitionJson
    );
    this._applyContractMarker(output);
    return output;
  }

  /**
   * Serialises the submissions payload for a persistence emit. An array body
   * maps through the submission serialiser; a present non-array legacy value
   * is preserved (date-normalised, independently copied).
   * @param {*} submissions - Stored submissions value.
   * @param {'toJSON'|'toPartialJSON'} method - Model serialiser for array entries.
   * @returns {*} JSON-friendly submissions payload.
   */
  static _submissionsJSON(submissions, method) {
    return Array.isArray(submissions)
      ? submissions.map((submission) => AssignmentSerialisation._submissionJSON(submission, method))
      : AssignmentSerialisation._plainSubmissionJSON(submissions);
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
   * Copies a stored submission record without a model serialiser, converting
   * the whole value through `DateUtils.deepConvertDates()`. A `Date` has no own
   * enumerable keys, so copying one key by key would otherwise produce `{}`;
   * `deepConvertDates()` converts whole values (Dates, arrays and plain
   * objects) instead.
   * @param {*} submission - Plain stored submission record.
   * @returns {*} Independently owned JSON-friendly record.
   */
  static _plainSubmissionJSON(submission) {
    if (!submission || typeof submission !== 'object') {
      return submission;
    }
    return DateUtils.deepConvertDates(submission);
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
   * Serialises this assignment for a read response in the requested form.
   *
   * A marker-1 record keeps its persistence serialisation: `full` emits
   * toJSON() and `partial` emits toPartialJSON(), byte-identical to those
   * persistence payloads. A legacy record (marker missing, null or
   * unsupported) prepares an independent read result first — so contextual
   * preparation errors surface before definition serialisation — and then
   * serialises the root without the per-submission mapping preparation
   * replaces. The read marker maps stored `1` to `1` and every other stored
   * marker to `'legacy'`, set on the read output only — the stored instance is
   * never rewritten. A present non-array submissions root cannot be prepared
   * and fails the read transport contextually; persistence emits keep
   * preserving it.
   * @param {'full'|'partial'} [form] - Read output form; defaults to 'full'.
   * @returns {object} Read payload in the requested form.
   * @throws {Error} When the form is unsupported or legacy preparation fails.
   */
  toReadJSON(form = 'full') {
    if (form !== 'full' && form !== 'partial') {
      throw new Error(`Invalid read serialisation form: ${form}`);
    }
    if (this._assignment.assessmentContractVersion === 1) {
      return form === 'full' ? this.toJSON() : this.toPartialJSON();
    }
    return AssignmentSerialisation._applyLegacyReadOverlay(this._assignment, form, this);
  }

  /**
   * Serialises the read root for a legacy record without mapping submissions:
   * preparation supplies the read submissions, so the per-submission mapping
   * the persistence emits run would be discarded work.
   * @param {'full'|'partial'} form - Read output form.
   * @returns {object} Root output with a placeholder submissions value and no
   *   contract marker; the overlay applies both.
   * @private
   */
  _readRootWithoutSubmissions(form) {
    const definition = this._assignment.assignmentDefinition;
    // A restored partial definition (tasks as an array) is emitted through its
    // partial serialiser; a full definition through toJSON(), whose errors
    // propagate. The partial form always emits the partial serialiser.
    const definitionJson =
      form === 'partial' || Array.isArray(definition.tasks)
        ? definition.toPartialJSON()
        : definition.toJSON();
    const rootFields =
      form === 'partial'
        ? this._extractPartialRootFields(definitionJson)
        : this._extractFullDefinitionFields(definitionJson);
    return this._rootOutput(rootFields, [], definitionJson);
  }

  /**
   * Applies the shared legacy read overlay: prepares the read submissions from
   * stored state, then serialises the root and applies the prepared
   * submissions plus the `'legacy'` marker. A present non-array submissions
   * root cannot be prepared and fails the read transport with a contextual
   * error naming the assignment; persistence emits keep preserving that stored
   * value.
   * @param {Assignment} assignment - Restored legacy assignment.
   * @param {'full'|'partial'} form - Read output form.
   * @param {AssignmentSerialisation} serialisation - Serialiser owning the root emit.
   * @returns {object} Legacy read payload with prepared submissions.
   * @throws {Error} When the submissions root is present but not an array, or
   *   the assignment state is untrustworthy.
   */
  static _applyLegacyReadOverlay(assignment, form, serialisation) {
    // Preparation runs first so its contextual errors (missing embedded tasks,
    // non-array root) surface before definition serialisation.
    const prepared = AssignmentRehydration.prepareLegacyReadSubmissions(assignment, form);
    if (prepared === null) {
      throw new Error(
        `Legacy read of assignment ${assignment.assignmentId} found a non-array submissions root`
      );
    }
    const output = serialisation._readRootWithoutSubmissions(form);
    output.submissions = prepared;
    output.assessmentContractVersion = 'legacy';
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

    const partialSubmissions = AssignmentSerialisation._submissionsJSON(
      this._assignment.submissions,
      'toPartialJSON'
    );

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
