/**
 * DateUtils — Date-related utility functions.
 *
 * Extracted from Utils.js. Provides date formatting, comparison, staleness checks,
 * and transport-boundary Date normalisation.
 */
const DateUtils = {
  /**
   * Gets the date in DD/MM/YYYY format for appending to various file names.
   * @returns {string} The formatted date string.
   */
  getFormattedDate() {
    const dateObject = new Date();
    const timeZone = Session.getScriptTimeZone();
    return Utilities.formatDate(dateObject, timeZone, 'dd/MM/yyyy');
  },

  /**
   * Converts a number of days into a future date.
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
   * Determines if an assignment definition needs to be refreshed.
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

  /**
   * Normalises specified fields on an object, converting live Date objects to
   * ISO 8601 strings. Mutates the object in-place and returns the same reference.
   *
   * This is the canonical pattern for converting Date objects at the API handler
   * boundary before returning data to google.script.run.
   *
   * @param {Object} target - The object whose date fields should be normalised.
   * @param {string[]} fields - Array of field names to normalise.
   * @returns {Object} The same object reference (mutated in-place).
   */
  normaliseDateFields(target, fields) {
    if (!target) return target;
    for (const field of fields) {
      // eslint-disable-next-line security/detect-object-injection -- field names are explicitly provided by the caller
      if (target[field] instanceof Date) {
        // eslint-disable-next-line security/detect-object-injection
        target[field] = target[field].toISOString();
      }
    }
    return target;
  },
};

// Export for Node tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DateUtils;
}
