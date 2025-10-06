// Shim to keep Node tests working after moving error classes to ErrorTypes/
// Re-export the AbortRequestError class from the ErrorTypes folder.
let AbortRequestError;
if (typeof module !== 'undefined' && module.exports) {
  AbortRequestError = require('./ErrorTypes/AbortRequestError.js');
  module.exports = AbortRequestError;
}
