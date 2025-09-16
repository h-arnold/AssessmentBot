if (typeof module !== 'undefined') {
  // Required for testing in a Node.js environment with Vitest
  BaseTaskArtifact = require('./0_BaseTaskArtifact.js');
}

/**
 * Represents a text-based task artifact.
 *
 * Extends BaseTaskArtifact and provides helpers for handling and normalizing
 * text content associated with a task.
 *
 * @class TextTaskArtifact
 * @extends BaseTaskArtifact
 *
 * @example
 * // create from raw text
 * // const artifact = TextTaskArtifact.fromRawText(" hello\r\nworld ", { id: 1 });
 *
 * @method getType
 * @returns {string} The artifact type identifier ('TEXT').
 *
 * @method normalizeContent
 * @param {(string|any|null|undefined)} content - Raw content to normalize. Non-string values will be coerced to string.
 * @returns {(string|null)} Normalized content with CRLF/CR converted to LF and trimmed. Returns null for null/undefined or empty content after trimming.
 *
 * @method fromRawText
 * @static
 * @param {(string|any|null|undefined)} raw - Raw text to set as the artifact content.
 * @param {Object} [params] - Additional parameters to merge into the artifact constructor.
 * @returns {TextTaskArtifact} New TextTaskArtifact instance initialized with the provided content and params.
 */
class TextTaskArtifact extends BaseTaskArtifact {
  getType() {
    return 'TEXT';
  }
  normalizeContent(content) {
    if (content == null) return null;
    if (typeof content !== 'string') content = String(content);
    const normalised = content.replace(/\r\n?/g, '\n').trim();
    return normalised === '' ? null : normalised;
  }
  static fromRawText(raw, params) {
    return new TextTaskArtifact({ ...params, content: raw });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TextTaskArtifact;
} else {
  this.TextTaskArtifact = TextTaskArtifact;
}
