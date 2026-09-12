/**
 *
 */
const ArtifactFactory = {
  /**
   * Create an artifact instance based on the provided params.type.
   * Falls back to BaseTaskArtifact for unknown types.
   *
   * @param {Object} parameters - constructor parameters including optional `type`.
   * @returns {BaseTaskArtifact} New artifact instance.
   */
  create(parameters) {
    const rawType = (parameters.type || '').toString();
    const type = rawType.toUpperCase();
    switch (type) {
      case 'TEXT': {
        return new TextTaskArtifact(parameters);
      }
      case 'TABLE': {
        return new TableTaskArtifact(parameters);
      }
      case 'SPREADSHEET': {
        return new SpreadsheetTaskArtifact(parameters);
      }
      case 'IMAGE': {
        return new ImageTaskArtifact(parameters);
      }
      default: {
        return new BaseTaskArtifact(parameters);
      }
    }
  },
  /**
   * Alias for create when given a JSON-like object.
   *
   * @param {Object} json - JSON-like object to create from.
   * @returns {BaseTaskArtifact} New artifact instance.
   */
  fromJSON(json) {
    return this.create(json);
  },
  /**
   * Create a text artifact.
   *
   * @param {Object} parameters - Constructor parameters.
   * @returns {BaseTaskArtifact} New text artifact.
   */
  text(parameters) {
    return this.create({ ...parameters, type: 'TEXT' });
  },
  /**
   * Create a table artifact.
   *
   * @param {Object} parameters - Constructor parameters.
   * @returns {BaseTaskArtifact} New table artifact.
   */
  table(parameters) {
    return this.create({ ...parameters, type: 'TABLE' });
  },
  /**
   * Create a spreadsheet artifact.
   *
   * @param {Object} parameters - Constructor parameters.
   * @returns {BaseTaskArtifact} New spreadsheet artifact.
   */
  spreadsheet(parameters) {
    return this.create({ ...parameters, type: 'SPREADSHEET' });
  },
  /**
   * Create an image artifact.
   *
   * @param {Object} parameters - Constructor parameters.
   * @returns {BaseTaskArtifact} New image artifact.
   */
  image(parameters) {
    return this.create({ ...parameters, type: 'IMAGE' });
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ArtifactFactory;
} else {
  globalThis.ArtifactFactory = ArtifactFactory;
}
if (typeof module !== 'undefined') {
  // Required for testing in a Node.js environment with Vitest
  BaseTaskArtifact = require('./0_BaseTaskArtifact.js');
  TextTaskArtifact = require('./1_TextTaskArtifact.js');
  TableTaskArtifact = require('./2_TableTaskArtifact.js');
  SpreadsheetTaskArtifact = require('./3_SpreadsheetTaskArtifact.js');
  ImageTaskArtifact = require('./4_ImageTaskArtifact.js');
}
