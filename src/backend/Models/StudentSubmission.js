// StudentSubmission.js
// Defines StudentSubmission and StudentSubmissionItem classes.

const STUDENT_SUBMISSION_ITEM_HASH_LENGTH = 16;

/**
 * Represents a single submission item within a student submission.
 * Each item corresponds to a task and holds the submitted artifact, assessments, and feedback.
 */
class StudentSubmissionItem {
  /**
   * Constructs a StudentSubmissionItem instance.
   * @param {Object} p - Constructor parameters
   * @param {string} p.taskId - The task ID
   * @param {BaseTaskArtifact} p.artifact - The submission artifact (role='submission')
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

  /**
   * Derives a stable unique ID for this submission item.
   * Uses the artifact's UID if available, falling back to contentHash or taskId.
   * @returns {string} A unique identifier prefixed with 'ssi_'
   * @private
   */
  _deriveId() {
    // Prefer artifact UID for stable identity; fall back to contentHash or taskId.
    const primaryUid = this.artifact.getUid();
    const hasPrimaryUid = Validate.isNonEmptyString(primaryUid);
    const resolvedUid = hasPrimaryUid ? primaryUid : (this.artifact.contentHash ?? '');
    const base = `${this.taskId}::${resolvedUid}`;
    return (
      'ssi_' + Utils.generateHash(base).slice(0, Math.max(0, STUDENT_SUBMISSION_ITEM_HASH_LENGTH))
    );
  }

  /**
   * Adds an assessment for a specific criterion.
   * @param {string} criterion - The criterion identifier
   * @param {Assessment|Object} assessment - The assessment object or JSON
   */
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

  /**
   * Gets assessment data for a specific criterion or all assessments.
   * @param {string|null} [criterion=null] - The criterion to retrieve, or null for all assessments
   * @returns {Object|null} Assessment data for the criterion, or null if not found
   */
  getAssessment(criterion = null) {
    if (!criterion) return this.assessments || null;
    return this.assessments[criterion] || null;
  }

  /**
   * Adds feedback of a specific type.
   * @param {string} type - The feedback type identifier
   * @param {Object} feedbackObject - The feedback object
   */
  addFeedback(type, feedbackObject) {
    if (!type) throw new Error('addFeedback requires a feedback type identifier');
    if (!feedbackObject) return;
    this.feedback[type] = feedbackObject.toJSON ? feedbackObject.toJSON() : feedbackObject;
  }

  /**
   * Gets feedback of a specific type or all feedback.
   * @param {string|null} [type=null] - The feedback type to retrieve, or null for all feedback
   * @returns {Object|null} Feedback for the type, or null if not found
   */
  getFeedback(type = null) {
    if (!type) return this.feedback || null;
    return this.feedback[type] || null;
  }

  /**
   * Gets the artifact type.
   * @returns {string} The artifact type
   */
  getType() {
    return this.artifact.getType();
  }

  /**
   * Serialises this submission item to a JSON object.
   * @returns {Object} A plain object representation of the submission item
   */
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
   * Returns a partial JSON payload with heavy artifact fields redacted.
   * @returns {Object} A partial representation with artifact content minimised
   */
  toPartialJSON() {
    const json = this.toJSON();
    json.artifact = this.artifact.toPartialJSON();
    json.assessments = StudentSubmissionItem._stripAssessmentReasoning(json.assessments);
    return json;
  }

  /**
   * Strips assessment reasoning from assessments to reduce payload size.
   * @param {Object} assessments - Assessment data keyed by criterion
   * @returns {Object} Assessments without reasoning
   * @private
   */
  static _stripAssessmentReasoning(assessments) {
    if (!assessments || typeof assessments !== 'object') return assessments;
    return Object.fromEntries(
      Object.entries(assessments).map(([criterion, assessment]) => [
        criterion,
        StudentSubmissionItem._removeAssessmentReasoning(assessment),
      ])
    );
  }

  /**
   * Removes reasoning from a single assessment object.
   * @param {Object} assessment - The assessment object
   * @returns {Object} Assessment without the reasoning property
   * @private
   */
  static _removeAssessmentReasoning(assessment) {
    if (!assessment || typeof assessment !== 'object') return assessment;
    const { reasoning, ...rest } = assessment;
    return rest;
  }

  /**
   * Deserialises a JSON object to a StudentSubmissionItem instance.
   * @param {Object} json - The serialised submission item object
   * @returns {StudentSubmissionItem} A new StudentSubmissionItem instance
   */
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

/**
 * Represents a complete student submission for an assignment.
 * Contains multiple submission items (one per task) along with artefacts, assessments, and feedback.
 */
class StudentSubmission {
  /**
   * Constructs a StudentSubmission instance.
   * @param {string} studentId - The student ID
   * @param {string} assignmentId - The assignment ID
   * @param {string} [documentId=null] - The source document ID
   * @param {string} [studentName=null] - The student's name
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

  /**
   * Updates the updatedAt timestamp to the current time.
   * Uses a counter to ensure strictly monotonic timestamps even within the same millisecond.
   */
  touchUpdated() {
    // Ensure strictly monotonic updatedAt even if multiple updates within same ms
    const base = new Date().toISOString();
    this._updateCounter++;
    this.updatedAt = base + '#' + this._updateCounter;
  }

  /**
   * Gets a submission item for the given task ID.
   * @param {string} taskId - The task ID
   * @returns {StudentSubmissionItem|undefined} The submission item, or undefined if not found
   */
  getItem(taskId) {
    return this.items[taskId];
  }

  /**
   * Upserts submission artifacts from primitive extraction results (student side only).
   * Creates the submission artifact via ArtifactFactory when none exists, or merges content/metadata
   * into the existing submission artifact for the same taskId. This is distinct from
   * TaskDefinition.addReferenceArtifact/addTemplateArtifact, which always create new reference/template
   * artifacts during parsing and never mutate. Expects primitive extraction payload from parsers/assignments.
   * @param {TaskDefinition} taskDefinition - Task definition providing ids/type hints
   * @param {Object} extraction - Extraction parameters (pageId, content, metadata, documentId)
   * @returns {StudentSubmissionItem} The created or updated submission item
   */
  upsertItemFromExtraction(taskDefinition, extraction = {}) {
    if (!taskDefinition) {
      throw new Error('upsertItemFromExtraction requires taskDefinition');
    }
    const taskId = taskDefinition.getId();
    let item = this.items[taskId];
    let mutated = false;

    const {
      pageId = null,
      content = null,
      metadata: extractionMetadata,
      documentId: extractionDocumentId = null,
    } = extraction;
    const hasMetadata = Object.hasOwn(extraction, 'metadata');
    const metadataPayload = hasMetadata ? extractionMetadata : undefined;

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
      const resolvedPageId = pageId ?? taskDefinition.pageId;
      const metadataForArtifact = metadataPayload ?? {};
      // Prefer documentId provided by the extraction (parser-level) otherwise use
      // the parent submission's documentId so artifacts carry canonical source.
      const documentIdForArtifact = extractionDocumentId ?? this.documentId ?? null;
      const uid = `${taskId}-${this.studentId}-${resolvedPageId ?? 'na'}-0`;
      const artifact = ArtifactFactory.create({
        type: this._inferTypeFromTask(taskDefinition),
        taskId,
        role: 'submission',
        pageId: resolvedPageId,
        documentId: documentIdForArtifact,
        content,
        metadata: metadataForArtifact,
        uid,
      });
      if (artifact.content == null && artifact.getType() !== 'IMAGE') {
        ABLogger.getInstance().warn(
          `No content found for ${this.studentName} for task '${taskDefinition.taskTitle}'.`
        );
      }
      item = new StudentSubmissionItem({ taskId, artifact, onMutate: () => this.touchUpdated() });
      this.items[taskId] = item;
      mutated = true;
    }
    if (mutated) this.touchUpdated();
    return item;
  }

  /**
   * Infers the artifact type from the task definition.
   * Checks the primary reference artifact first, then metadata hints.
   * @param {TaskDefinition} taskDefinition - The task definition
   * @returns {string} The inferred artifact type (defaults to 'TEXT')
   * @private
   */
  _inferTypeFromTask(taskDefinition) {
    // Attempt to infer from primary reference artifact if present
    const reference = taskDefinition.getPrimaryReference();
    if (reference) return reference.getType();
    // fallback: check metadata hints
    if (taskDefinition.taskMetadata?.taskType) return taskDefinition.taskMetadata.taskType;
    return 'TEXT';
  }

  /**
   * Serialises this student submission to a JSON object.
   * @returns {Object} A plain object representation of the submission with all items
   */
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
   * Serialises this submission to a partial JSON object with artifacts redacted.
   * Suitable for lightweight persistence and list operations.
   * @returns {Object} A partial object representation with item artifacts redacted
   */
  toPartialJSON() {
    const json = this.toJSON();
    json.items = Object.fromEntries(
      Object.entries(this.items).map(([k, v]) => [k, v.toPartialJSON()])
    );
    return json;
  }

  /**
   * Deserialises a JSON object to a StudentSubmission instance.
   * @param {Object} json - The serialised submission object
   * @returns {StudentSubmission} A new StudentSubmission instance
   */
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
