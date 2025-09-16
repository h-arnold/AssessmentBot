if (typeof module !== 'undefined') {
  // Required for testing in a Node.js environment with Vitest
  BaseTaskArtifact = require('./0_BaseTaskArtifact.js');
  TextTaskArtifact = require('./1_TextTaskArtifact.js');
  TableTaskArtifact = require('./2_TableTaskArtifact.js');
  SpreadsheetTaskArtifact = require('./3_SpreadsheetTaskArtifact.js');
  ImageTaskArtifact = require('./4_ImageTaskArtifact.js');
}

class ArtifactFactory {
  /**
   * Create an artifact instance based on the provided params.type.
   * Falls back to BaseTaskArtifact for unknown types.
   * @param {Object} params - constructor parameters including optional `type`.
   * @returns {BaseTaskArtifact}
   */
  static create(params) {
    const rawType = (params.type || '').toString();
    const type = rawType.toUpperCase();
    switch (type) {
      case 'TEXT':
        return new TextTaskArtifact(params);
      case 'TABLE':
        return new TableTaskArtifact(params);
      case 'SPREADSHEET':
        return new SpreadsheetTaskArtifact(params);
      case 'IMAGE':
        return new ImageTaskArtifact(params);
      default:
        return new BaseTaskArtifact(params);
    }
  }
  /**
   * Alias for create when given a JSON-like object.
   * @param {Object} json
   * @returns {BaseTaskArtifact}
   */
  static fromJSON(json) {
    return this.create(json);
  }
  /** Create a text artifact. */
  static text(params) {
    return this.create({ ...params, type: 'TEXT' });
  }
  /** Create a table artifact. */
  static table(params) {
    return this.create({ ...params, type: 'TABLE' });
  }
  /** Create a spreadsheet artifact. */
  static spreadsheet(params) {
    return this.create({ ...params, type: 'SPREADSHEET' });
  }
  /** Create an image artifact. */
  static image(params) {
    return this.create({ ...params, type: 'IMAGE' });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ArtifactFactory;
} else {
  this.ArtifactFactory = ArtifactFactory;
}
