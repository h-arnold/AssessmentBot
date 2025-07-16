/**
 * Represents a single class assessment spreadsheet
 * and provides methods to extract data from it.
 * Used by MultiSheetExtractor to process multiple assessment records, enabling analysis of data from entire cohorts. 
 */
class ClassAssessmentSheet {
  /**
   * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet 
   *        The Spreadsheet object for this class assessment.
   * @param {string} [className]  (Optional) A descriptive class/assessment name.
   * @param {string} [yearGroup]  (Optional) The year group or other metadata.
   */
  constructor(spreadsheet, className = '', yearGroup = '') {
    this.spreadsheet = spreadsheet;
    this.className = className;
    this.yearGroup = yearGroup;
  }

  /**
   * Extracts data from the 'Overview' sheet in the attached Spreadsheet,
   * converting rows into objects using headers as keys, with student name as the primary key.
   *
   * @throws {Error} if the 'Overview' sheet is not found or if Name column is missing.
   * @returns {Object} Object with student names as keys and their data as values
   */
  extractOverviewSheetData() {
    const overviewSheet = this.spreadsheet.getSheetByName('Overview');
    if (!overviewSheet) {
      throw new Error(`Overview sheet not found in spreadsheet: "${this.spreadsheet.getName()}"`);
    }

    const values = overviewSheet.getDataRange().getValues();
    const headers = values[0];
    const nameColumnIndex = headers.indexOf('Name');

    return values.slice(1, -2).reduce((acc, row) => {
      const studentName = row[nameColumnIndex];

      // Build an object *excluding* the 'Name' header
      const studentData = headers.reduce((obj, header, index) => {
        if (header !== 'Name') { // skip the 'Name' column
          obj[header] = row[index];
        }
        return obj;
      }, {});

      acc[studentName] = studentData;
      return acc;
    }, {});

  }
}
