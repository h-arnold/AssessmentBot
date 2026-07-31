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
      throw new ClassNotFoundError(`readClass: no stored class found for classId=${classId}`, {
        courseId: classId,
      });
    }

    // Collection exists — read the single stored document (if any)
    const document = collection.findOne({ classId }) || null;
    if (!document) {
      throw new ClassNotFoundError(`readClass: no stored class found for classId=${classId}`, {
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
  /**
   * Delegates to ABClassRoster._applyCourseMetadata.
   * @param {ABClass} abClass - The class instance to update.
   * @param {string} courseId - The Classroom course ID.
   * @returns {void}
   * @throws {Error} Rethrows any errors from ClassroomApiClient.
   */
  _applyCourseMetadata(abClass, courseId) {
    return this._roster._applyCourseMetadata(abClass, courseId);
  }
  /**
   * Delegates to ABClassRoster._applyTeachers.
   * @param {ABClass} abClass - The class instance to populate.
   * @param {string} courseId - The Classroom course ID.
   * @returns {void}
   * @throws {Error} Rethrows any errors from ClassroomApiClient or deserialisation.
   */
  _applyTeachers(abClass, courseId) {
    return this._roster._applyTeachers(abClass, courseId);
  }
  /**
   * Delegates to ABClassRoster._applyStudents.
   * @param {ABClass} abClass - The class instance to populate.
   * @param {string} classId - The Classroom course ID.
   * @returns {void}
   * @throws {Error} Rethrows any errors from ClassroomApiClient.
   */
  _applyStudents(abClass, classId) {
    return this._roster._applyStudents(abClass, classId);
  }
  /**
   * Delegates to ABClassRoster._buildClassroomRosterUpdatePayload.
   * @param {ABClass} abClass - The class instance to serialise.
   * @returns {Object} Payload with className, classOwner, teachers, and students.
   */
  _buildClassroomRosterUpdatePayload(abClass) {
    return this._roster._buildClassroomRosterUpdatePayload(abClass);
  }
  /**
   * Delegates to ABClassRoster._refreshRoster.
   * @param {ABClass} abClass - The class instance to refresh.
   * @param {string} classId - The Classroom course ID.
   * @returns {void}
   */
  _refreshRoster(abClass, classId) {
    return this._roster._refreshRoster(abClass, classId);
  }
  /**
   * Delegates to ABClassRoster._persistRoster.
   * @param {Object} collection - The JsonDb collection to persist to.
   * @param {Object} existingDocument - The existing document (if any) to identify for update.
   * @param {ABClass} abClass - The class instance to persist.
   * @returns {void}
   * @throws {Error} Rethrows any persistence errors.
   */
  _persistRoster(collection, existingDocument, abClass) {
    return this._roster._persistRoster(collection, existingDocument, abClass);
  }

  // ──────────────────────────────────────────────
  //  Private method delegators — ABClassAssignmentOps
  // ──────────────────────────────────────────────
  /**
   * Delegates to ABClassAssignmentOps._loadFullAssignmentDocument.
   * @param {string} courseId - The Classroom course ID.
   * @param {string} assignmentId - The assignment ID.
   * @returns {Object} The assignment document.
   * @throws {AssignmentNotFoundError} If the document is not found.
   */
  _loadFullAssignmentDocument(courseId, assignmentId) {
    return this._assignmentOps._loadFullAssignmentDocument(courseId, assignmentId);
  }
  /**
   * Delegates to ABClassAssignmentOps._validateAssignmentDocument.
   * @param {Object} document - The assignment document to validate.
   * @returns {void}
   * @throws {Error} If required fields are missing.
   */
  _validateAssignmentDocument(document) {
    return this._assignmentOps._validateAssignmentDocument(document);
  }
  /**
   * Delegates to ABClassAssignmentOps._ensureFullDefinition.
   * @param {Assignment} assignment - The assignment to ensure has a full definition.
   * @returns {void}
   * @throws {Error} If the authoritative definition is partial.
   */
  _ensureFullDefinition(assignment) {
    return this._assignmentOps._ensureFullDefinition(assignment);
  }
  /**
   * Delegates to ABClassAssignmentOps._getFullAssignmentCollectionName.
   * @param {string} courseId - The Classroom course ID.
   * @param {string} assignmentId - The assignment ID.
   * @returns {string} Collection name following pattern: assign_full_<courseId>_<assignmentId>.
   */
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
   * Read-only rehydrate: loads and hydrates an assignment directly from its
   * dedicated collection without needing an ABClass instance.
   * Performs no roster refresh, no database write, and no ABClass mutation.
   * Delegates to ABClassAssignmentOps.readRehydrateAssignment.
   * @param {string} courseId - The Classroom course identifier.
   * @param {string} assignmentId - The assignment ID to rehydrate.
   * @returns {Assignment} The fully hydrated assignment instance.
   * @throws {TypeError} If courseId or assignmentId is not a non-empty string.
   * @throws {AssignmentNotFoundError} If no document exists for the given identifiers.
   */
  readRehydrateAssignment(courseId, assignmentId) {
    return this._assignmentOps.readRehydrateAssignment(courseId, assignmentId);
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
  /**
   * Delegates to ABClassPersistence._upsertClassPartial.
   * @param {Object} abClass - The ABClass instance to persist as a partial.
   * @returns {void}
   * @throws {Error} Rethrows any persistence error.
   */
  _upsertClassPartial(abClass) {
    return this._persistence._upsertClassPartial(abClass);
  }

  // ──────────────────────────────────────────────
  //  Private method delegators — ABClassValidation
  // ──────────────────────────────────────────────
  /**
   * Delegates to ABClassValidation._validateClassId.
   * @param {*} classId - The class ID to validate.
   * @param {string} methodName - The calling method name for error reporting.
   * @returns {string} The validated classId.
   * @throws {TypeError} If classId is not a non-empty string.
   */
  _validateClassId(classId, methodName) {
    return this._validation._validateClassId(classId, methodName);
  }
  /**
   * Delegates to ABClassValidation._validateDeleteClassId.
   * @param {*} classId - The class ID to validate.
   * @param {string} methodName - The calling method name for error reporting.
   * @returns {string} The validated classId.
   * @throws {TypeError} If classId is invalid or contains path traversal characters.
   */
  _validateDeleteClassId(classId, methodName) {
    return this._validation._validateDeleteClassId(classId, methodName);
  }
  /**
   * Delegates to ABClassValidation._isMissingCollectionError.
   * @param {Error} error - The error to check.
   * @returns {boolean} True if the error is a COLLECTION_NOT_FOUND error.
   */
  _isMissingCollectionError(error) {
    return this._validation._isMissingCollectionError(error);
  }
  /**
   * Delegates to ABClassValidation._validateCourseLength.
   * @param {*} courseLength - The course length to validate.
   * @param {string} methodName - The calling method name for error reporting.
   * @returns {number} The validated courseLength.
   * @throws {TypeError} If courseLength is not an integer >= 1.
   */
  _validateCourseLength(courseLength, methodName) {
    return this._validation._validateCourseLength(courseLength, methodName);
  }
  /**
   * Delegates to ABClassValidation._buildUpdatePatch.
   * @param {Object} parameters - The update parameters object.
   * @returns {Object} Patch object containing only provided fields.
   */
  _buildUpdatePatch(parameters) {
    return this._validation._buildUpdatePatch(parameters);
  }
  /**
   * Delegates to ABClassValidation._applyPatchToClass.
   * @param {ABClass} abClass - The class instance to update.
   * @param {Object} patch - The patch object containing fields to update.
   * @returns {ABClass} The updated class instance.
   */
  _applyPatchToClass(abClass, patch) {
    return this._validation._applyPatchToClass(abClass, patch);
  }

  // ──────────────────────────────────────────────
  //  Private method delegators — ABClassResponseMapper
  // ──────────────────────────────────────────────
  /**
   * Delegates to ABClassResponseMapper._normaliseClassPartial.
   * @param {Object} partialDocument - Raw partial document read from storage.
   * @returns {Object} Normalised class partial payload.
   * @throws {TypeError} If the document is not a plain object or lacks required fields.
   */
  _normaliseClassPartial(partialDocument) {
    return this._responseMapper._normaliseClassPartial(partialDocument);
  }
  /**
   * Delegates to ABClassResponseMapper._buildClassSummary.
   * @param {ABClass} abClass - The class instance to summarise.
   * @returns {Object} Partial JSON summary of the class.
   */
  _buildClassSummary(abClass) {
    return this._responseMapper._buildClassSummary(abClass);
  }
  /**
   * Delegates to ABClassResponseMapper._toReadView.
   * @param {ABClass} abClass - The class instance to convert.
   * @returns {Object} A plain read-view object.
   */
  _toReadView(abClass) {
    return this._responseMapper._toReadView(abClass);
  }
}

// Export for Node tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ABClassController;
}
