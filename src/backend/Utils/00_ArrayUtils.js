/**
 * ArrayUtils - Utility methods for array operations.
 *
 * Provides generic array helper functions that can be reused across the codebase.
 * All methods are static and do not require instantiation.
 */
// eslint-disable-next-line unicorn/no-static-only-class
class ArrayUtils {
  /**
   * Finds the index of the first item in an array matching the given predicate.
   * @param {Array} items - The array to search
   * @param {Function} predicate - Function that receives (item, index, collection) and returns true for a match
   * @returns {number} Index of the matching item, or -1 if not found
   */
  static findIndexWithPredicate(items, predicate) {
    return items.findIndex((item, index, collection) => predicate(item, index, collection));
  }

  /**
   * Finds the first item in an array matching the given predicate.
   * @param {Array} items - The array to search
   * @param {Function} predicate - Function that receives (item, index, collection) and returns true for a match
   * @returns {*|null} The matching item, or null if not found
   */
  static findWithPredicate(items, predicate) {
    return items.find((item, index, collection) => predicate(item, index, collection)) || null;
  }

  /**
   * Serialises an array of objects by calling toJSON() on each item if available.
   * @param {Array} items - Array of objects to serialise
   * @returns {Array} Array of serialised objects
   */
  static serialiseArray(items) {
    return (items || []).map((item) =>
      item && typeof item.toJSON === 'function' ? item.toJSON() : item
    );
  }
}

// Export for Node/Vitest environment
if (typeof module !== 'undefined') {
  module.exports = ArrayUtils;
}
