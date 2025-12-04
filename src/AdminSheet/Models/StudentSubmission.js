// StudentSubmission.js
// Defines StudentSubmission and StudentSubmissionItem classes.

class StudentSubmissionItem {
  /**
   * @param {Object} p
   * @param {string} p.taskId
   * @param {BaseTaskArtifact} p.artifact (role='submission')
   *
   * Note: We intentionally do NOT store assignmentId/studentId/documentId/pageId
   * on the item to avoid duplicated canonical data; these are available on
   * the parent StudentSubmission or on the artifact itself.
   */
  constructor({ taskId, artifact }) {
    if (!taskId) throw new Error('StudentSubmissionItem missing taskId');
    if (!artifact) throw new Error('StudentSubmissionItem requires artifact');
    this.taskId = taskId;
    this.artifact = artifact;
    this.assessments = {}; // criterion -> { score, reasoning }
    this.feedback = {}; // type -> feedback JSON or object
    this.id = this._deriveId();
  }

  _deriveId() {
    // Prefer artifact UID for stable identity; fall back to contentHash or taskId.
    const primaryUid = this.artifact.getUid();
    const hasPrimaryUid = typeof primaryUid === 'string' && primaryUid.length > 0;
    const resolvedUid = hasPrimaryUid ? primaryUid : (this.artifact.contentHash ?? '');
    const base = `${this.taskId}::${resolvedUid}`;
    return 'ssi_' + Utils.generateHash(base).substring(0, 16);
  }

  addAssessment(criterion, assessment) {
    if (!criterion)
      throw new Error('addAssessment requires criterion when recording assessment data');
    if (!assessment) return;
    // Guard against missing Assessment class in pure test environment
    if (typeof Assessment !== 'undefined' && assessment instanceof Assessment) {
      this.assessments[criterion] = assessment.toJSON();
    } else if (typeof assessment === 'object') {
      this.assessments[criterion] = assessment; // assume already JSON shape
    }
  }

  getAssessment(criterion = null) {
    if (!criterion) return this.assessments || null;
    return this.assessments[criterion] || null;
  }

  addFeedback(type, feedbackObj) {
    if (!type) throw new Error('addFeedback requires a feedback type identifier');
    if (!feedbackObj) return;
    if (feedbackObj.toJSON) {
      this.feedback[type] = feedbackObj.toJSON();
    } else {
      this.feedback[type] = feedbackObj;
    }
  }

  getFeedback(type = null) {
    if (!type) return this.feedback || null;
    return this.feedback[type] || null;
  }

  getType() {
    return this.artifact.getType();
  }

  toJSON() {
    return {
      id: this.id,
      taskId: this.taskId,
      // documentId/pageId intentionally omitted here; parent submission
      // holds documentId and the artifact contains any pageId information.
      artifact: this.artifact.toJSON(),
      assessments: this.assessments,
      feedback: this.feedback,
      // lastAssessedHash intentionally removed; submission.updatedAt is authoritative
    };
  }

  /**
   * Return a partial JSON payload with heavy artifact fields redacted.
   * @return {Object}
   */
  toPartialJSON() {
    const json = this.toJSON();
    json.artifact = this.artifact.toPartialJSON();
    return json;
  }

  static fromJSON(json) {
    const artifact = ArtifactFactory.fromJSON(json.artifact);
    const item = new StudentSubmissionItem({
      taskId: json.taskId,
      artifact,
    });
    // Preserve id from persisted JSON when present for compatibility
    if (json.id) item.id = json.id;
    item.assessments = json.assessments || {};
    item.feedback = json.feedback || {};
    // previous lastAssessedHash is ignored in new model
    return item;
  }
}

class StudentSubmission {
  /**
   * @param {string} studentId
   * @param {string} assignmentId
   * @param {string=} documentId
   * @param {string=} studentName
   */
  constructor(studentId, assignmentId, documentId = null, studentName = null) {
    if (!studentId || !assignmentId)
      throw new Error('StudentSubmission requires studentId & assignmentId');
    this.studentId = studentId;
    this.assignmentId = assignmentId;
    this.documentId = documentId;
    this.studentName = studentName; //Temporary addition for V0.7.2 - will be removed later.
    this.items = {}; // taskId -> StudentSubmissionItem
    const now = new Date().toISOString();
    this.createdAt = now;
    this.updatedAt = now;
    this._updateCounter = 0;
  }

  touchUpdated() {
    // Ensure strictly monotonic updatedAt even if multiple updates within same ms
    const base = new Date().toISOString();
    this._updateCounter++;
    this.updatedAt = base + '#' + this._updateCounter;
  }

  getItem(taskId) {
    return this.items[taskId];
  }

  /**
   * Upsert item from primitive extraction results
   * @param {TaskDefinition} taskDef
   * @param {Object} extraction - { pageId?, content?, metadata? }
   */
  upsertItemFromExtraction(taskDef, extraction = {}) {
    if (!taskDef) throw new Error('upsertItemFromExtraction requires taskDef');
    const taskId = taskDef.getId();
    let item = this.items[taskId];
    let mutated = false;

    const { pageId = null, content = null } = extraction;
    const hasMetadata = Object.hasOwn(extraction, 'metadata');
    const metadataPayload = hasMetadata ? extraction.metadata : undefined;

    if (item) {
      if (content !== undefined) {
        item.artifact.content = item.artifact.normalizeContent(content);
        item.artifact.ensureHash();
        mutated = true;
      }
      if (hasMetadata) {
        const metadataUpdates = metadataPayload ?? {};
        item.artifact.metadata = {
          ...item.artifact.metadata,
          ...metadataUpdates,
        };
        mutated = true;
      }
    } else {
      const resolvedPageId = pageId ?? taskDef.pageId;
      const metadataForArtifact = metadataPayload ?? {};
      const uid = `${taskId}-${this.studentId}-${resolvedPageId ?? 'na'}-0`;
      const artifact = ArtifactFactory.create({
        type: this._inferTypeFromTask(taskDef),
        taskId,
        role: 'submission',
        pageId: resolvedPageId,
        content,
        metadata: metadataForArtifact,
        uid,
      });
      if (artifact.content == null && artifact.getType() !== 'IMAGE') {
        ABLogger.getInstance().warn(
          `No content found for ${this.studentName} for task '${taskDef.taskTitle}'.`
        );
      }
      item = new StudentSubmissionItem({ taskId, artifact, onMutate: () => this.touchUpdated() });
      this.items[taskId] = item;
      mutated = true;
    }
    if (mutated) this.touchUpdated();
    return item;
  }

  _inferTypeFromTask(taskDef) {
    // Attempt to infer from primary reference artifact if present
    const ref = taskDef.getPrimaryReference();
    if (ref) return ref.getType();
    // fallback: check metadata hints
    if (taskDef.taskMetadata?.taskType) return taskDef.taskMetadata.taskType;
    return 'TEXT';
  }

  toJSON() {
    return {
      studentId: this.studentId,
      studentName: this.studentName,
      assignmentId: this.assignmentId,
      documentId: this.documentId,
      items: Object.fromEntries(Object.entries(this.items).map(([k, v]) => [k, v.toJSON()])),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Return a partial JSON payload with artifacts redacted for lightweight persistence.
   * @return {Object}
   */
  toPartialJSON() {
    const json = this.toJSON();
    json.items = Object.fromEntries(
      Object.entries(this.items).map(([k, v]) => [k, v.toPartialJSON()])
    );
    return json;
  }

  static fromJSON(json) {
    const sub = new StudentSubmission(
      json.studentId,
      json.assignmentId,
      json.documentId,
      json.studentName || null
    );
    sub.createdAt = json.createdAt || new Date().toISOString();
    sub.updatedAt = json.updatedAt || sub.createdAt;
    if (json.items) {
      for (const [taskId, itemJson] of Object.entries(json.items)) {
        const item = StudentSubmissionItem.fromJSON(itemJson);
        sub.items[taskId] = item;
      }
    }
    return sub;
  }
}

if (typeof module !== 'undefined') {
  module.exports = { StudentSubmission, StudentSubmissionItem };
}
