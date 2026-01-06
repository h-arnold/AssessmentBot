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
        // ProgressTracker may not be available in some test environments so log a dev warning
        ABLogger.getInstance().warn('Invalid teacher email', e);
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
        // ProgressTracker may not be available in some test environments so log a dev warning
        ABLogger.getInstance().warn('Invalid Google userId', e);
      }
    }
    return result;
  }

  /**
   * Validates that required parameters are present (truthy).
   * Throws an error if any parameter is missing.
   * @param {Object<string, *>} params - Object where keys are parameter names and values are the parameter values.
   * @param {string} [context] - Optional context (e.g., method name) for the error message.
   * @throws {Error} If any parameter is falsy.
   * @example
   * Validate.requireParams({ destinationFolderId, fileIds }, 'moveFiles');
   */
  static requireParams(params, context = '') {
    if (!params || typeof params !== 'object') {
      throw new Error('params must be an object');
    }

    const contextStr = context ? ` for ${context}` : '';

    for (const [paramName, value] of Object.entries(params)) {
      if (!value) {
        throw new Error(`${paramName} is required${contextStr}`);
      }
    }
  }
}

if (typeof module !== 'undefined') {
  module.exports = { Validate };
}
