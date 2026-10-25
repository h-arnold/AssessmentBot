/** Pure legacy reassessment read projection; never writes its detached placeholders. */
const AssignmentReadProjection = {
  /**
   * Builds detached reassessment submissions from a legacy assignment.
   * @param {object} assignment - Raw or typed legacy assignment.
   * @param {Array<object>} students - Loaded roster for partial projections.
   * @param {'full'|'partial'} form - Projection representation.
   * @returns {StudentSubmission[]} Detached reassessment submissions.
   */
  projectReassessmentSubmissions(assignment, students, form) {
    if (!['full', 'partial'].includes(form)) throw new Error('Invalid projection mode');
    if (
      !assignment ||
      !this._isValidId(assignment.courseId) ||
      !this._isValidId(assignment.assignmentId)
    )
      throw new Error('Invalid assignment identity for reassessment projection');
    const definition = assignment.assignmentDefinition;
    if (!definition || typeof definition !== 'object')
      throw new Error('Invalid assignment definition');

    const taskIds = this._getTaskIds(definition.tasks, form);
    const records = this._getHistoricalSubmissions(assignment);
    const identities =
      form === 'full'
        ? this._getStoredIdentities(records, assignment.assignmentId)
        : this._getRosterIdentities(students, records);
    const timestamps = this._getAssignmentTimestamps(assignment);

    return identities.map(({ id, record, name }) =>
      this._createPlaceholder(assignment.assignmentId, id, name, record, taskIds, timestamps)
    );
  },

  /** Checks whether an ID is a non-empty string.
   * @param {*} value - Candidate identifier.
   * @returns {boolean} Whether the identifier is usable.
   */
  _isValidId(value) {
    return typeof value === 'string' && value.trim().length > 0;
  },

  /** Selects and validates the canonical task universe for a projection.
   * @param {*} rawTasks - Definition task representation.
   * @param {string} form - Projection representation.
   * @returns {string[]} Ordered canonical task IDs.
   */
  _getTaskIds(rawTasks, form) {
    const taskIds = [];
    if (form === 'full' && rawTasks && !Array.isArray(rawTasks) && typeof rawTasks === 'object') {
      for (const [key, task] of Object.entries(rawTasks)) {
        if (
          !this._isValidId(key) ||
          !task ||
          task.id !== key ||
          (task.taskId != null && task.taskId !== key)
        )
          throw new TypeError('Invalid canonical full task identity');
        taskIds.push(key);
      }
    } else if (form === 'partial' && Array.isArray(rawTasks)) {
      const seen = new Set();
      for (const task of rawTasks) {
        this._appendPartialTask(task, seen, taskIds);
      }
    } else {
      throw new Error('Invalid task universe for projection mode');
    }
    if (taskIds.length === 0) throw new Error('Empty task definition for reassessment projection');
    return taskIds;
  },

  /** Adds one valid partial task identity.
   * @param {*} task - Task summary.
   * @param {Set<string>} seen - Previously encountered IDs.
   * @param {string[]} taskIds - Ordered ID output.
   * @returns {void}
   */
  _appendPartialTask(task, seen, taskIds) {
    if (!task || !this._isValidId(task.taskId) || seen.has(task.taskId))
      throw new TypeError('Invalid or duplicate partial task identity');
    seen.add(task.taskId);
    taskIds.push(task.taskId);
  },

  /** Uses opaque owned legacy history when present, otherwise raw submissions.
   * @param {object} assignment - Raw or typed assignment.
   * @returns {Array<object>} Historical records.
   */
  _getHistoricalSubmissions(assignment) {
    const snapshot = assignment._legacyPersistenceSnapshot;
    const records = snapshot ? snapshot.submissions : assignment.submissions;
    if (!Array.isArray(records)) throw new TypeError('Invalid stored submissions');
    return records;
  },

  /** Validates historical identities for a full projection.
   * @param {Array<object>} records - Historical records.
   * @param {string} assignmentId - Owning assignment ID.
   * @returns {Array<object>} Validated identities.
   */
  _getStoredIdentities(records, assignmentId) {
    const seen = new Set();
    return records.map((record) => {
      const id = record && (this._isValidId(record.studentId) ? record.studentId : record.userId);
      if (!this._isValidId(id) || record.assignmentId !== assignmentId || seen.has(id))
        throw new Error('Invalid or duplicate stored submission identity');
      seen.add(id);
      return {
        id,
        record,
        name: typeof record.studentName === 'string' ? record.studentName : null,
      };
    });
  },

  /** Validates roster identities and associates matching historical metadata.
   * @param {Array<object>} students - Loaded roster.
   * @param {Array<object>} records - Historical records.
   * @returns {Array<object>} Roster-authoritative identities.
   */
  _getRosterIdentities(students, records) {
    if (!Array.isArray(students)) throw new TypeError('Invalid loaded student roster');
    const historicalById = new Map();
    for (const record of records) {
      const id = record && (this._isValidId(record.studentId) ? record.studentId : record.userId);
      if (this._isValidId(id) && !historicalById.has(id)) historicalById.set(id, record);
    }
    const seen = new Set();
    return students.map((student) => {
      const id = student && (this._isValidId(student.studentId) ? student.studentId : student.id);
      if (!this._isValidId(id) || seen.has(id))
        throw new Error('Invalid or duplicate roster student identity');
      seen.add(id);
      const record = historicalById.get(id) || null;
      let name = null;
      if (typeof student.studentName === 'string') name = student.studentName;
      else if (typeof student.name === 'string') name = student.name;
      return { id, record, name };
    });
  },

  /** Converts valid Date/string timestamps to deterministic ISO strings.
   * @param {*} value - Candidate timestamp.
   * @returns {string|null} ISO string or null when invalid.
   */
  _timestamp(value) {
    if (!(typeof value === 'string' || value instanceof Date)) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  },

  /** Resolves assignment timestamp fallbacks without the wall clock.
   * @param {object} assignment - Raw or typed assignment.
   * @returns {object} Creation and update timestamp fallbacks.
   */
  _getAssignmentTimestamps(assignment) {
    const createdAt = this._timestamp(assignment.createdAt);
    if (!createdAt) throw new Error('Invalid assignment createdAt fallback');
    if (assignment.updatedAt != null && !this._timestamp(assignment.updatedAt))
      throw new Error('Invalid assignment updatedAt timestamp');
    return {
      createdAt,
      updatedAt: assignment.updatedAt == null ? createdAt : this._timestamp(assignment.updatedAt),
    };
  },

  /** Creates one safe placeholder with catalogue-backed task entries.
   * @param {string} assignmentId - Owning assignment ID.
   * @param {string} studentId - Authoritative student ID.
   * @param {string|null} studentName - Authoritative student name.
   * @param {object|null} record - Matching historical record.
   * @param {string[]} taskIds - Canonical task IDs.
   * @param {object} timestamps - Assignment timestamp fallbacks.
   * @returns {StudentSubmission} Detached placeholder submission.
   */
  _createPlaceholder(assignmentId, studentId, studentName, record, taskIds, timestamps) {
    const submission = new StudentSubmission(studentId, assignmentId, null, studentName);
    const documentId = this._safeSourceId(record && record.documentId);
    submission.documentId = documentId;
    submission.createdAt = this._timestamp(record && record.createdAt) || timestamps.createdAt;
    submission.updatedAt = this._timestamp(record && record.updatedAt) || timestamps.updatedAt;
    for (const taskId of taskIds) {
      const pageId = documentId ? this._safeSourceId(record && record.pageId) : null;
      const hashInput = `${assignmentId}::${studentId}::${taskId}`;
      const uid = `reassessment-${Utils.generateHash(hashInput)}`;
      const artifact = new BaseTaskArtifact({
        taskId,
        role: 'submission',
        documentId,
        pageId,
        content: null,
        contentHash: null,
        metadata: {},
        uid,
      });
      const item = new StudentSubmissionItem({ taskId, artifact });
      item.setError('validation', 'REASSESSMENT_REQUIRED');
      submission.items[taskId] = item;
    }
    return submission;
  },

  /** Retains only identifier-shaped source IDs.
   * @param {*} value - Candidate source ID.
   * @returns {string|null} Safe source ID or null.
   */
  _safeSourceId(value) {
    return this._isValidId(value) && /^[A-Za-z0-9_-]+$/u.test(value) ? value : null;
  },
};

if (typeof module !== 'undefined' && module.exports) module.exports = AssignmentReadProjection;
