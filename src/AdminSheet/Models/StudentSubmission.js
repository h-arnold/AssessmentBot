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
    let uid = null;
    try {
      if (this.artifact && typeof this.artifact.getUid === 'function') uid = this.artifact.getUid();
    } catch (e) {
      uid = null;
    }
    if (!uid) uid = this.artifact && this.artifact.contentHash ? this.artifact.contentHash : '';
    const base = `${this.taskId}::${uid}`;
    return 'ssi_' + Utils.generateHash(base).substring(0, 16);
  }

  addAssessment(criterion, assessment) {
    if (!criterion) return;
    if (assessment) {
      // Guard against missing Assessment class in pure test environment
      if (typeof Assessment !== 'undefined' && assessment instanceof Assessment) {
        this.assessments[criterion] = assessment.toJSON();
      } else if (typeof assessment === 'object') {
        this.assessments[criterion] = assessment; // assume already JSON shape
      }
    }
  }

  getAssessment(criterion = null) {
    if (!criterion) return this.assessments || null;
    return this.assessments[criterion] || null;
  }

  addFeedback(type, feedbackObj) {
    if (!type) return;
    if (feedbackObj) {
      if (feedbackObj.toJSON) {
        this.feedback[type] = feedbackObj.toJSON();
      } else {
        this.feedback[type] = feedbackObj;
      }
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
   */
  constructor(studentId, assignmentId, documentId = null) {
    if (!studentId || !assignmentId)
      throw new Error('StudentSubmission requires studentId & assignmentId');
    this.studentId = studentId;
    this.assignmentId = assignmentId;
    this.documentId = documentId;
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
  upsertItemFromExtraction(taskDef, { pageId = null, content = null, metadata = {} } = {}) {
    if (!taskDef) throw new Error('upsertItemFromExtraction requires taskDef');
    const taskId = taskDef.getId();
    let item = this.items[taskId];
    let mutated = false;

    if (!item) {
      // Construct a submission-specific UID including the studentId to avoid collisions
      const uid = `${taskId}-${this.studentId}-${
        pageId != null ? pageId : taskDef.pageId || 'na'
      }-0`;
      const artifact = ArtifactFactory.create({
        type: this._inferTypeFromTask(taskDef),
        taskId,
        role: 'submission',
        pageId: pageId != null ? pageId : taskDef.pageId,
        content,
        metadata,
        uid,
      });
      item = new StudentSubmissionItem({ taskId, artifact, onMutate: () => this.touchUpdated() });
      this.items[taskId] = item;
      mutated = true;
    } else {
      // Update existing artifact content if changed
      if (content !== undefined) {
        item.artifact.content = item.artifact.normalizeContent(content);
        item.artifact.ensureHash();
        mutated = true;
      }
      if (metadata) {
        item.artifact.metadata = Object.assign({}, item.artifact.metadata, metadata);
        mutated = true;
      }
      // pageId is stored on the artifact; do not duplicate on the item
    }
    if (mutated) this.touchUpdated();
    return item;
  }

  _inferTypeFromTask(taskDef) {
    // Attempt to infer from primary reference artifact if present
    const ref = taskDef.getPrimaryReference();
    if (ref) return ref.getType();
    // fallback: check metadata hints
    if (taskDef.taskMetadata && taskDef.taskMetadata.taskType) return taskDef.taskMetadata.taskType;
    return 'TEXT';
  }

  toJSON() {
    return {
      studentId: this.studentId,
      assignmentId: this.assignmentId,
      documentId: this.documentId,
      items: Object.fromEntries(Object.entries(this.items).map(([k, v]) => [k, v.toJSON()])),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromJSON(json) {
    const sub = new StudentSubmission(json.studentId, json.assignmentId, json.documentId);
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
