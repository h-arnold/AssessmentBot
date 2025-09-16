// Aggregator for artifact-related classes so tests (and any Node code) can
// import from 'Models/Artifacts' without using individual require statements.
// This keeps per-file globals pattern (for GAS) untouched while providing a
// CommonJS/ESM-friendly entry point for Vitest.

const BaseTaskArtifact = require('./0_BaseTaskArtifact.js');
const TextTaskArtifact = require('./1_TextTaskArtifact.js');
const TableTaskArtifact = require('./2_TableTaskArtifact.js');
const SpreadsheetTaskArtifact = require('./3_SpreadsheetTaskArtifact.js');
const ImageTaskArtifact = require('./4_ImageTaskArtifact.js');
const ArtifactFactory = require('./5_ArtifactFactory.js');

const exported = {
  BaseTaskArtifact,
  TextTaskArtifact,
  TableTaskArtifact,
  SpreadsheetTaskArtifact,
  ImageTaskArtifact,
  ArtifactFactory
};

// Support both CommonJS and (via Vitest) ESM named import interop.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = exported;
}

// Provide a default export for ESM compatibility if transpiled.
exports.default = exported;
