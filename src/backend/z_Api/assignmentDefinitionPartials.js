/* global AssignmentDefinitionController, ApiValidationError */

const PARTIAL_REQUIRED_FIELDS = Object.freeze([
  'primaryTitle',
  'primaryTopic',
  'yearGroup',
  'alternateTitles',
  'alternateTopics',
  'documentType',
  'referenceDocumentId',
  'templateDocumentId',
  'assignmentWeighting',
  'definitionKey',
  'tasks',
  'createdAt',
  'updatedAt',
]);

const RESPONSE_FIELD_NAME = 'response';
const ISO_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})(Z|([+-])(\d{2}):(\d{2}))$/u;
const MAX_OFFSET_HOURS = 23;
const MAX_OFFSET_MINUTES = 59;
const MINUTES_PER_HOUR = 60;
const MILLISECONDS_PER_SECOND = 1000;
const MILLISECONDS_PER_MINUTE = MINUTES_PER_HOUR * MILLISECONDS_PER_SECOND;
const NEGATIVE_TIMEZONE_MULTIPLIER = -1;

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

const LAST_CONTROL_CHARACTER_CODE = 31;
const DELETE_CHARACTER_CODE = 127;

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

  if (typeof definitionKey !== 'string') {
    throwDeleteValidationError_('definitionKey must be a string.', 'definitionKey');
  }

  if (definitionKey.trim().length === 0) {
    throwDeleteValidationError_('definitionKey must be a non-empty string.', 'definitionKey');
  }

  if (definitionKey.trim() !== definitionKey) {
    throwDeleteValidationError_('definitionKey must already be trimmed.', 'definitionKey');
  }

  if (
    definitionKey.includes('/') ||
    definitionKey.includes('\\') ||
    definitionKey.includes('..') ||
    hasControlCharacters_(definitionKey)
  ) {
    throwDeleteValidationError_('definitionKey contains unsafe characters.', 'definitionKey');
  }

  return definitionKey;
}

/**
 * Validates that the input contains all required transport fields.
 *
 * @param {*} row - Candidate row.
 * @param {number} rowIndex - Candidate row index.
 * @throws {ApiValidationError} If the row shape is invalid.
 */
function validateRequiredFields_(row, rowIndex) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    throwValidationError_(
      'Each assignment definition partial row must be an object.',
      null,
      rowIndex
    );
  }

  PARTIAL_REQUIRED_FIELDS.forEach((fieldName) => {
    if (!Object.hasOwn(row, fieldName)) {
      throwValidationError_(`Missing required field: ${fieldName}.`, fieldName, rowIndex);
    }
  });
}

/**
 * Validates the strict definition-key transport contract.
 *
 * @param {*} definitionKey - Candidate definition key.
 * @param {number} rowIndex - Row index.
 * @throws {ApiValidationError} If definitionKey is missing, blank, or untrimmed.
 */
function validateDefinitionKey_(definitionKey, rowIndex) {
  if (typeof definitionKey !== 'string') {
    throwValidationError_('definitionKey must be a string.', 'definitionKey', rowIndex);
  }

  const trimmedDefinitionKey = definitionKey.trim();
  if (trimmedDefinitionKey.length === 0) {
    throwValidationError_('definitionKey must be a non-empty string.', 'definitionKey', rowIndex);
  }

  if (trimmedDefinitionKey !== definitionKey) {
    throwValidationError_('definitionKey must already be trimmed.', 'definitionKey', rowIndex);
  }
}

/**
 * Checks whether a value is an ISO datetime string with timezone info.
 *
 * @param {*} value - Candidate timestamp value.
 * @returns {boolean} True when value is a valid ISO datetime string.
 */
function isIsoDateTimeString_(value) {
  if (typeof value !== 'string') {
    return false;
  }

  const match = ISO_DATE_TIME_PATTERN.exec(value);
  if (!match) {
    return false;
  }

  const [
    ,
    year,
    month,
    day,
    hours,
    minutes,
    seconds,
    milliseconds,
    timezone,
    sign,
    offsetHours,
    offsetMinutes,
  ] = match;

  const parsedOffsetHours = timezone === 'Z' ? 0 : Number(offsetHours);
  const parsedOffsetMinutes = timezone === 'Z' ? 0 : Number(offsetMinutes);
  if (parsedOffsetHours > MAX_OFFSET_HOURS || parsedOffsetMinutes > MAX_OFFSET_MINUTES) {
    return false;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return false;
  }

  const timezoneOffsetSign = timezone === 'Z' || sign === '+' ? 1 : NEGATIVE_TIMEZONE_MULTIPLIER;
  const timezoneOffsetMinutes =
    timezoneOffsetSign * (parsedOffsetHours * MINUTES_PER_HOUR + parsedOffsetMinutes);
  const localDate = new Date(
    parsedDate.getTime() + timezoneOffsetMinutes * MILLISECONDS_PER_MINUTE
  );

  return (
    localDate.getUTCFullYear() === Number(year) &&
    localDate.getUTCMonth() + 1 === Number(month) &&
    localDate.getUTCDate() === Number(day) &&
    localDate.getUTCHours() === Number(hours) &&
    localDate.getUTCMinutes() === Number(minutes) &&
    localDate.getUTCSeconds() === Number(seconds) &&
    localDate.getUTCMilliseconds() === Number(milliseconds)
  );
}

/**
 * Validates a timestamp transport field.
 *
 * @param {*} value - Candidate timestamp value.
 * @param {string} fieldName - Field name for diagnostics.
 * @param {number} rowIndex - Row index.
 * @throws {ApiValidationError} If value is not null and not a valid ISO datetime string.
 */
function validateTimestamp_(value, fieldName, rowIndex) {
  if (value === null) {
    return;
  }

  if (!isIsoDateTimeString_(value)) {
    throwValidationError_(
      `${fieldName} must be null or an ISO datetime string.`,
      fieldName,
      rowIndex
    );
  }
}

/**
 * Validates a single assignment-definition partial transport row.
 *
 * @param {*} row - Candidate row.
 * @param {number} rowIndex - Row index.
 * @throws {ApiValidationError} If the row violates the strict contract.
 */
function validatePartialRow_(row, rowIndex) {
  validateRequiredFields_(row, rowIndex);
  validateDefinitionKey_(row.definitionKey, rowIndex);
  validateTimestamp_(row.createdAt, 'createdAt', rowIndex);
  validateTimestamp_(row.updatedAt, 'updatedAt', rowIndex);

  if (row.tasks !== null) {
    throwValidationError_('tasks must be null in partial transport.', 'tasks', rowIndex);
  }
}

/**
 * Builds a plain assignment-definition partial object.
 *
 * @param {Object} row - Valid partial row.
 * @returns {Object} Plain transport row.
 */
function toPlainPartialRow_(row) {
  return {
    primaryTitle: row.primaryTitle,
    primaryTopic: row.primaryTopic,
    yearGroup: row.yearGroup,
    alternateTitles: row.alternateTitles,
    alternateTopics: row.alternateTopics,
    documentType: row.documentType,
    referenceDocumentId: row.referenceDocumentId,
    templateDocumentId: row.templateDocumentId,
    assignmentWeighting: row.assignmentWeighting,
    definitionKey: row.definitionKey,
    tasks: row.tasks,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Returns assignment-definition partial rows for API transport.
 *
 * @returns {Array<Object>} Plain assignment-definition partial rows.
 * @throws {ApiValidationError} If any row violates the strict transport contract.
 */
function getAssignmentDefinitionPartials_() {
  const partialRows = getAssignmentDefinitionController_().getAllPartialDefinitions();

  if (!Array.isArray(partialRows)) {
    throwValidationError_('Controller response must be an array.', RESPONSE_FIELD_NAME, 0);
  }

  return partialRows.map((row, rowIndex) => {
    validatePartialRow_(row, rowIndex);
    return toPlainPartialRow_(row);
  });
}

/**
 * Deletes an assignment definition by key after strict safety validation.
 *
 * @param {Object} parameters - Request payload containing definitionKey.
 */
function deleteAssignmentDefinition_(parameters) {
  const definitionKey = validateDeleteParameters_(parameters);
  getAssignmentDefinitionController_().deleteDefinitionByKey(definitionKey);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getAssignmentDefinitionPartials_,
    deleteAssignmentDefinition_,
  };
}
