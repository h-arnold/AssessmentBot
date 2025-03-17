// CohortAnalysisSheetManager.js

class CohortAnalysisSheetManager extends BaseSheetManager {

  /**
   * Creates or updates a Year Group sheet for each yearGroup in overviewData,
   * writing numeric columns as actual numbers, and text columns as strings.
   *
   * @param {Object} overviewData - Aggregated data from MultiSheetExtractor.
   * @param {string} masterSpreadsheetId - The ID of the Master spreadsheet.
   */
  createYearGroupSheets(overviewData, masterSpreadsheetId) {
    for (const [yearGroup, classData] of Object.entries(overviewData)) {
      // 1. Transform the data to (headers, rows)
      const { headers, rows } = this._transformYearGroupData(classData);

      // 2. Create or get the sheet
      this.createOrGetSheet(`Y${yearGroup}`, masterSpreadsheetId);
      const sheetId = this.sheet.getSheetId();

      // 3. (Optional) clear the sheet
      this.clearSheet();

      // 4. Write headers via batch update
      this.ensureSheetHasEnoughColumns(headers.length);
      const headerRequest = this.createHeaderValuesRequest(sheetId, headers, 0);
      const headerFormattingRequest = this.createHeaderFormattingRequest(sheetId, headers.length, 0, 1);
      this.requests.push(headerRequest, headerFormattingRequest);

      // 5. Identify which columns should be numeric - this enables us to work out which columns to conditionally format
      const numericColumnIndices = this._identifyNumericColumns(headers);

      // 6. Convert rows to rowData, forcing numeric columns
      const rowData = this._mapRowArraysToRowData(rows, numericColumnIndices);

      // 7. Append row data
      const appendRowsRequest = {
        appendCells: {
          sheetId,
          rows: rowData,
          fields: 'userEnteredValue'
        }
      };
      this.requests.push(appendRowsRequest);

      // 8. Freeze top row + first column
      const freezeRequest = this.createFreezeRequest(sheetId, 1, 1);
      this.requests.push(freezeRequest);

      this.requests.push(...this.createYearGroupConditionalFormattingRequests(sheetId, rows.length, headers.length, numericColumnIndices))


    }

    // 9. Execute batch for writing
    this.executeBatchUpdate(masterSpreadsheetId);
  }

  /**
   * Identifies the indicies of columns containing numeric values from their headers
   * Defaults to 'Completeness, Accuracy, SPaG and Average. You can pass others if you want different ones.
   * @param {string[]} headers - An array of header titles (e.g. ["Student Name", "Class Name", "Completeness", ...])
   * @returns {number[]} numericColumnIndices - The 0-based indices of columns we treat as numbers
   */
  _identifyNumericColumns(headers, numericHeaders = ["Completeness", "Accuracy", "SPaG", "Average"]) {
    // OR, you can specifically look for certain header names:
    // e.g. Only columns named "Completeness", "Accuracy", "SPaG", "Average" are numeric:
    return headers
      .map((h, i) => numericHeaders.includes(h) ? i : -1)
      .filter(i => i !== -1);
  }

  /**
   * Converts each row array into a set of CellData objects, 
   * forcing columns listed in numericColumnIndices to be { numberValue: ... } 
   * (except if it's "N" or empty).
   *
   * @param {Array<Array<any>>} rows - e.g. [ ["Alice","7A1",5,4,3,4.0], ["Bob","7B2","N",2.5,1,"N"] ]
   * @param {number[]} numericColumnIndices - Which columns are definitely numeric.
   * @returns {Array<{ values: Array<CellData> }>} rowData for batch update
   */
  _mapRowArraysToRowData(rows, numericColumnIndices) {
    return rows.map(row => {
      const cellValues = row.map((value, colIndex) => {
        // If column is numeric
        if (numericColumnIndices.includes(colIndex)) {
          // If "N", treat as text "N"
          if (value === 'N') {
            return { userEnteredValue: { stringValue: 'N' } };
          }
          // If formula (starts with "="), store as formulaValue
          if (typeof value === 'string' && value.trim().startsWith('=')) {
            return { userEnteredValue: { formulaValue: value.trim() } };
          }
          // Otherwise try to parse as number
          const num = parseFloat(value);
          // If parse was successful (not NaN) store as numberValue
          if (!isNaN(num)) {
            return { userEnteredValue: { numberValue: num } };
          }
          // Fallback: store as string
          return { userEnteredValue: { stringValue: String(value) } };
        }
        else {
          // Non-numeric columns
          // e.g. Student Name, Class Name
          // If it's a formula, handle that
          if (typeof value === 'string' && value.trim().startsWith('=')) {
            return { userEnteredValue: { formulaValue: value.trim() } };
          }
          // Otherwise store as string
          return { userEnteredValue: { stringValue: String(value) } };
        }
      });
      return { values: cellValues };
    });
  }


  /**
   * Private helper method that transforms a single year group’s
   * class-and-student object data into tabular format.
   *
   * @param {Object} classData - e.g. { "7A1 Digital Tech": { "Student A": {...}, ...}, ... }
   * @returns {{ headers: string[], rows: Array<Array<string>> }}
   */
  _transformYearGroupData(classData) {
    // 1. Find all sub-headers from the first (or all) classes
    //    e.g. "Score", "Grade", etc.
    const allHeaders = new Set();
    for (const singleClassObj of Object.values(classData)) {
      for (const studentData of Object.values(singleClassObj)) {
        Object.keys(studentData).forEach(key => allHeaders.add(key));
      }
    }
    // Convert the Set to an array
    const subHeaders = Array.from(allHeaders);

    // 2. Build final headers (e.g. "Student Name", then the sub-headers, then Class Name)
    const headers = ["Student Name", ...subHeaders, "Class Name"];

    // 3. Build row data
    const rows = [];
    for (const [className, students] of Object.entries(classData)) {
      for (const [studentName, studentValues] of Object.entries(students)) {
        // For each sub-header, get the student value or default to ""
        const subHeaderValues = subHeaders.map(h => studentValues[h] ?? "");
        rows.push([
          studentName,
          ...subHeaderValues,
          className
        ]);
      }
    }

    return { headers, rows };
  }



  /**
   * Creates conditional formatting requests for the main data region in a Year Group sheet.
   * Adapts the approach from your snippet, skipping headers and optionally skipping columns for names.
   *
   * @param {number} sheetId - The ID of the sheet to format.
   * @param {number} dataRowCount - How many *student* rows (or data rows) you have.
   * @param {number} totalColumns - The total number of columns in the sheet.
   *                                (including "Student Name" and "Class Name" columns).
   * @param {number} numericColumnIndices - Which columns to apply conditional formatting to.
   * @returns {Array<Object>} - An array of conditional formatting requests.
   */
  createYearGroupConditionalFormattingRequests(sheetId, dataRowCount, totalColumns, numericColumnIndices) {
    const requests = [];

    // --- Define your row indices ---
    // In 0-based indexing:
    //  - Row 0 is the header row
    const startRowIndex = 1; // data starts immediately after the headers
    const endRowIndex = startRowIndex + dataRowCount; // no extra blank row or average row in this example

    // --- Define your column indices ---
    // This current works because the numeric columns are all together. This will need modifying in the future if there's a mix of numeric and non-numeric columns.
    const startColumnIndex = numericColumnIndices[0]; //Gets the column to conditionally format
    const lastNumericColumnIndex = numericColumnIndices.length - 1 //Gets the last value in the numericColumnIndices array 
    const endColumnIndex = numericColumnIndices[lastNumericColumnIndex] + startColumnIndex// Gets the last column index to conditionally format;

    // --- Build the grid range ---
    const range = {
      sheetId: sheetId,
      startRowIndex: startRowIndex,
      endRowIndex: endRowIndex,
      startColumnIndex: startColumnIndex,
      endColumnIndex: endColumnIndex
    };

    // Push conditional formatting rules
    requests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [range],
          gradientRule: {
            minpoint: {
              color: { red: 1, green: 0, blue: 0 }, // Red
              type: 'NUMBER',
              value: '0'
            },
            midpoint: {
              color: { red: 1, green: 1, blue: 0 }, // Yellow
              type: 'NUMBER',
              value: '2.5'
            },
            maxpoint: {
              color: { red: 0, green: 1, blue: 0 }, // Green
              type: 'NUMBER',
              value: '5'
            }
          }
        },
        index: startColumnIndex
      }
    });

    // 2) Highlight 'N' with a different background color
    //    (e.g. gray, or red – adapt to taste)
    requests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [range],
          booleanRule: {
            condition: {
              type: 'TEXT_EQ',
              values: [{ userEnteredValue: 'N' }]
            },
            format: {
              backgroundColor: { red: 0.8, green: 0.8, blue: 0.8 } // Gray
            }
          }
        },
        index: startColumnIndex
      }
    });

    return requests;
  }

}
