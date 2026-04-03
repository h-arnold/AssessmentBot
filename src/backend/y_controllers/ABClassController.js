/**
 * ABClassController
 *
 * Loads, persists, and mutates ABClass records stored in JsonDbApp-backed
 * collections managed by DbManager. Each class is stored in a collection named
 * after its classId, with plain serialized ABClass objects written via
 * ABClass.toJSON().
 */

/**
 * ABClassController
 *
 * Loads, persists, and mutates ABClass records stored in JsonDbApp-backed
 * collections managed by DbManager. Each class is stored in a collection named
 * after its classId, with plain serialized ABClass objects written via
 * ABClass.toJSON().
 */

/**
 * Creates the ABClassController.
 */
class ABClassController {
  /**
   * Initialises the ABClassController.
   */
  constructor() {
    this.dbManager = DbManager.getInstance();
  }

  /**
   * Fetches course metadata from the Classroom API and applies it to the ABClass.
   * Updates the class name and owner information.
   *
   * @param {ABClass} abClass - The class instance to update.
   * @param {string} courseId - The Classroom course ID.
   * @throws {Error} Rethrows any errors from ClassroomApiClient.
   * @private
   */
  _applyCourseMetadata(abClass, courseId) {
    // Call the ClassroomApiClient static method directly and allow errors to surface
    const course = ClassroomApiClient.fetchCourse(courseId);

    if (course.name) {
      abClass.setClassName(course.name);
    }

    if (course.ownerId) {
      const owner = new Teacher(null, course.ownerId);
      abClass.setClassOwner(owner);
    }
  }

  /**
   * Fetches teacher list from the Classroom API and populates them in the ABClass.
   * Handles both Teacher instances and legacy API objects.
   *
   * @param {ABClass} abClass - The class instance to populate.
   * @param {string} courseId - The Classroom course ID.
   * @throws {Error} Rethrows any errors from ClassroomApiClient or deserialisation.
   * @private
   */
  _applyTeachers(abClass, courseId) {
    const logger = ABLogger.getInstance();
    // Call the ClassroomApiClient static method directly and allow errors to surface
    const teachers = ClassroomApiClient.fetchTeachers(courseId);

    // Support both new behaviour (Teacher instances) and legacy raw API objects.
    teachers.forEach((teacherObject) => {
      // Ensure we operate on a Teacher instance so setClassOwner's instanceof
      // check in ABClass doesn't throw. Support both Teacher instances and
      // plain objects returned by legacy API mocks.
      let teacherInstance = teacherObject;
      if (!(teacherObject instanceof Teacher) && typeof Teacher.fromJSON === 'function') {
        try {
          teacherInstance = Teacher.fromJSON(teacherObject) || teacherObject;
        } catch (error) {
          logger.error('_applyTeachers: failed to deserialize teacher payload', {
            courseId,
            teacherId: teacherObject?.userId,
            err: error,
          });
          throw error;
        }
      }

      // If this teacher matches the course owner, set as owner (using a
      // Teacher instance). Otherwise add to teachers list.
      if (abClass.classOwner && abClass.classOwner.userId === teacherObject.userId) {
        // Prefer the instance we coerced where possible
        abClass.setClassOwner(teacherInstance);
      } else {
        abClass.addTeacher(teacherInstance);
      }
    });
  }

  /**
   * Fetches all students from the Classroom API and populates them in the ABClass.
   * Handles pagination automatically via ClassroomApiClient.
   *
   * @param {ABClass} abClass - The class instance to populate.
   * @param {string} courseId - The Classroom course ID.
   * @throws {Error} Rethrows any errors from ClassroomApiClient.
   * @private
   */
  _applyStudents(abClass, courseId) {
    // Call the ClassroomApiClient static method directly; it handles paging. Let errors bubble up.
    const students = ClassroomApiClient.fetchAllStudents(courseId);

    students.forEach((st) => {
      abClass.addStudent(st);
    });
  }

  /**
   * Retrieves metadata from a collection, returning null if retrieval fails.
   *
   * @param {Object} collection - The collection to query.
   * @returns {Object|null} Metadata or null if retrieval fails.
   * @private
   */
  _getCollectionMetadata(collection) {
    try {
      return collection.getMetadata();
    } catch (error) {
      ABLogger.getInstance().warn('Failed to read collection metadata', { err: error });
      return null;
    }
  }

  /**
   * Builds a roster update payload containing class metadata and member arrays.
   *
   * @param {ABClass} abClass - The class instance to serialise.
   * @returns {Object} Payload with className, classOwner, teachers, and students.
   * @private
   */
  _buildClassroomRosterUpdatePayload(abClass) {
    return {
      className: abClass?.className ?? null,
      classOwner: abClass?.classOwner ?? null,
      teachers: Array.isArray(abClass?.teachers) ? [...abClass.teachers] : [],
      students: Array.isArray(abClass?.students) ? [...abClass.students] : [],
    };
  }

  /**
   * Normalises a stored partial document to the documented transport shape.
   * This prevents storage-only metadata from leaking to API consumers.
   *
   * @param {Object} partialDocument - Raw partial document read from storage.
   * @returns {Object} Normalised class partial payload.
   * @throws {TypeError} If the document is not a plain object or lacks required fields.
   * @private
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
      className: partialDocument.className,
      cohortKey: partialDocument.cohortKey,
      cohortLabel: partialDocument.cohortLabel,
      courseLength: partialDocument.courseLength,
      yearGroupKey: partialDocument.yearGroupKey,
      yearGroupLabel: partialDocument.yearGroupLabel,
      classOwner: partialDocument.classOwner,
      teachers: [...partialDocument.teachers],
      active: partialDocument.active,
    };
  }

  // Metadata-driven refresh is currently disabled while Issue #88 is being investigated;
  // keep the helper for future use once the issue is resolved.
  /**
   * Determines whether a roster needs updating based on course modification time.
   * Currently disabled pending Issue #88 investigation.
   *
   * @param {Object} metadata - Collection metadata including lastUpdated timestamp.
   * @param {string} classId - The Classroom course ID.
   * @returns {boolean} True if the course has been updated since the last fetch.
   * @private
   */
  _shouldRefreshRoster(metadata, classId) {
    if (!metadata?.lastUpdated) return false;

    const lastUpdated =
      metadata.lastUpdated instanceof Date ? metadata.lastUpdated : new Date(metadata.lastUpdated);
    if (!(lastUpdated instanceof Date) || Number.isNaN(lastUpdated.getTime())) return false;

    const courseUpdatedAt = ClassroomApiClient.fetchCourseUpdateTime(classId);
    if (!(courseUpdatedAt instanceof Date) || Number.isNaN(courseUpdatedAt.getTime())) return false;

    return courseUpdatedAt.getTime() > lastUpdated.getTime();
  }

  /**
   * Clears and refreshes all roster data (owner, teachers, students) for a class.
   * Fetches latest data from the Classroom API.
   *
   * @param {ABClass} abClass - The class instance to refresh.
   * @param {string} classId - The Classroom course ID.
   * @private
   */
  _refreshRoster(abClass, classId) {
    if (!abClass) return;

    abClass.classOwner = null;
    abClass.teachers = [];
    abClass.students = [];

    this._applyCourseMetadata(abClass, classId);
    this._applyTeachers(abClass, classId);
    this._applyStudents(abClass, classId);
  }

  /**
   * Upserts the class partial document to the abclass_partials collection.
   * @param {ABClass|Object} abClass - An ABClass instance or plain object with
   *   a `classId` property and a `toPartialJSON()` method.
   * @throws {Error} Rethrows any persistence error.
   * @private
   */
  _upsertClassPartial(abClass) {
    const logger = ABLogger.getInstance();
    const partialsCollection = this.dbManager.getCollection('abclass_partials');
    try {
      const partialData = abClass.toPartialJSON();
      const existingPartial = partialsCollection.findOne({ classId: abClass.classId });
      if (existingPartial) {
        partialsCollection.replaceOne({ classId: abClass.classId }, partialData);
      } else {
        partialsCollection.insertOne(partialData);
      }
      partialsCollection.save();
      logger.info('_upsertClassPartial: partial persisted', { classId: abClass.classId });
    } catch (error) {
      logger.error('_upsertClassPartial: partials collection write failed', {
        classId: abClass.classId,
        err: error,
      });
      throw error;
    }
  }

  /**
   * Persists roster changes to a collection and updates the partial registry.
   * Logs intent and completion for diagnostic purposes.
   *
   * @param {Object} collection - The JsonDb collection to persist to.
   * @param {Object} existingDocument - The existing document (if any) to identify for update.
   * @param {ABClass} abClass - The class instance to persist.
   * @throws {Error} Rethrows any persistence errors.
   * @private
   */
  _persistRoster(collection, existingDocument, abClass) {
    const logger = ABLogger.getInstance();
    const payload = this._buildClassroomRosterUpdatePayload(abClass);
    const filter = existingDocument?._id
      ? { _id: existingDocument._id }
      : { classId: abClass.classId };

    try {
      // Log intent to persist
      logger.info('_persistRoster: persisting roster', {
        classId: abClass.classId,
        filter,
        payloadSummary: {
          className: payload.className,
          teachers: Array.isArray(payload.teachers) ? payload.teachers.length : 0,
          students: Array.isArray(payload.students) ? payload.students.length : 0,
        },
      });

      collection.updateOne(filter, { $set: payload });
      collection.save();

      // Log success
      logger.info('_persistRoster: roster persisted successfully', {
        classId: abClass.classId,
        filter,
      });

      this._upsertClassPartial(abClass);
    } catch (error) {
      logger.error('_persistRoster: write or partial upsert failed', {
        classId: abClass.classId,
        err: error,
      });
      throw error;
    }
  }

  /**
   * Generate consistent collection name for full assignment persistence.
   *
   * @param {string} courseId - The Classroom course ID.
   * @param {string} assignmentId - The assignment ID.
   * @returns {string} Collection name following pattern: assign_full_<courseId>_<assignmentId>.
   * @private
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
      const fullCollection = this.dbManager.getCollection(collectionName);
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
      this.saveClass(abClass);

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
   * @throws {Error} If the document is not found or an error occurs during loading.
   * @private
   */
  _loadFullAssignmentDocument(courseId, assignmentId) {
    const logger = ABLogger.getInstance();
    const collectionName = this._getFullAssignmentCollectionName(courseId, assignmentId);
    const fullCollection = this.dbManager.getCollection(collectionName);
    const document = fullCollection.findOne({ courseId, assignmentId });

    if (!document) {
      throw new Error(
        `No document found in collection ${collectionName} for courseId=${courseId}, assignmentId=${assignmentId}. Assignment does not exist or has not been persisted.`
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
   * @private
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
   * @private
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
   * @private
   */
  _replaceAssignmentInClass(abClass, assignmentId, hydratedAssignment) {
    const logger = ABLogger.getInstance();
    const index = abClass.findAssignmentIndex((a) => a.assignmentId === assignmentId);

    if (index >= 0) {
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

  /**
   * Initialises an ABClass instance by populating data that can be fetched using
   * the classId (Google Classroom courseId) alone. Populates: className,
   * classOwner, teachers and students. Additional properties (assignments,
   * cohortKey, courseLength, yearGroupKey) may be provided via options.
   *
   * @param {string} classId - The Classroom course ID.
   * @param {Object} [options={}] - Optional configuration for class properties.
   * @param {string} [options.cohortKey] - Cohort key value for the class.
   * @param {number} [options.courseLength] - Course duration in weeks.
   * @param {string} [options.yearGroupKey] - Academic year-group key.
   * @param {Assignment[]} [options.assignments] - Assignments to add to the class.
   * @returns {ABClass} Populated ABClass instance with roster data.
   * @throws {TypeError} If classId is missing.
   */
  initialise(classId, options = {}) {
    if (!classId) throw new TypeError('classId is required');

    // Create a fresh ABClass instance for this id
    const abClass = new ABClass({ classId });

    // Apply straightforward options first
    if (options.cohortKey !== undefined) {
      abClass.cohortKey = options.cohortKey === null ? null : String(options.cohortKey);
    }
    if (options.courseLength !== undefined) {
      abClass.courseLength = Number.isInteger(options.courseLength)
        ? options.courseLength
        : ABClass._parseNullableInt(options.courseLength, abClass.courseLength);
    }
    if (options.yearGroupKey !== undefined) {
      abClass.yearGroupKey = options.yearGroupKey === null ? null : String(options.yearGroupKey);
    }
    if (options.assignments?.length) {
      options.assignments.forEach((assignment) => abClass.addAssignment(assignment));
    }

    // Populate via helpers
    this._applyCourseMetadata(abClass, classId);
    this._applyTeachers(abClass, classId);
    this._applyStudents(abClass, classId);

    return abClass;
  }

  /**
   * Validates that a classId is a non-empty string.
   * @param {*} classId - The class ID to validate.
   * @param {string} methodName - The calling method name for error reporting.
   * @returns {string} The validated classId.
   * @throws {TypeError} If classId is not a non-empty string.
   * @private
   */
  _validateClassId(classId, methodName) {
    if (typeof classId !== 'string' || classId.trim().length === 0) {
      throw new TypeError(`${methodName}: classId must be a non-empty string`);
    }

    return classId;
  }

  /**
   * Validates that a classId is safe for deletion operations (no path traversal characters).
   * @param {*} classId - The class ID to validate.
   * @param {string} methodName - The calling method name for error reporting.
   * @returns {string} The validated classId.
   * @throws {TypeError} If classId is invalid or contains path traversal characters.
   * @private
   */
  _validateDeleteClassId(classId, methodName) {
    const validatedClassId = this._validateClassId(classId, methodName);

    if (validatedClassId.includes('..') || validatedClassId.includes('/')) {
      throw new TypeError(`${methodName}: invalid classId format`);
    }

    return validatedClassId;
  }

  /**
   * Checks if an error is a collection not found error from JsonDb.
   * @param {Error} error - The error to check.
   * @returns {boolean} True if the error is a COLLECTION_NOT_FOUND error.
   * @private
   */
  _isMissingCollectionError(error) {
    return error?.code === 'COLLECTION_NOT_FOUND';
  }

  /**
   * Validates that courseLength is a positive integer.
   * @param {*} courseLength - The course length to validate.
   * @param {string} methodName - The calling method name for error reporting.
   * @returns {number} The validated courseLength.
   * @throws {TypeError} If courseLength is not an integer >= 1.
   * @private
   */
  _validateCourseLength(courseLength, methodName) {
    if (!Number.isInteger(courseLength) || courseLength < 1) {
      throw new TypeError(
        `${methodName}: courseLength must be an integer greater than or equal to 1`
      );
    }

    return courseLength;
  }

  /**
   * Builds a patch object from update parameters for selective field updates.
   * @param {Object} parameters - The update parameters object.
   * @param {*} [parameters.cohortKey] - Optional cohort key value.
   * @param {*} [parameters.yearGroupKey] - Optional year group key value.
   * @param {*} [parameters.courseLength] - Optional course length (validated).
   * @param {boolean} [parameters.active] - Optional active flag.
   * @returns {Object} Patch object containing only provided fields.
   * @private
   */
  _buildUpdatePatch(parameters) {
    const patch = {};

    if (Object.hasOwn(parameters, 'cohortKey')) {
      patch.cohortKey = parameters.cohortKey === null ? null : String(parameters.cohortKey);
    }

    if (Object.hasOwn(parameters, 'yearGroupKey')) {
      patch.yearGroupKey =
        parameters.yearGroupKey === null ? null : String(parameters.yearGroupKey);
    }

    if (Object.hasOwn(parameters, 'courseLength')) {
      patch.courseLength = this._validateCourseLength(parameters.courseLength, 'updateABClass');
    }

    if (Object.hasOwn(parameters, 'active')) {
      patch.active = parameters.active;
    }

    return patch;
  }

  /**
   * Applies a patch object to an ABClass instance, updating specified fields.
   * @param {ABClass} abClass - The class instance to update.
   * @param {Object} patch - The patch object containing fields to update.
   * @returns {ABClass} The updated class instance.
   * @private
   */
  _applyPatchToClass(abClass, patch) {
    if (Object.hasOwn(patch, 'cohortKey')) {
      abClass.cohortKey = patch.cohortKey;
    }

    if (Object.hasOwn(patch, 'yearGroupKey')) {
      abClass.yearGroupKey = patch.yearGroupKey;
    }

    if (Object.hasOwn(patch, 'courseLength')) {
      abClass.courseLength = patch.courseLength;
    }

    if (Object.hasOwn(patch, 'active')) {
      abClass.active = patch.active;
    }

    return abClass;
  }

  /**
   * Builds a lightweight partial summary of an ABClass for transport.
   * @param {ABClass} abClass - The class instance to summarise.
   * @returns {Object} Partial JSON summary of the class.
   * @private
   */
  _buildClassSummary(abClass) {
    return abClass.toPartialJSON();
  }

  /**
   * Creates a new ABClass or updates an existing one with fresh classroom data and custom metadata.
   * Validates all required parameters, then either creates a new class or refreshes an existing one,
   * applying the provided metadata (cohortKey, yearGroupKey, courseLength).
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

    const classId = this._validateClassId(parameters.classId, 'upsertABClass');
    const courseLength = this._validateCourseLength(parameters.courseLength, 'upsertABClass');
    const collection = this.dbManager.getCollection(classId);
    const existingDocument = collection.findOne({ classId: classId });
    let abClass;

    if (existingDocument) {
      abClass = ABClass.fromJSON(existingDocument);
      abClass.cohortKey = parameters.cohortKey === null ? null : String(parameters.cohortKey);
      abClass.yearGroupKey =
        parameters.yearGroupKey === null ? null : String(parameters.yearGroupKey);
      abClass.courseLength = courseLength;
      this._refreshRoster(abClass, classId);
    } else {
      abClass = this.initialise(classId, {
        cohortKey: parameters.cohortKey,
        yearGroupKey: parameters.yearGroupKey,
        courseLength: courseLength,
      });
    }

    this.saveClass(abClass);
    return this._buildClassSummary(abClass);
  }

  /**
   * Applies a lightweight patch to editable ABClass fields and returns the persisted partial class summary.
   * If the class does not yet exist, initialises it first using the supplied patch fields.
   * @param {Object} parameters - Patch parameters object.
   * @param {string} parameters.classId - Classroom course identifier (required).
   * @param {*} [parameters.cohortKey] - Optional cohort-key replacement.
   * @param {*} [parameters.yearGroupKey] - Optional year-group-key replacement.
   * @param {*} [parameters.courseLength] - Optional validated course length.
   * @param {boolean|null} [parameters.active] - Optional active-state replacement.
   * @returns {Object} Partial ABClass summary from toPartialJSON().
   */
  updateABClass(parameters) {
    Validate.requireParams({ classId: parameters?.classId }, 'updateABClass');

    const classId = this._validateClassId(parameters.classId, 'updateABClass');
    const patch = this._buildUpdatePatch(parameters);
    const collection = this.dbManager.getCollection(classId);
    const existingDocument = collection.findOne({ classId: classId });

    if (!existingDocument) {
      if (Object.hasOwn(patch, 'active')) {
        this.dbManager.getCollection('abclass_partials');
        throw new Error('updateABClass: active patch requires an existing class');
      }

      const abClass = this.initialise(classId, {
        cohortKey: Object.hasOwn(patch, 'cohortKey') ? patch.cohortKey : undefined,
        yearGroupKey: Object.hasOwn(patch, 'yearGroupKey') ? patch.yearGroupKey : undefined,
        courseLength: Object.hasOwn(patch, 'courseLength') ? patch.courseLength : undefined,
      });

      this.saveClass(abClass);
      return this._buildClassSummary(abClass);
    }

    const abClass = this._applyPatchToClass(ABClass.fromJSON(existingDocument), patch);

    collection.updateOne({ classId: classId }, { $set: patch });
    collection.save();
    this._upsertClassPartial(abClass);

    return this._buildClassSummary(abClass);
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

    const classId = this._validateDeleteClassId(parameters.classId, 'deleteABClass');
    let fullClassDeleted = false;
    let partialDeleted = false;

    try {
      this.dbManager.getDb().dropCollection(classId);
      fullClassDeleted = true;
    } catch (error) {
      if (!this._isMissingCollectionError(error)) {
        throw error;
      }
    }

    const partialsCollection = this.dbManager.getCollection('abclass_partials');
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
   * Load an ABClass by its classId. Returns an ABClass instance or null if not found.
   * Reads all documents from the collection named by classId, deserialises the first document,
   * and optionally refreshes roster data from Classroom API.
   * @param {string} classId - The Classroom course identifier.
   * @returns {ABClass|null} The loaded class instance, or null if not found.
   */
  loadClass(classId) {
    if (!classId) throw new TypeError('classId is required');
    const logger = ABLogger.getInstance();

    const collection = this.dbManager.getCollection(classId);
    logger.info('loadClass: called', { classId, hasCollection: !!collection });
    // If no collection is returned, create a new class object and save it.
    if (!collection) {
      logger.info('loadClass: no collection found - initialising new class', { classId });
      return this.initialise(classId);
    }

    // Collection exists - read the single stored document (if any)
    const document = collection.findOne({ classId: classId }) || null;
    if (!document) {
      // Collection exists but has no document - initialise new class
      logger.info('loadClass: collection exists but no document stored - creating new class', {
        classId,
      });
      const newClass = this.initialise(classId);
      this.saveClass(newClass);
      return newClass;
    }

    // Metadata-driven refresh is currently disabled while Issue #88 is being
    // investigated; keep the helper for future use but force a refresh here so
    // persisted ABClass objects are kept up-to-date with live Classroom data.
    const needsRefresh = true; // retained helper: this._shouldRefreshRoster(metadata, classId);
    // Deserialize the document into an ABClass instance
    const abClass = ABClass.fromJSON(document);
    if (needsRefresh) {
      logger.info('loadClass: metadata indicates refresh required - refreshing roster', {
        classId,
      });
      this._refreshRoster(abClass, classId);
      this._persistRoster(collection, document, abClass);
      logger.info('loadClass: refresh completed and roster persisted', { classId });
    } else {
      logger.info('loadClass: loaded class from collection without refresh', { classId });
    }
    return abClass;
  }

  /**
   * Write-through persistence: saves the full class document to its own collection
   * and upserts a partial summary document to the partials registry.
   * @param {ABClass|Object} abClass - The class instance or plain object to persist.
   * @returns {void}
   * @throws {Error} Rethrows any persistence error from either collection.
   * @private
   */
  _persistClassAndPartial(abClass) {
    const logger = ABLogger.getInstance();
    const collectionName = String(abClass.classId);
    const collection = this.dbManager.getCollection(collectionName);

    // Write the full class document first so partials are never visible
    // without a corresponding authoritative class record.
    try {
      const existing = collection.findOne({ classId: abClass.classId });

      if (existing) {
        collection.replaceOne({ classId: abClass.classId }, abClass);
      } else {
        collection.insertOne(abClass);
      }

      collection.save();
    } catch (error) {
      logger.error('_persistClassAndPartial: class collection write failed', {
        classId: abClass.classId,
        err: error,
      });
      throw error;
    }

    this._upsertClassPartial(abClass);
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
      const partialsCollection = this.dbManager.getCollection('abclass_partials');
      const documents = partialsCollection.find({});
      if (!Array.isArray(documents)) {
        throw new TypeError('getAllClassPartials: unexpected non-array result from find()');
      }
      return documents.map((document) => this._normaliseClassPartial(document));
    } catch (error) {
      logger.error('getAllClassPartials: failed to read abclass_partials', { err: error });
      throw error;
    }
  }
}

// Export for Node tests
if (typeof module !== 'undefined') {
  module.exports = ABClassController;
}
