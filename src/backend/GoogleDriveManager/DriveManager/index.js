/**
 * DriveManager — Facade
 *
 * Handles Drive-related operations. Delegates to focused sub-classes for folder
 * validation, file operations, folder operations, file ID parsing, and modified
 * time retrieval.
 *
 * Public API contract is preserved from the original monolithic module.
 */
/* global DriveManagerFolderValidator, DriveManagerFileOperations, DriveManagerFolderOperations */
/* global DriveManagerFileId, DriveManagerModifiedTime */

const DRIVE_MANAGER_RETRY_ATTEMPTS = 3;
const DRIVE_MANAGER_RETRY_BACKOFF_BASE_MS = 500;
const DRIVE_MANAGER_RETRY_BACKOFF_MULTIPLIER = 2;

const driveManagerFolderValidator = new DriveManagerFolderValidator();
const driveManagerFileOperations = new DriveManagerFileOperations({
  folderValidator: driveManagerFolderValidator,
});
const driveManagerFolderOperations = new DriveManagerFolderOperations({
  folderValidator: driveManagerFolderValidator,
  retries: DRIVE_MANAGER_RETRY_ATTEMPTS,
  backoffBaseMs: DRIVE_MANAGER_RETRY_BACKOFF_BASE_MS,
  backoffMultiplier: DRIVE_MANAGER_RETRY_BACKOFF_MULTIPLIER,
});
const driveManagerFileId = new DriveManagerFileId();
const driveManagerModifiedTime = new DriveManagerModifiedTime({
  retries: DRIVE_MANAGER_RETRY_ATTEMPTS,
  defaultWaitMs: DRIVE_MANAGER_RETRY_BACKOFF_BASE_MS,
  backoffMultiplier: DRIVE_MANAGER_RETRY_BACKOFF_MULTIPLIER,
});

/**
 * Handles Drive-related operations.
 */
const DriveManager = {
  /**
   * Moves one or more files into a destination folder, optionally appending a string
   * to each file name before the move. Uses the Advanced Drive API so that moves
   * work reliably on both My Drive and Shared Drives.
   *
   * @param {string} destinationFolderId - ID of the folder the files will be moved into.
   * @param {string[]} fileIds - Array of Drive file IDs to move.
   * @param {string} [appendString] - Optional string to append to each file name before moving.
   * @returns {{status: string, message: string, details: Array<{fileId: string, status: string, message: string}>}} -
   * Overall status for the move operation and per-file result details.
   * @throws {Error} If `destinationFolderId` is not provided or the destination folder cannot be accessed.
   */
  moveFiles(destinationFolderId, fileIds, appendString = '') {
    return driveManagerFileOperations.moveFiles(destinationFolderId, fileIds, appendString);
  },
  /**
   * Copy a template sheet to a destination folder, optionally checking for existing files.
   * If a file with the same name already exists, returns its ID without copying.
   * @param {string} templateSheetId - The ID of the template sheet to copy.
   * @param {string} destinationFolderId - The ID of the destination folder. If not provided, uses the template's parent folder.
   * @param {string} newSheetName - The name for the copied sheet.
   * @returns {{status: 'copied'|'skipped', file: null, fileId: string, message: string}} An object with copy status, file ID, and message.
   * @throws {Error} If templateSheetId or newSheetName is not provided, or destination folder cannot be accessed.
   */
  copyTemplateSheet(templateSheetId, destinationFolderId, newSheetName) {
    return driveManagerFileOperations.copyTemplateSheet(
      templateSheetId,
      destinationFolderId,
      newSheetName
    );
  },

  /**
   * Validates that a folder exists and is accessible.
   * @param {string} folderId - The folder ID to validate.
   * @throws {Error} If folder cannot be accessed.
   * @private
   */
  _validateFolderExists(folderId) {
    driveManagerFolderValidator.validateFolderExists(folderId);
  },

  /**
   * Shares a folder with a list of email addresses, capturing the result for each email.
   * @param {string} destinationFolderId - The ID of the folder to share.
   * @param {Set<string>} emails - A set of email addresses to share the folder with.
   * @returns {{
   *   status: 'complete' | 'partial' | 'none',
   *   message: string,
   *   details: Array<{
   *     email: string,
   *     status: 'shared' | 'failed',
   *     message: string
   *   }>
   * }} An object describing the overall result.
   * @throws {Error} If destinationFolderId is not provided or folder cannot be accessed.
   *
   * Possible statuses:
   *   - 'complete': All emails were shared successfully.
   *   - 'partial': Some emails succeeded, some failed.
   *   - 'none': No emails were processed (e.g., if the set is empty).
   */
  shareFolder(destinationFolderId, emails) {
    return driveManagerFolderOperations.shareFolder(destinationFolderId, emails);
  },

  /**
   * Retrieves the first parent folder ID of a given file.
   * @param {string} fileId - The ID of the file to check.
   * @returns {string | null} The parent folder ID, or null if none is found.
   * @throws {Error} If fileId is not provided.
   */
  getParentFolderId(fileId) {
    return driveManagerFolderOperations.getParentFolderId(fileId);
  },

  /**
   * Retrieve the parent folder ID of a file using DriveApp with retry logic.
   * Attempts to access the parent via DriveApp, retrying on failure with exponential backoff.
   * @param {string} fileId - The ID of the file to retrieve the parent for.
   * @returns {string|null} The parent folder ID, or null if none is found or all retries fail.
   * @private
   */
  _getParentViaDriveApp(fileId) {
    return driveManagerFolderOperations._getParentViaDriveApp(fileId);
  },

  /**
   * Retrieve the parent folder ID of a file using the Advanced Drive API with fallback logic.
   * Falls back to Shared Drive root or My Drive root if needed.
   * @param {string} fileId - The ID of the file to retrieve the parent for.
   * @returns {string} The parent folder ID (API response, Shared Drive root, or My Drive root).
   * @throws {Error} If all fallback attempts fail.
   * @private
   */
  _getParentViaDriveApi(fileId) {
    return driveManagerFolderOperations._getParentViaDriveApi(fileId);
  },

  /**
   * Creates a folder inside a parent folder if it doesn't already exist.
   * If a folder with the same name exists, returns its ID instead.
   * @param {string} parentFolderId - The ID of the parent folder.
   * @param {string} folderName - The name for the new folder.
   * @returns {{ parentFolderId: string, newFolderId: string }}
   *          An object containing the parent folder ID and the folder ID (existing or newly created).
   * @throws {Error} If parentFolderId or folderName is not provided.
   */
  createFolder(parentFolderId, folderName) {
    return driveManagerFolderOperations.createFolder(parentFolderId, folderName);
  },

  /**
   * Validate if a string is a valid Google Drive File ID (format check only).
   * @param {string} fileId - The File ID to validate.
   * @returns {boolean} True if the format is valid, false otherwise.
   */
  isValidGoogleDriveFileId(fileId) {
    return driveManagerFileId.isValidGoogleDriveFileId(fileId);
  },

  /**
   * Normalise a Google Drive URL or file ID to a file ID.
   * Accepts either a full Google Drive/Docs/Slides/Sheets URL or a raw file ID.
   * If the input is already a valid file ID, it is returned unchanged.
   * If the input is a URL, the file ID is extracted and validated.
   *
   * Supported URL patterns:
   * - https://docs.google.com/presentation/d/{id}/edit
   * - https://docs.google.com/spreadsheets/d/{id}/edit
   * - https://drive.google.com/file/d/{id}/view
   * - https://drive.google.com/open?id={id}
   * - https://docs.google.com/document/d/{id}/edit
   * - Query parameter format: ?id={id}
   *
   * @param {string} urlOrId - A Google Drive URL or file ID.
   * @returns {string} The extracted or validated file ID.
   * @throws {Error} If the input is not a valid URL or file ID.
   */
  normaliseToFileId(urlOrId) {
    return driveManagerFileId.normaliseToFileId(urlOrId);
  },

  /**
   * Fetch the last modified timestamp for a Drive file with retries and Shared Drive fallback.
   * @param {string} fileId - Drive file ID.
   * @returns {string} ISO 8601 timestamp of the file's last modified time.
   * @throws {Error} If fileId is not provided or file cannot be accessed.
   */
  getFileModifiedTime(fileId) {
    return driveManagerModifiedTime.getFileModifiedTime(fileId);
  },

  /**
   * Fetch the last modified timestamp for a file via DriveApp with retry logic.
   * @param {string} fileId - The ID of the file to fetch the modification time for.
   * @param {number} retries - The number of retry attempts to make.
   * @param {number} baseWaitMs - The base wait time in milliseconds for exponential backoff.
   * @returns {string} ISO 8601 timestamp of the file's last modified time.
   * @throws {Error} If all retry attempts fail.
   * @private
   */
  _fetchModifiedTimeViaDriveApp(fileId, retries, baseWaitMs) {
    return driveManagerModifiedTime._fetchModifiedTimeViaDriveApp(fileId, retries, baseWaitMs);
  },

  /**
   * Fetch the last modified timestamp for a file via Advanced Drive API with retry logic.
   * @param {string} fileId - The ID of the file to fetch the modification time for.
   * @param {number} retries - The number of retry attempts to make.
   * @param {number} baseWaitMs - The base wait time in milliseconds for exponential backoff.
   * @returns {string} ISO 8601 timestamp of the file's last modified time.
   * @throws {Error} If all retry attempts fail.
   * @private
   */
  _fetchModifiedTimeViaDriveApi(fileId, retries, baseWaitMs) {
    return driveManagerModifiedTime._fetchModifiedTimeViaDriveApi(fileId, retries, baseWaitMs);
  },
};

// Export for Node tests / CommonJS environments
if (typeof module !== 'undefined') {
  module.exports = DriveManager;
}
