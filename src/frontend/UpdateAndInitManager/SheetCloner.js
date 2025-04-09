/**
 * SheetCloner Class
 * 
 * This class should only be run from an admin sheet. An error will be thrown if it's run from an assessment record.
 * Manages the process of cloning spreadsheets, including:
 * 1) Creating a copy of a template spreadsheet.
 * 2) Copying all sheets (data & formatting) from a source spreadsheet to the new file.
 * 3) Copying document properties from the source (optional).
 */
class SheetCloner {
  constructor() {

    // Ensure this is only run from the admin sheet. Throws an error if not.   
    Utils.validateIsAdminSheet(true);
  }

  /**
   * Makes a copy of the template spreadsheet in a specific folder with a new name.
   * @param {string} templateSpreadsheetId - The ID of the template spreadsheet.
   * @param {string} newSpreadsheetName - The name for the newly copied spreadsheet.
   * @param {string} [destinationFolderId] - The ID of the folder to place the new copy. If omitted, it goes to My Drive.
   * @returns {GoogleAppsScript.Drive.File} The newly created spreadsheet file.
   */
  static copyTemplateSpreadsheet(templateSpreadsheetId, newSpreadsheetName, destinationFolderId) {
    const templateFile = DriveApp.getFileById(templateSpreadsheetId);

    if (destinationFolderId) {
      // If a destination folder is specified, copy the file into that folder
      const destinationFolder = DriveApp.getFolderById(destinationFolderId);

      // Create a copy with the specified name in the destination folder
      return templateFile.makeCopy(newSpreadsheetName, destinationFolder);
    } else {
      // Otherwise just create a copy in the user's My Drive
      return templateFile.makeCopy(newSpreadsheetName);
    }
  }

  /**
   * Copies all sheets from the source spreadsheet to the target spreadsheet.
   * This preserves data, formatting, conditional formatting rules, notes, etc.
   * @param {string} sourceSpreadsheetId - The ID of the source spreadsheet.
   * @param {string} targetSpreadsheetId - The ID of the target spreadsheet.
   */
  static copyAllSheetsToTarget(sourceSpreadsheetId, targetSpreadsheetId) {
    const source = SpreadsheetApp.openById(sourceSpreadsheetId);
    const target = SpreadsheetApp.openById(targetSpreadsheetId);

    const sourceSheets = source.getSheets();

    sourceSheets.forEach(sheet => {
      const sheetName = sheet.getName();

    
      if (sheetName !== "Sheet1") {

      const newSheet = sheet.copyTo(target);
      // Rename the sheet in the target to match the source (copyTo calls it "Copy of X" by default)
      try {
        newSheet.setName(sheetName);
      } catch (e) {

        // If a sheet of the same name already exists, rename it and then rename the new copy to the correct name.
        if (e.message.indexOf(`already exists. Please enter another name.`) !== -1) {
          const targetSheet = target.getSheetByName(sheetName);
          const date = Utils.getDate();
          targetSheet.setName(`${sheetName} ${date}`);

          newSheet.setName(sheetName)
        } else {
          throw new Error(e.message);
        }
      }
      }
    });
  }


  /**
   * End-to-end method to clone a spreadsheet, including:
   * 1) Copying the template.
   * 2) Copying all sheets from the source spreadsheet into this new template.
   * 3) Copying document properties (optional).
   *
   * @param {Object} params - The parameters encapsulated in a JSON object.
   * @param {string} params.templateSpreadsheetId - The ID of the template to copy.
   * @param {string} params.newSpreadsheetName - The name for the new spreadsheet.
   * @param {string} params.sourceSpreadsheetId - The ID of the spreadsheet whose sheets you want to clone.
   * @param {string} [params.destinationFolderId] - The ID of the folder to place the new copy. Optional.
   * @returns {{ file: GoogleAppsScript.Drive.File, fileId: string }} 
   *     An object with the new file object and its ID.
   */
  static cloneEverything(params) {
    // 1) Copy the template
    const newFile = DriveManager.copyTemplateSheet(
      params.templateSheetId,
      params.destinationFolderId,
      params.newSpreadsheetName
    );

    // 2) Copy all sheets from source into the newly created file
    const newSpreadsheetId = newFile.fileId;
    SheetCloner.copyAllSheetsToTarget(params.sourceSpreadsheetId, newSpreadsheetId);

    return {
      file: newFile,
      fileId: newSpreadsheetId
    };
  }
}