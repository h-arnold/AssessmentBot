/**
 * DriveManagerFileOperations
 *
 * Handles Drive file-level operations: moving files into destination folders
 * and copying template sheets with duplicate-name detection.
 */
class DriveManagerFileOperations {
  /**
   * Creates the instance with injected dependencies.
   *
   * @param {Object} deps - Dependency injection.
   * @param {Object} deps.folderValidator - DriveManagerFolderValidator instance.
   */
  constructor({ folderValidator }) {
    this._folderValidator = folderValidator;
  }

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
    Validate.requireParams({ destinationFolderId }, 'moveFiles');

    const details = [];
    let successCount = 0;
    let failCount = 0;

    // If no files are provided
    if (!fileIds || fileIds.length === 0) {
      const noFilesMessage = 'No file IDs provided; nothing to move.';
      ABLogger.getInstance().info(noFilesMessage);
      return {
        status: 'none',
        message: noFilesMessage,
        details,
      };
    }

    // Validate the destination folder exists (fail fast).
    this._folderValidator.validateFolderExists(destinationFolderId);

    // Use the Advanced Drive API for moving so this works on Shared Drives as well.
    // DriveApp parent manipulation (removeFile/addFile) is unreliable for Shared Drives.
    fileIds.forEach((fileId) => {
      try {
        const file = Drive.Files.get(fileId, {
          supportsAllDrives: true,
          fields: 'name,parents',
        });

        const currentName = file?.name || '';

        // Optionally append a string to the file name.
        if (appendString) {
          Drive.Files.update({ name: `${currentName}${appendString}` }, fileId, null, {
            supportsAllDrives: true,
          });
        }

        const parentIds = Array.isArray(file?.parents) ? file.parents : [];
        const normalisedParentIds = parentIds.filter((id) => Validate.isString(id) && id);
        const alreadyInDestination = normalisedParentIds.includes(destinationFolderId);
        const parentsToRemove = normalisedParentIds.filter((id) => id !== destinationFolderId);

        // Only attempt a parent update if needed.
        if (!alreadyInDestination || parentsToRemove.length > 0) {
          const updateArguments = {
            supportsAllDrives: true,
          };

          if (!alreadyInDestination) {
            updateArguments.addParents = destinationFolderId;
          }
          if (parentsToRemove.length > 0) {
            updateArguments.removeParents = parentsToRemove.join(',');
          }

          Drive.Files.update({}, fileId, null, updateArguments);
        }

        const successMessage = `File ${fileId} moved to folder ${destinationFolderId} successfully.`;
        ABLogger.getInstance().info(successMessage);
        details.push({
          fileId,
          status: 'moved',
          message: successMessage,
        });
        successCount++;
      } catch (error) {
        const failMessage = `Failed to move file ${fileId}: ${error.message}`;
        ABLogger.getInstance().error(failMessage, error);
        details.push({
          fileId,
          status: 'failed',
          message: failMessage,
        });
        failCount++;
      }
    });

    // Determine final overall status
    const overallStatus = failCount === 0 ? 'complete' : 'partial';

    const overallMessage = `Moved ${successCount} file(s) successfully, ${failCount} failed.`;
    ABLogger.getInstance().info(overallMessage);

    return {
      status: overallStatus, // 'complete', 'partial', or 'none'
      message: overallMessage,
      details,
    };
  }

  /**
   * Copy a template sheet to a destination folder, optionally checking for existing files.
   * If a file with the same name already exists, returns its ID without copying.
   *
   * @param {string} templateSheetId - The ID of the template sheet to copy.
   * @param {string} destinationFolderId - The ID of the destination folder. If not provided, uses the template's parent folder.
   * @param {string} newSheetName - The name for the copied sheet.
   * @returns {{status: 'copied'|'skipped', file: null, fileId: string, message: string}} An object with copy status, file ID, and message.
   * @throws {Error} If templateSheetId or newSheetName is not provided, or destination folder cannot be accessed.
   */
  copyTemplateSheet(templateSheetId, destinationFolderId, newSheetName) {
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
      this._folderValidator.validateFolderExists(destinationFolderId);

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

      const successMessage = `Template sheet copied successfully. Copied sheet ID: ${copied.id}`;
      ABLogger.getInstance().info(successMessage);

      return {
        status: 'copied',
        file: null,
        fileId: copied.id,
        message: successMessage,
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
}

// Export for Node tests / CommonJS environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DriveManagerFileOperations;
}
