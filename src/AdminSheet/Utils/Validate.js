// Validate.js

/**
 * Validate Utility
 *
 * Provides simple validation helpers used across the Admin Sheet codebase.
 */
class Validate {
  /**
   * Determines whether a value is a string.
   * @param {*} value
   * @returns {boolean}
   */
  static isString(value) {
    return typeof value === 'string';
  }

  /**
   * Determines whether a value is a non-empty string (after trimming whitespace).
   * @param {*} value
   * @returns {boolean}
   */
  static isNonEmptyString(value) {
    return Validate.isString(value) && value.trim().length > 0;
  }

  /**
   * Determines whether a value is a finite number.
   * @param {*} value
   * @returns {boolean}
   */
  static isNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  /**
   * Determines whether a value is a boolean.
   * @param {*} value
   * @returns {boolean}
   */
  static isBoolean(value) {
    return typeof value === 'boolean';
  }

  /**
   * Validates an email address using a permissive but practical regex.
   * @param {string} email
   * @return {boolean}
   */
  static isEmail(email) {
    if (typeof email !== 'string') return false;
    // Basic RFC 5322-ish regex adapted for practicality (no catastrophic backtracking)
    const emailPattern = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
    const result = emailPattern.test(email.trim());
    if (!result) {
      try {
        ProgressTracker.getInstance().logError(`Invalid teacher email: ${email}`);
      } catch (e) {
        // ProgressTracker may not be available in some test environments
        console.warn(`Invalid teacher email: ${email}`);
      }
    }
    return result;
  }

  /**
   * Validates a Google userId as returned by Classroom APIs.
   * Historically these are numeric strings, but to be tolerant we accept
   * long digit strings and typical alphanumeric ids.
   * @param {string} userId
   * @return {boolean}
   */
  static isGoogleUserId(userId) {
    if (typeof userId !== 'string' && typeof userId !== 'number') return false;
    const str = String(userId).trim();

    // Common Google userId pattern: all digits (e.g., '12345678901234567890')
    const digitsOnly = /^\d{6,}$/; // at least 6 digits
    // Fallback: alphanumeric identifiers (allow -, _ and .) with reasonable length
    const alnum = /^[A-Za-z0-9_.-]{6,64}$/;

    const result = digitsOnly.test(str) || alnum.test(str);
    if (!result) {
      try {
        ProgressTracker.getInstance().logError(`Invalid Google userId: ${userId}`);
      } catch (e) {
        console.warn(`Invalid Google userId: ${userId}`);
      }
    }
    return result;
  }
}

if (typeof module !== 'undefined') {
  module.exports = { Validate };
}
