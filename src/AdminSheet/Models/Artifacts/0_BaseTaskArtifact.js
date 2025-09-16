/**
 * BaseTaskArtifact
 *
 * Base model for task artifacts. Subclasses should override getType() and
 * normalizeContent(content).
 */

class BaseTaskArtifact {
  /**
   * Construct a BaseTaskArtifact.
   * @param {Object} opts - Initialization options for the artifact.
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
    this.metadata = metadata || {};
    this.content = this.normalizeContent(content);
    if (contentHash) {
      this.contentHash = contentHash;
    } else {
      this.contentHash = this.content != null ? this.ensureHash() : null;
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
    return `${this.taskId}-${taskIndex != null ? taskIndex : '0'}-${this.role}-${
      this.pageId || 'na'
    }-${artifactIndex}`;
  }

  /**
   * Return the artifact's unique id.
   * @returns {string}
   */
  getUid() {
    return this._uid;
  }
  /**
   * Return the artifact type identifier.
   * Subclasses should override this.
   * @returns {string}
   */
  getType() {
    return 'base';
  }
  /**
   * Normalize provided content into the internal representation.
   * Base implementation returns content unchanged; subclasses may coerce.
   * @param {*} content
   * @returns {*}
   */
  normalizeContent(content) {
    return content;
  }

  /**
   * Validate that the artifact has non-empty content.
   * @returns {{status: string, errors?: string[]}}
   */
  validate() {
    if (
      this.content == null ||
      this.content === '' ||
      (Array.isArray(this.content) && !this.content.length)
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
    const str = this._stableStringify(this.content);
    this.contentHash = Utils.generateHash(str);
    return this.contentHash;
  }

  /**
   * Deterministically stringify an object so hashing is stable.
   * @param {*} obj
   * @returns {string}
   */
  _stableStringify(obj) {
    if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
    if (Array.isArray(obj)) return '[' + obj.map((i) => this._stableStringify(i)).join(',') + ']';
    const keys = Object.keys(obj).sort();
    return (
      '{' + keys.map((k) => JSON.stringify(k) + ':' + this._stableStringify(obj[k])).join(',') + '}'
    );
  }

  /**
   * Return a plain object suitable for JSON serialization.
   * @returns {Object}
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
   * Construct a BaseTaskArtifact directly from a plain JSON-like object.
   * @param {Object} json
   * @returns {BaseTaskArtifact}
   */
  static baseFromJSON(json) {
    return new BaseTaskArtifact(json);
  }
}

// Export for Node (module.exports) and attach to global when running in GAS.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BaseTaskArtifact;
} else {
  this.BaseTaskArtifact = BaseTaskArtifact; // global assignment for GAS
}
