/**
 * ConfigurationManager validators and normalisers.
 * Delegates to shared utils where available to keep behaviour consistent.
 */

const API_KEY_PATTERN = /^(?!-)([A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)$/;
const DRIVE_ID_PATTERN = /^[A-Za-z0-9-_]{10,}$/;
const JSON_DB_LOG_LEVELS = Object.freeze(['DEBUG', 'INFO', 'WARN', 'ERROR']);

function validateLogLevel(label, value) {
  Validate.validateNonEmptyString(label, value);
  const upper = value.trim().toUpperCase();
  if (!JSON_DB_LOG_LEVELS.includes(upper)) {
    throw new Error(`${label} must be one of: ${JSON_DB_LOG_LEVELS.join(', ')}`);
  }
  return upper;
}

function validateApiKey(value) {
  if (!Validate.isNonEmptyString(value) || !API_KEY_PATTERN.test(value.trim())) {
    throw new Error(
      'API Key must be a valid string of alphanumeric characters and hyphens, without leading/trailing hyphens or consecutive hyphens.'
    );
  }
  return value;
}

function toBoolean(value) {
  if (Validate.isBoolean(value)) return value;
  if (value == null) return false;
  if (typeof value === 'number') return value !== 0;
  const normalised = String(value).trim().toLowerCase();
  if (normalised === 'true') return true;
  if (normalised === 'false') return false;
  return Boolean(normalised);
}

function toBooleanString(value) {
  return toBoolean(value) ? 'true' : 'false';
}

function toReadableKey(key) {
  return key.replaceAll(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
}

/**
 * Validates and parses a ClassInfo JSON string.
 * @param {string} label - Human readable label for error messaging
 * @param {string} value - JSON string to validate
 * @returns {string} The validated JSON string
 * @throws {TypeError} If validation fails
 */
function validateClassInfo(label, value) {
  const keyLabel = label || 'Assessment Record Class Info';
  // Must be a string
  if (!Validate.isString(value)) {
    throw new TypeError(`${keyLabel} must be a JSON string.`);
  }

  // Must be valid JSON
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch (err) {
    throw new TypeError(`${keyLabel} must be valid JSON.`);
  }

  // Must be an object (not null, array, or primitive)
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError(`${keyLabel} must be a JSON object.`);
  }

  // Validate required properties
  if (!Validate.isNonEmptyString(parsed.ClassName)) {
    throw new TypeError(`${keyLabel} must have a ClassName property (non-empty string).`);
  }

  if (!Validate.isNonEmptyString(parsed.CourseId)) {
    throw new TypeError(`${keyLabel} must have a CourseId property (non-empty string).`);
  }

  // Validate CourseId format - Google Classroom course IDs are typically numeric or alphanumeric
  const courseIdPattern = /^[A-Za-z0-9_-]+$/;
  if (!courseIdPattern.test(parsed.CourseId)) {
    throw new TypeError(`${keyLabel} CourseId must be alphanumeric (with hyphens/underscores).`);
  }

  // YearGroup is optional but if present must be a number or null
  if (
    parsed.YearGroup !== null &&
    parsed.YearGroup !== undefined &&
    !Validate.isNumber(parsed.YearGroup)
  ) {
    throw new TypeError(`${keyLabel} YearGroup must be a number or null.`);
  }

  return value;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    API_KEY_PATTERN,
    DRIVE_ID_PATTERN,
    JSON_DB_LOG_LEVELS,
    validateLogLevel,
    validateApiKey,
    validateClassInfo,
    toBoolean,
    toBooleanString,
    toReadableKey,
  };
}
