/* global AssignmentDefinitionController, ApiValidationError */

const RESPONSE_FIELD_NAME = 'response';
const LAST_CONTROL_CHARACTER_CODE = 31;
const DELETE_CHARACTER_CODE = 127;

/**
 * Returns a new assignment-definition controller instance.
 *
 * @returns {AssignmentDefinitionController} Controller instance.
 */
function getAssignmentDefinitionController_() {
  return new AssignmentDefinitionController();
}

/**
 * Throws a transport validation error for assignment-definition partials.
 *
 * @param {string} message - Validation failure message.
 * @param {string|null} fieldName - Related field name.
 * @param {number} rowIndex - Invalid row index.
 * @throws {ApiValidationError} Always throws.
 */
function throwValidationError_(message, fieldName, rowIndex) {
  throw new ApiValidationError(message, {
    method: 'getAssignmentDefinitionPartials',
    fieldName,
    details: `rowIndex=${rowIndex}`,
  });
}

/**
 * Throws a transport validation error for assignment-definition delete operations.
 *
 * @param {string} message - Validation failure message.
 * @param {string} fieldName - Related field name.
 * @throws {ApiValidationError} Always throws.
 */
function throwDeleteValidationError_(message, fieldName) {
  throw new ApiValidationError(message, {
    method: 'deleteAssignmentDefinition',
    fieldName,
  });
}

/**
 * Returns whether the provided key contains control characters.
 *
 * @param {string} value - Definition key candidate.
 * @returns {boolean} True when any control character is present.
 */
function hasControlCharacters_(value) {
  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.codePointAt(index);
    if (codePoint <= LAST_CONTROL_CHARACTER_CODE || codePoint === DELETE_CHARACTER_CODE) {
      return true;
    }
  }

  return false;
}

/**
 * Validates a safe, non-empty, already-trimmed identifier string.
 *
 * @param {*} value - Identifier candidate.
 * @param {Object} options - Validation options.
 * @param {Function} options.throwValidationError - Context-specific validation thrower.
 * @param {string} options.typeErrorMessage - Type-validation error message.
 * @param {string} options.nonEmptyErrorMessage - Non-empty-validation error message.
 * @param {string} options.trimmedErrorMessage - Trimmed-shape-validation error message.
 * @param {string} options.unsafeErrorMessage - Unsafe-character-validation error message.
 * @param {Object} options.fieldNames - Field names for diagnostics.
 * @param {string} options.fieldNames.type - Field name for type errors.
 * @param {string} options.fieldNames.nonEmpty - Field name for non-empty errors.
 * @param {string} options.fieldNames.trimmed - Field name for trimmed-shape errors.
 * @param {string} options.fieldNames.unsafe - Field name for unsafe-character errors.
 */
function validateSafeTrimmedIdentifier_(value, options) {
  const {
    throwValidationError,
    typeErrorMessage,
    nonEmptyErrorMessage,
    trimmedErrorMessage,
    unsafeErrorMessage,
    fieldNames,
  } = options;

  if (typeof value !== 'string') {
    throwValidationError(typeErrorMessage, fieldNames.type);
  }

  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    throwValidationError(nonEmptyErrorMessage, fieldNames.nonEmpty);
  }

  if (trimmedValue !== value) {
    throwValidationError(trimmedErrorMessage, fieldNames.trimmed);
  }

  if (
    value.includes('/') ||
    value.includes('\\') ||
    value.includes('..') ||
    hasControlCharacters_(value)
  ) {
    throwValidationError(unsafeErrorMessage, fieldNames.unsafe);
  }
}

/**
 * Validates delete parameters with strict safe-key requirements.
 *
 * @param {*} parameters - Candidate request parameters.
 * @returns {string} The original validated definition key.
 * @throws {ApiValidationError} If parameters or definitionKey are invalid.
 */
function validateDeleteParameters_(parameters) {
  if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) {
    throwDeleteValidationError_('params must be an object.', 'params');
  }

  if (!Object.hasOwn(parameters, 'definitionKey')) {
    throwDeleteValidationError_('Missing required field: definitionKey.', 'definitionKey');
  }

  const { definitionKey } = parameters;

  validateSafeTrimmedIdentifier_(definitionKey, {
    throwValidationError: throwDeleteValidationError_,
    typeErrorMessage: 'definitionKey must be a string.',
    nonEmptyErrorMessage: 'definitionKey must be a non-empty string.',
    trimmedErrorMessage: 'definitionKey must already be trimmed.',
    unsafeErrorMessage: 'definitionKey contains unsafe characters.',
    fieldNames: {
      type: 'definitionKey',
      nonEmpty: 'definitionKey',
      trimmed: 'definitionKey',
      unsafe: 'definitionKey',
    },
  });

  return definitionKey;
}

/**
 * Throws a transport validation error for assignment-definition upsert operations.
 *
 * @param {string} message - Validation failure message.
 * @param {string|null} fieldName - Related field name.
 * @throws {ApiValidationError} Always throws.
 */
function throwUpsertValidationError_(message, fieldName) {
  throw new ApiValidationError(message, {
    method: 'upsertAssignmentDefinition',
    fieldName,
  });
}

/**
 * Throws a transport validation error for assignment-definition read operations.
 *
 * @param {string} message - Validation failure message.
 * @param {string} fieldName - Related field name.
 * @throws {ApiValidationError} Always throws.
 */
function throwReadValidationError_(message, fieldName) {
  throw new ApiValidationError(message, {
    method: 'getAssignmentDefinition',
    fieldName,
  });
}

/**
 * Validates read parameters with strict safe-key requirements.
 *
 * @param {*} parameters - Candidate request parameters.
 * @returns {string} The validated definition key.
 */
function validateReadParameters_(parameters) {
  if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) {
    throwReadValidationError_('params must be an object.', 'params');
  }

  if (!Object.hasOwn(parameters, 'definitionKey')) {
    throwReadValidationError_('Missing required field: definitionKey.', 'definitionKey');
  }

  validateSafeTrimmedIdentifier_(parameters.definitionKey, {
    throwValidationError: throwReadValidationError_,
    typeErrorMessage: 'definitionKey must be a string.',
    nonEmptyErrorMessage: 'definitionKey must be a non-empty string.',
    trimmedErrorMessage: 'definitionKey must already be trimmed.',
    unsafeErrorMessage: 'definitionKey contains unsafe characters.',
    fieldNames: {
      type: 'definitionKey',
      nonEmpty: 'definitionKey',
      trimmed: 'definitionKey',
      unsafe: 'definitionKey',
    },
  });

  return parameters.definitionKey;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getAssignmentDefinitionController_,
    throwValidationError_,
    throwDeleteValidationError_,
    throwUpsertValidationError_,
    throwReadValidationError_,
    hasControlCharacters_,
    validateSafeTrimmedIdentifier_,
    validateDeleteParameters_,
    validateReadParameters_,
    // Export constants needed by transport module in Node environment
    RESPONSE_FIELD_NAME,
  };
}
