/**
 * DriveManagerFolderValidator
 *
 * Validates that Google Drive folders are accessible before file, folder, or
 * template operations attempt to use them.
 */
class DriveManagerFolderValidator {
  /**
   * Validates that a folder exists and is accessible.
   *
   * @param {string} folderId - The folder ID to validate.
   * @returns {void}
   * @throws {Error} If the folder cannot be accessed.
   */
  validateFolderExists(folderId) {
    Validate.requireParams({ folderId }, 'DriveManagerFolderValidator.validateFolderExists');

    try {
      Drive.Files.get(folderId, { supportsAllDrives: true, fields: 'id' });
    } catch (error) {
      const failMessage = `Failed to access folder with ID "${folderId}".`;
      ProgressTracker.getInstance().logError(failMessage, { folderId, err: error });
      const error_ = new Error(failMessage);
      error_.cause = error;
      throw error_;
    }
  }
}

// Export for Node tests / CommonJS environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DriveManagerFolderValidator;
}
