/**
 * DriveManagerModifiedTime
 *
 * Fetches the last modified timestamp for a Drive file, preferring DriveApp
 * and falling back to the Advanced Drive API with retry and exponential
 * backoff.
 */
class DriveManagerModifiedTime {
  /**
   * Creates the instance with injected retry configuration.
   *
   * @param {Object} deps - Dependency injection.
   * @param {number} deps.retries - Number of fetch attempts to make.
   * @param {number} deps.defaultWaitMs - Base wait, in milliseconds, for exponential backoff.
   * @param {number} deps.backoffMultiplier - Multiplier applied to the base wait per attempt.
   */
  constructor({ retries, defaultWaitMs, backoffMultiplier }) {
    this._retries = retries;
    this._defaultWaitMs = defaultWaitMs;
    this._backoffMultiplier = backoffMultiplier;
  }

  /**
   * Fetch the last modified timestamp for a Drive file with retries and Shared Drive fallback.
   *
   * @param {string} fileId - Drive file ID.
   * @returns {string} ISO 8601 timestamp of the file's last modified time.
   * @throws {Error} If fileId is not provided or file cannot be accessed.
   */
  getFileModifiedTime(fileId) {
    const progressTracker = ProgressTracker.getInstance();

    Validate.requireParams({ fileId }, 'getFileModifiedTime');

    try {
      return this._fetchModifiedTimeViaDriveApp(fileId, this._retries, this._defaultWaitMs);
    } catch (appError) {
      ABLogger.getInstance().debug('DriveApp failed, trying Drive API', appError);
      try {
        return this._fetchModifiedTimeViaDriveApi(fileId, this._retries, this._defaultWaitMs);
      } catch (apiError) {
        progressTracker.logError('Failed to fetch file modified time', {
          fileId,
          err: apiError,
        });
        throw apiError;
      }
    }
  }

  /**
   * Fetch the last modified timestamp for a file via DriveApp with retry logic.
   *
   * @param {string} fileId - The ID of the file to fetch the modification time for.
   * @param {number} retries - The number of retry attempts to make.
   * @param {number} baseWaitMs - The base wait time in milliseconds for exponential backoff.
   * @returns {string} ISO 8601 timestamp of the file's last modified time.
   * @throws {Error} If all retry attempts fail.
   * @private
   */
  _fetchModifiedTimeViaDriveApp(fileId, retries, baseWaitMs) {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const file = DriveApp.getFileById(fileId);
        const date = file.getLastUpdated();
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
          throw new TypeError('DriveApp.getLastUpdated returned an invalid Date');
        }
        return date.toISOString();
      } catch (error) {
        if (attempt < retries - 1) {
          const wait = baseWaitMs * Math.pow(this._backoffMultiplier, attempt);
          Utilities.sleep(wait);
          continue;
        }
        throw error;
      }
    }
    throw new Error('Unable to fetch modified time via DriveApp');
  }

  /**
   * Fetch the last modified timestamp for a file via Advanced Drive API with retry logic.
   *
   * @param {string} fileId - The ID of the file to fetch the modification time for.
   * @param {number} retries - The number of retry attempts to make.
   * @param {number} baseWaitMs - The base wait time in milliseconds for exponential backoff.
   * @returns {string} ISO 8601 timestamp of the file's last modified time.
   * @throws {Error} If all retry attempts fail.
   * @private
   */
  _fetchModifiedTimeViaDriveApi(fileId, retries, baseWaitMs) {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = Drive.Files.get(fileId, {
          supportsAllDrives: true,
          fields: 'modifiedTime',
        });
        if (!response?.modifiedTime) {
          throw new TypeError('Advanced Drive API did not return modifiedTime');
        }
        const parsed = new Date(response.modifiedTime);
        if (Number.isNaN(parsed.getTime())) {
          throw new TypeError(`Invalid modifiedTime format for file ${fileId}`);
        }
        return parsed.toISOString();
      } catch (error) {
        if (attempt < retries - 1) {
          const wait = baseWaitMs * Math.pow(this._backoffMultiplier, attempt);
          Utilities.sleep(wait);
          continue;
        }
        throw error;
      }
    }
    throw new Error('Unable to fetch modified time via Drive API');
  }
}

// Export for Node tests / CommonJS environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DriveManagerModifiedTime;
}
