/* global ABLogger, Assignment, AssignmentNotFoundError, TypeError, AssignmentDefinitionController */

/**
 * ABClassAssignmentOps
 *
 * Assignment run persistence and rehydration operations. Persists full
 * assignment payloads to dedicated collections and manages the
 * hydration lifecycle between partial and full assignment representations.
 */
class ABClassAssignmentOps {
  /**
   * Constructs ABClassAssignmentOps.
   * @param {Object} options - Options object.
   * @param {Object} options.dbManager - The DbManager instance for collection access.
   * @param {Object} options.validation - An ABClassValidation instance.
   * @param {Object} options.persistence - An ABClassPersistence instance.
   */
  constructor({ dbManager, validation, persistence }) {
    this._dbManager = dbManager;
    this._validation = validation;
    this._persistence = persistence;
  }

  /**
   * Generate consistent collection name for full assignment persistence.
   *
   * @param {string} courseId - The Classroom course ID.
   * @param {string} assignmentId - The assignment ID.
   * @returns {string} Collection name following pattern: assign_full_<courseId>_<assignmentId>.
   */
  _getFullAssignmentCollectionName(courseId, assignmentId) {
    return `assign_full_${courseId}_${assignmentId}`;
  }

  /**
   * Persist an assignment run by writing full payload to dedicated collection
   * and updating the ABClass with a partial summary.
   * @param {ABClass|Object} abClass - An ABClass instance or plain object with
   *   a `classId` property and a `toPartialJSON()` method.
   * @param {Assignment} assignment - The assignment to persist
   * @return {void}
   */
  persistAssignmentRun(abClass, assignment) {
    const logger = ABLogger.getInstance();

    if (!abClass || !assignment) {
      throw new TypeError('persistAssignmentRun requires abClass and assignment');
    }

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

    try {
      if (assignment.assignmentDefinition?.tasks === null) {
        throw new Error(
          'Cannot persist full assignment with partial assignmentDefinition (tasks: null)'
        );
      }
      // 1. Serialize full assignment and write to dedicated collection
      const collectionName = this._getFullAssignmentCollectionName(
        assignment.courseId,
        assignment.assignmentId
      );
      const fullCollection = this._dbManager.getCollection(collectionName);
      assignment._hydrationLevel = 'full';
      const fullPayload = assignment.toJSON();

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

      // 2. Generate partial summary and reconstruct as typed instance
      const partialJson = assignment.toPartialJSON();
      const partialInstance = Assignment.fromJSON(partialJson);
      partialInstance._hydrationLevel = 'partial';

      // 3. Find and replace assignment in abClass.assignments
      const index = abClass.findAssignmentIndex((a) => a.assignmentId === assignment.assignmentId);

      if (index >= 0) {
        // eslint-disable-next-line security/detect-object-injection
        abClass.assignments[index] = partialInstance;
        logger.info('persistAssignmentRun: replaced existing assignment in ABClass', {
          assignmentId: assignment.assignmentId,
          index: index,
        });
      } else {
        abClass.assignments.push(partialInstance);
        logger.info('persistAssignmentRun: added new assignment to ABClass', {
          assignmentId: assignment.assignmentId,
        });
      }

      // 4. Save updated ABClass with partial assignment
      this._persistence.persistClassAndPartial(abClass);

      logger.info('persistAssignmentRun: completed successfully', {
        courseId: assignment.courseId,
        assignmentId: assignment.assignmentId,
      });
    } catch (error) {
      logger.error('persistAssignmentRun failed', {
        courseId: assignment.courseId,
        assignmentId: assignment.assignmentId,
        err: error,
      });
      throw error;
    }
  }

  /**
   * Rehydrate an assignment by loading the full version from its dedicated collection.
   * Updates the ABClass with the hydrated assignment and ensures full definition is available.
   *
   * @param {ABClass|Object} abClass - An ABClass instance with classId property.
   * @param {string} assignmentId - The assignment ID to rehydrate.
   * @returns {Assignment} The fully hydrated assignment instance.
   * @throws {TypeError} If parameters are invalid.
   * @throws {Error} If the assignment document is not found or corrupt.
   */
  rehydrateAssignment(abClass, assignmentId) {
    const logger = ABLogger.getInstance();

    if (!abClass || !assignmentId) {
      throw new TypeError('rehydrateAssignment requires abClass and assignmentId');
    }

    if (typeof abClass.classId !== 'string' || abClass.classId.trim().length === 0) {
      throw new TypeError('rehydrateAssignment: expected abClass.classId to be a non-empty string');
    }

    if (typeof assignmentId !== 'string' || assignmentId.trim().length === 0) {
      throw new TypeError('rehydrateAssignment: expected assignmentId to be a non-empty string');
    }

    const courseId = abClass.classId;

    try {
      const document = this._loadFullAssignmentDocument(courseId, assignmentId);
      this._validateAssignmentDocument(document);

      const hydratedAssignment = Assignment.fromJSON(document);
      this._ensureFullDefinition(hydratedAssignment);
      hydratedAssignment._hydrationLevel = 'full';

      this._replaceAssignmentInClass(abClass, assignmentId, hydratedAssignment);

      return hydratedAssignment;
    } catch (error) {
      logger.error('rehydrateAssignment failed', {
        courseId,
        assignmentId,
        err: error,
      });
      throw error;
    }
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

    logger.info('rehydrateAssignment: loading full assignment', {
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
   * Detects partial definitions (tasks === null) and fetches or persists the full definition as needed.
   *
   * @param {Assignment} assignment - The assignment to check and potentially complete.
   */
  _ensureFullDefinition(assignment) {
    const definitionKey = assignment.assignmentDefinition?.definitionKey;
    if (!definitionKey) return;

    // Detect partial definition by checking if tasks is null
    const isPartial = assignment.assignmentDefinition?.tasks === null;

    if (isPartial) {
      const definitionController = new AssignmentDefinitionController();
      const storedDefinition = definitionController.getDefinitionByKey(definitionKey, {
        form: 'full',
      });

      if (storedDefinition && storedDefinition.tasks !== null) {
        // Use the full definition from the registry
        assignment.assignmentDefinition = storedDefinition;
      } else {
        throw new Error(
          `Failed to rehydrate definition '${definitionKey}': the authoritative record is partial (tasks: null).`
        );
      }
    }
  }

  /**
   * Replaces an assignment in the ABClass assignments array.
   *
   * @param {ABClass|Object} abClass - The class containing the assignments.
   * @param {string} assignmentId - The assignment ID to replace.
   * @param {Assignment} hydratedAssignment - The new fully hydrated assignment instance.
   * @throws {Error} If the assignment ID is not found in the class.
   */
  _replaceAssignmentInClass(abClass, assignmentId, hydratedAssignment) {
    const logger = ABLogger.getInstance();
    const index = abClass.findAssignmentIndex((a) => a.assignmentId === assignmentId);

    if (index >= 0) {
      // eslint-disable-next-line security/detect-object-injection
      abClass.assignments[index] = hydratedAssignment;
      logger.info('rehydrateAssignment: replaced assignment in ABClass', {
        assignmentId,
        index: index,
      });
    } else {
      throw new Error(
        `Assignment with ID '${assignmentId}' not found in the provided ABClass instance for course '${abClass.classId}'.`
      );
    }
  }
}

// Export for Node tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ABClassAssignmentOps;
}
