/**
 * BaseTaskArtifact
 *
 * Base model for task artifacts. Subclasses should override getType() and
 * normalizeContent(content).
 */

/**
 *
 */
class BaseTaskArtifact {
  /**
   * Construct a BaseTaskArtifact.
   *
   * @param {Object} opts - Initialization options for the artifact.
   * @param {string} opts.taskId - Identifier of the parent task.
   * @param {string} opts.role - Artifact role within the task.
   * @param {string|null} opts.pageId - Identifier of the source page.
   * @param {string|null} opts.documentId - Identifier of the source document.
   * @param {*} opts.content - Raw artifact content to normalise.
   * @param {string|null} opts.contentHash - Precomputed content hash.
   * @param {Object} opts.metadata - Additional artifact metadata.
   * @param {string|null} opts.uid - Precomputed unique identifier.
   * @param {number|null} opts.taskIndex - Index of the parent task.
   * @param {number} opts.artifactIndex - Index of this artifact within the task.
   */
  constructor({
    taskId,
    role,
    pageId = null,
    documentId = null,
    content = null,
    contentHash = null,
    metadata = {},
    uid = null,
    taskIndex = null,
    artifactIndex = 0,
  }) {
    if (!taskId) throw new Error('Artifact requires taskId');
    if (!role) throw new Error('Artifact requires role');
    this.taskId = taskId;
    this.role = role; // reference|template|submission
    this.pageId = pageId;
    this.documentId = documentId;
    this.metadata = metadata ?? {};
    this.content = this.normalizeContent(content);
    if (contentHash) {
      this.contentHash = contentHash;
    } else if (this.content === null || this.content === undefined) {
      this.contentHash = null;
    } else {
      this.contentHash = this.ensureHash();
    }
    this._uid = uid || this._defaultUid(taskIndex, artifactIndex);
  }

  /**
   * Build a default UID when none is provided.
   * @param {number|null} taskIndex - Index of the parent task.
   * @param {number} artifactIndex - Index of this artifact within the task.
   * @returns {string} Generated UID string.
   */
  _defaultUid(taskIndex, artifactIndex) {
    return `${this.taskId}-${taskIndex ?? '0'}-${this.role}-${this.pageId || 'na'}-${artifactIndex}`;
  }

  /**
   * Return the artifact's unique id.
   *
   * @returns {string} The artifact unique identifier.
   */
  getUid() {
    return this._uid;
  }
  /**
   * Return the artifact type identifier.
   * Subclasses should override this.
   *
   * @returns {string} The artifact type identifier.
   */
  getType() {
    return 'base';
  }
  /**
   * Normalize provided content into the internal representation.
   * Base implementation returns content unchanged; subclasses may coerce.
   *
   * @param {*} content - Raw content to normalise.
   * @returns {*} The normalised content.
   */
  normalizeContent(content) {
    return content;
  }

  /**
   * Validate that the artifact has non-empty content.
   *
   * @returns {{status: string, errors?: string[]}} Validation result with status.
   */
  validate() {
    if (
      this.content == null ||
      this.content === '' ||
      (Array.isArray(this.content) && this.content.length === 0)
    ) {
      return { status: 'empty', errors: ['No content'] };
    }
    return { status: 'ok' };
  }

  /**
   * Ensure the artifact has a contentHash; generates one from stable JSON.
   * @returns {string|null} The generated content hash.
   */
  ensureHash() {
    const string_ = this._stableStringify(this.content);
    this.contentHash = Utils.generateHash(string_);
    return this.contentHash;
  }

  /**
   * Deterministically stringify an object so hashing is stable.
   *
   * @param {*} object - Value to stringify deterministically.
   * @returns {string} Stable JSON representation.
   */
  _stableStringify(object) {
    if (object === null || typeof object !== 'object') return JSON.stringify(object);
    if (Array.isArray(object))
      return '[' + object.map((index) => this._stableStringify(index)).join(',') + ']';
    const keys = Object.keys(object).toSorted((a, b) => a.localeCompare(b));
    return (
      '{' +
      keys.map((k) => JSON.stringify(k) + ':' + this._stableStringify(object[k])).join(',') +
      '}'
    );
  }

  /**
   * Return a plain object suitable for JSON serialization.
   *
   * @returns {Object} Plain object representation.
   */
  toJSON() {
    return {
      taskId: this.taskId,
      role: this.role,
      pageId: this.pageId,
      documentId: this.documentId,
      content: this.content,
      contentHash: this.contentHash,
      metadata: this.metadata,
      uid: this._uid,
      type: this.getType(),
    };
  }

  /**
   * Return a partial JSON representation with heavy fields redacted.
   *
   * @returns {Object} Partial representation with heavy fields redacted.
   */
  toPartialJSON() {
    const json = this.toJSON();
    json.content = null;
    json.contentHash = null;
    return json;
  }

  /**
   * Construct a BaseTaskArtifact directly from a plain JSON-like object.
   *
   * @param {Object} json - Plain JSON-like object to construct from.
   * @returns {BaseTaskArtifact} New artifact instance.
   */
  static baseFromJSON(json) {
    return new BaseTaskArtifact(json);
  }
}

// Export for Node (module.exports) and attach to global when running in GAS.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BaseTaskArtifact;
} else {
  globalThis.BaseTaskArtifact = BaseTaskArtifact; // global assignment for GAS
}
