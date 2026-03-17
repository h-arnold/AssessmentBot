/**
 * ConfigurationManager validators and normalisers.
 * Delegates to shared utils where available to keep behaviour consistent.
 */

// eslint-disable-next-line security/detect-unsafe-regex -- anchored token validation with bounded character classes; false positive.
const API_KEY_PATTERN = /^(?!-)([\dA-Za-z]+(?:-[\dA-Za-z]+)*)$/u;
const DRIVE_ID_PATTERN = /^[\w-]{10,}$/u;
const JSON_DB_LOG_LEVELS = Object.freeze(['DEBUG', 'INFO', 'WARN', 'ERROR']);

/**
 * Validates a configured JsonDbApp log level and normalises it to uppercase.
 * @param {string} label - Human-readable label for error messaging.
 * @param {*} value - Candidate log level.
 * @return {string} Validated uppercase log level.
 * @throws {Error} If the value is empty or not one of the supported levels.
 */
function validateLogLevel(label, value) {
  Validate.validateNonEmptyString(label, value);
  const upper = value.trim().toUpperCase();
  if (!JSON_DB_LOG_LEVELS.includes(upper)) {
    throw new Error(`${label} must be one of: ${JSON_DB_LOG_LEVELS.join(', ')}`);
  }
  return upper;
}

/**
 * Validates an API key token used by external integrations.
 * @param {*} value - Candidate API key.
 * @return {string} Original API key value when valid.
 * @throws {Error} If the value is missing or has an invalid token format.
 */
function validateApiKey(value) {
  if (!Validate.isNonEmptyString(value) || !API_KEY_PATTERN.test(value.trim())) {
    throw new Error(
      'API Key must be a valid string of alphanumeric characters and hyphens, without leading/trailing hyphens or consecutive hyphens.'
    );
  }
  return value;
}

/**
 * Coerces common boolean-like values to a boolean.
 * @param {*} value - Value to coerce.
 * @return {boolean} Coerced boolean value.
 */
function toBoolean(value) {
  if (Validate.isBoolean(value)) return value;
  if (value == null) return false;
  if (typeof value === 'number') return value !== 0;
  const normalised = String(value).trim().toLowerCase();
  if (normalised === 'true') return true;
  if (normalised === 'false') return false;
  return Boolean(normalised);
}

/**
 * Coerces a value to a lowercase boolean string.
 * @param {*} value - Value to normalise.
 * @return {string} `'true'` or `'false'` depending on the coerced value.
 */
function toBooleanString(value) {
  return toBoolean(value) ? 'true' : 'false';
}

/**
 * Converts an internal camel-case key to a human-readable label.
 * @param {string} key - Internal configuration key.
 * @return {string} Human-readable label.
 */
function toReadableKey(key) {
  return key.replaceAll(/([A-Z])/gu, ' $1').replace(/^./u, (string_) => string_.toUpperCase());
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
  } catch {
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
  const courseIdPattern = /^[\w-]+$/u;
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
