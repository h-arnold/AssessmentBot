/**
 * ABClassResponseMapper
 *
 * Response shape mapping for ABClass data. Normalises partial documents
 * to the documented transport shape and builds summary/read-view
 * representations. No DB or service dependencies — pure transformation.
 */
class ABClassResponseMapper {
  /**
   * Normalises a stored partial document to the documented transport shape.
   * This prevents storage-only metadata from leaking to API consumers.
   *
   * @remarks Treat this as the backend transport boundary for class partials.
   * Keep this output aligned with `ABClass.toPartialJSON()` and do not forward
   * derived UI fields (for example `cohortLabel` or `yearGroupLabel`) from storage.
   *
   * @param {Object} partialDocument - Raw partial document read from storage.
   * @returns {Object} Normalised class partial payload.
   * @throws {TypeError} If the document is not a plain object or lacks required fields.
   */
  _normaliseClassPartial(partialDocument) {
    if (!partialDocument || typeof partialDocument !== 'object') {
      throw new TypeError('getAllClassPartials: expected each partial document to be an object');
    }

    if (!Array.isArray(partialDocument.teachers)) {
      throw new TypeError('getAllClassPartials: expected partial document teachers to be an array');
    }

    return {
      classId: partialDocument.classId,
      className: partialDocument.className ?? null,
      cohortKey: partialDocument.cohortKey ?? null,
      courseLength: partialDocument.courseLength,
      yearGroupKey: partialDocument.yearGroupKey ?? null,
      classOwner: partialDocument.classOwner ?? null,
      teachers: [...partialDocument.teachers],
      active: partialDocument.active ?? null,
    };
  }

  /**
   * Builds a lightweight partial summary of an ABClass for transport.
   * @param {ABClass} abClass - The class instance to summarise.
   * @returns {Object} Partial JSON summary of the class.
   */
  _buildClassSummary(abClass) {
    return this._normaliseClassPartial(abClass.toPartialJSON());
  }

  /**
   * Converts an ABClass instance to a read-view plain object for API transport.
   * Assignments are included as Assignment.toPartialJSON() output.
   * Defence-in-depth: strips _hydrationLevel and progressTracker from each assignment.
   *
   * @remarks Builds the JSON object manually rather than calling `abClass.toJSON()`,
   * which would invoke `Assignment.toJSON()` on each assignment and in turn
   * `AssignmentDefinition.toJSON()`.  That call chain fails when assignments carry
   * a partial definition (tasks stored as an array).  The read-view response
   * always uses `toPartialJSON()` for assignments, so the full serialisation
   * path is unnecessary and harmful.
   *
   * @param {ABClass} abClass - The class instance to convert.
   * @returns {Object} A plain read-view object.
   */
  _toReadView(abClass) {
    const json = {
      classId: abClass.classId,
      className: abClass.className,
      cohortKey: abClass.cohortKey,
      courseLength: abClass.courseLength,
      yearGroupKey: abClass.yearGroupKey,
      classOwner: abClass.serialiseOwner(abClass.classOwner),
      teachers: ArrayUtils.serialiseArray(abClass.teachers),
      students: ArrayUtils.serialiseArray(abClass.students),
      active: abClass.active ?? null,
      assignments: Array.isArray(abClass.assignments)
        ? abClass.assignments.map((assignment) => {
            const partial =
              typeof assignment.toPartialJSON === 'function'
                ? assignment.toPartialJSON()
                : assignment.toJSON();
            // Defence-in-depth: strip _hydrationLevel and progressTracker
            const { _hydrationLevel, progressTracker, ...safe } = partial;
            // Replace the embedded assignmentDefinition with just the definitionKey.
            // The frontend resolves definition details from its own registry
            // (AssignmentDefinitionPartials), so the full embedded object is redundant
            // transport payload that also risks serialisation failures when the
            // stored definition is partial (tasks as an array).
            if (safe.assignmentDefinition) {
              safe.assignmentDefinitionKey = safe.assignmentDefinition.definitionKey ?? null;
              delete safe.assignmentDefinition;
            }
            return safe;
          })
        : [],
    };

    return json;
  }
}

// Export for Node tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ABClassResponseMapper;
}
