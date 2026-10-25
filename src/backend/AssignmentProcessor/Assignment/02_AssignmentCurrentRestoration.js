/**
 * AssignmentCurrentRestoration — restores current-format submissions and validates
 * their assessment and source state.
 *
 * Depends on the model classes and Assessment as GAS runtime globals.
 * @namespace
 */
const AssignmentCurrentRestoration = {
  /**
   * Validate shared marker-1 root and authoritative task identities once.
   * @param {object} data - Marker-1 assignment JSON.
   * @returns {void}
   */
  _validateCurrentAssignment(data) {
    if (
      typeof data.courseId !== 'string' ||
      !data.courseId.trim() ||
      typeof data.assignmentId !== 'string' ||
      !data.assignmentId.trim() ||
      !Array.isArray(data.submissions)
    )
      throw new Error('Current assignment root is untrustworthy');
    const tasks = data.assignmentDefinition?.tasks;
    if (!tasks || typeof tasks !== 'object')
      throw new Error('Current assignment requires an embedded task universe');
    if (Array.isArray(tasks)) {
      const ids = tasks.map((task) => task?.taskId);
      if (
        ids.length === 0 ||
        ids.some((id) => typeof id !== 'string' || !id.trim()) ||
        new Set(ids).size !== ids.length
      )
        throw new Error('Current assignment task universe is untrustworthy');
      return;
    }
    const keys = Object.keys(tasks);
    if (
      keys.length === 0 ||
      keys.some((key) => {
        const task = tasks[key];
        const taskId = task?.id;
        return (
          !key.trim() ||
          !task ||
          typeof task !== 'object' ||
          typeof taskId !== 'string' ||
          taskId !== key ||
          (task.taskId !== undefined && task.taskId !== key)
        );
      })
    )
      throw new Error('Current assignment task universe is untrustworthy');
  },

  /**
   * Restores a current-format submission and its complete task-item universe.
   * Invalid items become corrupt-record placeholders; untrustworthy submission
   * identity or task universes are rejected.
   * @param {Assignment} inst - Assignment receiving the restored submission.
   * @param {object} raw - Current-format submission JSON.
   * @param {object} assignmentData - Parent assignment JSON and embedded definition.
   * @param {string} mode - Representation mode (`full` or `partial`).
   * @returns {void}
   */
  _rehydrateCurrentSubmission(inst, raw, assignmentData, mode) {
    const definition = assignmentData.assignmentDefinition;
    const taskIds = this._getCurrentTaskIds(raw, assignmentData, definition);
    const { items, isMalformedItems } = this._getCurrentItems(raw, taskIds);
    const preparedRaw = this._prepareCurrentTimestamps(raw, assignmentData);
    if (raw.documentId == null && !isMalformedItems && Object.keys(items).length === 0) {
      const empty = StudentSubmission.fromJSON(preparedRaw, mode);
      inst.submissions.push(empty);
      return;
    }
    const createCorruptPlaceholder = (taskId) => {
      const artifact = new BaseTaskArtifact({
        taskId,
        role: 'submission',
        pageId: null,
        documentId: null,
        content: null,
        contentHash: null,
        metadata: {},
        uid: `${taskId}-${raw.studentId}-na-0`,
      });
      const placeholder = new StudentSubmissionItem({ taskId, artifact });
      placeholder.setError('validation', 'CORRUPT_RECORD');
      return placeholder;
    };
    // Prepare canonical JSON before restoration so invalid records never enter
    // the model restoration path and each healthy item is restored only once.
    const prepared = { ...preparedRaw, items: {} };
    for (const taskId of taskIds) {
      const originalItem = items[taskId];
      if (!originalItem) continue;
      const result = this._prepareCurrentItem(originalItem, taskId, raw.documentId, mode);
      if (result.isValid) {
        prepared.items[taskId] = result.retained;
      } else {
        prepared.items[taskId] = createCorruptPlaceholder(taskId);
      }
    }
    for (const taskId of taskIds)
      if (!Object.hasOwn(prepared.items, taskId))
        prepared.items[taskId] = createCorruptPlaceholder(taskId);
    const submission = StudentSubmission.fromJSON(prepared, mode);
    inst.submissions.push(submission);
  },

  _prepareCurrentItem(item, taskId, parentDocumentId, mode) {
    const isModelItem = item instanceof StudentSubmissionItem;
    let itemJson = item;
    if (isModelItem) itemJson = mode === 'partial' ? item.toPartialJSON() : item.toJSON();
    const isValid =
      itemJson.taskId === taskId &&
      StudentSubmissionItem.validateCurrentRawArtifact(itemJson, taskId, mode) &&
      this._hasValidCompletedCurrentAssessments(itemJson.assessments, mode) &&
      this._hasConsistentCurrentSource(itemJson, parentDocumentId, mode);
    return { isValid, retained: isModelItem ? item : itemJson };
  },

  _prepareCurrentTimestamps(raw, assignmentData) {
    let createdAt = assignmentData.createdAt;
    if (this._isValidCurrentTimestamp(raw.createdAt)) createdAt = raw.createdAt;
    let updatedAt = assignmentData.createdAt;
    if (assignmentData.updatedAt != null) updatedAt = assignmentData.updatedAt;
    if (this._isValidCurrentTimestamp(raw.updatedAt)) updatedAt = raw.updatedAt;
    if (!this._isValidCurrentTimestamp(createdAt) || !this._isValidCurrentTimestamp(updatedAt))
      throw new Error('Current assignment timestamps are untrustworthy');
    return { ...raw, createdAt, updatedAt };
  },

  _isValidCurrentTimestamp(value) {
    return (
      (typeof value === 'string' || value instanceof Date) &&
      !Number.isNaN(new Date(value).getTime())
    );
  },

  _getCurrentItems(raw, taskIds) {
    const isMalformedItems =
      !raw.items || typeof raw.items !== 'object' || Array.isArray(raw.items);
    const items = isMalformedItems ? {} : raw.items;
    for (const key of Object.keys(items)) {
      if (!taskIds.includes(key)) throw new Error(`Unknown task key: ${key}`);
    }
    return { items, isMalformedItems };
  },

  _getCurrentTaskIds(raw, assignmentData, definition) {
    if (
      !raw ||
      typeof raw !== 'object' ||
      !definition ||
      !definition.tasks ||
      typeof definition.tasks !== 'object'
    )
      throw new Error('Current assignment restoration requires an embedded task universe');
    if (
      raw.assignmentId !== assignmentData.assignmentId ||
      typeof raw.studentId !== 'string' ||
      !raw.studentId.trim()
    )
      throw new Error('Current submission identity is untrustworthy');
    const taskIds = Array.isArray(definition.tasks)
      ? definition.tasks.map((task) => task.taskId)
      : Object.keys(definition.tasks);
    if (taskIds.length === 0 || taskIds.some((id) => typeof id !== 'string' || !id))
      throw new Error('Current assignment task universe is untrustworthy');
    return taskIds;
  },

  /**
   * Validates the completed three-criterion result map required by marker-1 records.
   * @param {object} assessments - Raw item assessment map.
   * @param {string} mode - Representation mode (`full` or `partial`).
   * @returns {boolean} Whether the map contains exactly three valid completed results.
   */
  _hasValidCompletedCurrentAssessments(assessments, mode) {
    const criteria = ['completeness', 'accuracy', 'spag'];
    if (
      !assessments ||
      typeof assessments !== 'object' ||
      Array.isArray(assessments) ||
      Object.keys(assessments).length !== criteria.length ||
      criteria.some((criterion) => !Object.hasOwn(assessments, criterion))
    )
      return false;
    return criteria.every((criterion) => {
      const entry = assessments[criterion];
      if (mode === 'full') return Assessment.isValidRawResult(entry);
      if (
        !entry ||
        typeof entry !== 'object' ||
        Array.isArray(entry) ||
        !Assessment.isValidRawScore(entry.score)
      )
        return false;
      if (entry.score === 'E')
        return (
          typeof entry.reasoning === 'string' &&
          entry.reasoning.trim().length > 0 &&
          Assessment.isValidCause(entry.error)
        );
      return !Object.hasOwn(entry, 'reasoning') && !Object.hasOwn(entry, 'error');
    });
  },

  /**
   * Rejects assessment/source combinations that cannot describe one stored state.
   * Partial records redact source bodies; full records require a source for
   * numeric, not-attempted, and assessment/extraction outcomes.
   * @param {object} item - Raw submission item.
   * @param {string|null} parentDocumentId - Parent submission document ID.
   * @param {string} mode - Representation mode (`full` or `partial`).
   * @returns {boolean} Whether the item is consistent with its parent source.
   */
  _hasConsistentCurrentSource(item, parentDocumentId, mode) {
    if (parentDocumentId != null && mode === 'partial') return true;
    const assessments = item.assessments;
    const artifact = item.artifact;
    const isSourceIsEmpty = artifact.content === null && artifact.contentHash === null;
    if (parentDocumentId != null)
      return (
        !isSourceIsEmpty ||
        Object.values(assessments).every((entry) => {
          return (
            entry.score === 'E' &&
            ['acquisition', 'extraction', 'validation'].includes(entry.error?.stage)
          );
        })
      );
    if (
      artifact.type !== 'base' ||
      artifact.role !== 'submission' ||
      artifact.documentId !== null ||
      artifact.pageId !== null ||
      artifact.content !== null ||
      artifact.contentHash !== null ||
      !artifact.metadata ||
      typeof artifact.metadata !== 'object' ||
      Array.isArray(artifact.metadata) ||
      Object.keys(artifact.metadata).length > 0 ||
      !item.feedback ||
      typeof item.feedback !== 'object' ||
      Array.isArray(item.feedback) ||
      Object.keys(item.feedback).length > 0
    )
      return false;
    return Object.values(assessments).every(
      (entry) => entry.score === 'E' && ['acquisition', 'validation'].includes(entry.error?.stage)
    );
  },
};

// Export for Node/Vitest environment (ignored in GAS runtime)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AssignmentCurrentRestoration;
}
