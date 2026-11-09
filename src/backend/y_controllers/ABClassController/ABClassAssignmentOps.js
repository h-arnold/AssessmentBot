/* global ABLogger, Assignment, AssignmentNotFoundError, TypeError, AssignmentDefinitionController, Validate, ABClassAssignmentValidation */

/**
 * ABClassAssignmentOps
 *
 * Assignment run persistence and rehydration operations. Persists full
 * assignment payloads to dedicated collections and manages the
 * hydration lifecycle between partial and full assignment representations.
 * Completed-run validation is delegated to {@link ABClassAssignmentValidation}
 * and class-save validation to the injected `ABClassValidation`.
 */
class ABClassAssignmentOps {
  /** Constructs ABClassAssignmentOps.
   * @param {Object} options - Options object.
   * @param {Object} options.dbManager - The DbManager instance for collection access.
   * @param {Object} options.validation - An ABClassValidation instance.
   * @param {Object} options.persistence - An ABClassPersistence instance.
   * @param {ABClassAssignmentValidation} [options.assignmentValidation] - Completed-run validation owner; defaults to a new instance.
   */
  constructor({ dbManager, validation, persistence, assignmentValidation }) {
    this._dbManager = dbManager;
    this._validation = validation;
    this._persistence = persistence;
    this._assignmentValidation = assignmentValidation ?? new ABClassAssignmentValidation();
  }

  /** Generates the collection name for a full assignment.
   * @param {string} courseId - The Classroom course ID.
   * @param {string} assignmentId - The assignment ID.
   * @returns {string} Collection name following pattern: assign_full_<courseId>_<assignmentId>.
   */
  _getFullAssignmentCollectionName(courseId, assignmentId) {
    return `assign_full_${courseId}_${assignmentId}`;
  }

  /** Persists a completed assignment run and its class projections.
   * Persist an assignment run by writing full payload to dedicated collection
   * and updating the ABClass with a partial summary.
   *
   * @remarks Deliberately NOT transactional, no rollback: the full assignment
   * store is written first, then the class store, then the abclass_partials
   * registry. Completed-run validation is delegated to
   * {@link ABClassAssignmentValidation}; the same class-save contract that
   * `saveClass()` enforces (`ABClassValidation._validateClassForSave`) also runs
   * here before the first mutation, so an invalid class cannot commit the full
   * assignment and then fail outside both persistence owners' diagnostics.
   * All four projections (full assignment, embedded partial,
   * prospective full class, class-partials registry) are prepared through the
   * existing class preparation owner before the first collection mutation, and
   * every later write consumes those exact prepared payloads. A storage failure
   * throws after logging the failed phase and whether the full assignment write
   * committed; it never reports a completed run and nothing repairs the state.
   *
   * @param {ABClass|Object} abClass - An ABClass instance or plain object with
   *   a `classId` property and a `toPartialJSON()` method.
   * @param {Assignment} assignment - The assignment to persist
   * @returns {Object} Prepared class and registry payloads for the facade write.
   * @see ABClassAssignmentValidation
   */
  persistAssignmentRun(abClass, assignment) {
    const logger = ABLogger.getInstance();
    let failedPhase = 'completed-write-validation';
    let hasFullWriteCommitted = false;
    try {
      Validate.requireParams({ abClass, assignment }, 'persistAssignmentRun');

      if (!assignment.courseId || !assignment.assignmentId) {
        throw new TypeError('Assignment must have courseId and assignmentId');
      }

      if (typeof abClass.classId !== 'string' || abClass.classId.trim().length === 0) {
        throw new TypeError(
          'persistAssignmentRun: expected abClass.classId to be a non-empty string'
        );
      }

      if (typeof assignment.courseId !== 'string' || assignment.courseId.trim().length === 0) {
        throw new TypeError(
          'persistAssignmentRun: expected assignment.courseId to be a non-empty string'
        );
      }

      if (
        typeof assignment.assignmentId !== 'string' ||
        assignment.assignmentId.trim().length === 0
      ) {
        throw new TypeError(
          'persistAssignmentRun: expected assignment.assignmentId to be a non-empty string'
        );
      }

      // Fail-fast: reject partial assignmentDefinition (tasks is an array).
      // Full persistence requires a fully hydrated definition with keyed task objects.
      if (Array.isArray(assignment.assignmentDefinition?.tasks)) {
        throw new TypeError(
          'Cannot persist full assignment with partial assignmentDefinition (tasks is an array)'
        );
      }

      // Completed-write gate: reject an incomplete or invalid terminal result
      // before any projection or collection mutation.
      this._assignmentValidation._validateCompletedAssignmentRun(assignment);

      // Reuse the existing class-save contract so an invalid class cannot commit
      // the full assignment and then fail outside both persistence diagnostics.
      this._validation._validateClassForSave(abClass);

      // Stamp the result-format marker only after the completed state is valid
      // and before the full and partial payloads are serialised.
      assignment.assessmentContractVersion = 1;

      // 1. Prepare the full assignment and embedded partial projections.
      failedPhase = 'full-assignment-projection';
      assignment._hydrationLevel = 'full';
      const fullPayload = assignment.toJSON();

      failedPhase = 'embedded-partial-projection';
      const partialPayload = assignment.toPartialJSON();

      // Restore the actual partial representation that will live in the class.
      // This is a representation conversion, not a validation-only round-trip.
      const partialView = Assignment.fromJSON(partialPayload, 'partial');
      partialView._hydrationLevel = 'partial';
      const assignmentIndex = abClass.findAssignmentIndex(
        (a) => a.assignmentId === assignment.assignmentId
      );
      const existingAssignment = assignmentIndex >= 0 ? abClass.assignments[assignmentIndex] : null;
      if (assignmentIndex >= 0) abClass.assignments[assignmentIndex] = partialView;
      else abClass.assignments.push(partialView);
      let classFullData;
      let classPartialData;
      try {
        failedPhase = 'prospective-class-projection';
        classFullData = this._persistence._prepareFullClass(abClass);
        failedPhase = 'class-partials-projection';
        classPartialData = this._persistence._prepareClassPartial(abClass);
      } finally {
        if (assignmentIndex >= 0) abClass.assignments[assignmentIndex] = existingAssignment;
        else abClass.assignments.pop();
      }

      // 3. Write the full assignment to its dedicated collection.
      failedPhase = 'full-assignment-store';
      const collectionName = this._getFullAssignmentCollectionName(
        assignment.courseId,
        assignment.assignmentId
      );
      const fullCollection = this._dbManager.getCollection(collectionName);

      logger.info('persistAssignmentRun: writing full assignment', {
        courseId: assignment.courseId,
        assignmentId: assignment.assignmentId,
        collectionName,
      });

      // Use replaceOne to ensure single document per assignment
      const filter = {
        courseId: assignment.courseId,
        assignmentId: assignment.assignmentId,
      };
      const existing = fullCollection.findOne(filter);

      if (existing) {
        fullCollection.replaceOne(filter, fullPayload);
      } else {
        fullCollection.insertOne(fullPayload);
      }
      fullCollection.save();
      hasFullWriteCommitted = true;

      if (assignmentIndex >= 0) abClass.assignments[assignmentIndex] = partialView;
      else abClass.assignments.push(partialView);
      logger.info('persistAssignmentRun: prepared class projections', {
        assignmentId: assignment.assignmentId,
        index: assignmentIndex,
      });
      return {
        fullData: classFullData,
        partialData: classPartialData,
        fullWriteCommitted: true,
      };
    } catch (error) {
      logger.error('persistAssignmentRun failed', {
        courseId: assignment?.courseId,
        assignmentId: assignment?.assignmentId,
        err: error,
        failedPhase,
        fullWriteCommitted: hasFullWriteCommitted,
      });
      throw error;
    }
  }

  /**
   * Read-only rehydration of an assignment from its dedicated collection.
   * Loads and hydrates an assignment without requiring an ABClass instance,
   * triggering a roster refresh, or mutating any class.
   *
   * @param {string} courseId - The Classroom course ID.
   * @param {string} assignmentId - The assignment ID to rehydrate.
   * @returns {Assignment} The fully hydrated assignment instance.
   * @throws {TypeError} If courseId or assignmentId are not non-empty strings.
   * @throws {AssignmentNotFoundError} If no document exists for the given identifiers.
   * @throws {Error} If the document is corrupt or the definition cannot be resolved.
   */
  readRehydrateAssignment(courseId, assignmentId) {
    // Keep the direct guards: requireParams would replace the required exact
    // TypeError messages with a generic Error for null or undefined inputs.
    if (typeof courseId !== 'string' || courseId.trim().length === 0) {
      throw new TypeError('readRehydrateAssignment: expected courseId to be a non-empty string');
    }

    if (typeof assignmentId !== 'string' || assignmentId.trim().length === 0) {
      throw new TypeError(
        'readRehydrateAssignment: expected assignmentId to be a non-empty string'
      );
    }

    const document = this._loadFullAssignmentDocument(courseId, assignmentId);
    this._validateAssignmentDocument(document);

    const hydratedAssignment = Assignment.fromJSON(document, 'full');
    this._ensureFullDefinition(hydratedAssignment);
    hydratedAssignment._hydrationLevel = 'full';

    return hydratedAssignment;
  }

  /**
   * Loads the full assignment document from its dedicated collection.
   *
   * @param {string} courseId - The Classroom course ID.
   * @param {string} assignmentId - The assignment ID.
   * @returns {Object} The assignment document.
   * @throws {AssignmentNotFoundError} If the document is not found in its dedicated collection.
   * @throws {Error} If an error occurs during loading.
   */
  _loadFullAssignmentDocument(courseId, assignmentId) {
    const logger = ABLogger.getInstance();
    const collectionName = this._getFullAssignmentCollectionName(courseId, assignmentId);
    const fullCollection = this._dbManager.getCollection(collectionName);
    const document = fullCollection.findOne({ courseId, assignmentId });

    if (!document) {
      throw new AssignmentNotFoundError(
        `No document found in collection ${collectionName} for courseId=${courseId}, assignmentId=${assignmentId}. Assignment does not exist or has not been persisted.`,
        { courseId, assignmentId, collectionName }
      );
    }

    logger.info('_loadFullAssignmentDocument: loading full assignment', {
      courseId,
      assignmentId,
      collectionName,
    });

    return document;
  }

  /**
   * Validates that an assignment document has all required fields.
   *
   * @param {Object} document - The assignment document to validate.
   * @throws {Error} If required fields courseId, assignmentId, or assignmentDefinition are missing.
   */
  _validateAssignmentDocument(document) {
    if (!document.courseId || !document.assignmentId) {
      throw new Error(
        'Corrupt or invalid assignment data: missing required fields courseId or assignmentId'
      );
    }

    if (!document.assignmentDefinition) {
      throw new Error(
        'Corrupt or invalid assignment data: missing required field assignmentDefinition'
      );
    }
  }

  /**
   * Ensures the assignment has a full definition.
   * Detects partial definitions (tasks is an array) and fetches the full definition as needed.
   *
   * @param {Assignment} assignment - The assignment to check and potentially complete.
   */
  _ensureFullDefinition(assignment) {
    const definitionKey = assignment.assignmentDefinition?.definitionKey;
    if (!definitionKey) return;

    // Detect partial definition by checking if tasks is an array
    const isPartial = Array.isArray(assignment.assignmentDefinition?.tasks);

    if (!isPartial) return;

    const definitionController = new AssignmentDefinitionController();
    const storedDefinition = definitionController.getDefinitionByKey(definitionKey, {
      form: 'full',
    });

    if (!storedDefinition || Array.isArray(storedDefinition.tasks)) {
      throw new Error(
        `Failed to rehydrate definition '${definitionKey}': the authoritative record is a partial (tasks is an array).`
      );
    }

    // Use the full definition from the registry
    assignment.assignmentDefinition = storedDefinition;
  }
}

// Export for Node tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ABClassAssignmentOps;
}
