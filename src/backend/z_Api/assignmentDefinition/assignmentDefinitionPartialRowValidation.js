/* global throwValidationError_ */

const PARTIAL_REQUIRED_FIELDS = Object.freeze([
  'primaryTitle',
  'primaryTopic',
  'primaryTopicKey',
  'yearGroupKey',
  'yearGroupLabel',
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

const ISO_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})(Z|([+-])(\d{2}):(\d{2}))$/u;
const MAX_OFFSET_HOURS = 23;
const MAX_OFFSET_MINUTES = 59;
const MINUTES_PER_HOUR = 60;
const MILLISECONDS_PER_SECOND = 1000;
const MILLISECONDS_PER_MINUTE = MINUTES_PER_HOUR * MILLISECONDS_PER_SECOND;
const NEGATIVE_TIMEZONE_MULTIPLIER = -1;

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
 * Validates the strict primary-topic-key transport contract.
 *
 * @param {*} primaryTopicKey - Candidate topic key.
 * @param {number} rowIndex - Row index.
 * @throws {ApiValidationError} If primaryTopicKey is missing, blank, or untrimmed.
 */
function validatePrimaryTopicKey_(primaryTopicKey, rowIndex) {
  if (typeof primaryTopicKey !== 'string') {
    throwValidationError_('primaryTopicKey must be a string.', 'primaryTopicKey', rowIndex);
  }

  const trimmedPrimaryTopicKey = primaryTopicKey.trim();
  if (trimmedPrimaryTopicKey.length === 0) {
    throwValidationError_(
      'primaryTopicKey must be a non-empty string.',
      'primaryTopicKey',
      rowIndex
    );
  }

  if (trimmedPrimaryTopicKey !== primaryTopicKey) {
    throwValidationError_('primaryTopicKey must already be trimmed.', 'primaryTopicKey', rowIndex);
  }
}

/**
 * Validates the strict year-group keyed transport contract.
 *
 * @param {*} yearGroupKey - Candidate year-group key.
 * @param {*} yearGroupLabel - Candidate year-group label.
 * @param {number} rowIndex - Row index.
 * @throws {ApiValidationError} If year-group fields are missing, blank, or untrimmed.
 */
function validateYearGroupKeyedFields_(yearGroupKey, yearGroupLabel, rowIndex) {
  if (typeof yearGroupKey !== 'string') {
    throwValidationError_('yearGroupKey must be a string.', 'yearGroupKey', rowIndex);
  }

  const trimmedYearGroupKey = yearGroupKey.trim();
  if (trimmedYearGroupKey.length === 0) {
    throwValidationError_('yearGroupKey must be a non-empty string.', 'yearGroupKey', rowIndex);
  }

  if (trimmedYearGroupKey !== yearGroupKey) {
    throwValidationError_('yearGroupKey must already be trimmed.', 'yearGroupKey', rowIndex);
  }

  if (typeof yearGroupLabel !== 'string') {
    throwValidationError_('yearGroupLabel must be a string.', 'yearGroupLabel', rowIndex);
  }

  const trimmedYearGroupLabel = yearGroupLabel.trim();
  if (trimmedYearGroupLabel.length === 0) {
    throwValidationError_('yearGroupLabel must be a non-empty string.', 'yearGroupLabel', rowIndex);
  }

  if (trimmedYearGroupLabel !== yearGroupLabel) {
    throwValidationError_('yearGroupLabel must already be trimmed.', 'yearGroupLabel', rowIndex);
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
  validatePrimaryTopicKey_(row.primaryTopicKey, rowIndex);
  validateYearGroupKeyedFields_(row.yearGroupKey, row.yearGroupLabel, rowIndex);
  validateTimestamp_(row.createdAt, 'createdAt', rowIndex);
  validateTimestamp_(row.updatedAt, 'updatedAt', rowIndex);

  if (!Array.isArray(row.tasks)) {
    throwValidationError_('tasks must be an array.', 'tasks', rowIndex);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    validateRequiredFields_,
    validateDefinitionKey_,
    validatePrimaryTopicKey_,
    validateYearGroupKeyedFields_,
    isIsoDateTimeString_,
    validateTimestamp_,
    validatePartialRow_,
  };
}
