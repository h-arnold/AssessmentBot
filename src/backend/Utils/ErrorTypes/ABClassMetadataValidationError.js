/**
 * Error raised when an ABClass metadata snapshot violates its domain contract.
 */
class ABClassMetadataValidationError extends Error {
  /**
   * Creates a metadata integrity error.
   *
   * @param {string} message - Description of the invalid metadata value.
   * @param {string} fieldPath - Dot/bracket path to the invalid metadata value.
   */
  constructor(message, fieldPath) {
    super(`${message} (${fieldPath})`);
    this.name = 'ABClassMetadataValidationError';
    this.fieldPath = fieldPath;
    this.inputSource = 'model';
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ABClassMetadataValidationError };
}
