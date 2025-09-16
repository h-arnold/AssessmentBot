/**
 * BaseTaskArtifact
 *
 * Base model for task artifacts. Subclasses should override getType() and
 * normalizeContent(content).
 */

class BaseTaskArtifact {
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

  _defaultUid(taskIndex, artifactIndex) {
    return `${this.taskId}-${taskIndex != null ? taskIndex : '0'}-${this.role}-${
      this.pageId || 'na'
    }-${artifactIndex}`;
  }

  getUid() {
    return this._uid;
  }
  getType() {
    return 'base';
  }
  normalizeContent(content) {
    return content;
  }

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

  ensureHash() {
    const str = this._stableStringify(this.content);
    this.contentHash = Utils.generateHash(str);
    return this.contentHash;
  }

  _stableStringify(obj) {
    if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
    if (Array.isArray(obj)) return '[' + obj.map((i) => this._stableStringify(i)).join(',') + ']';
    const keys = Object.keys(obj).sort();
    return (
      '{' + keys.map((k) => JSON.stringify(k) + ':' + this._stableStringify(obj[k])).join(',') + '}'
    );
  }

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
