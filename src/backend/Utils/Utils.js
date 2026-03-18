/**
 * Utils Class
 *
 * Provides utility functions for the application.
 */
const BYTE_NEGATIVE_OFFSET = 256;
const HEX_RADIX = 16;
const ALPHABET_LENGTH = 26;
const UPPERCASE_A_CODE_POINT = 65;
const DEFAULT_TOAST_TIMEOUT_SECONDS = 3;

/**
 * Utility methods used across the backend.
 */
const Utilities_ = {
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

  /**
   * Clears all document properties.
   * @returns {void}
   */
  clearDocumentProperties() {
    const documentProperties = PropertiesService.getDocumentProperties();
    documentProperties.deleteAllProperties();
  },

  /**
   * Gets the date in DD/MM/YYYY format for appending to various file names.
   * @returns {string} The formatted date string.
   */
  getDate() {
    const dateObject = new Date();
    const timeZone = Session.getScriptTimeZone();

    // "dd/MM/yyyy" produces strings like "29/01/2025"
    return Utilities.formatDate(dateObject, timeZone, 'dd/MM/yyyy');
  },

  /**
   * Converts a number of days into a future date.
   *
   * @param {number} days - The number of days into the future.
   * @returns {Date} - A Date object representing the future date.
   */
  getFutureDate(days) {
    if (typeof days !== 'number' || days < 0) {
      const progressTracker = ProgressTracker.getInstance();
      progressTracker.logAndThrowError('Days must be a non-negative number.');
    }

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    return futureDate;
  },

  /**
   * Determines if an assignment definition needs to be refreshed based on tasks and modification timestamps.
   * @param {Object} definition - The assignment definition to check.
   * @param {string|Date} referenceModified - Last modified timestamp of reference document.
   * @param {string|Date} templateModified - Last modified timestamp of template document.
   * @returns {boolean} True if refresh is needed.
   */
  definitionNeedsRefresh(definition, referenceModified, templateModified) {
    if (!definition?.tasks || Object.keys(definition.tasks).length === 0) {
      return true;
    }
    if (!definition.referenceLastModified || !definition.templateLastModified) {
      return true;
    }
    const referenceFresh = this.isNewer(referenceModified, definition.referenceLastModified);
    const tplFresh = this.isNewer(templateModified, definition.templateLastModified);
    return referenceFresh || tplFresh;
  },

  /**
   * Checks if a candidate timestamp is newer than a baseline timestamp.
   * @param {string|Date} candidate - The candidate timestamp.
   * @param {string|Date} baseline - The baseline timestamp.
   * @returns {boolean} True if candidate is newer than baseline.
   */
  isNewer(candidate, baseline) {
    if (!candidate || !baseline) return false;
    const c = new Date(candidate);
    const b = new Date(baseline);
    if (Number.isNaN(c.getTime()) || Number.isNaN(b.getTime())) return false;
    return c.getTime() > b.getTime();
  },
};

// Export for Node tests / CommonJS environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Utilities_;
}
