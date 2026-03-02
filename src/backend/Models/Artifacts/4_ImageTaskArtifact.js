if (typeof module !== 'undefined') {
  // Required for testing in a Node.js environment with Vitest
  BaseTaskArtifact = require('./0_BaseTaskArtifact.js');
}

class ImageTaskArtifact extends BaseTaskArtifact {
  /**
   * Return the artifact type identifier.
   * @returns {string}
   */
  getType() {
    return 'IMAGE';
  }
  /**
   * Normalize image content; accepts only non-empty strings (data URLs).
   * @param {*} content
   * @returns {string|null}
   */
  normalizeContent(content) {
    if (content == null) return null;
    if (typeof content !== 'string') return null;
    const trimmed = content.trim();
    return trimmed === '' ? null : trimmed;
  }
  /**
   * Set the artifact content from a binary blob (GAS Blob or Node Buffer-like).
   * The blob is converted to a base64 PNG data URL and a content hash is set.
   * @param {*} blob
   */
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
      const pngPrefix = 'data:image/png;base64,';
      this.content = pngPrefix + base64;
      this.ensureHash();
    } catch (e) {
      // swallow errors
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ImageTaskArtifact;
} else {
  this.ImageTaskArtifact = ImageTaskArtifact;
}
