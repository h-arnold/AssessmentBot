// Artifacts.js
// Defines BaseTaskArtifact and concrete subclasses plus ArtifactFactory.

class BaseTaskArtifact {
  /**
   * @param {Object} p
   * @param {string} p.taskId
   * @param {'reference'|'template'|'submission'} p.role
   * @param {string=} p.pageId
   * @param {string=} p.documentId
   * @param {any=} p.content
   * @param {string=} p.contentHash
   * @param {Object=} p.metadata
   * @param {string=} p.uid
   * @param {number=} p.taskIndex
   * @param {number=} p.artifactIndex
   */
  constructor({ taskId, role, pageId = null, documentId = null, content = null, contentHash = null, metadata = {}, uid = null, taskIndex = null, artifactIndex = 0 }) {
    if (!taskId) throw new Error('Artifact requires taskId');
    if (!role) throw new Error('Artifact requires role');
    this.taskId = taskId;
    this.role = role; // reference|template|submission
    this.pageId = pageId;
    this.documentId = documentId;
    this.metadata = metadata || {};
    this.content = this.normalizeContent(content);
    // Auto-compute hash immediately for any role when content present (reference/template hashes needed for caching & not-attempted detection).
    if (contentHash) {
      this.contentHash = contentHash;
    } else {
      this.contentHash = this.content != null ? this.ensureHash() : null;
    }
    this._uid = uid || this._defaultUid(taskIndex, artifactIndex);
  }

  _defaultUid(taskIndex, artifactIndex) {
    return `${this.taskId}-${taskIndex != null ? taskIndex : '0'}-${this.role}-${this.pageId || 'na'}-${artifactIndex}`;
  }

  getUid() { return this._uid; }

  // Subclasses override
  getType() { return 'base'; }

  normalizeContent(content) { return content; }

  validate() {
    if (this.content == null || this.content === '' || (Array.isArray(this.content) && !this.content.length)) {
      return { status: 'empty', errors: ['No content'] };
    }
    return { status: 'ok' };
  }

  ensureHash() {
    // Use deep stable stringify; implement simple deterministic JSON.
    const str = this._stableStringify(this.content);
    this.contentHash = Utils.generateHash(str);
    return this.contentHash;
  }

  /**
   * Produce a deterministic, canonical string representation of a value.
   *
   * This method provides a stable serialization that can be used for deterministic
   * comparisons (for example, as a key in caches or for equality checks). It differs
   * from JSON.stringify in that object keys are always sorted lexicographically,
   * making the output order-independent for plain objects.
   *
   * Behavior summary:
   *  - Primitives and null: returned via JSON.stringify(obj).
   *  - Arrays: element order is preserved; each element is recursively stable-stringified.
   *  - Plain objects: enumerable string keys are sorted (Object.keys(obj).sort()) and
   *    each key/value pair is serialized as "key:stableStringify(value)".
   *
   * Important notes and limitations:
   *  - Only enumerable string-keyed own properties are considered. Non-enumerable
   *    properties, symbol-keyed properties, and prototype properties are ignored.
   *  - The result is intended to be stable/deterministic, but may not be valid JSON
   *    for all inputs (e.g., functions and symbols follow JSON.stringify semantics).
   *  - Circular references are not handled and will lead to a thrown error or
   *    stack overflow.
   *
   * @private
   * @param {*} obj - The value to serialize (primitive, array, or plain object).
   * @returns {string} A stable string representation of the input.
   */
  _stableStringify(obj) {
    if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
    if (Array.isArray(obj)) return '[' + obj.map(i => this._stableStringify(i)).join(',') + ']';
    const keys = Object.keys(obj).sort();
    return '{' + keys.map(k => JSON.stringify(k) + ':' + this._stableStringify(obj[k])).join(',') + '}';
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
      type: this.getType()
    };
  }

  static baseFromJSON(json) {
    return new BaseTaskArtifact(json); // For unknown types
  }
}

class TextTaskArtifact extends BaseTaskArtifact {
  // Updated to use uppercase enum expected by backend
  getType() { return 'TEXT'; }
  normalizeContent(content) {
    if (content == null) return null;
    if (typeof content !== 'string') content = String(content);
    const normalised = content.replace(/\r\n?/g, '\n').trim();
    return normalised === '' ? null : normalised;
  }
  /**
   * Convenience factory from raw (possibly un-normalised) text.
   * @param {string} raw
   * @param {Object} params - Remaining constructor params excluding content.
   */
  static fromRawText(raw, params) {
    return new TextTaskArtifact({ ...params, content: raw });
  }
}

class TableTaskArtifact extends BaseTaskArtifact {
  // Updated to uppercase enum
  getType() { return 'TABLE'; }
  normalizeContent(content) {
    if (content == null) return null;
    // If already a string (pre-rendered markdown), accept it
    if (typeof content === 'string') {
      const s = content.trim();
      return s === '' ? null : s; // consumer tests treat string content as-is
    }
    if (!Array.isArray(content)) return null;
    // Ensure 2D array of primitive (string|number|null)
    const rows = content.map(row => Array.isArray(row) ? row.map(cell => this._normCell(cell)) : []);
    const trimmed = this._trimEmpty(rows);
  // Store trimmed 2D array directly (tests expect array form, markdown generated lazily by toMarkdown())
  if (!trimmed.length) return null;
  return trimmed;
  }
  _normCell(cell) {
    if (cell == null) return null;
    if (typeof cell === 'number') return cell;
    let s = String(cell).trim();
    return s === '' ? null : s;
  }
  _trimEmpty(rows) {
    // Remove trailing empty rows
    while (rows.length && this._rowEmpty(rows[rows.length - 1])) rows.pop();
    // Remove trailing empty cols
    if (rows.length) {
      let colCount = Math.max(...rows.map(r => r.length));
      for (let c = colCount - 1; c >= 0; c--) {
        let allEmpty = true;
        for (let r = 0; r < rows.length; r++) {
          if (!this._cellEmpty(rows[r][c])) { allEmpty = false; break; }
        }
        if (allEmpty) {
          for (let r = 0; r < rows.length; r++) rows[r].splice(c, 1);
        }
      }
    }
    return rows;
  }
  _rowEmpty(row) { return !row.some(c => !this._cellEmpty(c)); }
  _cellEmpty(c) { return c == null || c === ''; }

  toMarkdown() {
    if (!this.content) return '';
    if (typeof this.content === 'string') return this.content; // legacy/pre-rendered
    if (!Array.isArray(this.content) || !this.content.length) return '';
    const header = this.content[0];
    const lines = [];
    lines.push('| ' + header.map(c => c ?? '').join(' | ') + ' |');
    lines.push('| ' + header.map(() => '---').join(' | ') + ' |');
    for (let i = 1; i < this.content.length; i++) {
      const row = this.content[i];
      lines.push('| ' + row.map(c => c ?? '').join(' | ') + ' |');
    }
    return lines.join('\n');
  }
  
  /**
   * Convenience factory from raw 2D cells array.
   * @param {Array<Array<any>>} rawCells
   * @param {Object} params - Remaining constructor params excluding content.
   */
  static fromRawCells(rawCells, params) {
    return new TableTaskArtifact({ ...params, content: rawCells });
  }
}

class SpreadsheetTaskArtifact extends TableTaskArtifact {
  // Represented as its own subtype internally but we keep distinct identifier.
  // Still return uppercase for consistency; assessor logic will still skip.
  getType() { return 'SPREADSHEET'; }
  normalizeContent(content) {
    if (content == null) return null;
    // Delegate to Table normalisation to get either markdown string or 2D array
    const base = super.normalizeContent(content);
    // If base returned a markdown string (legacy) just return it unchanged
    if (typeof base === 'string' || !Array.isArray(base)) return base;
    // Clone rows deeply to avoid mutating shared arrays
    const norm = base.map(r => r.slice());
    for (let r = 0; r < norm.length; r++) {
      for (let c = 0; c < norm[r].length; c++) {
        const cell = norm[r][c];
        if (typeof cell === 'string' && cell.startsWith('=')) {
          norm[r][c] = this._canonicaliseFormula(cell);
        }
      }
    }
    return norm;
  }
  _canonicaliseFormula(f) {
    // Uppercase function names outside quotes; preserve quoted substrings.
    // Simple state machine.
    let result = '';
    let inQuote = false;
    for (let i = 0; i < f.length; i++) {
      const ch = f[i];
      if (ch === '"') {
        inQuote = !inQuote; result += ch; continue;
      }
      if (!inQuote) {
        result += ch.toUpperCase();
      } else {
        result += ch; // inside quotes leave as-is
      }
    }
    return result;
  }
}

class ImageTaskArtifact extends BaseTaskArtifact {
  // Updated to uppercase enum
  getType() { return 'IMAGE'; }
  normalizeContent(content) {
    // content is base64 string when set; may be null initially
    if (content == null) return null;
    if (typeof content !== 'string') return null;
    const trimmed = content.trim();
    return trimmed === '' ? null : trimmed;
  }
  setContentFromBlob(blob) {
    if (!blob) return;
    try {
      let bytes;
      if (blob.getBytes) {
        bytes = blob.getBytes();
      }
      if (!bytes) return;
      let base64;
      if (typeof Utilities !== 'undefined' && Utilities.base64Encode) {
        base64 = Utilities.base64Encode(bytes);
      } else if (typeof Buffer !== 'undefined') {
        base64 = Buffer.from(bytes).toString('base64');
      } else {
        return;
      }
      // Always use PNG data URI prefix per spec
      const pngPrefix = 'data:image/png;base64,';
      this.content = pngPrefix + base64;
      this.ensureHash();
    } catch (e) {
      // swallow errors silently in production path
    }
  }
}

class ArtifactFactory {
  /**
   * Params: { type, taskId, role, pageId?, documentId?, content?, metadata?, contentHash?, uid?, taskIndex?, artifactIndex? }
   */
  static create(params) {
    const rawType = (params.type || '').toString();
    // Expect upstream callers to use uppercase enums ('TEXT','TABLE','SPREADSHEET','IMAGE').
    // For backwards compatibility accept lowercase but immediately map to uppercase.
    const type = rawType.toUpperCase();
    switch (type) {
      case 'TEXT': return new TextTaskArtifact(params);
      case 'TABLE': return new TableTaskArtifact(params);
      case 'SPREADSHEET': return new SpreadsheetTaskArtifact(params);
      case 'IMAGE': return new ImageTaskArtifact(params);
      default: return new BaseTaskArtifact(params);
    }
  }
  static fromJSON(json) {
    return this.create(json);
  }
  // Convenience helpers mirroring subclass-specific static constructors.
  static text(params) { return this.create({ ...params, type: 'TEXT' }); }
  static table(params) { return this.create({ ...params, type: 'TABLE' }); }
  static spreadsheet(params) { return this.create({ ...params, type: 'SPREADSHEET' }); }
  static image(params) { return this.create({ ...params, type: 'IMAGE' }); }
}

// Export for Node/test environment (GAS will ignore module.exports)
if (typeof module !== 'undefined') {
  module.exports = {
    BaseTaskArtifact,
    TextTaskArtifact,
    TableTaskArtifact,
    SpreadsheetTaskArtifact,
    ImageTaskArtifact,
    ArtifactFactory
  };
}
