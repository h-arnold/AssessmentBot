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
   * @remarks Iterates `abClass.assignments` (model instances) rather than
   * `json.assignments` (already-serialised plain objects) so that
   * `Assignment.toPartialJSON()` is actually invoked. Once `ABClass.toJSON()` has
   * been called, each element of `json.assignments` is a plain object produced by
   * `Assignment.toJSON()` and has no `toPartialJSON` method, which would cause
   * the partial-shape transformation to be silently skipped and the full
   * assignment payload (including `tasks` and document IDs) to leak into the
   * response.
   *
   * @param {ABClass} abClass - The class instance to convert.
   * @returns {Object} A plain read-view object.
   */
  _toReadView(abClass) {
    const json = abClass.toJSON();

    if (Array.isArray(abClass.assignments)) {
      json.assignments = abClass.assignments.map((assignment) => {
        const partial =
          typeof assignment.toPartialJSON === 'function' ? assignment.toPartialJSON() : assignment.toJSON();
        // Defence-in-depth: strip _hydrationLevel and progressTracker
        const { _hydrationLevel, progressTracker, ...safe } = partial;
        return safe;
      });
    }

    return json;
  }
}

// Export for Node tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ABClassResponseMapper;
}
