/**
 * Central error logging utility to provide consistent formatting.
 * Usage: logError('ContextDescription', errorObjectOrMessage);
 * Adds stack trace when available and DEBUG_ERRORS flag is truthy.
 * @param {string} context - Context description for the error.
 * @param {string|Error|Object} error - The error object or message to log.
 * @returns {void}
 */
function logError(context, error) {
  const message = error?.message || error?.toString?.() || String(error);
  const base = `[ERROR][${context}] ${message}`;
  if (globalThis.DEBUG_ERRORS && error && error.stack) {
    console.error(`${base}\n${error.stack}`);
  } else {
    console.error(base);
  }
}

// Export for Node tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { logError };
} else {
  globalThis.logError = logError; // GAS global
}
