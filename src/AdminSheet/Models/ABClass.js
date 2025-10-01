/**
 * ABClass
 *
 * Root model that encapsulates all data about a given class (Google Classroom course).
 * Contains students, teachers and assignments and provides helpers for cohort handling
 * and simple add/remove/find operations. Designed to be serializable via toJSON/fromJSON.
 */
class ABClass {
  /**
   * @param {string} classId - Google Classroom courseId (primary key)
   * @param {string} className - Human readable class name
   * @param {string|number} cohort - Year the cohort started (e.g. 2025) or a string/enum
   * @param {number} courseLength - Length of the course in years (integer)
   * @param {number} yearGroup - Current year group (integer)
   * @param {Array} teachers - Array of teacher objects (raw or Teacher instances)
   * @param {Array} students - Array of student objects (raw or Student instances)
   * @param {Array} assignments - Array of assignment objects (raw or Assignment instances)
   */
  constructor(
    classId,
    className = null,
    cohort = null,
    courseLength = 1,
    yearGroup = null,
    classOwner = null,
    teachers = [],
    students = [],
    assignments = []
  ) {
    // If classId not provided, attempt to read from ConfigurationManager (Assessment Record Course Id)
    if (!classId) {
      try {
        const cfg = ConfigurationManager.getInstance();
        const cfgCourseId = cfg.getAssessmentRecordCourseId();
        if (cfgCourseId) {
          classId = String(cfgCourseId);
        }
      } catch (e) {
        // swallow and allow the subsequent check to throw a consistent error
        if (globalThis.__TRACE_SINGLETON__)
          console.debug('ABClass constructor config lookup failed:', e);
      }
    }

    if (!classId) throw new TypeError('classId is required');
    this.classId = classId;
    this.className = className || null;

    // Explicit owner property (store as provided). Validation should be done via setClassOwner.
    this.classOwner = classOwner || null;

    // Cohort can be a number (year) or string. Store as string for stability but expose helpers.
    this.cohort = cohort !== undefined && cohort !== null ? String(cohort) : null;

    // courseLength in years (integer)
    this.courseLength = Number.isInteger(courseLength)
      ? courseLength
      : ABClass._parseNullableInt(courseLength, 1);

    // yearGroup (integer), nullable
    this.yearGroup = Number.isInteger(yearGroup)
      ? yearGroup
      : ABClass._parseNullableInt(yearGroup, null);

    // Arrays of domain objects; consumers may push instances or plain objects.
    this.teachers = Array.isArray(teachers) ? teachers.slice() : [];
    this.students = Array.isArray(students) ? students.slice() : [];
    this.assignments = Array.isArray(assignments) ? assignments.slice() : [];
  }

  // Owner helpers
  getClassOwner() {
    return this.classOwner || null;
  }

  setClassOwner(owner) {
    const logger = ABLogger.getInstance();

    if (!(owner instanceof Teacher)) {
      const msg = 'setClassOwner requires a Teacher instance';
      if (logger && typeof logger.error === 'function') logger.error(msg);
      throw new TypeError(msg);
    }

    this.classOwner = owner;
    return this.classOwner;
  }

  /**
      classOwner: this.classOwner && typeof this.classOwner.toJSON === 'function'
        ? this.classOwner.toJSON()
        : this.classOwner,
      teachers: serializeArray(this.teachers),
   * is null/undefined or cannot be parsed. If defaultValue is null, null will be
   * returned when input is null/undefined or non-parsable.
   * @param {*} value
   * @param {number|null} defaultValue
   * @return {number|null}
   */
  static _parseNullableInt(value, defaultValue) {
    if (value === null || value === undefined) return defaultValue;
    if (Number.isInteger(value)) return value;
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) return defaultValue;
    return parsed;
  }

  // Basic getters
  getClassId() {
    return this.classId;
  }

  getClassName() {
    return this.className;
  }

  setClassName(name) {
    this.className = name || null;
  }

  // Cohort helpers
  getCohortStartYear() {
    if (!this.cohort) return null;
    const num = parseInt(this.cohort, 10);
    return Number.isNaN(num) ? null : num;
  }

  /**
   * Returns an array containing the cohort year range as strings.
   * e.g. cohort=2025, courseLength=1 -> ['2025-2026']
   * If courseLength > 1 returns multiple ranges for each academic year segment up to courseLength.
   */
  getCohortYearRanges() {
    const start = this.getCohortStartYear();
    if (!start || !Number.isInteger(this.courseLength) || this.courseLength < 1) return [];
    const ranges = [];
    for (let i = 0; i < this.courseLength; i++) {
      const a = start + i;
      const b = a + 1;
      ranges.push(`${a}-${b}`);
    }
    return ranges;
  }

  // Teacher management
  addTeacher(teacher) {
    if (!teacher) return null;
    this.teachers.push(teacher);
    return teacher;
  }

  removeTeacher(predicate) {
    const idx = this.teachers.findIndex(predicate);
    if (idx === -1) return null;
    return this.teachers.splice(idx, 1)[0];
  }

  findTeacher(predicate) {
    return this.teachers.find(predicate) || null;
  }

  // Student management
  addStudent(student) {
    if (!student) return null;
    this.students.push(student);
    return student;
  }

  removeStudent(predicate) {
    const idx = this.students.findIndex(predicate);
    if (idx === -1) return null;
    return this.students.splice(idx, 1)[0];
  }

  findStudent(predicate) {
    return this.students.find(predicate) || null;
  }

  // Assignment management
  addAssignment(assignment) {
    if (!assignment) return null;
    this.assignments.push(assignment);
    return assignment;
  }

  removeAssignment(predicate) {
    const idx = this.assignments.findIndex(predicate);
    if (idx === -1) return null;
    return this.assignments.splice(idx, 1)[0];
  }

  findAssignment(predicate) {
    return this.assignments.find(predicate) || null;
  }

  // toJSON serializes contained objects by calling toJSON if available.
  toJSON() {
    const serializeArray = (arr) =>
      (arr || []).map((it) => (it && typeof it.toJSON === 'function' ? it.toJSON() : it));

    return {
      classId: this.classId,
      className: this.className,
      cohort: this.cohort,
      courseLength: this.courseLength,
      yearGroup: this.yearGroup,
      teachers: serializeArray(this.teachers),
      students: serializeArray(this.students),
      assignments: serializeArray(this.assignments),
    };
  }

  // fromJSON reconstructs an ABClass instance from previously serialized data.
  static fromJSON(json) {
    if (!json || typeof json !== 'object') return null;
    const inst = Object.create(ABClass.prototype);
    inst.classId = json.classId;
    inst.className = json.className || null;
    inst.cohort = json.cohort !== undefined && json.cohort !== null ? String(json.cohort) : null;
    inst.courseLength = Number.isInteger(json.courseLength)
      ? json.courseLength
      : ABClass._parseNullableInt(json.courseLength, 1);
    inst.yearGroup = Number.isInteger(json.yearGroup)
      ? json.yearGroup
      : ABClass._parseNullableInt(json.yearGroup, null);

    // Restore explicit owner (attempt Teacher.fromJSON when available)
    try {
      if (
        json.classOwner &&
        typeof Teacher === 'function' &&
        typeof Teacher.fromJSON === 'function'
      ) {
        inst.classOwner = Teacher.fromJSON(json.classOwner) || json.classOwner;
      } else {
        inst.classOwner = json.classOwner || null;
      }
    } catch (e) {
      inst.classOwner = json.classOwner || null;
      if (globalThis.__TRACE_SINGLETON__)
        console.debug('ABClass.fromJSON classOwner coercion failed:', e);
    }

    // Restore arrays - callers may want to map to Student/Teacher/Assignment via their own fromJSON
    inst.teachers = Array.isArray(json.teachers) ? json.teachers.slice() : [];
    inst.students = Array.isArray(json.students) ? json.students.slice() : [];
    inst.assignments = Array.isArray(json.assignments) ? json.assignments.slice() : [];

    return inst;
  }
}

// Export for Node/Vitest environment (ignored in GAS runtime)
if (typeof module !== 'undefined') {
  module.exports = { ABClass };
}
