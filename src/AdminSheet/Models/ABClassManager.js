/**
 * ABClassManager
 *
 * Small utility to load and save ABClass instances from the JsonDbApp-backed
 * collections managed by DbManager. The convention used here is that each
 * class is stored in a collection named after its classId. The documents inside
 * that collection are plain serialized ABClass objects (from ABClass.toJSON()).
 */

class ABClassManager {
  constructor() {
    this.dbManager = DbManager.getInstance();
  }

  // Helper: fetch and apply course metadata (name, owner)
  _applyCourseMetadata(abClass, courseId) {
    const course = Classroom.Courses.get(courseId);
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
    const teacherResp = Classroom.Courses.Teachers.list(courseId);
    const teachers = teacherResp.teachers || [];
    teachers.forEach((t) => {
      const name = t.profile.name.fullName;
      const email = t.profile.emailAddress;
      const userId = t.profile.id;
      const teacherObj = new Teacher(email, userId, name);

      if (abClass.classOwner.userId === t.profile.id) {
        abClass.setClassOwner(teacherObj);
      } else {
        abClass.addTeacher(teacherObj);
      }
    });
  }

  // Helper: fetch and apply students
  _applyStudents(abClass, courseId) {
    // Use ClassroomManager helper which handles paging and API details.
    const students = ClassroomManager.fetchAllStudents(courseId);

    students.forEach((st) => {
      abClass.addStudent(st);
    });
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

    // Save the class to the DB.
    this.saveClass(abClass);

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

    // Deserialize the document into an ABClass instance
    const abClass = ABClass.fromJSON(doc);
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
  module.exports = ABClassManager;
}
