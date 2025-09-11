// StudentSubmission.js
// Defines StudentSubmission and StudentSubmissionItem classes.

class StudentSubmissionItem {
  /**
   * @param {Object} p
   * @param {string} p.assignmentId
   * @param {string} p.studentId
   * @param {string} p.taskId
   * @param {string=} p.documentId
   * @param {string=} p.pageId
   * @param {BaseTaskArtifact} p.artifact (role='submission')
   */
  constructor({ assignmentId, studentId, taskId, documentId = null, pageId = null, artifact }) {
    if (!assignmentId || !studentId || !taskId) throw new Error('StudentSubmissionItem missing identity fields');
    if (!artifact) throw new Error('StudentSubmissionItem requires artifact');
    this.assignmentId = assignmentId;
    this.studentId = studentId;
    this.taskId = taskId;
    this.documentId = documentId;
    this.pageId = pageId;
    this.artifact = artifact;
    this.assessments = {}; // criterion -> { score, reasoning }
    this.feedback = {}; // type -> feedback JSON or object
    this.id = this._deriveId();
    this.lastAssessedHash = null; // optional tracking of artifact.contentHash when last assessed
  }

  _deriveId() {
    const base = `${this.assignmentId}::${this.studentId}::${this.taskId}`;
    return 'ssi_' + Utils.generateHash(base).substring(0, 16);
  }

  addAssessment(criterion, assessment) {
    if (!criterion) return;
    if (assessment) {
      if (assessment instanceof Assessment) {
        this.assessments[criterion] = assessment.toJSON();
      } else if (typeof assessment === 'object') {
        this.assessments[criterion] = assessment; // assume already JSON shape
      }
      this.lastAssessedHash = this.artifact.contentHash;
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

  markAssessed() {
    this.lastAssessedHash = this.artifact.contentHash;
  }

  getType() { return this.artifact.getType(); }

  toJSON() {
    return {
      id: this.id,
      taskId: this.taskId,
      documentId: this.documentId,
      pageId: this.pageId,
      artifact: this.artifact.toJSON(),
      assessments: this.assessments,
      feedback: this.feedback,
      lastAssessedHash: this.lastAssessedHash
    };
  }

  static fromJSON(json, assignmentId, studentId) {
    const artifact = ArtifactFactory.fromJSON(json.artifact);
    const item = new StudentSubmissionItem({
      assignmentId,
      studentId,
      taskId: json.taskId,
      documentId: json.documentId,
      pageId: json.pageId,
      artifact
    });
    item.assessments = json.assessments || {};
    item.feedback = json.feedback || {};
    item.lastAssessedHash = json.lastAssessedHash || null;
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
    if (!studentId || !assignmentId) throw new Error('StudentSubmission requires studentId & assignmentId');
    this.studentId = studentId;
    this.assignmentId = assignmentId;
    this.documentId = documentId;
    this.items = {}; // taskId -> StudentSubmissionItem
    const now = new Date().toISOString();
    this.createdAt = now;
    this.updatedAt = now;
  }

  touchUpdated() { this.updatedAt = new Date().toISOString(); }

  getItem(taskId) { return this.items[taskId]; }

  /**
   * Upsert item from primitive extraction results
   * @param {TaskDefinition} taskDef
   * @param {Object} extraction - { pageId?, content?, metadata? }
   */
  upsertItemFromExtraction(taskDef, { pageId = null, content = null, metadata = {} } = {}) {
    if (!taskDef) throw new Error('upsertItemFromExtraction requires taskDef');
    const taskId = taskDef.getId();
    let item = this.items[taskId];

    if (!item) {
      const artifact = ArtifactFactory.create({
        type: this._inferTypeFromTask(taskDef),
        taskId,
        role: 'submission',
        pageId: pageId != null ? pageId : taskDef.pageId,
        content,
        metadata
      });
      item = new StudentSubmissionItem({
        assignmentId: this.assignmentId,
        studentId: this.studentId,
        taskId,
        documentId: this.documentId,
        pageId: pageId != null ? pageId : taskDef.pageId,
        artifact
      });
      this.items[taskId] = item;
    } else {
      // Update existing artifact content if changed
      if (content !== undefined) {
        item.artifact.content = item.artifact.normalizeContent(content);
        item.artifact.ensureHash();
      }
      if (metadata) {
        item.artifact.metadata = Object.assign({}, item.artifact.metadata, metadata);
      }
      if (pageId) item.pageId = pageId;
    }
    this.touchUpdated();
    return item;
  }

  _inferTypeFromTask(taskDef) {
    // Attempt to infer from primary reference artifact if present
    const ref = taskDef.getPrimaryReference();
    if (ref) return ref.getType();
    // fallback: check metadata hints
    if (taskDef.taskMetadata && taskDef.taskMetadata.taskType) return taskDef.taskMetadata.taskType;
    return 'text';
  }

  toJSON() {
    return {
      studentId: this.studentId,
      assignmentId: this.assignmentId,
      documentId: this.documentId,
      items: Object.fromEntries(Object.entries(this.items).map(([k,v]) => [k, v.toJSON()])),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  static fromJSON(json) {
    const sub = new StudentSubmission(json.studentId, json.assignmentId, json.documentId);
    sub.createdAt = json.createdAt || new Date().toISOString();
    sub.updatedAt = json.updatedAt || sub.createdAt;
    if (json.items) {
      for (const [taskId, itemJson] of Object.entries(json.items)) {
        const item = StudentSubmissionItem.fromJSON(itemJson, json.assignmentId, json.studentId);
        sub.items[taskId] = item;
      }
    }
    return sub;
  }
}

if (typeof module !== 'undefined') {
  module.exports = { StudentSubmission, StudentSubmissionItem };
}
