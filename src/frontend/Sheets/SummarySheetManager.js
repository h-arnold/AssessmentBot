/**
 * @class SummarySheetManager
 * @extends BaseSheetManager
 * @classdesc Handles creation of the "Summary" sheet, which displays
 * Year Group-level aggregates (e.g. averages) across all the Year Group sheets.
 */
class SummarySheetManager extends BaseSheetManager {

  /**
   * Creates or updates the "Summary" sheet that displays the per-Year-Group
   * averages (or other aggregates).
   *
   * @param {Object} overviewData - The aggregated data returned by MultiSheetExtractor.
   *                                Structure: { "Y7": { "7A1 Digital Tech": {...}, ...}, "Y8": ... }
   * @param {string} masterSpreadsheetId - ID of the spreadsheet where "Summary" should be created/updated.
   */
  createSummarySheet(overviewData, masterSpreadsheetId) {
    // 1. Create or get the "Summary" sheet
    this.createOrGetSheet('Summary', masterSpreadsheetId);
    const sheetId = this.sheet.getSheetId();

    // 2. Clear contents and formatting (if you want a fresh rebuild each time)
    this.clearSheet();

    // 3. Write the header row
    const headers = this._buildSummaryHeaders();
    this.ensureSheetHasEnoughColumns(headers.length);

    // Add requests for header values & formatting
    const headerRequest = this.createHeaderValuesRequest(sheetId, headers, 0);
    const headerFormattingRequest = this.createHeaderFormattingRequest(
      sheetId, 
      headers.length, 
      0,  // startRowIndex
      1   // endRowIndex (exclusive; 1 means just the first row)
    );
    this.requests.push(headerRequest, headerFormattingRequest);

    // 4. Build row data for all Year Groups
    const summaryRows = this._buildSummaryRowData(overviewData);

    // 5. Convert the rows into rowData objects for batch update
    const rowData = summaryRows.map(row => ({
      values: row.map(cell => {
        // If cell is a formula (i.e. starts with "="), store as formula
        if (typeof cell === 'string' && cell.trim().startsWith('=')) {
          return { userEnteredValue: { formulaValue: cell.trim() } };
        }
        // Otherwise store as a string
        return { userEnteredValue: { stringValue: String(cell) } };
      })
    }));

    // 6. Append these rows below the header
    const appendRowsRequest = {
      appendCells: {
        sheetId,
        rows: rowData,
        fields: 'userEnteredValue'
      }
    };
    this.requests.push(appendRowsRequest);

    // 7. Freeze the top row and the first column
    const freezeRequest = this.createFreezeRequest(sheetId, 1, 1);
    this.requests.push(freezeRequest);

    // 8. Add conditional formatting requests if desired
    this.requests.push(
       ...this._createSummaryConditionalFormattingRequests(sheetId, summaryRows.length, headers.length)
    );

    // 9. Execute batch update
    this.executeBatchUpdate(masterSpreadsheetId);
  }

  /**
   * Helper method to build the header row for the "Summary" sheet.
   * 
   * @returns {string[]} Array of header names.
   */
  _buildSummaryHeaders() {
    // For example, you might want: 
    //    ["Year Group", "Completeness Avg", "Accuracy Avg", "SPaG Avg", "Overall Avg"]
    // Adjust these to your own naming conventions.
    return [
      "Year Group",
      "Completeness (Avg)",
      "Accuracy (Avg)",
      "SPaG (Avg)",
      "Average (Overall)"
    ];
  }

  /**
   * Helper method that builds an array of row data for each Year Group in overviewData.
   * Each row includes the Year Group name and formulas referencing the respective 
   * Y<yearGroup> sheet columns.
   * 
   * @param {Object} overviewData - e.g. { "7": {...}, "8": {...}, ... }
   * @returns {Array<Array<string>>} The row data (arrays of strings/formulas).
   */
  _buildSummaryRowData(overviewData) {
    const rows = [];

    // If your keys are numeric year groups like "7", "8", "9", we'll just loop
    // (Remember to convert them to strings if needed).
    for (const yearGroupKey of Object.keys(overviewData)) {
      // Build a single row
      // Cell 0: "Y7", "Y8", etc. 
      // The rest are formulas referencing the columns in the Y7 sheet (for example).
      // Assumes numeric data in columns B, C, D, E
      // TODO: Refactor the SheetManagers more generally to consolidate duplicated functionality and make the below much more flexible.
      const row = [
        `Y${yearGroupKey}`,                                 // e.g. "Y7"
        `=IFERROR(ROUND(AVERAGE('Y${yearGroupKey}'!B2:B), 2), "N/A")`,  // Completeness
        `=IFERROR(ROUND(AVERAGE('Y${yearGroupKey}'!C2:C), 2), "N/A")`,  // Accuracy
        `=IFERROR(ROUND(AVERAGE('Y${yearGroupKey}'!D2:D), 2), "N/A")`,  // SPaG
        `=IFERROR(ROUND(AVERAGE('Y${yearGroupKey}'!E2:E), 2), "N/A")`   // Overall
      ];

      rows.push(row);
    }

    return rows;
  }

  /**
   * @param {number} sheetId 
   * @param {number} dataRowCount 
   * @param {number} totalColumns 
   * @returns {Array<Object>}
   */
  _createSummaryConditionalFormattingRequests(sheetId, dataRowCount, totalColumns) {
    const requests = [];

    const startRowIndex = 1;
    const endRowIndex = startRowIndex + dataRowCount;
    const startColumnIndex = 1; // "Completeness (Avg)"
    const endColumnIndex = totalColumns; 
    const range = {
       sheetId,
       startRowIndex,
       endRowIndex,
       startColumnIndex,
       endColumnIndex
      };
    //
    // // Add a simple gradient rule
     requests.push({
       addConditionalFormatRule: {
         rule: {
           ranges: [range],
           gradientRule: {
             minpoint: { color: { red: 1, green: 0, blue: 0 }, type: 'NUMBER', value: '0' },
             midpoint: { color: { red: 1, green: 1, blue: 0 }, type: 'NUMBER', value: '2.5' },
             maxpoint: { color: { red: 0, green: 1, blue: 0 }, type: 'NUMBER', value: '5' }
           }
         },
         index: 0
       }
     });
    
    return requests;
  }
}
