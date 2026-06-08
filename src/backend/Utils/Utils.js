/**
 * Utils Class
 *
 * Provides utility functions for the application.
 */
/* global ALPHABET_LENGTH */
const BYTE_NEGATIVE_OFFSET = 256;
const HEX_RADIX = 16;
const UPPERCASE_A_CODE_POINT = 65;
const DEFAULT_TOAST_TIMEOUT_SECONDS = 3;

/**
 * Utility methods used across the backend.
 */
const Utils = {
  /**
   * Generates a SHA-256 hash for a given input.
   *
   * @param {string|Uint8Array} input - The string or byte array to be hashed.
   * @returns {string} The SHA-256 hash of the input.
   */
  generateHash(input) {
    const inputBytes = Validate.isString(input) ? Utilities.newBlob(input).getBytes() : input;

    const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, inputBytes);
    const hash = rawHash
      .map((byteValue) => {
        const hex = (byteValue < 0 ? byteValue + BYTE_NEGATIVE_OFFSET : byteValue).toString(
          HEX_RADIX
        );
        return hex.length === 1 ? '0' + hex : hex;
      })
      .join('');

    if (hash === null || hash === undefined) {
      const progressTracker = ProgressTracker.getInstance();
      progressTracker.logAndThrowError('Hash is null. Please check debugger to find out why.');
    } else {
      return hash;
    }
  },
  /**
   * Converts a column index to its corresponding letter.
   *
   * @param {number} columnIndex - The column index to convert (0-based).
   * @returns {string} The corresponding column letter.
   */
  getColumnLetter(columnIndex) {
    let temporary;
    let letter = '';
    while (columnIndex >= 0) {
      temporary = columnIndex % ALPHABET_LENGTH;
      letter = String.fromCodePoint(temporary + UPPERCASE_A_CODE_POINT) + letter;
      columnIndex = Math.floor((columnIndex - temporary) / ALPHABET_LENGTH) - 1;
    }
    return letter;
  },

  /**
   * Compares two arrays for equality.
   *
   * @param {Array} array1 - The first array.
   * @param {Array} array2 - The second array.
   * @returns {boolean} True if arrays are equal, false otherwise.
   */
  arraysEqual(array1, array2) {
    if (array1.length !== array2.length) return false;
    for (const [index, element] of array1.entries()) {
      if (element !== array2.at(index)) return false;
    }
    return true;
  },

  /**
   * Normalises all keys in an object to lowercase. Sometimes the LLM will capitalise the keys of objects which causes problems elsewhere.
   *
   * @param {Object} object - The object whose keys are to be normalised.
   * @returns {Object} A new object with all keys in lowercase.
   */
  normaliseKeysToLowerCase(object) {
    const normalisedObject = {};
    for (const [key, value] of Object.entries(object)) {
      normalisedObject[key.toLowerCase()] = value;
    }
    return normalisedObject;
  },

  // -------------------
  // UI Methods
  // -------------------

  /**
   * Displays a toast message to the user in Google Sheets.
   *
   * @param {string} message - The message to display.
   * @param {string} [title=''] - Optional title for the toast.
   * @param {number} [timeoutSeconds=3] - Duration for which the toast is visible.
   */
  toastMessage(message, title = '', timeoutSeconds = DEFAULT_TOAST_TIMEOUT_SECONDS) {
    try {
      const activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      if (activeSpreadsheet) {
        activeSpreadsheet.toast(message, title, timeoutSeconds);
        console.log(
          `Toast message displayed: "${message}" with title "${title}" for ${timeoutSeconds} seconds.`
        );
      } else {
        const progressTracker = ProgressTracker.getInstance();
        progressTracker.logError('No active spreadsheet found for toast message.');
      }
    } catch (error) {
      const progressTracker = ProgressTracker.getInstance();
      progressTracker.captureError(error, 'Error displaying toast message');
    }
  },
};

// Export for Node tests / CommonJS environment
if (typeof module !== 'undefined' && module.exports) {
  // Load DateUtils for backward-compatible re-exports
  const dateUtils = require('./DateUtils.js');
  Utils.getDate = dateUtils.getFormattedDate;
  Utils.getFutureDate = dateUtils.getFutureDate;
  Utils.definitionNeedsRefresh = dateUtils.definitionNeedsRefresh;
  Utils.isNewer = dateUtils.isNewer;
  module.exports = Utils;
}

// Export to global scope for GAS runtime
if (typeof globalThis !== 'undefined') {
  // DateUtils is loaded first in GAS (alphabetical ordering of files in same directory)
  /* global DateUtils */
  Utils.getDate = DateUtils.getFormattedDate;
  Utils.getFutureDate = DateUtils.getFutureDate;
  Utils.definitionNeedsRefresh = DateUtils.definitionNeedsRefresh;
  Utils.isNewer = DateUtils.isNewer;
  globalThis.Utils = Utils;
}
