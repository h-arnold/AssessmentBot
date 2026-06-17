/**
 * ABClassController — Facade
 *
 * Thin facade delegating to focused sub-classes for validation, persistence,
 * roster operations, assignment operations, and response mapping.
 *
 * Public API contract is preserved from the original monolithic class.
 */
/* global ABClassValidation, ABClassPersistence, ABClassRoster, ABClassAssignmentOps, ABClassResponseMapper, DbManager, ABLogger, ClassroomApiClient, Teacher, ABClass, Assignment, AssignmentNotFoundError, AssignmentDefinitionController, ClassNotFoundError, Validate, TypeError, RangeError */

/**
 * Loads, persists, and mutates ABClass records stored in JsonDbApp-backed
 * collections managed by DbManager. Each class is stored in a collection named
 * after its classId, with plain serialized ABClass objects written via
 * ABClass.toJSON().
 *
 * Delegates to five focused sub-classes injected at construction time.
 * @class
 */
class ABClassController {
  /**
   * Creates the controller with all sub-class dependencies wired up.
   */
  constructor() {
    const databaseManager = DbManager.getInstance();
    this._dbManager = databaseManager;
    this.dbManager = databaseManager;
    this._validation = new ABClassValidation();
    this._persistence = new ABClassPersistence({
      dbManager: databaseManager,
      validation: this._validation,
    });
    this._roster = new ABClassRoster({
      dbManager: databaseManager,
      validation: this._validation,
      persistence: this._persistence,
    });
    this._assignmentOps = new ABClassAssignmentOps({
      dbManager: databaseManager,
      validation: this._validation,
      persistence: this._persistence,
    });
    this._responseMapper = new ABClassResponseMapper();
  }

  // ──────────────────────────────────────────────
  //  Public methods — implemented on facade
  // ──────────────────────────────────────────────

  /**
   * Creates a new ABClass or updates an existing one with fresh classroom data and custom metadata.
   * Validates all required parameters, then either creates a new class or refreshes an existing one,
   * applying the provided metadata (cohortKey, yearGroupKey, courseLength).
   *
   * @remarks New classes are explicitly initialised as active (`active = true`).
   * Existing classes retain their persisted `active` value unless changed through `updateABClass`.
   * This split is intentional to avoid hidden defaults during update flows.
   *
   * @param {Object} parameters - Update parameters.
   * @param {string} parameters.classId - Classroom course identifier (required).
   * @param {*} parameters.cohortKey - User-managed cohort key (required).
   * @param {*} parameters.yearGroupKey - User-managed year-group key (required).
   * @param {number} parameters.courseLength - Required course length, validated as an integer >= 1 (required).
   * @returns {Object} Partial ABClass summary from toPartialJSON().
   * @throws {Error} If required parameters are missing or validation fails.
   */
  upsertABClass(parameters) {
    Validate.requireParams(
      {
        classId: parameters?.classId,
        cohortKey: parameters?.cohortKey,
        yearGroupKey: parameters?.yearGroupKey,
        courseLength: parameters?.courseLength,
      },
      'upsertABClass'
    );

    const classId = this._validation._validateClassId(parameters.classId, 'upsertABClass');
    const courseLength = this._validation._validateCourseLength(
      parameters.courseLength,
      'upsertABClass'
    );
    const collection = this._dbManager.getCollection(classId);
    const existingDocument = collection.findOne({ classId: classId });
    let abClass;

    if (existingDocument) {
      abClass = ABClass.fromJSON(existingDocument);
      abClass.cohortKey = parameters.cohortKey === null ? null : String(parameters.cohortKey);
      abClass.yearGroupKey =
        parameters.yearGroupKey === null ? null : String(parameters.yearGroupKey);
      abClass.courseLength = courseLength;
      this._roster._refreshRoster(abClass, classId);
    } else {
      abClass = this._roster.initialise(classId, {
        cohortKey: parameters.cohortKey,
        yearGroupKey: parameters.yearGroupKey,
        courseLength: courseLength,
      });
      abClass.active = true;
    }

    this.saveClass(abClass);
    return this._responseMapper._buildClassSummary(abClass);
  }

  /**
   * Applies a lightweight patch to editable ABClass fields and returns the persisted partial class summary.
   * Throws a `RangeError` if the class does not exist; it does not create a new class.
   * @param {Object} parameters - Patch parameters object.
   * @param {string} parameters.classId - Classroom course identifier (required).
   * @param {*} [parameters.cohortKey] - Optional cohort-key replacement.
   * @param {*} [parameters.yearGroupKey] - Optional year-group-key replacement.
   * @param {*} [parameters.courseLength] - Optional validated course length.
   * @param {boolean|null} [parameters.active] - Optional active-state replacement.
   * @returns {Object} Partial ABClass summary from toPartialJSON().
   * @throws {RangeError} When no stored document exists for the given classId.
   */
  updateABClass(parameters) {
    Validate.requireParams({ classId: parameters?.classId }, 'updateABClass');

    const classId = this._validation._validateClassId(parameters.classId, 'updateABClass');
    const patch = this._validation._buildUpdatePatch(parameters);
    const collection = this._dbManager.getCollection(classId);
    const existingDocument = collection.findOne({ classId: classId });

    if (!existingDocument) {
      throw new RangeError(`updateABClass: class '${classId}' does not exist`);
    }

    const abClass = this._validation._applyPatchToClass(ABClass.fromJSON(existingDocument), patch);

    collection.updateOne({ classId: classId }, { $set: patch });
    collection.save();
    this._persistence._upsertClassPartial(abClass);

    return this._responseMapper._buildClassSummary(abClass);
  }

  /**
   * Deletes the stored full-class collection and matching class-partial row.
   * Returns idempotent deletion flags for each persistence layer.
   * @param {Object} parameters - Delete parameters object.
   * @param {string} parameters.classId - Classroom course identifier (required).
   * @returns {{classId: string, fullClassDeleted: boolean, partialDeleted: boolean}} Deletion result for the full-class collection and the partial registry row.
   */
  deleteABClass(parameters) {
    Validate.requireParams({ classId: parameters?.classId }, 'deleteABClass');

    const classId = this._validation._validateDeleteClassId(parameters.classId, 'deleteABClass');
    let fullClassDeleted = false;
    let partialDeleted = false;

    try {
      this._dbManager.getDb().dropCollection(classId);
      fullClassDeleted = true;
    } catch (error) {
      if (!this._validation._isMissingCollectionError(error)) {
        throw error;
      }
    }

    const partialsCollection = this._dbManager.getCollection('abclass_partials');
    const existingPartial = partialsCollection.findOne({ classId: classId });

    if (existingPartial) {
      partialsCollection.deleteOne({ classId: classId });
      partialsCollection.save();
      partialDeleted = true;
    }

    return {
      classId,
      fullClassDeleted,
      partialDeleted,
    };
  }

  /**
   * Load an ABClass by its classId. Throws when no stored collection or document exists.
   * Reads the stored document when present, deserialises it, and refreshes roster data from Classroom API before returning.
   * @param {string} classId - The Classroom course identifier.
   * @returns {ABClass} The loaded class instance.
   * @throws {Error} If no stored data exists for the given classId.
   * @remarks loadClass no longer auto-initialises a new class; callers must ensure the class exists before calling.
   */
  loadClass(classId) {
    if (!classId) throw new TypeError('classId is required');
    const logger = ABLogger.getInstance();

    const collection = this._dbManager.getCollection(classId);
    logger.info('loadClass: called', { classId, hasCollection: !!collection });
    if (!collection) {
      throw new ClassNotFoundError(`loadClass: no stored class found for classId=${classId}`, {
        courseId: classId,
      });
    }

    // Collection exists - read the single stored document (if any)
    const document = collection.findOne({ classId: classId }) || null;
    if (!document) {
      throw new ClassNotFoundError(`loadClass: no stored class found for classId=${classId}`, {
        courseId: classId,
      });
    }

    const abClass = ABClass.fromJSON(document);
    logger.info('loadClass: refreshing roster before returning class', { classId });
    this._roster._refreshRoster(abClass, classId);
    this._roster._persistRoster(collection, document, abClass);
    logger.info('loadClass: refresh completed and roster persisted', { classId });
    return abClass;
  }

  /**
   * Reads a stored ABClass by its classId and returns a read-view representation.
   * Does NOT refresh roster data or persist changes (pure read operation).
   *
   * @param {string} classId - The Classroom course identifier.
   * @returns {Object} A read-view plain object representation of the class.
   * @throws {TypeError} If classId is falsy.
   * @throws {ClassNotFoundError} If no stored class document exists for the given classId.
   * @remarks Pure read — does not call `_refreshRoster`, `_persistRoster`, or any Classroom API.
   * Use `loadClass` when roster freshness is required. Returns a plain object with `assignments[]`
   * as `Assignment.toPartialJSON()` output; the partial shape is produced by the private
   * `_toReadView` method.
   */
  readClass(classId) {
    if (!classId) throw new TypeError('classId is required');
    const logger = ABLogger.getInstance();

    const collection = this._dbManager.getCollection(classId);
    logger.info('readClass: called', { classId, hasCollection: !!collection });
    if (!collection) {
      throw new ClassNotFoundError(`loadClass: no stored class found for classId=${classId}`, {
        courseId: classId,
      });
    }

    // Collection exists — read the single stored document (if any)
    const document = collection.findOne({ classId }) || null;
    if (!document) {
      throw new ClassNotFoundError(`loadClass: no stored class found for classId=${classId}`, {
        courseId: classId,
      });
    }

    const abClass = ABClass.fromJSON(document);
    logger.info('readClass: returning read view', { classId });
    return this._responseMapper._toReadView(abClass);
  }

  /**
   * Save a class representation to its collection named by classId.
   * Delegates to _persistClassAndPartial for write-through persistence to both full and partial stores.
   * @param {ABClass|Object} abClass - The class instance or plain object with classId property and toPartialJSON() method.
   * @returns {void}
   * @throws {TypeError} If abClass is missing required properties or methods.
   */
  saveClass(abClass) {
    if (!abClass || typeof abClass !== 'object') {
      throw new TypeError(
        'saveClass: expected an ABClass instance or plain object with classId and toPartialJSON()'
      );
    }

    if (!Object.hasOwn(abClass, 'classId')) {
      throw new TypeError('saveClass: missing required classId property on abClass argument');
    }

    if (typeof abClass.classId !== 'string' || abClass.classId.trim().length === 0) {
      throw new TypeError('saveClass: expected abClass.classId to be a non-empty string');
    }

    if (abClass.classId.includes('..') || abClass.classId.includes('/')) {
      throw new TypeError('saveClass: invalid classId format');
    }

    if (typeof abClass.toPartialJSON !== 'function') {
      throw new TypeError(
        'saveClass: expected abClass.toPartialJSON() to be a function for partial persistence'
      );
    }

    this._persistClassAndPartial(abClass);
    return true;
  }

  /**
   * Returns all class partial documents from the abclass_partials collection.
   * Normalises each stored document to the public transport shape so storage-only
   * fields such as `_id` do not leak through the API response.
   *
   * @returns {Array<object>} Array of plain class partial transport objects; empty array if none exist.
   * @throws {Error} Rethrows any collection read error.
   */
  getAllClassPartials() {
    const logger = ABLogger.getInstance();
    try {
      const partialsCollection = this._dbManager.getCollection('abclass_partials');
      const documents = partialsCollection.find({});
      if (!Array.isArray(documents)) {
        throw new TypeError('getAllClassPartials: unexpected non-array result from find()');
      }
      return documents.map((document) => this._responseMapper._normaliseClassPartial(document));
    } catch (error) {
      logger.error('getAllClassPartials: failed to read abclass_partials', { err: error });
      throw error;
    }
  }

  // ──────────────────────────────────────────────
  //  Public method delegated to sub-class (one-liner)
  // ──────────────────────────────────────────────

  /**
   * Initialises an ABClass instance by populating data that can be fetched using
   * the classId (Google Classroom courseId) alone. Populates: className,
   * classOwner, teachers and students. Additional properties (assignments,
   * cohortKey, courseLength, yearGroupKey) may be provided via options.
   *
   * @param {string} classId - The Classroom course ID.
   * @param {Object} [options={}] - Optional configuration for class properties.
   * @param {string|null} [options.cohortKey] - Cohort key value for the class.
   * @param {number} [options.courseLength] - Course duration in weeks.
   * @param {string|null} [options.yearGroupKey] - Academic year-group key.
   * @param {Assignment[]} [options.assignments] - Assignments to add to the class.
   * @returns {ABClass} Populated ABClass instance with roster data.
   * @throws {TypeError} If classId is missing.
   */
  initialise(classId, options = {}) {
    return this._roster.initialise(classId, options);
  }

  // ──────────────────────────────────────────────
  //  Private method delegators — ABClassRoster
  // ──────────────────────────────────────────────
  // eslint-disable-next-line jsdoc/require-jsdoc
  _applyCourseMetadata(abClass, courseId) {
    return this._roster._applyCourseMetadata(abClass, courseId);
  }
  // eslint-disable-next-line jsdoc/require-jsdoc
  _applyTeachers(abClass, courseId) {
    return this._roster._applyTeachers(abClass, courseId);
  }
  // eslint-disable-next-line jsdoc/require-jsdoc
  _applyStudents(abClass, classId) {
    return this._roster._applyStudents(abClass, classId);
  }
  // eslint-disable-next-line jsdoc/require-jsdoc
  _buildClassroomRosterUpdatePayload(abClass) {
    return this._roster._buildClassroomRosterUpdatePayload(abClass);
  }
  // eslint-disable-next-line jsdoc/require-jsdoc
  _refreshRoster(abClass, classId) {
    return this._roster._refreshRoster(abClass, classId);
  }
  // eslint-disable-next-line jsdoc/require-jsdoc
  _persistRoster(collection, existingDocument, abClass) {
    return this._roster._persistRoster(collection, existingDocument, abClass);
  }

  // ──────────────────────────────────────────────
  //  Private method delegators — ABClassAssignmentOps
  // ──────────────────────────────────────────────
  // eslint-disable-next-line jsdoc/require-jsdoc
  _loadFullAssignmentDocument(courseId, assignmentId) {
    return this._assignmentOps._loadFullAssignmentDocument(courseId, assignmentId);
  }
  // eslint-disable-next-line jsdoc/require-jsdoc
  _validateAssignmentDocument(document) {
    return this._assignmentOps._validateAssignmentDocument(document);
  }
  // eslint-disable-next-line jsdoc/require-jsdoc
  _ensureFullDefinition(assignment) {
    return this._assignmentOps._ensureFullDefinition(assignment);
  }
  // eslint-disable-next-line jsdoc/require-jsdoc
  _replaceAssignmentInClass(abClass, assignmentId, hydratedAssignment) {
    return this._assignmentOps._replaceAssignmentInClass(abClass, assignmentId, hydratedAssignment);
  }
  // eslint-disable-next-line jsdoc/require-jsdoc
  _getFullAssignmentCollectionName(courseId, assignmentId) {
    return this._assignmentOps._getFullAssignmentCollectionName(courseId, assignmentId);
  }

  // ──────────────────────────────────────────────
  //  Public method delegators — ABClassAssignmentOps
  // ──────────────────────────────────────────────

  /**
   * Persists an assignment run and saves the updated ABClass.
   * @param {Object} abClass - The ABClass instance.
   * @param {Object} assignment - The assignment to persist.
   */
  persistAssignmentRun(abClass, assignment) {
    this._assignmentOps.persistAssignmentRun(abClass, assignment);
    this.saveClass(abClass);
  }

  /**
   * Rehydrates an assignment by loading the full version from its dedicated collection.
   * Delegates to ABClassAssignmentOps.
   * @param {Object} abClass - The ABClass instance containing the assignment.
   * @param {string} assignmentId - The assignment ID to rehydrate.
   * @returns {Assignment} The fully hydrated assignment instance.
   */
  rehydrateAssignment(abClass, assignmentId) {
    return this._assignmentOps.rehydrateAssignment(abClass, assignmentId);
  }

  // ──────────────────────────────────────────────
  //  Private method delegators — ABClassPersistence
  // ──────────────────────────────────────────────
  /**
   * Write-through persistence: saves the full class document and upserts the partial.
   * Delegates to ABClassPersistence.
   * @param {Object} abClass - The ABClass instance to persist.
   * @returns {void}
   */
  _persistClassAndPartial(abClass) {
    return this._persistence.persistClassAndPartial(abClass);
  }
  // eslint-disable-next-line jsdoc/require-jsdoc
  _upsertClassPartial(abClass) {
    return this._persistence._upsertClassPartial(abClass);
  }

  // ──────────────────────────────────────────────
  //  Private method delegators — ABClassValidation
  // ──────────────────────────────────────────────
  // eslint-disable-next-line jsdoc/require-jsdoc
  _validateClassId(classId, methodName) {
    return this._validation._validateClassId(classId, methodName);
  }
  // eslint-disable-next-line jsdoc/require-jsdoc
  _validateDeleteClassId(classId, methodName) {
    return this._validation._validateDeleteClassId(classId, methodName);
  }
  // eslint-disable-next-line jsdoc/require-jsdoc
  _isMissingCollectionError(error) {
    return this._validation._isMissingCollectionError(error);
  }
  // eslint-disable-next-line jsdoc/require-jsdoc
  _validateCourseLength(courseLength, methodName) {
    return this._validation._validateCourseLength(courseLength, methodName);
  }
  // eslint-disable-next-line jsdoc/require-jsdoc
  _buildUpdatePatch(parameters) {
    return this._validation._buildUpdatePatch(parameters);
  }
  // eslint-disable-next-line jsdoc/require-jsdoc
  _applyPatchToClass(abClass, patch) {
    return this._validation._applyPatchToClass(abClass, patch);
  }

  // ──────────────────────────────────────────────
  //  Private method delegators — ABClassResponseMapper
  // ──────────────────────────────────────────────
  // eslint-disable-next-line jsdoc/require-jsdoc
  _normaliseClassPartial(partialDocument) {
    return this._responseMapper._normaliseClassPartial(partialDocument);
  }
  // eslint-disable-next-line jsdoc/require-jsdoc
  _buildClassSummary(abClass) {
    return this._responseMapper._buildClassSummary(abClass);
  }
  // eslint-disable-next-line jsdoc/require-jsdoc
  _toReadView(abClass) {
    return this._responseMapper._toReadView(abClass);
  }
}

// Export for Node tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ABClassController;
}
