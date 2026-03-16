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
   * Validates an HTTPS URL string.
   *
   * Rules:
   * - Protocol must be https
   * - Host must be a DNS hostname (not an IP address and not localhost)
   * - Port numbers are not permitted
   *
   * @param {string} url
   * @return {boolean}
   */
  static isValidUrl(url) {
    if (typeof url !== 'string') return false;

    const trimmed = url.trim();
    if (trimmed.length === 0) return false;
    if (/\s/.test(trimmed)) return false;

    const match = /^https:\/\/([A-Za-z0-9.-]+)(?:[/?#]|$)/.exec(trimmed);
    if (!match) {
      try {
        ProgressTracker.getInstance().logError(`Invalid URL found: ${trimmed}`, { url: trimmed });
      } catch (e) {
        ABLogger.getInstance().warn('Invalid URL', e);
      }
      return false;
    }

    const hostname = match[1].toLowerCase();
    if (hostname.length === 0) return false;
    if (hostname === 'localhost') return false;

    // Reject IP addresses (including public) - we only accept hostnames.
    if (Validate._isIPv4(hostname)) return false;

    // Minimal DNS hostname validation.
    if (hostname.length > 253) return false;
    const labels = hostname.split('.');
    if (labels.length < 2) return false;
    if (labels.some((label) => label.length === 0 || label.length > 63)) return false;
    if (labels.some((label) => label.startsWith('-') || label.endsWith('-'))) return false;
    if (labels.some((label) => !/^[a-z0-9-]+$/.test(label))) return false;

    return true;
  }

  static _isIPv4(hostname) {
    const ipv4Exec = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
    if (!ipv4Exec) return false;
    const octets = [ipv4Exec[1], ipv4Exec[2], ipv4Exec[3], ipv4Exec[4]].map(Number);
    if (octets.some((o) => Number.isNaN(o) || o < 0 || o > 255)) return false;
    return true;
  }

  /**
   * Validates that required parameters are present (not null/undefined).
   * Throws an error if any parameter is missing.
   *
   * This method is intentionally limited to presence checks only. It does not
   * validate content (e.g., non-empty strings) and will not reject falsy-but-valid
   * values such as 0, false, or ''.
   * @param {Object<string, *>} params - Object where keys are parameter names and values are the parameter values.
   * @param {string} [context] - Optional context (e.g., method name) for the error message.
   * @throws {Error} If any parameter is null or undefined.
   * @example
   * Validate.requireParams({ templateSheetId, newSheetName }, 'copyTemplateSheet');
   */
  static requireParams(params, context = '') {
    if (!params || typeof params !== 'object' || Array.isArray(params))
      throw new Error('params must be an object');

    const contextStr = context ? ` for ${context}` : '';

    for (const [paramName, value] of Object.entries(params)) {
      if (value === null || value === undefined)
        throw new Error(`${paramName} is required${contextStr}`);
    }
  }

  /**
   * Validates that a value is an integer within a specified range.
   * @param {string} label - Human-readable label for error messaging.
   * @param {*} value - Value to validate.
   * @param {number} min - Minimum allowed value (inclusive).
   * @param {number} max - Maximum allowed value (inclusive).
   * @returns {number} The validated integer value.
   * @throws {Error} If value is not an integer or is outside the specified range.
   */
  static validateIntegerInRange(label, value, min, max) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      throw new Error(`${label} must be an integer between ${min} and ${max}.`);
    }
    return parsed;
  }

  /**
   * Validates that a value is a non-empty string.
   * @param {string} label - Human-readable label for error messaging.
   * @param {*} value - Value to validate.
   * @returns {string} The validated string value.
   * @throws {Error} If value is not a non-empty string.
   */
  static validateNonEmptyString(label, value) {
    if (!Validate.isNonEmptyString(value)) {
      throw new Error(`${label} must be a non-empty string.`);
    }
    return value;
  }

  /**
   * Validates that a value is a valid URL string.
   * @param {string} label - Human-readable label for error messaging.
   * @param {*} value - Value to validate.
   * @returns {string} The validated URL string.
   * @throws {Error} If value is not a valid URL string.
   */
  static validateUrl(label, value) {
    const isValid = typeof value === 'string' && Validate.isValidUrl(value);
    if (!isValid) {
      throw new Error(`${label} must be a valid URL string.`);
    }
    return value;
  }

  /**
   * Validates and coerces a value to a boolean.
   * Accepts boolean values, or string representations ('true'/'false').
   * @param {string} label - Human-readable label for error messaging.
   * @param {*} value - Value to validate.
   * @returns {boolean} The validated/coerced boolean value.
   * @throws {Error} If value cannot be interpreted as a boolean.
   */
  static validateBoolean(label, value) {
    if (Validate.isBoolean(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'true') return true;
      if (lower === 'false') return false;
    }
    throw new Error(`${label} must be a boolean (true/false).`);
  }
}

if (typeof module !== 'undefined') {
  module.exports = { Validate };
}
