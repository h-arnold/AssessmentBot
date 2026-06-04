/**
 * Validation helper functions for AssignmentDefinitionController.
 * Concatenated before the main controller file in GAS runtime.
 * Contains weighting validation, string helpers, title normalisation, and duplicate detection.
 */

const MIN_WEIGHTING = 0;
const MAX_WEIGHTING = 10;

/**
 * Returns whether the value is a non-empty string after trim.
 *
 * @param {*} value - Value to check.
 * @returns {boolean} True when non-empty trimmed string.
 */
function _isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Requires a non-empty string and returns trimmed value.
 *
 * @param {*} value - Candidate value.
 * @param {string} fieldName - Field for diagnostics.
 * @returns {string} Trimmed string.
 */
function _requireTrimmedString(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }

  return value.trim();
}

/**
 * Validates weighting values for assignment and task contracts.
 *
 * @param {*} value - Candidate weighting.
 * @param {string} fieldName - Field label for diagnostics.
 * @returns {number|null} Validated weighting.
 */
function _requireNumericOrNullWeighting(value, fieldName) {
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

/**
 * Normalises duplicate-check title format.
 *
 * @param {string} title - Candidate title.
 * @returns {string} Normalised title.
 */
function _normaliseTitleForDuplicate(title) {
  return String(title || '')
    .trim()
    .toLowerCase();
}

/**
 * Normalises alternate titles payload.
 *
 * @param {*} alternateTitles - Candidate title list.
 * @returns {Array<string>} Normalised title list.
 */
function _normaliseAlternateTitles(alternateTitles) {
  if (alternateTitles === undefined || alternateTitles === null) {
    return [];
  }

  if (!Array.isArray(alternateTitles)) {
    throw new TypeError('alternateTitles must be an array when provided.');
  }

  return alternateTitles.map(function (title, index) {
    if (typeof title !== 'string' || title.trim().length === 0) {
      throw new Error('alternateTitles[' + index + '] must be a non-empty string.');
    }
    return title.trim();
  });
}

/**
 * Generates a stable opaque definition key.
 *
 * @returns {string} Stable identifier.
 */
function _generateStableDefinitionKey() {
  if (typeof Utilities === 'undefined' || typeof Utilities.getUuid !== 'function') {
    throw new TypeError('Utilities.getUuid must be available to generate definitionKey.');
  }

  var generatedDefinitionKey = Utilities.getUuid();

  if (!_isNonEmptyString(generatedDefinitionKey)) {
    throw new TypeError('Utilities.getUuid must return a non-empty string definitionKey.');
  }

  return generatedDefinitionKey.trim();
}

// Export for Node tests / CommonJS environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MIN_WEIGHTING: MIN_WEIGHTING,
    MAX_WEIGHTING: MAX_WEIGHTING,
    _isNonEmptyString: _isNonEmptyString,
    _requireTrimmedString: _requireTrimmedString,
    _requireNumericOrNullWeighting: _requireNumericOrNullWeighting,
    _normaliseTitleForDuplicate: _normaliseTitleForDuplicate,
    _normaliseAlternateTitles: _normaliseAlternateTitles,
    _generateStableDefinitionKey: _generateStableDefinitionKey,
  };
}
