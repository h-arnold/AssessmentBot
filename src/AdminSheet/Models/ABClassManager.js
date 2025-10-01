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
    const course = globalThis.Classroom.Courses.get(courseId);
    if (!course) return;

    if (course.name) {
      if (typeof abClass.setClassName === 'function') abClass.setClassName(course.name);
      else abClass.className = course.name;
    }

    if (course.ownerId) {
      // Prefer to create a Teacher instance when available
      const Teacher = globalThis.Teacher;
      if (Teacher) {
        const owner = new Teacher(null, course.ownerId);
        if (typeof abClass.setClassOwner === 'function') {
          abClass.setClassOwner(owner);
        } else {
          abClass.classOwner = owner;
        }
      }
    }
  }

  // Helper: fetch and apply teacher list
  _applyTeachers(abClass, courseId) {
    const Teacher = globalThis.Teacher;
    if (!Teacher) return;

    const teacherResp = globalThis.Classroom.Courses.Teachers.list(courseId);
    const teachers = teacherResp.teachers || [];
    teachers.forEach((t) => {
      const email = t.profile.emailAddress ?? null;
      const userId = t.profile.id ?? null;
      const teacherObj = new Teacher(email, userId);
      if (typeof abClass.addTeacher === 'function') abClass.addTeacher(teacherObj);
      else abClass.teachers.push(teacherObj);
    });
  }

  // Helper: fetch and apply students (tries ClassroomManager.fetchAllStudents then falls back)
  _applyStudents(abClass, courseId) {
    // Try to use a ClassroomManager provided on globalThis (tests set this); don't require modules in GAS
    let ClassroomManagerRef = null;
    if (typeof globalThis !== 'undefined' && typeof globalThis.ClassroomManager !== 'undefined')
      ClassroomManagerRef = globalThis.ClassroomManager;

    if (ClassroomManagerRef && typeof ClassroomManagerRef.fetchAllStudents === 'function') {
      const students = ClassroomManagerRef.fetchAllStudents(courseId) || [];
      students.forEach((s) => {
        if (typeof abClass.addStudent === 'function') abClass.addStudent(s);
        else abClass.students.push(s);
      });
      return;
    }

    // Fallback: single-page fetch using Classroom API
    const Student = globalThis.Student;
    if (!Student) return;

    const resp = globalThis.Classroom.Courses.Students.list(courseId) || {};
    const students = resp.students || [];
    students.forEach((st) => {
      const name = st.profile.name.fullName ?? null;
      const email = st.profile.emailAddress ?? null;
      const id = st.profile.id ?? null;
      const studentObj = new Student(name, email, id);
      if (typeof abClass.addStudent === 'function') abClass.addStudent(studentObj);
      else abClass.students.push(studentObj);
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
   * @param {boolean} [options.persist=false] - whether to call saveClass at end
   * @returns {ABClass} populated ABClass instance
   */
  initialise(classId, options = {}) {
    if (!classId) throw new TypeError('classId is required');

    // Resolve ABClass from globalThis (set by tests or GAS environment)
    const ABClass = globalThis.ABClass;
    if (!ABClass) throw new Error('ABClass is not available on globalThis');

    // Create a fresh ABClass instance for this id
    const abClass = new ABClass(classId);

    // Apply straightforward options first
    if (options.cohort !== undefined)
      abClass.cohort = options.cohort === null ? null : String(options.cohort);
    if (options.courseLength !== undefined)
      abClass.courseLength = Number.isInteger(options.courseLength)
        ? options.courseLength
        : ABClass._parseNullableInt(options.courseLength, abClass.courseLength);
    if (options.yearGroup !== undefined)
      abClass.yearGroup = Number.isInteger(options.yearGroup)
        ? options.yearGroup
        : ABClass._parseNullableInt(options.yearGroup, abClass.yearGroup);
    if (options.assignments !== undefined && Array.isArray(options.assignments)) {
      options.assignments.forEach((assignment) => {
        if (typeof abClass.addAssignment === 'function') abClass.addAssignment(assignment);
        else if (Array.isArray(abClass.assignments)) abClass.assignments.push(assignment);
      });
    }

    // Populate via helpers
    this._applyCourseMetadata(abClass, classId);
    this._applyTeachers(abClass, classId);
    this._applyStudents(abClass, classId);

    // Persist if requested
    if (options.persist) {
      try {
        this.saveClass(abClass);
      } catch (e) {
        console.warn('ABClassManager.initialise: failed to persist class', e?.message);
      }
    }

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
      this.saveClass(newClass);

      return newClass;
    } else {
      // Collection exists - read all documents and pick the first one
      const docs = collection.findMany({}) || [];
      if (docs.length === 0) {
        // Collection exists but is empty - initialise new class
        const newClass = this.initialise(classId);
        this.saveClass(newClass);
        return newClass;
      }

      // Deserialize the first document into an ABClass instance
      const ABClass = globalThis.ABClass;
      if (!ABClass) throw new Error('ABClass is not available on globalThis');

      const firstDoc = docs[0];
      const abClass = ABClass.fromJSON(firstDoc);
      return abClass || null;
    }
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
    if (!abClass?.classId) throw new TypeError('abClass with classId is required');
    const colName = String(abClass.classId);
    const serialized = typeof abClass?.toJSON === 'function' ? abClass.toJSON() : abClass;

    const collection = this.dbManager.getCollection(colName);

    // Normalize to an insert/update path. Prefer updateOne upsert when available.
    try {
      if (collection && collection.updateOne && serialized && '_id' in serialized) {
        collection.updateOne({ _id: serialized._id }, { $set: serialized }, { upsert: true });
      } else if (collection && collection.insertOne) {
        // Attempt to clear/replace by removing all docs first if API available
        try {
          if (collection.removeMany) collection.removeMany({});
          else if (collection.clear) collection.clear();
        } catch (err) {
          console.warn('Collection clear attempt failed, continuing to insert', err);
        }
        collection.insertOne(serialized);
      } else {
        throw new Error('Collection API does not support insert or update operations');
      }
    } catch (err) {
      // Provide a clearer error path while keeping previous behavior
      console.warn('saveClass: collection operation failed', err?.message ?? err);
      throw err;
    }

    // Persist changes
    try {
      if (collection && collection.save) collection.save();
      else this.dbManager.saveCollection(collection);
    } catch (err) {
      console.warn('saveClass: collection persist failed, falling back', err?.message ?? err);
      try {
        this.dbManager.saveCollection(collection);
      } catch (err2) {
        console.error('saveClass: dbManager.saveCollection also failed', err2?.message ?? err2);
        throw err2;
      }
    }

    return true;
  }
}

// Export for Node tests
if (typeof module !== 'undefined') {
  module.exports = ABClassManager;
}
