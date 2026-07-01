/**
 * AssignmentTimestamps — Timestamp management sub-class
 *
 * Owns touchUpdated(), getUpdatedAt(), setUpdatedAt(), getCreatedAt(), setCreatedAt().
 * Operates on the parent Assignment instance's date fields via this._assignment.
 * @class
 */
/**
 * AssignmentTimestamps — Timestamp management sub-class
 *
 * Owns touchUpdated(), getUpdatedAt(), setUpdatedAt(), getCreatedAt(), setCreatedAt().
 * Operates on the parent Assignment instance's date fields via this._assignment.
 * @class
 */
class AssignmentTimestamps {
  /**
   * Constructor.
   * @param {import('../Assignment.js')} assignment - The parent Assignment instance.
   */
  constructor(assignment) {
    /** @type {import('../Assignment.js')} */
    this._assignment = assignment;
  }

  /**
   * Updates the updatedAt timestamp to the current date/time.
   * Call this whenever the assignment is modified in-memory.
   * @returns {Date} The new updatedAt value.
   */
  touchUpdated() {
    // Use setUpdatedAt to centralize validation/copying behaviour.
    return this.setUpdatedAt(new Date());
  }

  /**
   * Returns the updatedAt Date or null if not set.
   * @returns {Date|null} The updatedAt Date or null.
   */
  getUpdatedAt() {
    return this._assignment.updatedAt || null;
  }

  /**
   * Sets the updatedAt timestamp from a JavaScript Date object (or null to clear).
   * The method copies the provided Date to avoid external mutation.
   * @param {Date|null} date - The Date to set, or null to clear the timestamp.
   * @returns {Date|null} The stored Date instance or null.
   * @throws {TypeError} If the provided value is not a Date or null.
   */
  setUpdatedAt(date) {
    if (date === null) {
      this._assignment.updatedAt = null;
      return null;
    }
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      throw new TypeError('setUpdatedAt expects a valid Date or null');
    }
    // store a copy to avoid outside mutation
    this._assignment.updatedAt = new Date(date);
    return this._assignment.updatedAt;
  }

  /**
   * Returns the createdAt Date.
   * @returns {Date} The createdAt Date.
   */
  getCreatedAt() {
    return this._assignment.createdAt;
  }

  /**
   * Sets the createdAt timestamp from a JavaScript Date object.
   * The method copies the provided Date to avoid external mutation.
   * @param {Date} date - The Date to set.
   * @returns {Date} The stored Date instance.
   * @throws {TypeError} If the provided value is not a valid Date.
   */
  setCreatedAt(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      throw new TypeError('setCreatedAt expects a valid Date');
    }
    this._assignment.createdAt = new Date(date);
    return this._assignment.createdAt;
  }
}

// Export for Node/Vitest environment (ignored in GAS runtime)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AssignmentTimestamps;
}
