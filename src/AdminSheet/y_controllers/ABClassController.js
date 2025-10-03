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
    if (!course) return;

    if (course.name) {
      if (typeof abClass.setClassName === 'function') abClass.setClassName(course.name);
      else abClass.className = course.name;
    }

    if (course.ownerId) {
      const owner = new Teacher(null, course.ownerId);
      abClass.setClassOwner(owner);
    }
  }

  // Helper: fetch and apply teacher list
  _applyTeachers(abClass, courseId) {
    // Call the ClassroomApiClient static method directly and allow errors to surface
    const teachers = ClassroomApiClient.fetchTeachers(courseId) || [];

    teachers.forEach((teacherObj) => {
      // Support both new behaviour (Teacher instances) and legacy raw API objects.
      if (!teacherObj) return; // nothing to apply

      // If this teacher matches the course owner, set as owner
      if (abClass.classOwner && abClass.classOwner.userId === teacherObj.userId) {
        abClass.setClassOwner(teacherObj);
      } else {
        abClass.addTeacher(teacherObj);
      }
    });
  }

  // Helper: fetch and apply students
  _applyStudents(abClass, courseId) {
    // Call the ClassroomApiClient static method directly; it handles paging. Let errors bubble up.
    const students = ClassroomApiClient.fetchAllStudents(courseId) || [];

    students.forEach((st) => {
      abClass.addStudent(st);
    });
  }

  _getCollectionMetadata(collection) {
    if (!collection || typeof collection.getMetadata !== 'function') return null;

    try {
      return collection.getMetadata();
    } catch (err) {
      const logger = ABLogger?.getInstance ? ABLogger.getInstance() : null;
      if (logger && typeof logger.warn === 'function') {
        logger.warn('Failed to read collection metadata', { err });
      }
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

  _shouldRefreshRoster(metadata, classId) {
    if (!metadata || !metadata.lastUpdated) return false;

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
    if (!collection || !abClass) return;

    const payload = this._buildClassroomRosterUpdatePayload(abClass);
    const filter = existingDoc?._id ? { _id: existingDoc._id } : { classId: abClass.classId };

    try {
      collection.updateOne(filter, { $set: payload });
      collection.save();
    } catch (err) {
      ABLogger.getInstance().logger.error('Failed to persist refreshed roster', {
        classId: abClass.classId,
        err,
      });
    }
    throw err;
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

    const collection = this.dbManager.getCollection(classId);
    const metadata = this._getCollectionMetadata(collection);
    // If no collection is returned, create a new class object and save it.
    if (!collection) {
      const newClass = this.initialise(classId);
      return newClass;
    }

    // Collection exists - read the single stored document (if any)
    const doc = collection.findOne({ classId: classId }) || null;
    if (!doc) {
      // Collection exists but has no document - initialise new class
      const newClass = this.initialise(classId);
      this.saveClass(newClass);
      return newClass;
    }

    const needsRefresh = this._shouldRefreshRoster(metadata, classId);
    // Deserialize the document into an ABClass instance
    const abClass = ABClass.fromJSON(doc);
    if (needsRefresh) {
      this._refreshRoster(abClass, classId);
      this._persistRoster(collection, doc, abClass);
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
      // Provide a clearer error path while keeping previous behavior
      console.warn('saveClass: collection operation failed', err?.message ?? err);
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
