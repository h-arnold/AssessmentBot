const MIN_WEIGHTING = 0;
const MAX_WEIGHTING = 10;

/**
 * AssignmentDefinitionValidation
 *
 * Shared validation helpers for assignment definition operations.
 * Pure functions with no dependencies on other modules.
 */
class AssignmentDefinitionValidation {
  /**
   * Returns whether the value is a non-empty string after trim.
   *
   * @param {*} value - Value to check.
   * @returns {boolean} True when non-empty trimmed string.
   */
  isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
  }

  /**
   * Requires a non-empty string and returns trimmed value.
   *
   * @param {*} value - Candidate value.
   * @param {string} fieldName - Field for diagnostics.
   * @returns {string} Trimmed string.
   * @throws {Error} When value is not a non-empty string.
   */
  requireTrimmedString(value, fieldName) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`${fieldName} must be a non-empty string.`);
    }

    return value.trim();
  }

  /**
   * Normalises duplicate-check title format.
   *
   * @param {string} title - Candidate title.
   * @returns {string} Normalised title.
   */
  normaliseTitleForDuplicate(title) {
    return String(title || '')
      .trim()
      .toLowerCase();
  }

  /**
   * Normalises alternate titles payload.
   *
   * @param {*} alternateTitles - Candidate title list.
   * @returns {Array<string>} Normalised title list.
   * @throws {TypeError|Error} When alternateTitles is invalid.
   */
  normaliseAlternateTitles(alternateTitles) {
    if (alternateTitles === undefined || alternateTitles === null) {
      return [];
    }

    if (!Array.isArray(alternateTitles)) {
      throw new TypeError('alternateTitles must be an array when provided.');
    }

    return alternateTitles.map((title, index) => {
      if (typeof title !== 'string' || title.trim().length === 0) {
        throw new Error(`alternateTitles[${index}] must be a non-empty string.`);
      }
      return title.trim();
    });
  }

  /**
   * Validates weighting values for assignment and task contracts.
   *
   * @param {*} value - Candidate weighting.
   * @param {string} fieldName - Field label for diagnostics.
   * @returns {number|null} Validated weighting.
   * @throws {TypeError|RangeError} When value is invalid.
   */
  requireNumericOrNullWeighting(value, fieldName) {
    if (value === null) {
      return null;
    }

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new TypeError(`${fieldName} must be a number or null.`);
    }

    if (value < MIN_WEIGHTING || value > MAX_WEIGHTING) {
      throw new RangeError(`${fieldName} must be between ${MIN_WEIGHTING} and ${MAX_WEIGHTING}.`);
    }

    return value;
  }
}

// Export for Node tests / CommonJS environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AssignmentDefinitionValidation;
}
