const ITEM_NOT_FOUND_INDEX = -1;

/**
 * Finds the index of the first item in an array matching the given predicate.
 * @param {Array} items - The array to search
 * @param {Function} predicate - Function that receives (item, index, collection) and returns true for a match
 * @returns {number} Index of the matching item, or -1 if not found
 */
function findIndexWithPredicate(items, predicate) {
  return items.findIndex((item, index, collection) => predicate(item, index, collection));
}

/**
 * Finds the first item in an array matching the given predicate.
 * @param {Array} items - The array to search
 * @param {Function} predicate - Function that receives (item, index, collection) and returns true for a match
 * @returns {*|null} The matching item, or null if not found
 */
function findWithPredicate(items, predicate) {
  return items.find((item, index, collection) => predicate(item, index, collection)) || null;
}

/**
 * Serialises an array of objects by calling toJSON() on each item if available.
 * @param {Array} items - Array of objects to serialise
 * @returns {Array} Array of serialised objects
 */
function serialiseArray(items) {
  return (items || []).map((item) =>
    item && typeof item.toJSON === 'function' ? item.toJSON() : item
  );
}

/**
 * Serialises an owner object by calling toJSON() if available.
 * Returns null when owner is absent.
 * @param {Object|null} owner - The owner object to serialise
 * @returns {Object|null} The serialised owner object, or null if owner is falsy
 */
function serialiseOwner(owner) {
  if (!owner) return null;
  if (typeof owner.toJSON === 'function') return owner.toJSON();
  return owner;
}

/**
 * ABClass
 *
 * Root model that encapsulates all data about a given class (Google Classroom course).
 * Contains students, teachers and assignments and provides helpers for cohort handling
 * and simple add/remove/find operations. Designed to be serializable via toJSON/fromJSON.
 */
class ABClass {
  /**
   * Constructs an ABClass instance with class metadata, students, teachers, and assignments.
   * @param {Object} options - Class metadata and nested collections.
   * @throws {TypeError} If options is not a plain object or classId is missing.
   */
  constructor(options) {
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      throw new TypeError('ABClass constructor requires an options object');
    }

    const {
      classId,
      className = null,
      cohortKey = null,
      courseLength = 1,
      yearGroupKey = null,
      classOwner = null,
      teachers = [],
      students = [],
      assignments = [],
      active = null,
    } = options;

    if (!classId) throw new TypeError('classId is required');
    this.classId = classId;
    this.className = className || null;

    // Explicit owner property (store as provided). Validation should be done via setClassOwner.
    this.classOwner = classOwner || null;

    const hasCohortKey = cohortKey === undefined || cohortKey === null;
    this.cohortKey = hasCohortKey ? null : String(cohortKey);

    // courseLength in years (integer)
    this.courseLength = Number.isInteger(courseLength)
      ? courseLength
      : ABClass._parseNullableInt(courseLength, 1);

    const hasYearGroupKey = yearGroupKey === undefined || yearGroupKey === null;
    this.yearGroupKey = hasYearGroupKey ? null : String(yearGroupKey);

    // Arrays of domain objects; consumers may push instances or plain objects.
    this.teachers = Array.isArray(teachers) ? [...teachers] : [];
    this.students = Array.isArray(students) ? [...students] : [];
    this.assignments = Array.isArray(assignments) ? [...assignments] : [];

    this.active = active;
  }

  // Owner helpers
  /**
   * Gets the class owner (teacher).
   * @returns {Teacher|null} The class owner teacher object, or null if not set
   */
  getClassOwner() {
    return this.classOwner || null;
  }

  /**
   * Sets the class owner (teacher).
   * Accepts Teacher instances or plain objects, coercing to Teacher when possible.
   * @param {Teacher|Object} owner - The teacher object to set as class owner
   * @returns {Teacher} The verified owner as a Teacher instance
   * @throws {TypeError} If owner is not a valid Teacher instance
   */
  setClassOwner(owner) {
    const logger = ABLogger.getInstance();

    // Accept both Teacher instances and plain objects returned by legacy API
    // calls. Coerce plain objects via Teacher.fromJSON when available to
    // preserve fields like email and teacherName.
    let ownerInstance = owner;
    if (
      !(owner instanceof Teacher) &&
      owner &&
      typeof owner === 'object' &&
      typeof Teacher.fromJSON === 'function'
    ) {
      // Prefer fail-fast: allow Teacher.fromJSON to throw if coercion fails
      ownerInstance = Teacher.fromJSON(owner) || owner;
    }

    if (!(ownerInstance instanceof Teacher)) {
      const message = 'setClassOwner requires a Teacher instance';
      if (logger && typeof logger.error === 'function') logger.error(message);
      throw new TypeError(message);
    }

    this.classOwner = ownerInstance;
    return this.classOwner;
  }

  /**
   * Parses a value to an integer, returning a default if parsing fails.
   * @param {*} value - The value to parse
   * @param {number|null} defaultValue - The default value to return if parsing fails
   * @returns {number|null} The parsed integer, or defaultValue if parsing fails
   * @private
   */
  static _parseNullableInt(value, defaultValue) {
    if (value === null || value === undefined) return defaultValue;
    if (Number.isInteger(value)) return value;
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return defaultValue;
    return parsed;
  }

  // Basic getters
  /**
   * Gets the unique class ID (Google Classroom course ID).
   * @returns {string} The class ID
   */
  getClassId() {
    return this.classId;
  }

  /**
   * Gets the class name.
   * @returns {string|null} The class name, or null if not set
   */
  getClassName() {
    return this.className;
  }

  /**
   * Sets the class name.
   * @param {string|null} name - The class name to set
   */
  setClassName(name) {
    this.className = name || null;
  }

  // Teacher management
  /**
   * Adds a teacher to this class.
   * @param {Teacher} teacher - The teacher to add
   * @returns {Teacher|null} The added teacher, or null if teacher is falsy
   */
  addTeacher(teacher) {
    if (!teacher) return null;
    this.teachers.push(teacher);
    return teacher;
  }

  /**
   * Removes the first teacher matching the predicate.
   * @param {Function} predicate - Function that receives (teacher, index, collection) and returns true for the target
   * @returns {Teacher|null} The removed teacher, or null if not found
   */
  removeTeacher(predicate) {
    const index = findIndexWithPredicate(this.teachers, predicate);
    if (index === ITEM_NOT_FOUND_INDEX) return null;
    return this.teachers.splice(index, 1)[0];
  }

  /**
   * Finds the first teacher matching the predicate.
   * @param {Function} predicate - Function that receives (teacher, index, collection) and returns true for the target
   * @returns {Teacher|null} The matching teacher, or null if not found
   */
  findTeacher(predicate) {
    return findWithPredicate(this.teachers, predicate);
  }

  // Student management
  /**
   * Adds a student to this class.
   * @param {Student} student - The student to add
   * @returns {Student|null} The added student, or null if student is falsy
   */
  addStudent(student) {
    if (!student) return null;
    this.students.push(student);
    return student;
  }

  /**
   * Removes the first student matching the predicate.
   * @param {Function} predicate - Function that receives (student, index, collection) and returns true for the target
   * @returns {Student|null} The removed student, or null if not found
   */
  removeStudent(predicate) {
    const index = findIndexWithPredicate(this.students, predicate);
    if (index === ITEM_NOT_FOUND_INDEX) return null;
    return this.students.splice(index, 1)[0];
  }

  /**
   * Finds the first student matching the predicate.
   * @param {Function} predicate - Function that receives (student, index, collection) and returns true for the target
   * @returns {Student|null} The matching student, or null if not found
   */
  findStudent(predicate) {
    return findWithPredicate(this.students, predicate);
  }

  // Assignment management
  /**
   * Adds an assignment to this class.
   * @param {Assignment} assignment - The assignment to add
   * @returns {Assignment|null} The added assignment, or null if assignment is falsy
   */
  addAssignment(assignment) {
    if (!assignment) return null;
    this.assignments.push(assignment);
    return assignment;
  }

  /**
   * Removes the first assignment matching the predicate.
   * @param {Function} predicate - Function that receives (assignment, index, collection) and returns true for the target
   * @returns {Assignment|null} The removed assignment, or null if not found
   */
  removeAssignment(predicate) {
    const index = findIndexWithPredicate(this.assignments, predicate);
    if (index === ITEM_NOT_FOUND_INDEX) return null;
    return this.assignments.splice(index, 1)[0];
  }

  /**
   * Finds the first assignment matching the predicate.
   * @param {Function} predicate - Function that receives (assignment, index, collection) and returns true for the target
   * @returns {Assignment|null} The matching assignment, or null if not found
   */
  findAssignment(predicate) {
    return findWithPredicate(this.assignments, predicate);
  }

  /**
   * Find the array index of an assignment matching the predicate.
   * Supports immutable replace pattern during rehydration.
   * @param {Function} predicate - Function that returns true for the target assignment
   * @returns {number} Index of the matching assignment, or -1 if not found
   */
  findAssignmentIndex(predicate) {
    return findIndexWithPredicate(this.assignments, predicate);
  }

  // toJSON serializes contained objects by calling toJSON if available.
  /**
   * Serialises this class to a JSON object.
   * @returns {Object} A plain object representation of the class and all its contents
   */
  toJSON() {
    return {
      classId: this.classId,
      className: this.className,
      cohortKey: this.cohortKey,
      courseLength: this.courseLength,
      yearGroupKey: this.yearGroupKey,
      classOwner: serialiseOwner(this.classOwner),
      teachers: serialiseArray(this.teachers),
      students: serialiseArray(this.students),
      assignments: serialiseArray(this.assignments),
      active: this.active ?? null,
    };
  }

  /**
   * Returns a lightweight partial representation of the class, omitting students and assignments.
   * Suitable for list views and class-selector UIs.
   * @returns {Object} A partial object representation with class metadata and teachers, but no students or assignments
   */
  toPartialJSON() {
    return {
      classId: this.classId,
      className: this.className,
      cohortKey: this.cohortKey,
      courseLength: this.courseLength,
      yearGroupKey: this.yearGroupKey,
      classOwner: serialiseOwner(this.classOwner),
      teachers: serialiseArray(this.teachers),
      active: this.active ?? null,
    };
  }

  // fromJSON reconstructs an ABClass instance from previously serialized data.
  /**
   * Deserialises a JSON object to an ABClass instance.
   * @param {Object|null} json - The serialised class object
   * @returns {ABClass|null} A new ABClass instance, or null if json is falsy
   */
  static fromJSON(json) {
    if (!json || typeof json !== 'object') return null;
    const inst = Object.create(ABClass.prototype);
    inst.classId = json.classId;
    inst.className = json.className || null;
    inst.cohortKey =
      json.cohortKey !== undefined && json.cohortKey !== null ? String(json.cohortKey) : null;
    inst.courseLength = Number.isInteger(json.courseLength)
      ? json.courseLength
      : ABClass._parseNullableInt(json.courseLength, 1);
    inst.yearGroupKey =
      json.yearGroupKey !== undefined && json.yearGroupKey !== null
        ? String(json.yearGroupKey)
        : null;

    // Restore explicit owner (attempt Teacher.fromJSON when available)
    try {
      inst.classOwner =
        json.classOwner && typeof Teacher === 'function' && typeof Teacher.fromJSON === 'function'
          ? Teacher.fromJSON(json.classOwner) || json.classOwner
          : json.classOwner || null;
    } catch (error) {
      inst.classOwner = json.classOwner || null;
      if (globalThis.__TRACE_SINGLETON__)
        ABLogger.getInstance().debug('ABClass.fromJSON classOwner coercion failed:', error);
    }

    // Restore arrays - callers may want to map to Student/Teacher/Assignment via their own fromJSON
    inst.teachers = Array.isArray(json.teachers) ? [...json.teachers] : [];
    inst.students = Array.isArray(json.students) ? [...json.students] : [];

    // Reconstruct assignments as typed instances via Assignment.fromJSON
    inst.assignments = [];
    if (Array.isArray(json.assignments)) {
      json.assignments.forEach((assignmentData) => {
        const assignmentInstance = Assignment.fromJSON(assignmentData);
        assignmentInstance._hydrationLevel = 'partial';
        inst.assignments.push(assignmentInstance);
      });
    }

    inst.active = json.active ?? null;

    return inst;
  }
}

// Export for Node/Vitest environment (ignored in GAS runtime)
if (typeof module !== 'undefined') {
  module.exports = { ABClass };
}
