/**
 * DriveManagerFolderOperations
 *
 * Handles Drive folder-level operations: sharing folders with collaborators,
 * resolving a file's parent folder, and creating folders with Shared Drive
 * fallback.
 */
class DriveManagerFolderOperations {
  /**
   * Creates the instance with injected dependencies.
   *
   * @param {Object} deps - Dependency injection.
   * @param {Object} deps.folderValidator - DriveManagerFolderValidator instance.
   * @param {number} deps.retries - Number of parent-resolution retry attempts.
   * @param {number} deps.backoffBaseMs - Base wait, in milliseconds, for exponential backoff.
   * @param {number} deps.backoffMultiplier - Multiplier applied to the base wait per attempt.
   */
  constructor({ folderValidator, retries, backoffBaseMs, backoffMultiplier }) {
    this._folderValidator = folderValidator;
    this._retries = retries;
    this._backoffBaseMs = backoffBaseMs;
    this._backoffMultiplier = backoffMultiplier;
  }

  /**
   * Shares a folder with a list of email addresses, capturing the result for each email.
   *
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
    Validate.requireParams({ destinationFolderId }, 'shareFolder');

    const details = [];
    let successCount = 0;
    let failCount = 0;

    if (!emails || emails.size === 0) {
      const noEmailsMessage = 'No emails provided; nothing to share.';
      ABLogger.getInstance().info(noEmailsMessage);
      return {
        status: 'none',
        message: noEmailsMessage,
        details,
      };
    }

    // Validate the folder exists (fail fast).
    this._folderValidator.validateFolderExists(destinationFolderId);

    try {
      const destinationFolder = DriveApp.getFolderById(destinationFolderId);

      emails.forEach((email) => {
        try {
          destinationFolder.addEditor(email);
          ABLogger.getInstance().info(`Shared destination folder with: ${email}`);

          details.push({
            email,
            status: 'shared',
            message: `Successfully shared with ${email}`,
          });
          successCount++;
        } catch (error) {
          const failMessage = `Failed to share folder with ${email}: ${error.message}`;
          ABLogger.getInstance().error(failMessage, error);

          details.push({
            email,
            status: 'failed',
            message: failMessage,
          });
          failCount++;
        }
      });
    } catch (error) {
      ABLogger.getInstance().error('Failed to get folder or share with emails', error);
      throw error;
    }

    const overallStatus = failCount === 0 ? 'complete' : 'partial';
    const overallMessage = `Shared folder with ${successCount} email(s) successfully, ${failCount} failed.`;
    ABLogger.getInstance().info(overallMessage);

    return {
      status: overallStatus,
      message: overallMessage,
      details,
    };
  }

  /**
   * Retrieves the first parent folder ID of a given file.
   *
   * @param {string} fileId - The ID of the file to check.
   * @returns {string | null} The parent folder ID, or null if none is found.
   * @throws {Error} If fileId is not provided.
   */
  getParentFolderId(fileId) {
    Validate.requireParams({ fileId }, 'getParentFolderId');

    const driveAppParent = this._getParentViaDriveApp(fileId);
    if (driveAppParent) {
      return driveAppParent;
    }

    return this._getParentViaDriveApi(fileId);
  }

  /**
   * Retrieve the parent folder ID of a file using DriveApp with retry logic.
   * Attempts to access the parent via DriveApp, retrying on failure with exponential backoff.
   *
   * @param {string} fileId - The ID of the file to retrieve the parent for.
   * @returns {string|null} The parent folder ID, or null if none is found or all retries fail.
   * @private
   */
  _getParentViaDriveApp(fileId) {
    const retries = this._retries;
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const file = DriveApp.getFileById(fileId);
        const parentIterator = file.getParents();

        if (parentIterator.hasNext()) {
          const parentFolder = parentIterator.next();
          const parentId = parentFolder.getId();
          ABLogger.getInstance().info(`Parent folder ID for file ${fileId}: ${parentId}`);
          return parentId;
        }
        ABLogger.getInstance().info(
          `No parents found via DriveApp for ${fileId}; attempting Advanced Drive API...`
        );
        return null;
      } catch (error) {
        const waitMs = this._backoffBaseMs * Math.pow(this._backoffMultiplier, attempt);
        ABLogger.getInstance().warn(
          `DriveApp.getParents() attempt ${attempt + 1} failed for ${fileId}: ${error.message}${
            attempt < retries - 1 ? `; retrying in ${waitMs}ms` : ''
          }`,
          error
        );
        if (attempt < retries - 1) {
          Utilities.sleep(waitMs);
        }
      }
    }

    return null;
  }

  /**
   * Retrieve the parent folder ID of a file using the Advanced Drive API with fallback logic.
   * Falls back to Shared Drive root or My Drive root if needed.
   *
   * @param {string} fileId - The ID of the file to retrieve the parent for.
   * @returns {string} The parent folder ID (API response, Shared Drive root, or My Drive root).
   * @throws {Error} If all fallback attempts fail.
   * @private
   */
  _getParentViaDriveApi(fileId) {
    const fields = 'parents,driveId';
    try {
      const response = Drive.Files.get(fileId, { supportsAllDrives: true, fields });

      if (response?.parents?.length > 0) {
        const parentId = response.parents[0];
        ABLogger.getInstance().info(
          `Parent folder ID retrieved via Drive API for file ${fileId}: ${parentId}`
        );
        return parentId;
      }

      if (response?.driveId) {
        ABLogger.getInstance().info(
          `File ${fileId} appears to be in Shared Drive root. Using driveId as parent: ${response.driveId}`
        );
        return response.driveId;
      }

      const rootId = DriveApp.getRootFolder().getId();
      ABLogger.getInstance().info(
        `Falling back to My Drive root as parent for ${fileId}: ${rootId}`
      );
      return rootId;
    } catch (apiError) {
      ABLogger.getInstance().error('Advanced Drive API fallback failed', { fileId, err: apiError });
      try {
        const rootId = DriveApp.getRootFolder().getId();
        ABLogger.getInstance().info(
          `Returning My Drive root as last-resort parent for ${fileId}: ${rootId}`
        );
        return rootId;
      } catch (rootError) {
        ABLogger.getInstance().error('Failed to obtain My Drive root folder ID', rootError);
        throw apiError;
      }
    }
  }

  /**
   * Creates a folder inside a parent folder if it doesn't already exist.
   * If a folder with the same name exists, returns its ID instead.
   *
   * @param {string} parentFolderId - The ID of the parent folder.
   * @param {string} folderName - The name for the new folder.
   * @returns {{ parentFolderId: string, newFolderId: string }}
   *          An object containing the parent folder ID and the folder ID (existing or newly created).
   * @throws {Error} If parentFolderId or folderName is not provided.
   */
  createFolder(parentFolderId, folderName) {
    Validate.requireParams({ parentFolderId, folderName }, 'createFolder');

    // Validate the parent folder exists (fail fast).
    this._folderValidator.validateFolderExists(parentFolderId);

    try {
      const parentFolder = DriveApp.getFolderById(parentFolderId);
      const folders = parentFolder.getFoldersByName(folderName);

      if (folders.hasNext()) {
        const existingFolder = folders.next();
        ABLogger.getInstance().info(
          `Folder "${folderName}" already exists under parent folder ID ${parentFolderId}. Returning existing folder ID.`
        );
        return {
          parentFolderId,
          newFolderId: existingFolder.getId(),
        };
      }

      const newFolder = parentFolder.createFolder(folderName);
      ABLogger.getInstance().info(
        `Folder "${folderName}" created under parent folder ID ${parentFolderId}.`
      );
      return {
        parentFolderId,
        newFolderId: newFolder.getId(),
      };
    } catch (error) {
      // DriveApp folder operations can fail for Shared Drives (notably when parentFolderId is a Shared Drive root).
      // Fall back to the Advanced Drive API which supports Shared Drives when supportsAllDrives is enabled.
      ABLogger.getInstance().warn('DriveApp createFolder failed; falling back to Drive API', {
        parentFolderId,
        folderName,
        err: error,
      });

      const escapedFolderName = String(folderName).replaceAll("'", String.raw`\\'`);
      const query =
        `'${parentFolderId}' in parents and trashed = false ` +
        `and mimeType = 'application/vnd.google-apps.folder' ` +
        `and name = '${escapedFolderName}'`;

      try {
        const existing = Drive.Files.list({
          q: query,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
          fields: 'files(id,name)',
          pageSize: 1,
        });

        if (existing?.files?.length > 0) {
          return {
            parentFolderId,
            newFolderId: existing.files[0].id,
          };
        }

        const created = Drive.Files.create(
          {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentFolderId],
          },
          null,
          { supportsAllDrives: true }
        );

        return {
          parentFolderId,
          newFolderId: created.id,
        };
      } catch (apiError) {
        ABLogger.getInstance().error('Drive API createFolder fallback failed', {
          parentFolderId,
          folderName,
          err: apiError,
        });
        throw apiError;
      }
    }
  }
}

// Export for Node tests / CommonJS environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DriveManagerFolderOperations;
}
