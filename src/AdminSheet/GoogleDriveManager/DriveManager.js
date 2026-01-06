/**
 * Handles Drive-related operations.
 */
class DriveManager {
  static moveFiles(destinationFolderId, fileIds, appendString = '') {
    Validate.requireParams({ destinationFolderId }, 'moveFiles');

    const details = [];
    let successCount = 0;
    let failCount = 0;

    // If no files are provided
    if (!fileIds || fileIds.length === 0) {
      const noFilesMsg = 'No file IDs provided; nothing to move.';
      ABLogger.getInstance().info(noFilesMsg);
      return {
        status: 'none',
        message: noFilesMsg,
        details,
      };
    }

    // Validate the destination folder exists (fail fast).
    DriveManager._validateFolderExists(destinationFolderId);

    // Use the Advanced Drive API for moving so this works on Shared Drives as well.
    // DriveApp parent manipulation (removeFile/addFile) is unreliable for Shared Drives.
    fileIds.forEach((fileId) => {
      try {
        const file = Drive.Files.get(fileId, {
          supportsAllDrives: true,
          fields: 'name,parents',
        });

        const currentName = file?.name ? file.name : '';

        // Optionally append a string to the file name.
        if (appendString) {
          Drive.Files.update({ name: `${currentName}${appendString}` }, fileId, null, {
            supportsAllDrives: true,
          });
        }

        const parentIds = Array.isArray(file?.parents) ? file.parents : [];
        const normalisedParentIds = parentIds.filter((id) => typeof id === 'string' && id);
        const alreadyInDestination = normalisedParentIds.includes(destinationFolderId);
        const parentsToRemove = normalisedParentIds.filter((id) => id !== destinationFolderId);

        // Only attempt a parent update if needed.
        if (!alreadyInDestination || parentsToRemove.length > 0) {
          const updateArgs = {
            supportsAllDrives: true,
          };

          if (!alreadyInDestination) {
            updateArgs.addParents = destinationFolderId;
          }
          if (parentsToRemove.length > 0) {
            updateArgs.removeParents = parentsToRemove.join(',');
          }

          Drive.Files.update({}, fileId, null, updateArgs);
        }

        const successMsg = `File ${fileId} moved to folder ${destinationFolderId} successfully.`;
        ABLogger.getInstance().info(successMsg);
        details.push({
          fileId,
          status: 'moved',
          message: successMsg,
        });
        successCount++;
      } catch (error) {
        const failMsg = `Failed to move file ${fileId}: ${error.message}`;
        ABLogger.getInstance().error(failMsg, error);
        details.push({
          fileId,
          status: 'failed',
          message: failMsg,
        });
        failCount++;
      }
    });

    // Determine final overall status
    const overallStatus = failCount === 0 ? 'complete' : 'partial';

    const overallMsg = `Moved ${successCount} file(s) successfully, ${failCount} failed.`;
    ABLogger.getInstance().info(overallMsg);

    return {
      status: overallStatus, // 'complete', 'partial', or 'none'
      message: overallMsg,
      details,
    };
  }
  static copyTemplateSheet(templateSheetId, destinationFolderId, newSheetName) {
    Validate.requireParams({ templateSheetId, newSheetName }, 'copyTemplateSheet');

    try {
      // Use Advanced Drive API for Shared Drive compatibility.
      // DriveApp.getFolderById / folder iterators can fail in Shared Drive contexts.
      if (!destinationFolderId) {
        const templateMeta = Drive.Files.get(templateSheetId, {
          supportsAllDrives: true,
          fields: 'parents',
        });
        destinationFolderId = Array.isArray(templateMeta?.parents) ? templateMeta.parents[0] : null;
      }

      Validate.requireParams({ destinationFolderId }, 'copyTemplateSheet');

      // Validate the destination folder exists (fail fast).
      DriveManager._validateFolderExists(destinationFolderId);

      const escapedName = String(newSheetName).replaceAll("'", String.raw`\\'`);
      const query =
        `'${destinationFolderId}' in parents and trashed = false ` + `and name = '${escapedName}'`;

      const existing = Drive.Files.list({
        q: query,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        fields: 'files(id,name)',
        pageSize: 1,
      });

      if (existing?.files?.length > 0) {
        const existingFileId = existing.files[0].id;
        const message = `File with the name "${newSheetName}" already exists. Skipping copy.`;
        ABLogger.getInstance().info(message);
        return {
          status: 'skipped',
          file: null,
          fileId: existingFileId,
          message,
        };
      }

      const copied = Drive.Files.copy(
        {
          name: newSheetName,
          parents: [destinationFolderId],
        },
        templateSheetId,
        { supportsAllDrives: true }
      );

      const successMsg = `Template sheet copied successfully. Copied sheet ID: ${copied.id}`;
      ABLogger.getInstance().info(successMsg);

      return {
        status: 'copied',
        file: null,
        fileId: copied.id,
        message: successMsg,
      };
    } catch (error) {
      ABLogger.getInstance().error('Failed to copy template sheet', {
        templateSheetId,
        destinationFolderId,
        newSheetName,
        err: error,
      });
      throw error;
    }
  }

  /**
   * Validates that a folder exists and is accessible.
   * @param {string} folderId - The folder ID to validate.
   * @throws {Error} If folder cannot be accessed.
   * @private
   */
  static _validateFolderExists(folderId) {
    try {
      Drive.Files.get(folderId, { supportsAllDrives: true, fields: 'id' });
    } catch (error) {
      const failMsg = `Failed to access folder with ID "${folderId}".`;
      ProgressTracker.getInstance().logError(failMsg, { folderId, err: error });
      const err = new Error(failMsg);
      err.cause = error;
      throw err;
    }
  }

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
  static shareFolder(destinationFolderId, emails) {
    Validate.requireParams({ destinationFolderId }, 'shareFolder');

    const details = [];
    let successCount = 0;
    let failCount = 0;

    if (!emails || emails.size === 0) {
      const noEmailsMsg = 'No emails provided; nothing to share.';
      ABLogger.getInstance().info(noEmailsMsg);
      return {
        status: 'none',
        message: noEmailsMsg,
        details,
      };
    }

    // Validate the folder exists (fail fast).
    DriveManager._validateFolderExists(destinationFolderId);

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
          const failMsg = `Failed to share folder with ${email}: ${error.message}`;
          ABLogger.getInstance().error(failMsg, error);

          details.push({
            email,
            status: 'failed',
            message: failMsg,
          });
          failCount++;
        }
      });
    } catch (error) {
      ABLogger.getInstance().error('Failed to get folder or share with emails', error);
      throw error;
    }

    const overallStatus = failCount === 0 ? 'complete' : 'partial';
    const overallMsg = `Shared folder with ${successCount} email(s) successfully, ${failCount} failed.`;
    ABLogger.getInstance().info(overallMsg);

    return {
      status: overallStatus,
      message: overallMsg,
      details,
    };
  }

  /**
   * Retrieves the first parent folder ID of a given file.
   * @param {string} fileId - The ID of the file to check.
   * @returns {string | null} The parent folder ID, or null if none is found.
   * @throws {Error} If fileId is not provided.
   */
  static getParentFolderId(fileId) {
    Validate.requireParams({ fileId }, 'getParentFolderId');

    const driveAppParent = DriveManager._getParentViaDriveApp(fileId);
    if (driveAppParent) {
      return driveAppParent;
    }

    return DriveManager._getParentViaDriveApi(fileId);
  }

  static _getParentViaDriveApp(fileId) {
    const retries = 3;
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
        const waitMs = 500 * Math.pow(2, attempt);
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

  static _getParentViaDriveApi(fileId) {
    const fields = 'parents,driveId';
    try {
      const res = Drive.Files.get(fileId, { supportsAllDrives: true, fields });

      if (res?.parents?.length > 0) {
        const parentId = res.parents[0];
        ABLogger.getInstance().info(
          `Parent folder ID retrieved via Drive API for file ${fileId}: ${parentId}`
        );
        return parentId;
      }

      if (res?.driveId) {
        ABLogger.getInstance().info(
          `File ${fileId} appears to be in Shared Drive root. Using driveId as parent: ${res.driveId}`
        );
        return res.driveId;
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
   * @param {string} parentFolderId - The ID of the parent folder.
   * @param {string} folderName - The name for the new folder.
   * @returns {{ parentFolderId: string, newFolderId: string }}
   *          An object containing the parent folder ID and the folder ID (existing or newly created).
   * @throws {Error} If parentFolderId or folderName is not provided.
   */
  static createFolder(parentFolderId, folderName) {
    Validate.requireParams({ parentFolderId, folderName }, 'createFolder');

    // Validate the parent folder exists (fail fast).
    DriveManager._validateFolderExists(parentFolderId);

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

  /**
   * Validates if a string is a valid Google Drive File ID (format check only).
   * @param {string} fileId - The File ID to validate.
   * @return {boolean} - True if the format is valid, false otherwise.
   */
  static isValidGoogleDriveFileId(fileId) {
    // Define the regex for a valid google drive file id.
    const fileIdRegex = /^[a-zA-Z0-9_-]{33,44}$/;
    // Test if the passed string matches the regex and return the result.
    return fileIdRegex.test(fileId);
  }

  /**
   * Fetch the last modified timestamp for a Drive file with retries and Shared Drive fallback.
   * @param {string} fileId - Drive file ID.
   * @return {string} ISO 8601 timestamp of the file's last modified time.
   * @throws {Error} If fileId is not provided or file cannot be accessed.
   */
  static getFileModifiedTime(fileId) {
    const progressTracker = ProgressTracker.getInstance();

    if (!fileId) {
      progressTracker.logAndThrowError('fileId is required for getFileModifiedTime');
    }

    const baseWaitMs = 500;
    const retries = 3;

    try {
      return DriveManager._fetchModifiedTimeViaDriveApp(fileId, retries, baseWaitMs);
    } catch (appError) {
      ABLogger.getInstance().debug('DriveApp failed, trying Drive API', appError);
      try {
        return DriveManager._fetchModifiedTimeViaDriveApi(fileId, retries, baseWaitMs);
      } catch (apiError) {
        progressTracker.logError('Failed to fetch file modified time', {
          fileId,
          err: apiError,
        });
        throw apiError;
      }
    }
  }

  static _fetchModifiedTimeViaDriveApp(fileId, retries, baseWaitMs) {
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
          const wait = baseWaitMs * Math.pow(2, attempt);
          Utilities.sleep(wait);
          continue;
        }
        throw error;
      }
    }
    throw new Error('Unable to fetch modified time via DriveApp');
  }

  static _fetchModifiedTimeViaDriveApi(fileId, retries, baseWaitMs) {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const res = Drive.Files.get(fileId, { supportsAllDrives: true, fields: 'modifiedTime' });
        if (!res?.modifiedTime) {
          throw new TypeError('Advanced Drive API did not return modifiedTime');
        }
        const parsed = new Date(res.modifiedTime);
        if (Number.isNaN(parsed.getTime())) {
          throw new TypeError(`Invalid modifiedTime format for file ${fileId}`);
        }
        return parsed.toISOString();
      } catch (error) {
        if (attempt < retries - 1) {
          const wait = baseWaitMs * Math.pow(2, attempt);
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
if (typeof module !== 'undefined') {
  module.exports = DriveManager;
}
