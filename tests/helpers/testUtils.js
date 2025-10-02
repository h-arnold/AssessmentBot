/**
 * General test utility functions
 * Small helpers used across multiple test files
 */

/**
 * Repeat a function n times
 * @param {number} n - Number of times to repeat
 * @param {Function} fn - Function to repeat
 */
function repeat(n, fn) {
  for (let i = 0; i < n; i++) {
    fn(i);
  }
}

/**
 * Create a no-op function (for mocking callbacks)
 * @returns {Function} No-op function
 */
function noop() {}

/**
 * Simple assertion helper for tests without test framework
 * @param {boolean} condition - Condition to assert
 * @param {string} message - Error message if assertion fails
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

/**
 * Wait for a specified number of milliseconds
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise} Promise that resolves after delay
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a simple deterministic hash from a string (for testing)
 * @param {string} str - String to hash
 * @returns {string} Hex hash
 */
function simpleHash(str) {
  let h = 0;
  if (!str) return '0';
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    h = (h << 5) - h + chr;
    h |= 0; // Convert to 32bit integer
  }
  return Math.abs(h).toString(16);
}

module.exports = {
  repeat,
  noop,
  assert,
  delay,
  simpleHash,
};
