// This file is not used in the GAS environment.
// It is only used for testing in the Node environment.
if (typeof module === 'undefined') {
  // This code will not run in Node
} else {
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
    ArtifactFactory,
  };

  module.exports = exported;
}
