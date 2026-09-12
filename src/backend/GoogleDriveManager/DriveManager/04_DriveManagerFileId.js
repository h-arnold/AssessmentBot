/**
 * DriveManagerFileId
 *
 * Parses and validates Google Drive file identifiers, accepting either a raw
 * file ID or a Google Drive/Docs/Slides/Sheets URL.
 */
class DriveManagerFileId {
  /**
   * Validate if a string is a valid Google Drive File ID (format check only).
   *
   * @param {string} fileId - The File ID to validate.
   * @returns {boolean} True if the format is valid, false otherwise.
   */
  isValidGoogleDriveFileId(fileId) {
    // Define the regex for a valid google drive file id.
    const fileIdRegex = /^[\w-]{33,44}$/u;
    // Test if the passed string matches the regex and return the result.
    return fileIdRegex.test(fileId);
  }

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
    Validate.requireParams({ urlOrId }, 'normaliseToFileId');

    const input = String(urlOrId).trim();

    // Fast path: if it's already a valid file ID, return it unchanged.
    if (this.isValidGoogleDriveFileId(input)) {
      return input;
    }

    // Attempt to extract ID from URL patterns.
    // Pattern 1: /d/{id}/ or /d/{id}/edit or /d/{id}/view etc.
    const pathMatch = /\/d\/([\w-]{33,44})/u.exec(input);
    if (pathMatch?.[1]) {
      const extractedId = pathMatch[1];
      if (this.isValidGoogleDriveFileId(extractedId)) {
        return extractedId;
      }
    }

    // Pattern 2: ?id={id} or open?id={id}
    const queryMatch = /[&?]id=([\w-]{33,44})/u.exec(input);
    if (queryMatch?.[1]) {
      const extractedId = queryMatch[1];
      if (this.isValidGoogleDriveFileId(extractedId)) {
        return extractedId;
      }
    }

    // If we reach here, the input is neither a valid ID nor a recognised URL.
    ProgressTracker.getInstance().logError('Invalid Google Drive URL or file ID provided.', {
      input: urlOrId,
    });
    throw new Error(
      `Invalid Google Drive URL or file ID: "${urlOrId}". Please provide a valid URL or file ID.`
    );
  }
}

// Export for Node tests / CommonJS environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DriveManagerFileId;
}
