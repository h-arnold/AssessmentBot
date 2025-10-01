/**
 * ABClassManager
 *
 * Small utility to load and save ABClass instances from the JsonDbApp-backed
 * collections managed by DbManager. The convention used here is that each
 * class is stored in a collection named after its classId. The documents inside
 * that collection are plain serialized ABClass objects (from ABClass.toJSON()).
 */

let DbManagerRef = null;
// Prefer an already-provided global DbManager (useful for tests). In GAS rely on globalThis.
if (typeof globalThis !== 'undefined' && typeof globalThis.DbManager !== 'undefined') {
  DbManagerRef = globalThis.DbManager;
}
// Resolve to the actual DbManager constructor/object used below
const DbManagerCtor = DbManagerRef?.DbManager ?? DbManagerRef;

// In Node tests ABClass is exported as { ABClass } from ABClass.js; in GAS it's global.
// ABClass is provided globally in GAS or injected in tests via globalThis
const ABClass =
  typeof globalThis !== 'undefined' && typeof globalThis.ABClass !== 'undefined'
    ? globalThis.ABClass.ABClass ?? globalThis.ABClass
    : undefined;

class ABClassManager {
  constructor() {
    this.dbManager = DbManagerCtor?.getInstance
      ? DbManagerCtor.getInstance()
      : new DbManagerCtor(true);
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
      const owner = new Teacher(null, course.ownerId);
      if (typeof abClass.setClassOwner === 'function') {
        abClass.setClassOwner(owner);
      } else {
        abClass.classOwner = owner;
      }
    }
  }

  // Helper: fetch and apply teacher list
  _applyTeachers(abClass, courseId) {
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
   * @param {ABClass|Object} abClass - ABClass instance (must have classId)
   * @param {Object} [options]
   * @param {Array} [options.assignments] - optional assignments to set
   * @param {string|number} [options.cohort]
   * @param {number} [options.courseLength]
   * @param {number} [options.yearGroup]
   * @param {boolean} [options.persist=false] - whether to call saveClass at end
   * @returns {ABClass} populated ABClass instance
   */
  initialise(abClass, options = {}) {
    if (!abClass?.classId) throw new TypeError('abClass with classId is required');

    const courseId = String(abClass.classId);

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

    // Populate via helpers
    this._applyCourseMetadata(abClass, courseId);
    this._applyTeachers(abClass, courseId);
    this._applyStudents(abClass, courseId);

    // Optionally apply assignments provided in options
    if (Array.isArray(options.assignments) && options.assignments.length > 0) {
      options.assignments.forEach((a) => {
        if (typeof abClass.addAssignment === 'function') abClass.addAssignment(a);
        else abClass.assignments.push(a);
      });
    }

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
    const colName = String(classId);
    const docs = this.dbManager.readAll(colName) || [];
    if (!docs || docs.length === 0) return null;
    // If multiple docs exist, prefer the first (legacy behaviour)
    const doc = docs[0];
    return typeof ABClass?.fromJSON === 'function' ? ABClass.fromJSON(doc) : null;
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
    if (typeof collection.updateOne === 'function' && serialized && '_id' in serialized) {
      collection.updateOne({ _id: serialized._id }, { $set: serialized }, { upsert: true });
    } else if (typeof collection.insertOne === 'function') {
      // Attempt to clear/replace by removing all docs first if API available
      try {
        if (typeof collection.removeMany === 'function') collection.removeMany({});
        else if (typeof collection.clear === 'function') collection.clear();
      } catch (err) {
        console.warn('Collection clear attempt failed, continuing to insert', err);
      }
      collection.insertOne(serialized);
    } else {
      throw new Error('Collection API does not support insert or update operations');
    }

    // Persist changes
    if (typeof collection.save === 'function') collection.save();
    else this.dbManager.saveCollection(collection);

    return true;
  }
}

// Export for Node tests
if (typeof module !== 'undefined') {
  module.exports = ABClassManager;
}
