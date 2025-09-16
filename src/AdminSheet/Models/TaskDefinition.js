// TaskDefinition.js
// New model introduced in Phase 1 refactor. Represents a task definition with reference/template artifacts.

// Expect Utils to exist in global scope in GAS environment (generateHash, etc.).
// Artifacts are defined in `Artifacts.js` and loaded in the same runtime. We only reference by name here.

class TaskDefinition {
  /**
   * @param {Object} params
   * @param {string} params.taskTitle
   * @param {string=} params.pageId
   * @param {string=} params.taskNotes
   * @param {Object=} params.taskMetadata
   * @param {string=} params.id - Stable ID (if omitted, derived then hashed from title+pageId once).
   * @param {number=} params.index - Positional index within source document
   * @param {number=} params.taskWeighting - not yet implemented. Will be used to determine the weighting given to this task when calculating the average score.
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

  _deriveId(taskTitle, pageId) {
    const base = `${taskTitle || ''}::${pageId || ''}`;
    return 't_' + Utils.generateHash(base).substring(0, 12); // shorter stable prefix
  }

  getId() {
    return this.id;
  }

  /**
   * Internal helper to add artifact by role using ArtifactFactory.
   * params may include: type, content, metadata, pageId, documentId, uid
   */
  createArtifact(role, params = {}) {
    if (role !== 'reference' && role !== 'template')
      throw new Error('Invalid artifact role for TaskDefinition: ' + role);
    const artifactIndex = this.artifacts[role].length;
    const factoryParams = Object.assign({}, params, {
      role,
      taskId: this.id,
      pageId: params.pageId != null ? params.pageId : this.pageId,
      metadata: params.metadata || {},
      taskIndex: this.index,
      artifactIndex,
    });
    const artifact = ArtifactFactory.create(factoryParams);
    this.artifacts[role].push(artifact);
    return artifact;
  }

  addReferenceArtifact(params) {
    return this.createArtifact('reference', params);
  }
  addTemplateArtifact(params) {
    return this.createArtifact('template', params);
  }

  getPrimaryReference() {
    return this.artifacts.reference.length ? this.artifacts.reference[0] : null;
  }
  getPrimaryTemplate() {
    return this.artifacts.template.length ? this.artifacts.template[0] : null;
  }

  validate() {
    const errors = [];
    if (!this.artifacts.reference.length) errors.push('TaskDefinition missing reference artifact');
    if (!this.artifacts.template.length) errors.push('TaskDefinition missing template artifact');
    return { ok: errors.length === 0, errors };
  }

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
        json.artifacts.reference.forEach((refJson) => {
          const art = ArtifactFactory.fromJSON(refJson);
          td.artifacts.reference.push(art);
        });
      }
      if (json.artifacts.template) {
        json.artifacts.template.forEach((tJson) => {
          const art = ArtifactFactory.fromJSON(tJson);
          td.artifacts.template.push(art);
        });
      }
    }
    return td;
  }
}

if (typeof module !== 'undefined') {
  module.exports = { TaskDefinition };
}
