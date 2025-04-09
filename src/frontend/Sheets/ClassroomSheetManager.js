// ClassroomSheetManager.js

/**
 * ClassroomSheetManager Class
 *
 * Handles operations with Google Sheets, leveraging BaseSheetManager for common functionalities.
 */
class ClassroomSheetManager extends BaseSheetManager {
  /**
   * Initializes the ClassroomSheetManager with a specific sheet.
   * @param {string} sheetName - The name of the sheet to manage.
   * @param {string} spreadsheetId - The spreadsheet attached to the sheet to manage
   */
  constructor(sheetName, spreadsheetId) {
    // This class should only be run from an admin sheet. 
    // As this sheet can be instantiated from the configuration manager, it's set to silently fail to instantiate rather than throw an error.
    if (!Utils.validateIsAdminSheet(false)) {
      return;      
   // If the sheetName and spreadsheetId parameters have been supplied, we're creating a class info sheet in another spreadsheet. Otherwise, we're working with the 'Classrooms sheet in the admin page.   
   } else if (sheetName && spreadsheetId) {
    super(sheetName, spreadsheetId)
   } else {
    super('Classrooms')
   }
  }


  /**
   * Retrieves all data from the sheet.
   * @returns {Array<Array>} The data in the sheet.
   */
  getData() {
    return this.sheet.getDataRange().getValues();
  }

  /** 
   * Writes all data in an array back to a sheet
   * @param {Array} - the array of values to write to the Classroom sheet.
   */
  setData(values){
    return this.sheet.getDataRange().setValues(values);
  }

  /**
   * Writes headers to the first row of the sheet using batch requests.
   * @param {Array<string>} headers - The column headers.
   */
  writeHeaders(headers) {
    const sheetId = this.sheet.getSheetId();
    const headerRowIndex = 0; // First row

    // Ensure the sheet has enough columns
    this.ensureSheetHasEnoughColumns(headers.length);

    // Create header value and formatting requests
    const headerValuesRequest = this.createHeaderValuesRequest(sheetId, headers, headerRowIndex);
    const headerFormattingRequest = this.createHeaderFormattingRequest(sheetId, headers.length, headerRowIndex, headerRowIndex + 1);

    // Add requests to the queue
    this.requests.push(headerValuesRequest, headerFormattingRequest);

    // Execute all batch requests
    this.executeBatchUpdate();
  }

  /**
   * Appends multiple rows to the sheet using batch requests.
   * @param {Array<Array>} rows - The rows data to append.
   */
  appendRows(rows) {
    const sheetId = this.sheet.getSheetId();
    const startRowIndex = this.sheet.getLastRow();

    // Prepare row data for batch update
    const rowData = rows.map(row => {
      return {
        values: row.map(cell => ({ userEnteredValue: { stringValue: cell.toString() } }))
      };
    });

    const appendRowsRequest = {
      appendCells: {
        sheetId: sheetId,
        rows: rowData,
        fields: 'userEnteredValue'
      }
    };

    this.requests.push(appendRowsRequest);
    this.executeBatchUpdate();
  }

  /**
   * Appends class information to the 'ClassInfo' sheet in the specified spreadsheet using batch requests.
   * @param {string} spreadsheetId - The ID the spreadsheet.
   * @param {string} className - The name of the class.
   * @param {string} courseId - The ID of the course.
   */
  static appendClassInfo(spreadsheetId, className, courseId) {
    try {
      const classInfoSheetName = 'ClassInfo';
      const assessmentRecordSheet = new ClassroomSheetManager(classInfoSheetName, spreadsheetId);

      const classInfoSheetId = assessmentRecordSheet.sheet.getSheetId();
      const requests = [
        {
          updateCells: {
            rows: [
              {
                values: [
                  { userEnteredValue: { stringValue: 'Class' } },
                  { userEnteredValue: { stringValue: className } }
                ]
              },
              {
                values: [
                  { userEnteredValue: { stringValue: 'Course ID' } },
                  { userEnteredValue: { stringValue: courseId } }
                ]
              }
            ],
            fields: 'userEnteredValue',
            start: { sheetId: classInfoSheetId, rowIndex: 0, columnIndex: 0 }
          }
        }
      ];

      assessmentRecordSheet.requests.push(...requests);
      assessmentRecordSheet.executeBatchUpdate(spreadsheetId);

      console.log('Appended class info values successfully.');
    } catch (error) {
      console.error(`Failed to append class info: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extracts all unique teacher emails from the 'Active Courses' sheet.
   * Assumes teacher emails are in columns C to F (indexes 2 to 5).
   * @returns {Set<string>} A set of unique teacher emails.
   */
  getTeacherEmails() {
    const data = this.getData();
    const teacherEmails = new Set();
    for (let i = 1; i < data.length; i++) { // Start from row 2
      const row = data[i];
      for (let j = 2; j <= 5; j++) { // Columns C to F
        const email = row[j];
        if (email && email.trim() !== '') {
          teacherEmails.add(email.trim());
        }
      }
    }
    return teacherEmails;
  }

  /**
   * Retrieves all active courses from the sheet.
   * Assumes course ID is in column A and course name is in column B.
   * @returns {Array<Object>} An array of course objects with id and name.
   */
  getActiveCourses() {
    const data = this.getData();
    const courses = [];
    for (let i = 1; i < data.length; i++) { // Start from row 2
      const row = data[i];
      const courseId = row[0];
      const courseName = row[1];
      if (courseId && courseName) {
        courses.push({ id: courseId, name: courseName });
      } else {
        console.warn(`Invalid course data at row ${i + 1}`);
      }
    }
    return courses;
  }

  /**
   * Writes multiple rows and optionally formats the sheet in a single batch operation.
   * @param {Array<Array>} rows - The rows data to write.
   * @param {Array<number>} columnWidths - Optional array of column widths.
   */
  writeData(rows, columnWidths = []) {
    const sheetId = this.sheet.getSheetId();

    // Append rows
    const rowData = rows.map(row => {
      return {
        values: row.map(cell => ({ userEnteredValue: { stringValue: cell.toString() } }))
      };
    });

    this.requests.push({
      appendCells: {
        sheetId: sheetId,
        rows: rowData,
        fields: 'userEnteredValue'
      }
    });

    // Optionally set column widths
    if (columnWidths.length > 0) {
      const columnWidthRequests = this.createColumnWidthRequests(sheetId, columnWidths);
      this.requests.push(...columnWidthRequests);
    }

    // Optionally freeze rows and columns
    const freezeRequest = this.createFreezeRequest(sheetId, 1, 1);
    this.requests.push(freezeRequest);

    // Execute all batch requests
    this.executeBatchUpdate();
  }
}
