// 0BaseSheetManager.gs
// Note - BaseSheetManager needs a leading 0 in the filename to ensure that you don't get a reference error as AnalysisSheetManager depends on it. It appears that Google App Script concatenates all the script files before execution so the order in which the files are shown matters.

/**
 * BaseSheetManager Class
 *
 * Provides common methods for sheet manipulation.
 * @param {Object} [sheet=null] - Optional sheet object to initialize with.
 */
class BaseSheetManager {
  constructor(sheet = null, spreadSheetId = null) {
    // If a string is passed, create or get the sheet name
    if (typeof sheet === 'string') {
      this.createOrGetSheet(sheet, spreadSheetId)
    } else {
      // If it isn't use the passed sheet object.
      this.sheet = sheet;
    }

    this.requests = [];
  }

  /**
   * Creates or retrieves a sheet with the given name.
   * @param {string} sheetName - The name of the sheet.
   * @param {string} [spreadsheetId] - Optional ID of the spreadsheet to create the sheet in.
   *                             If not provided, uses the active spreadsheet.
   */
  createOrGetSheet(sheetName, spreadsheetId) {
    let spreadsheet;
    if (spreadsheetId) {
      spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    } else {
      spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    }

    this.sheet = spreadsheet.getSheetByName(sheetName);

    if (!this.sheet) {
      this.sheet = spreadsheet.insertSheet(sheetName);
    } else {
      // Clear existing content and formatting
      // this.clearSheet() // temporarily removed as it broke the GoogleClassroomManager.createAssessmentRecord() method. This change may break other things. 
    }
  }

  /**
   * Clears the content and formatting of the sheet.
   */
  clearSheet() {
    this.sheet.clear();
    this.sheet.clearFormats();
    this.sheet.clearNotes();
    this.sheet.clearConditionalFormatRules();
  }

  /**
   * Ensures the sheet has enough columns to accommodate the data.
   * @param {number} requiredColumns - The number of columns required.
   */
  ensureSheetHasEnoughColumns(requiredColumns) {
    const sheetId = this.sheet.getSheetId();
    const currentColumns = this.sheet.getMaxColumns();
    if (currentColumns < requiredColumns) {
      this.requests.push({
        appendDimension: {
          sheetId: sheetId,
          dimension: "COLUMNS",
          length: requiredColumns - currentColumns
        }
      });
    }
  }

  /**
   * Creates a request to set header values in the sheet.
   * @param {number} sheetId - The ID of the sheet.
   * @param {Array<string>} headers - The header values to set.
   * @param {number} rowIndex - The row index to start setting the header values.
   * @return {Object} - A request to update cells with header values.
   */
  createHeaderValuesRequest(sheetId, headers, rowIndex) {
    return {
      updateCells: {
        rows: [
          {
            values: headers.map(header => ({ userEnteredValue: { stringValue: header } }))
          }
        ],
        fields: 'userEnteredValue',
        start: { sheetId: sheetId, rowIndex: rowIndex, columnIndex: 0 }
      }
    };
  }

/**
 * Creates a header formatting request with custom formatting options and column range.
 *
 * @param {number} sheetId - The ID of the sheet.
 * @param {number} startRowIndex - The starting row index for formatting.
 * @param {number} endRowIndex - The ending row index for formatting.
 * @param {Object} [formatOptions={}] - Additional formatting options to override defaults.
 *        Allowed options include:
 *          - wordWrap (boolean): true to wrap text; false for overflow.
 *          - horizontalAlignment (string): e.g. "CENTER", "LEFT", "RIGHT".
 *          - verticalAlignment (string): e.g. "TOP", "MIDDLE", "BOTTOM"
 *          - autoResize (boolean): true to auto resize column widths.
 *          - textRotation (object): e.g. { angle: 45 } to rotate text.
 * @param {number} startColumnIndex - The starting column index for formatting.
 * @param {number} endColumnIndex - The ending column index for formatting.
 * @returns {Array<Object>} - An array with one (or more) formatting request objects.
 */
createHeaderFormattingRequest(sheetId, startRowIndex, endRowIndex, formatOptions = {}, startColumnIndex, endColumnIndex) {


  // Set default formatting values except for column autoResize as that's a separate request

  const backgroundColor =  { red: 0.9, green: 0.9, blue: 0.9 }
  const horizontalAlignment = formatOptions.horizontalAlignment || "CENTER"
  const verticalAlignment= formatOptions.verticalAlignment || "MIDDLE" 
  const textFormat = { bold: true }
  const textRotation =  formatOptions.textRotation || { angle: 0 }
  let wrapStrategy;

  // Adjust the wrap strategy if wordWrap is provided.
  if (!formatOptions.wordWrap) {
    wrapStrategy = "OVERFLOW_CELL";
  } else {
    wrapStrategy = "WRAP";
  }
  

  // Create the formatting object

  let finalFormat = {
    backgroundColor: backgroundColor,
    horizontalAlignment: horizontalAlignment,
    verticalAlignment: verticalAlignment,
    textFormat: textFormat,
    textRotation: textRotation,
    wrapStrategy: wrapStrategy
  }



  
  // Build the main repeatCell request using the specified range.
  const repeatCellRequest = {
    repeatCell: {
      range: {
        sheetId: sheetId,
        startRowIndex: startRowIndex,
        endRowIndex: endRowIndex,
        startColumnIndex: startColumnIndex,
        endColumnIndex: endColumnIndex
      },
      cell: {
        userEnteredFormat: finalFormat
      },
      fields: "userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat,textRotation,wrapStrategy)"
    }
  };
  
  // Initialise requests array with the repeatCell request.
  const requests = [repeatCellRequest];
  
  // If autoResize is true, add an additional request to auto-resize the columns.
  if (formatOptions.autoResize) {
    const autoResizeRequest = {
      autoResizeDimensions: {
        dimensions: {
          sheetId: sheetId,
          dimension: "COLUMNS",
          startIndex: startColumnIndex,
          endIndex: endColumnIndex
        }
      }
    };
    requests.push(autoResizeRequest);
  }
  
  return requests;
}



  /**
   * Creates requests to set column widths in the sheet.
   * @param {number} sheetId - The ID of the sheet.
   * @param {Array<number>} columnWidths - The widths of the columns to set.
   * @returns {Array<Object>} - An array of requests to update column widths.
   */
  createColumnWidthRequests(sheetId, columnWidths) {
    const requests = [];
    columnWidths.forEach((width, index) => {
      requests.push({
        updateDimensionProperties: {
          range: {
            sheetId: sheetId,
            dimension: "COLUMNS",
            startIndex: index,
            endIndex: index + 1
          },
          properties: {
            pixelSize: width
          },
          fields: "pixelSize"
        }
      });
    });
    return requests;
  }

  /**
   * Creates a request to freeze rows and columns in the sheet.
   * @param {number} sheetId - The ID of the sheet.
   * @param {number} frozenRowCount - The number of rows to freeze.
   * @param {number} frozenColumnCount - The number of columns to freeze.
   * @returns {Object} - A request to freeze rows and columns.
   */
  createFreezeRequest(sheetId, frozenRowCount = 2, frozenColumnCount = 1) {
    return {
      updateSheetProperties: {
        properties: {
          sheetId: sheetId,
          gridProperties: {
            frozenRowCount: frozenRowCount,
            frozenColumnCount: frozenColumnCount
          }
        },
        fields: 'gridProperties.frozenRowCount,gridProperties.frozenColumnCount'
      }
    };
  }

  /**
   * Executes all batchUpdate requests collected.
   * @param spreadsheetId {string} - Optional - the ID of the spreadsheet you'd like to perform the batch update on.
   */
  executeBatchUpdate(spreadsheetId) {
    if (this.requests.length === 0) {
      console.log("No batch requests to execute.");
      return;
    }

    if (!spreadsheetId) {
      spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
    }

    try {
      Sheets.Spreadsheets.batchUpdate({ requests: this.requests }, spreadsheetId);
      console.log("Batch update executed successfully.");
      // Clear requests after successful execution
      this.requests = [];
    } catch (e) {
      console.error("Error executing batch update:", e);
      throw new Error(`Error applying batch update. ${e.message}`);
    }
  }

  /**
   * Extracts all values from a column based on its header name.
   * @param {string} columnName - The name of the column to extract.
   * @param {number} [startRow=0] - The row index to search for the column name (default: 0).
   * @param {boolean} [includeHeader=false] - Whether to include the header in the returned values (default: false).
   * @returns {Array} - Array of values from the specified column.
   * @throws {Error} - If column name is not found.
   */
  extractColumn(columnName, startRow = 0, includeHeader = false) {
    const headerRange = this.sheet.getRange(startRow + 1, 1, 1, this.sheet.getLastColumn());
    const headers = headerRange.getValues()[0];
    const columnIndex = headers.indexOf(columnName);

    if (columnIndex === -1) {
      throw new Error(`Column "${columnName}" not found`);
    }

    const dataRange = this.sheet.getRange(startRow + 2, columnIndex + 1, this.sheet.getLastRow() - startRow - 1, 1);
    const values = dataRange.getValues().map(row => row[0]);

    return includeHeader ? [columnName, ...values] : values;
  }

  //extracts all values from a row based on the value of a given column in the row
  /**
   * Extracts all values from a row based on a matching value in a specified column.
   * @param {string} columnName - The name of the column to search in.
   * @param {*} matchValue - The value to match in the column.
   * @param {number} [startRow=0] - The row index to search for the column name (default: 0).
   * @returns {Array} - Array of values from the matched row.
   * @throws {Error} - If column name is not found or no matching value is found.
   */
  extractRow(columnName, matchValue, startRow = 0) {
    const headerRange = this.sheet.getRange(startRow + 1, 1, 1, this.sheet.getLastColumn());
    const headers = headerRange.getValues()[0];
    const columnIndex = headers.indexOf(columnName);

    if (columnIndex === -1) {
      throw new Error(`Column "${columnName}" not found`);
    }

    const dataRange = this.sheet.getRange(startRow + 2, 1, this.sheet.getLastRow() - startRow - 1, headers.length);
    const values = dataRange.getValues();
    const matchingRow = values.find(row => row[columnIndex] === matchValue);

    if (!matchingRow) {
      throw new Error(`No row found with value "${matchValue}" in column "${columnName}"`);
    }

    return matchingRow;
  }

  /**
 * Finds the column indices of matching header values.
 * @param {Array<string>} headerNames - An array of header names to find.
 * @param {number} [startRow=0] - The row index to search for the headers (default: 0).
 * @returns {Object} - An object where keys are header names and values are column indices.
 * @throws {Error} - If no headers are found.
 */
  getColumnIndicesFromHeader(headerNames, startRow = 0) {
    const headerRange = this.sheet.getRange(startRow + 1, 1, 1, this.sheet.getLastColumn());
    const headers = headerRange.getValues()[0];
    const indices = {};

    if (typeof headerNames === 'string') {
      headerNames = [headerNames];
    }

    headerNames.forEach(header => {
      const columnIndex = headers.indexOf(header);
      if (columnIndex === -1) {
        return;
      }
      const cleansedHeader = header.toLowerCase().replaceAll(' ', '');
      indices[cleansedHeader] = columnIndex;
    });

    if (indices.length == 1) {
      // If there's only the one value to return, just return the value.
      return indices[headerNames[0]];
    } else {

      // Return the indices in the form of key-value pairs.

      return indices;
    }
  }

  /**
 * Retrieves all values from the sheet's data range.
 * @returns {Array<Array<*>>} A 2D array of the sheet's values.
 */
  getAllValues() {
    return this.sheet.getDataRange().getValues();
  }

  /**
   * Clears the sheet, then sets all values in one go.
   * @param {Array<Array<*>>} values A 2D array of values to set in the sheet.
   */
  setAllValues(values) {
    // Optionally clear the sheet first if desired
    this.clearSheet();
    this.sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
  }

}
