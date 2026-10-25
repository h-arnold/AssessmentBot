const STUDENT_SUBMISSION_ITEM_HASH_LENGTH = 16;

/** Owns the default representation shared by submission models. */
class StudentSubmissionRepresentationConfig {
  /** Creates representation configuration with the backwards-compatible default. */
  constructor() {
    this.defaultMode = 'full';
  }
}

const STUDENT_SUBMISSION_REPRESENTATION = new StudentSubmissionRepresentationConfig();

/**
 * Represents a single submission item within a student submission.
 * Each item corresponds to a task and holds the submitted artifact, assessments, and feedback.
 */
class StudentSubmissionItem {
  /**
   * Returns the constructor-owned default representation mode.
   * @returns {'full'} The default representation mode.
   */
  static getDefaultRepresentationMode() {
    return STUDENT_SUBMISSION_REPRESENTATION.defaultMode;
  }

  /**
   * Constructs a StudentSubmissionItem instance.
   * @param {Object} p - Constructor parameters
   * @param {string} p.taskId - The task ID
   * @param {BaseTaskArtifact} p.artifact - The submission artifact (role='submission')
   * @param {Function|null} p.onMutate - Callback invoked after a task-wide mutation.
   */
  constructor({ taskId, artifact, onMutate = null }) {
    if (!taskId) throw new Error('StudentSubmissionItem missing taskId');
    if (!artifact) throw new Error('StudentSubmissionItem requires artifact');
    this.taskId = taskId;
    this.artifact = artifact;
    this.assessments = {}; // criterion -> { score, reasoning }
    this.feedback = {}; // type -> feedback JSON or object
    this.id = this._deriveId();
    this.onMutate = onMutate;
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

  /** Replaces all criterion results with one task-wide error and clears feedback.
   * @param {string} stage - Error stage from the Assessment catalogue.
   * @param {string} code - Error code valid for the stage.
   */
  setError(stage, code) {
    Validate.requireParams({ stage, code }, 'StudentSubmissionItem.setError');
    const errorResult = Assessment.createError(stage, code).toJSON();
    const assessments = {};
    for (const criterion of ['completeness', 'accuracy', 'spag']) {
      assessments[criterion] = { ...errorResult };
    }
    this.assessments = assessments;
    this.feedback = {};
    if (this.onMutate) this.onMutate();
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
    const strippedAssessments = {};
    for (const [criterion, assessment] of Object.entries(assessments)) {
      strippedAssessments[criterion] = StudentSubmissionItem._removeAssessmentReasoning(assessment);
    }
    return strippedAssessments;
  }

  /**
   * Removes reasoning from a single assessment object.
   * @param {Object} assessment - The assessment object
   * @returns {Object} Assessment without the reasoning property
   * @private
   */
  static _removeAssessmentReasoning(assessment) {
    if (!assessment || typeof assessment !== 'object') return assessment;
    if (assessment.score === 'E' && assessment.error) return { ...assessment };
    const { reasoning, ...rest } = assessment;
    return rest;
  }

  /** Validates the raw item representation without restoring a model.
   * @param {Object} json - The serialised submission item object
   * @param {'full'|'partial'} [mode='full'] - Representation being validated.
   * @returns {boolean} Whether the raw item has the required shape.
   */
  static validateRaw(json, mode) {
    const representationMode =
      mode === undefined ? STUDENT_SUBMISSION_REPRESENTATION.defaultMode : mode;
    if (
      !json ||
      typeof json !== 'object' ||
      Array.isArray(json) ||
      !json.artifact ||
      !['full', 'partial'].includes(representationMode) ||
      !json.taskId ||
      typeof json.taskId !== 'string'
    )
      return false;
    const artifact = json.artifact;
    if (
      !artifact ||
      typeof artifact !== 'object' ||
      Array.isArray(artifact) ||
      [artifact.type, artifact.role, artifact.taskId].some(
        (value) => !Validate.isNonEmptyString(value)
      )
    )
      return false;
    if (
      representationMode === 'full' &&
      (!Object.hasOwn(artifact, 'content') ||
        artifact.content === undefined ||
        !Object.hasOwn(artifact, 'contentHash') ||
        artifact.contentHash === undefined)
    )
      return false;
    return true;
  }

  /**
   * Validates an artefact before constructors can coerce it.
   * @param {Object} json - Raw submission item.
   * @param {string} knownTaskId - Authoritative task key.
   * @param {'full'|'partial'} mode - Representation mode.
   * @returns {boolean} Whether the artefact is safe to restore.
   */
  static validateCurrentRawArtifact(json, knownTaskId, mode) {
    if (
      !StudentSubmissionItem.validateRaw(json, mode) ||
      json.taskId !== knownTaskId ||
      !StudentSubmissionItem._hasValidCurrentArtifactIdentity(json.artifact, knownTaskId)
    )
      return false;
    const artifact = json.artifact;
    const body = artifact.content;
    const hash = artifact.contentHash;
    if (mode === 'full' && (body === null) !== (hash === null)) return false;
    if (hash !== null && typeof hash !== 'string') return false;
    if (['TEXT', 'TABLE'].includes(artifact.type) && body !== null && typeof body !== 'string')
      return false;
    if (
      artifact.type === 'IMAGE' &&
      body !== null &&
      (typeof body !== 'string' || !/^data:image\/[\w.+-]+;base64,[A-Za-z0-9+/]+=*$/u.test(body))
    )
      return false;
    if (
      artifact.type === 'SPREADSHEET' &&
      body !== null &&
      (!Array.isArray(body) ||
        body.some((row) => {
          return (
            !Array.isArray(row) ||
            row.some((cell) => {
              return !(
                cell === null ||
                typeof cell === 'string' ||
                typeof cell === 'number' ||
                typeof cell === 'boolean'
              );
            })
          );
        }))
    )
      return false;
    return true;
  }

  /** Validates the identity fields required by current-format artefacts.
   * @param {Object} artifact - Raw artefact object.
   * @param {string} knownTaskId - Authoritative task key.
   * @returns {boolean} Whether identity fields are valid.
   * @private
   */
  static _hasValidCurrentArtifactIdentity(artifact, knownTaskId) {
    if (
      artifact.taskId !== knownTaskId ||
      artifact.role !== 'submission' ||
      !['base', 'TEXT', 'TABLE', 'IMAGE', 'SPREADSHEET'].includes(artifact.type)
    )
      return false;
    return (
      typeof artifact.uid === 'string' &&
      artifact.uid.length > 0 &&
      (artifact.documentId === null ||
        (typeof artifact.documentId === 'string' && artifact.documentId.length > 0)) &&
      (artifact.pageId === null ||
        (typeof artifact.pageId === 'string' && artifact.pageId.length > 0))
    );
  }

  /** Restores an already validated raw item in the requested representation.
   * @param {Object} json - Persisted submission item.
   * @param {'full'|'partial'} mode - Representation being restored.
   * @returns {StudentSubmissionItem} The restored item.
   */
  static _restore(json, mode) {
    if (!StudentSubmissionItem.validateRaw(json, mode))
      throw new Error('Invalid StudentSubmissionItem JSON');
    const artifactJson = { ...json.artifact };
    if (
      mode === 'partial' &&
      (!Object.hasOwn(artifactJson, 'content') || artifactJson.content == null)
    ) {
      artifactJson.content = null;
      artifactJson.contentHash = null;
    }
    const artifact = ArtifactFactory.fromJSON(artifactJson);
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

  /** Restores a submission item from its serialised representation.
   * @param {Object} json - Persisted submission item.
   * @param {'full'|'partial'} [mode='full'] - Representation being restored.
   * @returns {StudentSubmissionItem} The restored item.
   */
  static fromJSON(json, mode) {
    if (mode === undefined) mode = STUDENT_SUBMISSION_REPRESENTATION.defaultMode;
    return StudentSubmissionItem._restore(json, mode);
  }
}

if (typeof module !== 'undefined') module.exports = { StudentSubmissionItem };
