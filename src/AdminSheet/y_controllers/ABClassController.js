/**
 * ABClassController
 *
 * Small utility to load and save ABClass instances from the JsonDbApp-backed
 * collections managed by DbManager. The convention used here is that each
 * class is stored in a collection named after its classId. The documents inside
 * that collection are plain serialized ABClass objects (from ABClass.toJSON()).
 */

class ABClassController {
  constructor() {
    this.dbManager = DbManager.getInstance();
  }

  // Helper: fetch and apply course metadata (name, owner)
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

  // Helper: fetch and apply teacher list
  _applyTeachers(abClass, courseId) {
    const logger = ABLogger.getInstance();
    // Call the ClassroomApiClient static method directly and allow errors to surface
    const teachers = ClassroomApiClient.fetchTeachers(courseId);

    // Support both new behaviour (Teacher instances) and legacy raw API objects.
    teachers.forEach((teacherObj) => {
      // Ensure we operate on a Teacher instance so setClassOwner's instanceof
      // check in ABClass doesn't throw. Support both Teacher instances and
      // plain objects returned by legacy API mocks.
      let teacherInstance = teacherObj;
      if (!(teacherObj instanceof Teacher) && typeof Teacher.fromJSON === 'function') {
        try {
          teacherInstance = Teacher.fromJSON(teacherObj) || teacherObj;
        } catch (err) {
          logger.error('_applyTeachers: failed to deserialize teacher payload', {
            courseId,
            teacherId: teacherObj?.userId,
            err,
          });
          throw err;
        }
      }

      // If this teacher matches the course owner, set as owner (using a
      // Teacher instance). Otherwise add to teachers list.
      if (abClass.classOwner && abClass.classOwner.userId === teacherObj.userId) {
        // Prefer the instance we coerced where possible
        abClass.setClassOwner(teacherInstance);
      } else {
        abClass.addTeacher(teacherInstance);
      }
    });
  }

  // Helper: fetch and apply students
  _applyStudents(abClass, courseId) {
    // Call the ClassroomApiClient static method directly; it handles paging. Let errors bubble up.
    const students = ClassroomApiClient.fetchAllStudents(courseId);

    students.forEach((st) => {
      abClass.addStudent(st);
    });
  }

  _getCollectionMetadata(collection) {
    try {
      return collection.getMetadata();
    } catch (err) {
      ABLogger.getInstance().warn('Failed to read collection metadata', { err });
      return null;
    }
  }

  _buildClassroomRosterUpdatePayload(abClass) {
    return {
      className: abClass?.className ?? null,
      classOwner: abClass?.classOwner ?? null,
      teachers: Array.isArray(abClass?.teachers) ? abClass.teachers.slice() : [],
      students: Array.isArray(abClass?.students) ? abClass.students.slice() : [],
    };
  }

  // Metadata-driven refresh is currently disabled while Issue #88 is being investigated;
  // keep the helper for future use once the issue is resolved.
  _shouldRefreshRoster(metadata, classId) {
    if (!metadata?.lastUpdated) return false;

    const lastUpdated =
      metadata.lastUpdated instanceof Date ? metadata.lastUpdated : new Date(metadata.lastUpdated);
    if (!(lastUpdated instanceof Date) || Number.isNaN(lastUpdated.getTime())) return false;

    const courseUpdatedAt = ClassroomApiClient.fetchCourseUpdateTime(classId);
    if (!(courseUpdatedAt instanceof Date) || Number.isNaN(courseUpdatedAt.getTime())) return false;

    return courseUpdatedAt.getTime() > lastUpdated.getTime();
  }

  _refreshRoster(abClass, classId) {
    if (!abClass) return;

    abClass.classOwner = null;
    abClass.teachers = [];
    abClass.students = [];

    this._applyCourseMetadata(abClass, classId);
    this._applyTeachers(abClass, classId);
    this._applyStudents(abClass, classId);
  }

  _persistRoster(collection, existingDoc, abClass) {
    const logger = ABLogger.getInstance();
    const payload = this._buildClassroomRosterUpdatePayload(abClass);
    const filter = existingDoc?._id ? { _id: existingDoc._id } : { classId: abClass.classId };

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
    } catch (err) {
      logger.error('Failed to persist refreshed roster', {
        classId: abClass.classId,
        err,
      });
      throw err;
    }
  }

  /**
   * Generate consistent collection name for full assignment persistence.
   * @param {string} courseId - The course ID
   * @param {string} assignmentId - The assignment ID
   * @return {string} Collection name following pattern: assign_full_<courseId>_<assignmentId>
   */
  _getFullAssignmentCollectionName(courseId, assignmentId) {
    return `assign_full_${courseId}_${assignmentId}`;
  }

  /**
   * Persist an assignment run by writing full payload to dedicated collection
   * and updating the ABClass with a partial summary.
   * @param {ABClass} abClass - The ABClass instance containing the assignment
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
      const idx = abClass.findAssignmentIndex((a) => a.assignmentId === assignment.assignmentId);

      if (idx >= 0) {
        abClass.assignments[idx] = partialInstance;
        logger.info('persistAssignmentRun: replaced existing assignment in ABClass', {
          assignmentId: assignment.assignmentId,
          index: idx,
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
    } catch (err) {
      logger.error('persistAssignmentRun failed', {
        courseId: assignment.courseId,
        assignmentId: assignment.assignmentId,
        err,
      });
      throw err;
    }
  }

  /**
   * Rehydrate an assignment by loading the full version from its dedicated collection.
   * @param {ABClass} abClass - The ABClass instance
   * @param {string} assignmentId - The assignment ID to rehydrate
   * @return {Assignment} The fully hydrated assignment instance
   */
  rehydrateAssignment(abClass, assignmentId) {
    const logger = ABLogger.getInstance();

    if (!abClass || !assignmentId) {
      throw new TypeError('rehydrateAssignment requires abClass and assignmentId');
    }

    const courseId = abClass.classId;

    try {
      const doc = this._loadFullAssignmentDocument(courseId, assignmentId);
      this._validateAssignmentDocument(doc);

      const hydratedAssignment = Assignment.fromJSON(doc);
      this._ensureFullDefinition(hydratedAssignment);
      hydratedAssignment._hydrationLevel = 'full';

      this._replaceAssignmentInClass(abClass, assignmentId, hydratedAssignment);

      return hydratedAssignment;
    } catch (err) {
      logger.error('rehydrateAssignment failed', {
        courseId,
        assignmentId,
        err,
      });
      throw err;
    }
  }

  /**
   * Load full assignment document from its dedicated collection.
   * @param {string} courseId
   * @param {string} assignmentId
   * @return {object} Assignment document
   * @private
   */
  _loadFullAssignmentDocument(courseId, assignmentId) {
    const logger = ABLogger.getInstance();
    const collectionName = this._getFullAssignmentCollectionName(courseId, assignmentId);
    const fullCollection = this.dbManager.getCollection(collectionName);
    const doc = fullCollection.findOne({ courseId, assignmentId });

    if (!doc) {
      throw new Error(
        `No document found in collection ${collectionName} for courseId=${courseId}, assignmentId=${assignmentId}. Assignment does not exist or has not been persisted.`
      );
    }

    logger.info('rehydrateAssignment: loading full assignment', {
      courseId,
      assignmentId,
      collectionName,
    });

    return doc;
  }

  /**
   * Validate that assignment document has all required fields.
   * @param {object} doc - Assignment document
   * @private
   */
  _validateAssignmentDocument(doc) {
    if (!doc.courseId || !doc.assignmentId) {
      throw new Error(
        'Corrupt or invalid assignment data: missing required fields courseId or assignmentId'
      );
    }

    if (!doc.assignmentDefinition) {
      throw new Error(
        'Corrupt or invalid assignment data: missing required field assignmentDefinition'
      );
    }
  }

  /**
   * Ensure assignment has a full definition, fetching or persisting if needed.
   * Detects partial definitions via tasks === null.
   * @param {Assignment} assignment
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
          `Cannot ensure full definition: no full definition found in registry for key '${definitionKey}'`
        );
      }
    }
  }

  /**
   * Replace assignment in ABClass assignments array.
   * @param {ABClass} abClass
   * @param {string} assignmentId
   * @param {Assignment} hydratedAssignment
   * @private
   */
  _replaceAssignmentInClass(abClass, assignmentId, hydratedAssignment) {
    const logger = ABLogger.getInstance();
    const idx = abClass.findAssignmentIndex((a) => a.assignmentId === assignmentId);

    if (idx >= 0) {
      abClass.assignments[idx] = hydratedAssignment;
      logger.info('rehydrateAssignment: replaced assignment in ABClass', {
        assignmentId,
        index: idx,
      });
    } else {
      throw new Error(
        `Assignment with ID '${assignmentId}' not found in the provided ABClass instance for course '${abClass.classId}'.`
      );
    }
  }

  /**
   * Initialise an ABClass instance by populating data that can be fetched using
   * the classId (Google Classroom courseId) alone. Populates: className,
   * classOwner, teachers and students. Additional properties (assignments,
   * cohort, courseLength, yearGroup) may be provided via options.
   *
   * @param {string} classId - classId (Google Classroom courseId)
   * @param {Object} [options]
   * @param {string|number} [options.cohort]
   * @param {number} [options.courseLength]
   * @param {number} [options.yearGroup]
   * @returns {ABClass} populated ABClass instance
   */
  initialise(classId, options = {}) {
    if (!classId) throw new TypeError('classId is required');

    // Create a fresh ABClass instance for this id
    const abClass = new ABClass(classId);

    // Apply straightforward options first
    if (options.cohort !== undefined) {
      abClass.cohort = options.cohort === null ? null : String(options.cohort);
    }
    if (options.courseLength !== undefined) {
      abClass.courseLength = Number.isInteger(options.courseLength)
        ? options.courseLength
        : ABClass._parseNullableInt(options.courseLength, abClass.courseLength);
    }
    if (options.yearGroup !== undefined) {
      abClass.yearGroup = Number.isInteger(options.yearGroup)
        ? options.yearGroup
        : ABClass._parseNullableInt(options.yearGroup, abClass.yearGroup);
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
   * Load an ABClass by its classId. Returns an ABClass instance or null if not found.
   * Strategy: read all documents from the collection named by classId, pick the
   * first document (collection stores a single ABClass serialized object) and
   * call ABClass.fromJSON on it.
   *
   * @param {string} classId
   * @returns {ABClass|null}
   */
  loadClass(classId) {
    if (!classId) throw new TypeError('classId is required');
    const logger = ABLogger.getInstance();

    const collection = this.dbManager.getCollection(classId);
    logger.info('loadClass: called', { classId, hasCollection: !!collection });
    // If no collection is returned, create a new class object and save it.
    if (!collection) {
      logger.info('loadClass: no collection found - initialising new class', { classId });
      const newClass = this.initialise(classId);
      return newClass;
    }

    // Collection exists - read the single stored document (if any)
    const doc = collection.findOne({ classId: classId }) || null;
    if (!doc) {
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
    const abClass = ABClass.fromJSON(doc);
    if (needsRefresh) {
      logger.info('loadClass: metadata indicates refresh required - refreshing roster', {
        classId,
      });
      this._refreshRoster(abClass, classId);
      this._persistRoster(collection, doc, abClass);
      logger.info('loadClass: refresh completed and persisted', { classId });
    } else {
      logger.info('loadClass: loaded class from collection without refresh', { classId });
    }
    return abClass;
  }

  /**
   * Save an ABClass instance (or plain object) to its collection named by classId.
   * Replaces all documents in the collection with a single serialized object.
   * Returns true on success.
   *
   * @param {ABClass|Object} abClass
   * @returns {boolean}
   */
  saveClass(abClass) {
    const collectionName = String(abClass.classId);

    const collection = this.dbManager.getCollection(collectionName);

    // Normalize to an insert/update path. If the collection already contains
    // a document for this classId, use replaceOne to update it. Otherwise
    // insert a new document.
    try {
      // Try to find an existing document for this classId. JsonDbApp's
      // collections typically store a single document per class, keyed by
      // classId. Use a field-based query to detect existence.
      const existing = collection.findOne({ classId: abClass.classId });

      if (existing) {
        // Replace the existing document entirely. Do not include update
        // operators in the replacement object.
        collection.replaceOne({ classId: abClass.classId }, abClass);
      } else {
        // No existing document — insert a new one.
        collection.insertOne(abClass);
      }
    } catch (err) {
      // Use the project's logging contract directly and fail fast.
      ABLogger.getInstance().warn('saveClass: collection operation failed', {
        classId: abClass.classId,
        err,
      });
      throw err;
    }

    // Persist changes
    collection.save();

    return true;
  }
}

// Export for Node tests
if (typeof module !== 'undefined') {
  module.exports = ABClassController;
}
