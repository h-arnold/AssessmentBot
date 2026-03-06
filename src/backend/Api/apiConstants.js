// apiConstants.js

const API_METHODS = Object.freeze({
  getAuthorisationStatus: 'getAuthorisationStatus',
});

const API_ALLOWLIST = Object.freeze({
  [API_METHODS.getAuthorisationStatus]: API_METHODS.getAuthorisationStatus,
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    API_METHODS,
    API_ALLOWLIST,
  };
}
