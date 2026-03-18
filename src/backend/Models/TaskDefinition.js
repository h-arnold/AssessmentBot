// TaskDefinition.js
// New model introduced in Phase 1 refactor. Represents a task definition with reference/template artifacts.

// Expect Utils to exist in global scope in GAS environment (generateHash, etc.).
// Artifacts are defined in `Artifacts.js` and loaded in the same runtime. We only reference by name here.

const TASK_DEFINITION_HASH_LENGTH = 12;

/**
 * Represents a task definition within an assignment.
 * Contains reference and template artifacts along with metadata and notes.
 */
class TaskDefinition {
  /**
   * Constructs a TaskDefinition instance.
   * @param {Object} params - Task definition parameters
   * @param {string} params.taskTitle - The task title
   * @param {string} [params.pageId] - Source page ID
   * @param {string} [params.taskNotes] - Optional task notes
   * @param {Object} [params.taskMetadata] - Optional task metadata
   * @param {string} [params.id] - Stable ID (if omitted, derived from title+pageId)
   * @param {number} [params.index] - Positional index within source document
   * @param {number|null} [taskWeighting] - Optional task weighting (not yet implemented)
   */
  constructor(
    { taskTitle, pageId = null, taskNotes = null, taskMetadata = {}, id = null, index = null } = {},
    taskWeighting = null
  ) {
    if (!taskTitle) throw new Error('TaskDefinition requires taskTitle');
    this.taskTitle = taskTitle;
    this.pageId = pageId;
    this.taskNotes = taskNotes;
    this.taskMetadata = taskMetadata || {};
    this.index = index; // set by parser / assignment population stage
    this.taskWeighting = taskWeighting;

    // Stable id: if provided, use it; else create deterministic hash from title+pageId.
    this.id = id || this._deriveId(taskTitle, pageId);

    // Artifacts grouped by role
    this.artifacts = {
      reference: [],
      template: [],
    };
  }

  /**
   * Derives a stable unique ID from task title and page ID using a hash.
   * @param {string} taskTitle - The task title
   * @param {string|null} pageId - The page ID
   * @returns {string} A stable ID prefixed with 't_'
   * @private
   */
  _deriveId(taskTitle, pageId) {
    const base = `${taskTitle || ''}::${pageId || ''}`;
    return 't_' + Utils.generateHash(base).slice(0, Math.max(0, TASK_DEFINITION_HASH_LENGTH)); // shorter stable prefix
  }

  /**
   * Gets the task ID.
   * @returns {string} The unique task ID
   */
  getId() {
    return this.id;
  }

  /**
   * Creates a new artifact with the specified role and parameters.
   * Used during parsing/definition-building to create either reference or template artefacts.
   * @param {string} role - The artifact role ('reference' or 'template')
   * @param {Object} [parameters={}] - Artifact parameters (type, content, metadata, pageId, documentId, uid, etc.)
   * @returns {BaseTaskArtifact} The created artifact
   * @throws {Error} If role is invalid
   */
  createArtifact(role, parameters = {}) {
    if (role !== 'reference' && role !== 'template')
      throw new Error('Invalid artifact role for TaskDefinition: ' + role);
    const artifactIndex = this.artifacts[role].length;
    const factoryParameters = {
      ...parameters,
      role,
      taskId: this.id,
      pageId: parameters.pageId ?? this.pageId,
      metadata: parameters.metadata ?? {},
      taskIndex: this.index,
      artifactIndex,
    };
    const artifact = ArtifactFactory.create(factoryParameters);
    this.artifacts[role].push(artifact);
    return artifact;
  }

  /**
   * Creates and appends a reference artifact for this task definition.
   * @param {Object} parameters - Artifact parameters
   * @returns {BaseTaskArtifact} The created reference artifact
   */
  addReferenceArtifact(parameters) {
    return this.createArtifact('reference', parameters);
  }
  /**
   * Creates and appends a template artifact for this task definition.
   * @param {Object} parameters - Artifact parameters
   * @returns {BaseTaskArtifact} The created template artifact
   */
  addTemplateArtifact(parameters) {
    return this.createArtifact('template', parameters);
  }

  /**
   * Gets the primary (first) reference artifact.
   * @returns {BaseTaskArtifact|null} The primary reference artifact, or null if none exists
   */
  getPrimaryReference() {
    return this.artifacts.reference.length > 0 ? this.artifacts.reference[0] : null;
  }
  /**
   * Gets the primary (first) template artifact.
   * @returns {BaseTaskArtifact|null} The primary template artifact, or null if none exists
   */
  getPrimaryTemplate() {
    return this.artifacts.template.length > 0 ? this.artifacts.template[0] : null;
  }

  /**
   * Validates that this task definition has required artefacts.
   * @returns {Object} Object with 'ok' boolean and 'errors' array
   */
  validate() {
    const errors = [];
    if (this.artifacts.reference.length === 0)
      errors.push('TaskDefinition missing reference artifact');
    if (this.artifacts.template.length === 0)
      errors.push('TaskDefinition missing template artifact');
    return { ok: errors.length === 0, errors };
  }

  /**
   * Serialises this task definition to a JSON object.
   * @returns {Object} A plain object representation with all artifacts
   */
  toJSON() {
    return {
      id: this.id,
      taskTitle: this.taskTitle,
      pageId: this.pageId,
      taskNotes: this.taskNotes,
      taskMetadata: this.taskMetadata,
      taskWeighting: this.taskWeighting,
      index: this.index,
      artifacts: {
        reference: this.artifacts.reference.map((a) => a.toJSON()),
        template: this.artifacts.template.map((a) => a.toJSON()),
      },
    };
  }

  /**
   * Serialises this task definition to a partial JSON object with artifact content redacted.
   * @returns {Object} A partial object representation with lightweight artifact data
   */
  toPartialJSON() {
    return {
      ...this.toJSON(),
      artifacts: {
        reference: this.artifacts.reference.map((a) => a.toPartialJSON()),
        template: this.artifacts.template.map((a) => a.toPartialJSON()),
      },
    };
  }

  /**
   * Deserialises a JSON object to a TaskDefinition instance.
   * @param {Object} json - The serialised task definition object
   * @returns {TaskDefinition} A new TaskDefinition instance
   */
  static fromJSON(json) {
    const td = new TaskDefinition({
      taskTitle: json.taskTitle,
      pageId: json.pageId,
      taskNotes: json.taskNotes,
      taskMetadata: json.taskMetadata,
      id: json.id,
      index: json.index,
    });
    // If taskWeighting was stored, set it on the instance (constructor accepts it as second arg)
    if (json.taskWeighting != null) td.taskWeighting = json.taskWeighting;
    if (json.artifacts) {
      if (json.artifacts.reference) {
        for (const referenceJson of json.artifacts.reference) {
          const art = ArtifactFactory.fromJSON(referenceJson);
          td.artifacts.reference.push(art);
        }
      }
      if (json.artifacts.template) {
        for (const tJson of json.artifacts.template) {
          const art = ArtifactFactory.fromJSON(tJson);
          td.artifacts.template.push(art);
        }
      }
    }
    return td;
  }
}

if (typeof module !== 'undefined') {
  module.exports = { TaskDefinition };
}
