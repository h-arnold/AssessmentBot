/* global ApiValidationError */

/**
 * Validates that parameters is a plain object (not an array).
 * Throws ApiValidationError if validation fails.
 *
 * This is the shared primitive for the abclass/ domain folder.
 * Referenced via `/* global validateParametersObject_ *&#47; from
 * abclassMutations.js and abclassRead.js.
 *
 * @param {*} parameters - The parameters object to validate.
 * @param {string} methodName - Name of the calling method (for error messages).
 * @throws {ApiValidationError} If parameters is not a plain object.
 */
function validateParametersObject_(parameters, methodName) {
  if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) {
    throw new ApiValidationError('params must be an object.', {
      method: methodName,
      fieldName: 'params',
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { validateParametersObject_ };
}
