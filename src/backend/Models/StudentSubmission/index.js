// StudentSubmission/index.js
// Submission facade; item model is loaded first by lexicographic order.
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
    this.representationMode = StudentSubmissionItem.getDefaultRepresentationMode();
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
   * @param {boolean} [extraction.missingContentLogged] - True when the caller already emitted
   *   the missing-content diagnostic at the parser boundary, suppressing the duplicate warn here.
   * @returns {StudentSubmissionItem} The created or updated submission item
   */
  upsertItemFromExtraction(taskDefinition, extraction = {}) {
    if (!taskDefinition) {
      throw new Error('upsertItemFromExtraction requires taskDefinition');
    }
    const taskId = taskDefinition.getId();
    let item = this.items[taskId];
    let isMutated = false;

    const {
      pageId = null,
      content = null,
      metadata: extractionMetadata,
      documentId: extractionDocumentId = null,
    } = extraction;
    const hasMetadata = Object.hasOwn(extraction, 'metadata');
    const metadataPayload = hasMetadata ? extractionMetadata : undefined;
    // True when the parser boundary already logged the missing-content diagnostic,
    // so this layer stays silent and the artifact is stored without duplicate detail.
    const isMissingContentLogged = extraction.missingContentLogged === true;

    if (item) {
      if (content !== undefined) {
        this._mergeExtractedContent(item, content);
        isMutated = true;
      }
      if (hasMetadata) {
        const metadataUpdates = metadataPayload ?? {};
        item.artifact.metadata = {
          ...item.artifact.metadata,
          ...metadataUpdates,
        };
        isMutated = true;
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
      if (artifact.content == null && artifact.getType() !== 'IMAGE' && !isMissingContentLogged) {
        ABLogger.getInstance().warn(
          `No content found for ${this.studentName} for task '${taskDefinition.taskTitle}'.`
        );
      }
      item = new StudentSubmissionItem({ taskId, artifact, onMutate: () => this.touchUpdated() });
      this.items[taskId] = item;
      isMutated = true;
    }
    if (isMutated) this.touchUpdated();
    return item;
  }

  /**
   * Applies extracted content to an existing artifact, keeping the serialised
   * shape complete. A null/empty content means there is no artifact body to
   * hash, so the content hash is set explicitly to null rather than left
   * undefined (which would fail transport validation).
   * @param {StudentSubmissionItem} item - The item to update.
   * @param {*} content - Extracted content (may be null/undefined).
   */
  _mergeExtractedContent(item, content) {
    const artifact = item.artifact;
    const previousContent = artifact.content;
    const normalisedContent = artifact.normalizeContent(content);
    if (JSON.stringify(normalisedContent) === JSON.stringify(previousContent)) return;
    artifact.content = normalisedContent;
    if (artifact.content == null) {
      artifact.contentHash = null;
    } else {
      artifact.ensureHash();
    }
    item.assessments = {};
    item.feedback = {};
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
   * @param {'full'|'partial'} [mode='full'] - Representation being restored.
   * @returns {StudentSubmission} A new StudentSubmission instance
   */
  static fromJSON(json, mode) {
    if (mode === undefined) mode = StudentSubmissionItem.getDefaultRepresentationMode();
    return StudentSubmission._restore(json, mode);
  }

  /** Validates the raw submission record before model restoration.
   * @param {Object} json - Persisted submission record.
   * @param {'full'|'partial'} [mode='full'] - Representation being validated.
   * @returns {boolean} Whether the raw record has the required shape.
   */
  static validateRaw(json, mode) {
    if (
      !json ||
      typeof json !== 'object' ||
      Array.isArray(json) ||
      !['full', 'partial'].includes(
        mode === undefined ? StudentSubmissionItem.getDefaultRepresentationMode() : mode
      ) ||
      typeof json.studentId !== 'string' ||
      json.studentId.trim().length === 0 ||
      typeof json.assignmentId !== 'string' ||
      json.assignmentId.trim().length === 0 ||
      !json.items ||
      typeof json.items !== 'object' ||
      Array.isArray(json.items)
    )
      return false;
    const representationMode =
      mode === undefined ? StudentSubmissionItem.getDefaultRepresentationMode() : mode;
    return Object.values(json.items).every((item) => {
      if (item instanceof StudentSubmissionItem) return true;
      return StudentSubmissionItem.validateRaw(item, representationMode);
    });
  }

  /** Restores a validated submission and its items.
   * @param {Object} json - Persisted submission record.
   * @param {'full'|'partial'} mode - Representation being restored.
   * @returns {StudentSubmission} The restored submission.
   */
  static _restore(json, mode) {
    if (!StudentSubmission.validateRaw(json, mode))
      throw new Error('Invalid StudentSubmission JSON');
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
        const item =
          itemJson instanceof StudentSubmissionItem
            ? itemJson
            : StudentSubmissionItem.fromJSON(itemJson, mode);
        sub.items[taskId] = item;
      }
    }
    return sub;
  }
}

if (typeof module !== 'undefined') {
  module.exports = { StudentSubmission, StudentSubmissionItem: globalThis.StudentSubmissionItem };
}
