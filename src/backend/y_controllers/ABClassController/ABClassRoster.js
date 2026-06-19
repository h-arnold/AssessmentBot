/* global ABLogger, ClassroomApiClient, Teacher, ABClass */

/**
 * ABClassRoster
 *
 * Classroom API roster operations: fetches course metadata, teachers, and
 * students from the Classroom API and applies them to ABClass instances.
 * Also handles roster persistence and the initialise flow.
 */
class ABClassRoster {
  /**
   * Constructs ABClassRoster.
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
   * Fetches course metadata from the Classroom API and applies it to the ABClass.
   * Updates the class name and owner information.
   *
   * @param {ABClass} abClass - The class instance to update.
   * @param {string} courseId - The Classroom course ID.
   * @throws {Error} Rethrows any errors from ClassroomApiClient.
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
   */
  _applyStudents(abClass, courseId) {
    // Call the ClassroomApiClient static method directly; it handles paging. Let errors bubble up.
    const students = ClassroomApiClient.fetchAllStudents(courseId);

    students.forEach((st) => {
      abClass.addStudent(st);
    });
  }

  /**
   * Builds a roster update payload containing class metadata and member arrays.
   *
   * @param {ABClass} abClass - The class instance to serialise.
   * @returns {Object} Payload with className, classOwner, teachers, and students.
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
   * Clears and refreshes all roster data (owner, teachers, students) for a class.
   * Fetches latest data from the Classroom API.
   *
   * @param {ABClass} abClass - The class instance to refresh.
   * @param {string} classId - The Classroom course ID.
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
   * Persists roster changes to a collection and updates the partial registry.
   * Logs intent and completion for diagnostic purposes.
   *
   * @param {Object} collection - The JsonDb collection to persist to.
   * @param {Object} existingDocument - The existing document (if any) to identify for update.
   * @param {ABClass} abClass - The class instance to persist.
   * @throws {Error} Rethrows any persistence errors.
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

      this._persistence._upsertClassPartial(abClass);
    } catch (error) {
      logger.error('_persistRoster: write or partial upsert failed', {
        classId: abClass.classId,
        err: error,
      });
      throw error;
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
   * @param {string|null} [options.cohortKey] - Cohort key value for the class.
   * @param {number} [options.courseLength] - Course duration in weeks.
   * @param {string|null} [options.yearGroupKey] - Academic year-group key.
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
}

// Export for Node tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ABClassRoster;
}
