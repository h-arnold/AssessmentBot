/* global Validate, ABClass, ABLogger */

/** Coordinates ABClass create, edit, and removal operations across injected domain owners. */
class ABClassMutationOps {
  /**
   * Creates an operation owner with its collaborators.
   * @param {Object} options - Mutation collaborators.
   * @param {Object} options.dbManager - Database manager used for class collection access.
   * @param {ABClassValidation} options.validation - Shared mutation input checks.
   * @param {ABClassPersistence} options.persistence - Full and partial persistence operations.
   * @param {ABClassRoster} options.roster - Classroom roster operations.
   * @param {ABClassResponseMapper} options.responseMapper - Mutation summary projection.
   */
  constructor({ dbManager, validation, persistence, roster, responseMapper }) {
    this._dbManager = dbManager;
    this._validation = validation;
    this._persistence = persistence;
    this._roster = roster;
    this._responseMapper = responseMapper;
  }

  /**
   * Creates a class or refreshes an existing class, then persists and summarises it.
   * @param {Object} parameters - Required class configuration and optional own `metadata` value.
   * @param {Object|null} [parameters.metadata] - Optional complete snapshot replacement; omission preserves an existing value or leaves a new class at null, and null clears it.
   * @returns {Object} Partial ABClass summary.
   * @throws {ABClassMetadataValidationError} If explicitly supplied request metadata is invalid. The mutation transport adapts request-provenance failures to `ApiValidationError`/`INVALID_REQUEST`; stored, model, and internal integrity failures remain unchanged.
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
    this._validation._validateRequestMetadata(parameters);

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
      if (Object.hasOwn(parameters, 'metadata')) abClass.setMetadata(parameters.metadata);
      this._roster._refreshRoster(abClass, classId);
    } else {
      abClass = this._roster.initialise(classId, {
        cohortKey: parameters.cohortKey,
        yearGroupKey: parameters.yearGroupKey,
        courseLength: courseLength,
      });
      if (Object.hasOwn(parameters, 'metadata')) abClass.setMetadata(parameters.metadata);
      abClass.active = true;
    }

    this._validation._validateClassForSave(abClass);
    this._persistence.persistClassAndPartial(abClass);
    return this._responseMapper._buildClassSummary(abClass);
  }

  /**
   * Applies a selective editable-field patch to an existing class.
   * @param {Object} parameters - Class identifier and editable fields, including optional complete metadata replacement.
   * @param {Object|null} [parameters.metadata] - Optional complete snapshot replacement; omission preserves it, null clears it, and nested patching is unsupported.
   * @returns {Object} Partial ABClass summary.
   * @throws {ABClassMetadataValidationError} If explicitly supplied request metadata is invalid. The mutation transport adapts request-provenance failures to `ApiValidationError`/`INVALID_REQUEST`; stored, model, and internal integrity failures remain unchanged.
   */
  updateABClass(parameters) {
    Validate.requireParams({ classId: parameters?.classId }, 'updateABClass');
    this._validation._validateRequestMetadata(parameters);

    const classId = this._validation._validateClassId(parameters.classId, 'updateABClass');
    const patch = this._validation._buildUpdatePatch(parameters);
    const collection = this._dbManager.getCollection(classId);
    const existingDocument = collection.findOne({ classId: classId });

    if (!existingDocument) {
      throw new RangeError(`updateABClass: class '${classId}' does not exist`);
    }

    const abClass = this._validation._applyPatchToClass(ABClass.fromJSON(existingDocument), patch);
    if (Object.hasOwn(patch, 'metadata')) {
      patch.metadata = this._persistence._metadataCopy(abClass);
    }
    const partialData = this._persistence._prepareClassPartial(abClass);

    collection.updateOne({ classId: classId }, { $set: patch });
    collection.save();
    this._persistence._writePreparedClassPartial(classId, partialData);

    return this._responseMapper._buildClassSummary(abClass);
  }

  /**
   * Removes the full class collection and its registry row.
   * @param {Object} parameters - Class identifier.
   * @returns {{classId: string, hasDeletedFullClass: boolean, hasDeletedClassPartial: boolean}} Deletion flags.
   */
  deleteABClass(parameters) {
    Validate.requireParams({ classId: parameters?.classId }, 'deleteABClass');

    const classId = this._validation._validateDeleteClassId(parameters.classId, 'deleteABClass');
    let hasDeletedFullClass = false;
    let hasDeletedClassPartial = false;

    try {
      this._dbManager.getDb().dropCollection(classId);
      hasDeletedFullClass = true;
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
      hasDeletedClassPartial = true;
    }

    return {
      classId,
      hasDeletedFullClass,
      hasDeletedClassPartial,
    };
  }
}

// Export for Node tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ABClassMutationOps;
}
