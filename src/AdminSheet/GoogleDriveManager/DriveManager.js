/**
 * Handles Drive-related operations.
 */
class DriveManager {
  /**
   * Copies a template sheet to the destination folder with a new name.
   * If a file with the same name already exists, the method skips copying.
   * @param {string} templateSheetId - The ID of the template sheet.
   * @param {string} destinationFolderId - The ID of the destination folder.
   * @param {string} newSheetName - The new name for the copied sheet.
   * @returns {{
   *   status: 'copied' | 'skipped',
   *   file: GoogleAppsScript.Drive.File | null,
   *   fileId: string | null,
   *   message: string
   * }} An object describing the outcome.
   * 
   * Possible statuses:
   *   - 'copied': The file was copied successfully.
   *   - 'skipped': A file with the same name already exists; nothing was copied.
   */
  static copyTemplateSheet(templateSheetId, destinationFolderId, newSheetName) {
    try {
      const templateSheetFile = DriveApp.getFileById(templateSheetId);
      const destinationFolder = DriveApp.getFolderById(destinationFolderId);

      // Check if a file with the same name exists in the destination folder
      const filesInFolder = destinationFolder.getFilesByName(newSheetName);
      if (filesInFolder.hasNext()) {
        const existingFile = filesInFolder.next();
        const message = `File with the name "${newSheetName}" already exists. Skipping copy.`;
        console.log(message);
        return {
          status: 'skipped',
          file: existingFile,
          fileId: existingFile.getId(),
          message
        };
      }

      // Proceed to copy the template sheet
      const copiedSheetFile = templateSheetFile.makeCopy(newSheetName, destinationFolder);
      const successMsg = `Template sheet copied successfully. Copied sheet ID: ${copiedSheetFile.getId()}`;
      console.log(successMsg);

      return {
        status: 'copied',
        file: copiedSheetFile,
        fileId: copiedSheetFile.getId(),
        message: successMsg
      };
    } catch (error) {
      console.error(`Failed to copy template sheet: ${error.message}`);
      throw error;
      // or return { status: 'error', file: null, fileId: null, message: error.message };
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
   * 
   * Possible statuses:
   *   - 'complete': All emails were shared successfully.
   *   - 'partial': Some emails succeeded, some failed.
   *   - 'none': No emails were processed (e.g., if the set is empty).
   */
  static shareFolder(destinationFolderId, emails) {
    // Prepare a results array to store each email's outcome
    const details = [];
    let successCount = 0;
    let failCount = 0;

    if (!emails || emails.size === 0) {
      const noEmailsMsg = 'No emails provided; nothing to share.';
      console.log(noEmailsMsg);
      return {
        status: 'none',
        message: noEmailsMsg,
        details
      };
    }

    try {
      const destinationFolder = DriveApp.getFolderById(destinationFolderId);

      emails.forEach(email => {
        try {
          destinationFolder.addEditor(email);
          console.log(`Shared destination folder with: ${email}`);

          details.push({
            email,
            status: 'shared',
            message: `Successfully shared with ${email}`
          });
          successCount++;
        } catch (error) {
          const failMsg = `Failed to share folder with ${email}: ${error.message}`;
          console.error(failMsg);

          details.push({
            email,
            status: 'failed',
            message: failMsg
          });
          failCount++;
        }
      });
    } catch (error) {
      console.error(`Failed to access destination folder: ${error.message}`);
      throw error;
    }

    // Determine final overall status
    let overallStatus = 'complete';
    if (successCount === 0 && failCount > 0) {
      // Everything failed
      overallStatus = 'partial';
    } else if (successCount > 0 && failCount > 0) {
      // Some succeeded, some failed
      overallStatus = 'partial';
    }

    const overallMsg = `Shared folder with ${successCount} email(s) successfully, ${failCount} failed.`;
    console.log(overallMsg);

    return {
      status: overallStatus, // 'complete', 'partial', or 'none'
      message: overallMsg,
      details
    };
  }

  /**
   * Retrieves the first parent folder ID of a given file.
   * @param {string} fileId - The ID of the file to check.
   * @returns {string | null} The parent folder ID, or null if none is found.
   */
  static getParentFolderId(fileId) {
    // Try DriveApp first; if it fails (e.g., Shared Drives quirk) fall back to Advanced Drive API
    const retries = 3;
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const file = DriveApp.getFileById(fileId);
        const parentIterator = file.getParents();

        if (parentIterator.hasNext()) {
          const parentFolder = parentIterator.next();
          const parentId = parentFolder.getId();
          console.log(`Parent folder ID for file ${fileId}: ${parentId}`);
          return parentId;
        }
        // No parents via DriveApp (can happen for orphaned files or Shared Drive root)
        console.log(`No parents found via DriveApp for ${fileId}; attempting Advanced Drive API...`);
        break; // proceed to fallback
      } catch (error) {
        const waitMs = 500 * Math.pow(2, attempt);
        console.warn(`DriveApp.getParents() attempt ${attempt + 1} failed for ${fileId}: ${error.message}${attempt < retries - 1 ? `; retrying in ${waitMs}ms` : ''}`);
        if (attempt < retries - 1) {
          Utilities.sleep(waitMs);
          continue;
        }
      }
    }

    // Fallback: Advanced Drive API (supportsAllDrives) to handle Shared Drives
    try {
      const fields = 'parents,driveId';
      const res = Drive.Files.get(fileId, { supportsAllDrives: true, fields });

      if (res && res.parents && res.parents.length > 0) {
        const parentId = res.parents[0];
        console.log(`Parent folder ID retrieved via Drive API for file ${fileId}: ${parentId}`);
        return parentId;
      }

      // If on a Shared Drive root, use the driveId as the parent folder id
      if (res && res.driveId) {
        console.log(`File ${fileId} appears to be in Shared Drive root. Using driveId as parent: ${res.driveId}`);
        return res.driveId;
      }

      // Last resort: use user's My Drive root
      const rootId = DriveApp.getRootFolder().getId();
      console.log(`Falling back to My Drive root as parent for ${fileId}: ${rootId}`);
      return rootId;
    } catch (fallbackError) {
      console.error(`Advanced Drive API fallback failed for ${fileId}: ${fallbackError.message}`);
      // As a final fallback, try My Drive root to avoid hard failure
      try {
        const rootId = DriveApp.getRootFolder().getId();
        console.log(`Returning My Drive root as last-resort parent for ${fileId}: ${rootId}`);
        return rootId;
      } catch (rootErr) {
        console.error(`Failed to obtain My Drive root folder ID: ${rootErr.message}`);
        throw fallbackError; // bubble original meaningful error
      }
    }
  }

  /**
   * Creates a folder inside a parent folder if it doesn't already exist.
   * If a folder with the same name exists, returns its ID instead.
   * @param {string} parentFolderId - The ID of the parent folder.
   * @param {string} folderName - The name for the new folder.
   * @returns {{ parentFolderId: string, folderId: string }}
   *          An object containing the parent folder ID and the folder ID (existing or newly created).
   */
  static createFolder(parentFolderId, folderName) {
    try {
      const parentFolder = DriveApp.getFolderById(parentFolderId);
      const folders = parentFolder.getFoldersByName(folderName);

      if (folders.hasNext()) {
        const existingFolder = folders.next();
        console.log(`Folder "${folderName}" already exists under parent folder ID ${parentFolderId}. Returning existing folder ID.`);
        return {
          parentFolderId,
          newFolderId: existingFolder.getId()
        };
      }

      const newFolder = parentFolder.createFolder(folderName);
      console.log(`Folder "${folderName}" created under parent folder ID ${parentFolderId}.`);
      return {
        parentFolderId,
        newFolderId: newFolder.getId()
      };
    } catch (error) {
      console.error(`Failed to create folder "${folderName}" under folder ID ${parentFolderId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Moves one or more files into a specified folder. Optionally appends a string to each file's name.
   * @param {string} destinationFolderId - The ID of the folder to move the files to.
   * @param {string[]} fileIds - An array of file IDs to move.
   * @param {string} [appendString=''] - Optional string to append to the file name.
   * @returns {{
   *   status: 'complete' | 'partial' | 'none',
   *   message: string,
   *   details: Array<{
   *     fileId: string,
   *     status: 'moved' | 'failed',
   *     message: string
   *   }>
   * }} An object describing the overall result of the move operation.
   */
  static moveFiles(destinationFolderId, fileIds, appendString = '') {
    const details = [];
    let successCount = 0;
    let failCount = 0;

    // If no files are provided
    if (!fileIds || fileIds.length === 0) {
      const noFilesMsg = 'No file IDs provided; nothing to move.';
      console.log(noFilesMsg);
      return {
        status: 'none',
        message: noFilesMsg,
        details
      };
    }

    let destinationFolder;
    try {
      destinationFolder = DriveApp.getFolderById(destinationFolderId);
    } catch (error) {
      // If we can't even access the destination folder, bail out
      const failMsg = `Failed to access destination folder: ${error.message}`;
      console.error(failMsg);
      throw error;
    }

    fileIds.forEach(fileId => {
      try {
        const file = DriveApp.getFileById(fileId);

        // Optionally append a string to the file name
        if (appendString) {
          const originalName = file.getName();
          const newName = `${originalName}${appendString}`;
          file.setName(newName);
        }

        // Remove from all existing parents
        const parentFolders = file.getParents();
        while (parentFolders.hasNext()) {
          const oldParent = parentFolders.next();
          oldParent.removeFile(file);
        }

        // Add to the new folder
        destinationFolder.addFile(file);

        const successMsg = `File ${fileId} moved to folder ${destinationFolderId} successfully.`;
        console.log(successMsg);
        details.push({
          fileId,
          status: 'moved',
          message: successMsg
        });
        successCount++;
      } catch (error) {
        const failMsg = `Failed to move file ${fileId}: ${error.message}`;
        console.error(failMsg);
        details.push({
          fileId,
          status: 'failed',
          message: failMsg
        });
        failCount++;
      }
    });

    // Determine final overall status
    let overallStatus = 'complete';
    if (successCount === 0 && failCount > 0) {
      // Everything failed
      overallStatus = 'partial';
    } else if (successCount > 0 && failCount > 0) {
      // Some succeeded, some failed
      overallStatus = 'partial';
    }

    const overallMsg = `Moved ${successCount} file(s) successfully, ${failCount} failed.`;
    console.log(overallMsg);

    return {
      status: overallStatus, // 'complete', 'partial', or 'none'
      message: overallMsg,
      details
    };
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

}

