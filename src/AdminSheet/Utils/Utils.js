/**
 * Utils Class
 *
 * Provides utility functions for the application.
 */
class Utils {
  /**
   * Generates a SHA-256 hash for a given input.
   *
   * @param {string|Uint8Array} input - The string or byte array to be hashed.
   * @return {string} - The SHA-256 hash of the input.
   */
  static generateHash(input) {
    let inputBytes;
    if (typeof input === 'string') {
      inputBytes = Utilities.newBlob(input).getBytes();
    } else {
      inputBytes = input; // Assume input is a byte array
    }

    const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, inputBytes);
    const hash = rawHash
      .map((e) => {
        const hex = (e < 0 ? e + 256 : e).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      })
      .join('');

    if (hash == null) {
      const progressTracker = ProgressTracker.getInstance();
      progressTracker.logAndThrowError('Hash is null. Please check debugger to find out why.');
    } else {
      return hash;
    }
  }
  /**
   * Converts a column index to its corresponding letter.
   *
   * @param {number} columnIndex - The column index to convert (0-based).
   * @return {string} - The corresponding column letter.
   */
  static getColumnLetter(columnIndex) {
    let temp;
    let letter = '';
    while (columnIndex >= 0) {
      temp = columnIndex % 26;
      letter = String.fromCodePoint(temp + 65) + letter;
      columnIndex = Math.floor((columnIndex - temp) / 26) - 1;
    }
    return letter;
  }

  /**
   * Compares two arrays for equality.
   *
   * @param {Array} arr1 - The first array.
   * @param {Array} arr2 - The second array.
   * @return {boolean} - True if arrays are equal, false otherwise.
   */
  static arraysEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    for (let i = 0; i < arr1.length; i++) {
      if (arr1[i] !== arr2[i]) return false;
    }
    return true;
  }

  /**
   * Normalises all keys in an object to lowercase. Sometimes the LLM will capitalize the keys of objects which causes problems elsewhere.
   *
   * @param {Object} obj - The object whose keys are to be normalised.
   * @return {Object} - A new object with all keys in lowercase.
   */
  static normaliseKeysToLowerCase(obj) {
    const normalisedObj = {};
    for (const [key, value] of Object.entries(obj)) {
      normalisedObj[key.toLowerCase()] = value;
    }
    return normalisedObj;
  }

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
  static toastMessage(message, title = '', timeoutSeconds = 3) {
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
  }

  static clearDocumentProperties() {
    const docProperties = PropertiesService.getDocumentProperties();
    docProperties.deleteAllProperties();
  }

  static isValidUrl(url) {
    if (typeof url !== 'string') {
      return false;
    }
    const trimmed = url.trim();

    if (trimmed.length === 0) return false;
    if (/\s/.test(trimmed)) return false;

    const match = /^https:\/\/([A-Za-z0-9.-]+)(?:[\/?#]|$)/.exec(trimmed);
    if (!match) {
      const progressTracker = ProgressTracker.getInstance();
      progressTracker.logError(`Invalid slide URL found: ${trimmed}`, { url: trimmed });
      return false;
    }

    const hostname = match[1].toLowerCase();
    if (hostname.length === 0) return false;

    if (hostname === 'localhost') return false;

    // Reject IP addresses (including public) - we only accept hostnames.
    if (this._isIPv4(hostname)) return false;

    // Minimal DNS hostname validation (labels, dots, hyphens).
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

  static _isPrivateIPv4(hostname) {
    const ipv4Exec = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
    if (!ipv4Exec) return false;
    const octets = [ipv4Exec[1], ipv4Exec[2], ipv4Exec[3], ipv4Exec[4]].map(Number);
    if (octets.some((o) => Number.isNaN(o) || o < 0 || o > 255)) return false;
    if (octets[0] === 10) return true;
    if (octets[0] === 127) return true;
    if (octets[0] === 169 && octets[1] === 254) return true;
    if (octets[0] === 192 && octets[1] === 168) return true;
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
    return false;
  }

  /**
   * Gets the date in DD/MM/YYYY format for appending to various file names
   */
  static getDate() {
    const dateObj = new Date();
    const timeZone = Session.getScriptTimeZone();

    // "dd/MM/yyyy" produces strings like "29/01/2025"
    return Utilities.formatDate(dateObj, timeZone, 'dd/MM/yyyy');
  }

  /**
   * Validates if current sheet is admin sheet
   * @param {boolean} throwError - Whether to throw error or just log warning
   * @returns {boolean} True if admin sheet
   */
  static validateIsAdminSheet(throwError = true) {
    const isAdmin = ConfigurationManager.getInstance().getIsAdminSheet();
    if (!isAdmin) {
      const message = 'This operation can only be performed from the admin sheet.';
      if (throwError) {
        const progressTracker = ProgressTracker.getInstance();
        progressTracker.logAndThrowError(message);
      } else {
        console.warn(message);
      }
      return false;
    }
    return true;
  }

  /**
   * Converts a number of days into a future date.
   *
   * @param {number} days - The number of days into the future.
   * @returns {Date} - A Date object representing the future date.
   */
  static getFutureDate(days) {
    if (typeof days !== 'number' || days < 0) {
      const progressTracker = ProgressTracker.getInstance();
      progressTracker.logAndThrowError('Days must be a non-negative number.');
    }

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    return futureDate;
  }

  /**
   * Determines if an assignment definition needs to be refreshed based on tasks and modification timestamps.
   * @param {Object} definition - The assignment definition to check.
   * @param {string|Date} referenceModified - Last modified timestamp of reference document.
   * @param {string|Date} templateModified - Last modified timestamp of template document.
   * @return {boolean} True if refresh is needed.
   */
  static definitionNeedsRefresh(definition, referenceModified, templateModified) {
    if (!definition?.tasks || Object.keys(definition.tasks).length === 0) {
      return true;
    }
    if (!definition.referenceLastModified || !definition.templateLastModified) {
      return true;
    }
    const refFresh = this.isNewer(referenceModified, definition.referenceLastModified);
    const tplFresh = this.isNewer(templateModified, definition.templateLastModified);
    return refFresh || tplFresh;
  }

  /**
   * Checks if a candidate timestamp is newer than a baseline timestamp.
   * @param {string|Date} candidate - The candidate timestamp.
   * @param {string|Date} baseline - The baseline timestamp.
   * @return {boolean} True if candidate is newer than baseline.
   */
  static isNewer(candidate, baseline) {
    if (!candidate || !baseline) return false;
    const c = new Date(candidate);
    const b = new Date(baseline);
    if (Number.isNaN(c.getTime()) || Number.isNaN(b.getTime())) return false;
    return c.getTime() > b.getTime();
  }
}

// Export for Node tests / CommonJS environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Utils;
}
