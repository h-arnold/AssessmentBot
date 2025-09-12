// Global shims for GAS-like environment in unit tests.

global.Utils = {
  generateHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h).toString(16);
  }
};

global.Utilities = {
  base64Encode(bytes) {
    if (Array.isArray(bytes)) return Buffer.from(Uint8Array.from(bytes)).toString('base64');
    if (typeof bytes === 'string') return Buffer.from(bytes, 'utf8').toString('base64');
    return '';
  }
};

global.Logger = {
  log: (...a) => console.log('[LOG]', ...a)
};

// Expose ArtifactFactory globally before TaskDefinition usage (TaskDefinition references global ArtifactFactory)
const { ArtifactFactory } = require('../src/AdminSheet/Models/Artifacts.js');
global.ArtifactFactory = ArtifactFactory;
