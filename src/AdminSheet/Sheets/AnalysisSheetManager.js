// AnalysisSheetManager.gs

class AnalysisSheetManager extends BaseSheetManager {
  /**
   * Constructs an AnalysisSheetManager instance.
   * @param {Assignment} assignment - The Assignment instance containing all the data.
   */
  constructor(assignment) {
    super();
    this.assignment = assignment;
    this.headers = {
      topHeaders: [],
      subHeaders: []
    };
  }

  /**
   * Creates or retrieves the analysis sheet for the assignment.
   */
  createOrGetSheet() {
    const sheetName = this.assignment.assignmentName || `Assignment ${this.assignment.assignmentId}`;
    super.createOrGetSheet(sheetName);
  }

  /**
   * Prepares the data and builds batchUpdate requests.
   */
  prepareData() {
    this.extractHeaders();
    this.createHeadersRequests();
    this.createDataRowsRequests();
    this.applyFormatting();
    this.addClassAverageRow();
  }

  /**
   * Extracts headers based on the tasks in the assignment.
   */
  extractHeaders() {
    this.headers.topHeaders = [''];
    this.headers.subHeaders = ['Name'];
    // Deterministic order by TaskDefinition.index then id fallback
    const taskDefs = Object.values(this.assignment.tasks || {}).sort((a,b) => {
      if (a.index != null && b.index != null && a.index !== b.index) return a.index - b.index;
      if (a.index != null) return -1; if (b.index != null) return 1; return a.id.localeCompare(b.id);
    });
    taskDefs.forEach(td => {
      this.headers.topHeaders.push(td.taskTitle, '', '');
      this.headers.subHeaders.push('Completeness', 'Accuracy', 'SPaG');
    });
    this.headers.topHeaders.push('Averages', '', '');
    this.headers.subHeaders.push('Completeness', 'Accuracy', 'SPaG');
  }

  /**
   * Creates batchUpdate requests for setting header values and formatting.
   */
  createHeadersRequests() {
    const sheetId = this.sheet.getSheetId();

    // Ensure sheet has enough columns
    this.ensureSheetHasEnoughColumns(this.headers.topHeaders.length);

    // Create header value requests

    this.requests.push(this.createHeaderValuesRequest(sheetId, this.headers.topHeaders, 0));

    this.requests.push(this.createHeaderValuesRequest(sheetId, this.headers.subHeaders, 1));

    // Add header formatting requests
    // Top row of headers listing the assignment names
    this.requests.push(this.createHeaderFormattingRequest(sheetId, 0, 1, {
      wordWrap: true,
      horizontalAlignment: "CENTER"
    },
    0,
    this.headers.topHeaders.length));

    // Second row of headers focussing on just the 'Name' column, formatted in bold, left aligned and auto resized.

    this.requests.push(this.createHeaderFormattingRequest(sheetId, 1, 2, {
      wordWrap: false,
      horizontalAlignment: "LEFT",
      autoResize: true
    },
      0,
      1));

    // Second row of headers containing 'Completeness', 'Accuracy' and 'SPaG' headers, rotated 45 degrees
    this.requests.push(this.createHeaderFormattingRequest(sheetId, 1, 2, {
      wordWrap: false,
      horizontalAlignment: "CENTER",
      textRotation: { angle: 45 }
    },
      1,
      this.headers.subHeaders.length));


    // Add merge requests for task headers
    this.requests.push(...this.createMergeRequests(sheetId, this.headers.topHeaders));
  }

  /**
   * Creates merge requests for task headers.
   * @param {number} sheetId - The ID of the sheet.
   * @param {Array<string>} topHeaders - The top headers to create merge requests for.
   * @returns {Array} - An array of merge requests.
   */
  createMergeRequests(sheetId, topHeaders) {
    let mergeRequests = [];
    let columnIndex = 1; // Start after the first column (Name)
    for (let i = 1; i < topHeaders.length - 3; i += 3) {
      mergeRequests.push({
        mergeCells: {
          range: {
            sheetId: sheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: columnIndex,
            endColumnIndex: columnIndex + 3
          },
          mergeType: "MERGE_ALL"
        }
      });
      columnIndex += 3;
    }

    // Merge the 'Averages' header
    mergeRequests.push({
      mergeCells: {
        range: {
          sheetId: sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: columnIndex,
          endColumnIndex: columnIndex + 3
        },
        mergeType: "MERGE_ALL"
      }
    });

    return mergeRequests;
  }

  /**
   * Creates data rows for each student.
   */
  createDataRowsRequests() {
    const sheetId = this.sheet.getSheetId();
    const startRowIndex = 2;
  const submissions = this.assignment.submissions || [];
    submissions.forEach((submission, studentIndex) => {
      const rowData = [];
      const notesData = [];
      const completenessCells = [];
      const accuracyCells = [];
      const spagCells = [];
      const studentName = submission.student?.name || submission.studentName || submission.studentId || 'Unknown';
      rowData.push({ userEnteredValue: { stringValue: studentName } });
      let currentColumnIndex = 1;
      const taskDefs = Object.values(this.assignment.tasks || {}).sort((a,b)=>{ if(a.index!=null&&b.index!=null&&a.index!==b.index) return a.index-b.index; if(a.index!=null) return -1; if(b.index!=null) return 1; return a.id.localeCompare(b.id); });
      taskDefs.forEach(td => {
        const item = submission.getItem ? submission.getItem(td.id) : (submission.items ? submission.items[td.id] : null);
        const assessments = item && item.assessments ? item.assessments : {};
        const studentDisplay = this._artifactDisplayString(item && item.artifact);
        // completeness
        const completeness = assessments['completeness']?.score;
        if (typeof completeness === 'number' && completeness > 0) { rowData.push({ userEnteredValue: { numberValue: completeness } }); } else { rowData.push({ userEnteredValue: { stringValue: 'N' } }); }
        notesData.push({ note: this.formatNote(assessments['completeness']?.reasoning || 'No reasoning provided.', studentDisplay), columnOffset: currentColumnIndex });
        completenessCells.push(Utils.getColumnLetter(currentColumnIndex) + (startRowIndex + studentIndex + 1));
        currentColumnIndex++;
        // accuracy
        const accuracy = assessments['accuracy']?.score;
        if (typeof accuracy === 'number' && accuracy > 0) { rowData.push({ userEnteredValue: { numberValue: accuracy } }); } else { rowData.push({ userEnteredValue: { stringValue: 'N' } }); }
        notesData.push({ note: this.formatNote(assessments['accuracy']?.reasoning || 'No reasoning provided.', studentDisplay), columnOffset: currentColumnIndex });
        accuracyCells.push(Utils.getColumnLetter(currentColumnIndex) + (startRowIndex + studentIndex + 1));
        currentColumnIndex++;
        // spag
        const spag = assessments['spag']?.score;
        if (typeof spag === 'number' && spag > 0) { rowData.push({ userEnteredValue: { numberValue: spag } }); } else { rowData.push({ userEnteredValue: { stringValue: 'N' } }); }
        notesData.push({ note: this.formatNote(assessments['spag']?.reasoning || 'No reasoning provided.', studentDisplay), columnOffset: currentColumnIndex });
        spagCells.push(Utils.getColumnLetter(currentColumnIndex) + (startRowIndex + studentIndex + 1));
        currentColumnIndex++;
      });
      const completenessFormula = `=IFERROR(ROUND(AVERAGEA(${completenessCells.join(',')}),1),'E')`;
      const accuracyFormula = `=IFERROR(ROUND(AVERAGE(${accuracyCells.join(',')}),1),'N')`;
      const spagFormula = `=IFERROR(ROUND(AVERAGE(${spagCells.join(',')}),1),'N')`;
      rowData.push({ userEnteredValue: { formulaValue: completenessFormula } });
      rowData.push({ userEnteredValue: { formulaValue: accuracyFormula } });
      rowData.push({ userEnteredValue: { formulaValue: spagFormula } });
      this.requests.push({ updateCells: { rows: [{ values: rowData }], fields: 'userEnteredValue', start: { sheetId, rowIndex: startRowIndex + studentIndex, columnIndex: 0 } } });
      notesData.forEach(noteData => { this.requests.push({ updateCells: { rows: [{ values: [{ note: noteData.note }] }], fields: 'note', start: { sheetId, rowIndex: startRowIndex + studentIndex, columnIndex: noteData.columnOffset } } }); });
    });
  }

  /**
   * Convert an artifact object into a human-readable display string.
   *
   * The function inspects artifact.getType() (if present) to decide how to
   * serialize artifact.content:
   * - 'TEXT'        : returns artifact.content (string) or '' when missing.
   * - 'TABLE'|'SPREADSHEET'
   *                 : expects content to be an array of rows (each row an array of cells).
   *                   Cells that are null or undefined are rendered as empty strings.
   *                   Rows are joined with tabs and rows are joined with newlines.
   * - 'IMAGE'       : returns "[image]" when artifact.content is truthy, otherwise ''.
   *
   * For any missing artifact or unrecognized type the function returns the empty string.
   *
   * @private
   * @param {Object|null|undefined} artifact - Artifact to render. May be null/undefined.
   *   If present, may implement getType():string (type is expected to be uppercase),
   *   and have a content property whose shape depends on the type:
   *     - TEXT: content is a string
   *     - TABLE|SPREADSHEET: content is Array<Array<any>>
   *     - IMAGE: content truthiness indicates presence of an image
   * @returns {string} A string suitable for display (possibly multi-line for tables),
   *                   or '' when artifact/type/content is missing or unsupported.
   */
  _artifactDisplayString(artifact) {
    if (!artifact) return '';
    const type = artifact.getType ? artifact.getType() : null;
  const t = type; // now already uppercase from artifact
  if (t === 'TEXT') return artifact.content || '';
  if (t === 'TABLE' || t === 'SPREADSHEET') {
      if (!artifact.content) return '';
      return artifact.content.map(r => r.map(c => (c==null?'':c)).join('\t')).join('\n');
    }
  if (t === 'IMAGE') return artifact.content ? '[image]' : '';
    return '';
  }

  /**
   * Applies formatting to the sheet, including conditional formatting and column widths.
   */
  applyFormatting() {
    const sheetId = this.sheet.getSheetId();
  const submissions = this.assignment.submissions || [];
    const numRows = submissions.length + 2; // header rows
    const numColumns = this.headers.subHeaders.length;

    // Apply cell formatting
    this.requests.push({
      repeatCell: {
        range: {
          sheetId: sheetId,
          startRowIndex: 2, // After headers
          endRowIndex: numRows,
          startColumnIndex: 1,
          endColumnIndex: numColumns
        },
        cell: {
          userEnteredFormat: {
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE"
          }
        },
        fields: "userEnteredFormat(horizontalAlignment, verticalAlignment)"
      }
    });

    // Create conditional formatting requests
    this.requests.push(...this.createConditionalFormattingRequests(sheetId, numRows, numColumns));

    // Set column widths
    const columnWidths = this.calculateColumnWidths();
    this.requests.push(...this.createColumnWidthRequests(sheetId, columnWidths));

    // Freeze headers and name column
    this.requests.push(this.createFreezeRequest(sheetId));
  }

  /**
   * Creates conditional formatting requests for the data cells, including the class average row.
   * @param {number} sheetId - The ID of the sheet.
   * @param {number} dataRowCount - The number of data rows (excluding headers, blank row, and class average row).
   * @param {number} numColumns - The number of columns to format.
   * @returns {Array<Object>} - An array of conditional formatting requests.
   */
  createConditionalFormattingRequests(sheetId, dataRowCount, numColumns) {
    const requests = [];
    const dataStartRowIndex = 2; // Data starts after headers
    const blankRowCount = 1;
    const classAverageRowCount = 1;
    const startRowIndex = dataStartRowIndex;
    const endRowIndex = startRowIndex + dataRowCount + blankRowCount + classAverageRowCount;
    const startColumnIndex = 1; // Assuming the first column is for names
    const endColumnIndex = numColumns;

    const range = {
      sheetId: sheetId,
      startRowIndex: startRowIndex,
      startColumnIndex: startColumnIndex,
      endRowIndex: endRowIndex,
      endColumnIndex: endColumnIndex
    };

    // Gradient formatting based on score
    requests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [range],
          gradientRule: {
            minpoint: {
              color: { red: 1, green: 0, blue: 0 }, // Red for 0
              type: "NUMBER",
              value: "0"
            },
            midpoint: {
              color: { red: 1, green: 1, blue: 0 }, // Yellow for 2.5
              type: "NUMBER",
              value: "2.5"
            },
            maxpoint: {
              color: { red: 0, green: 1, blue: 0 }, // Green for 5
              type: "NUMBER",
              value: "5"
            }
          }
        },
        index: 0
      }
    });

    // Formatting for 'N' values
    requests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [range],
          booleanRule: {
            condition: {
              type: "TEXT_EQ",
              values: [{ userEnteredValue: "N" }]
            },
            format: {
              backgroundColor: { red: 0.8, green: 0.8, blue: 0.8 } // Gray for 'N'
            }
          }
        },
        index: 0
      }
    });

    return requests;
  }

  /**
   * Calculates the widths of columns based on headers.
   * @returns {Array<number>} - An array of column widths.
   */
  calculateColumnWidths() {
    const columnWidths = [];
    // First column (Name) width
    columnWidths.push(200);

    // Other columns
    const numColumns = this.headers.subHeaders.length;
    for (let i = 1; i < numColumns; i++) {
      columnWidths.push(75);
    }

    return columnWidths;
  }

  /**
   * Adds the class average row to the sheet.
   */
  addClassAverageRow() {
    const sheetId = this.sheet.getSheetId();
  const submissions = this.assignment.submissions || [];
    const lastRowIndex = submissions.length + 2;
    // Add blank row
    this.requests.push({
      updateCells: {
        rows: [{}],
        fields: 'userEnteredValue',
        start: { sheetId: sheetId, rowIndex: lastRowIndex, columnIndex: 0 }
      }
    });

    // Prepare Class Average row
    const rowData = [
      { userEnteredValue: { stringValue: 'Class Average' }, userEnteredFormat: { textFormat: { bold: true } } }
    ];

    const numColumns = this.headers.subHeaders.length;
    for (let col = 1; col < numColumns; col++) {
      const columnLetter = Utils.getColumnLetter(col); // Adjust to start from Column B
      const formula = `=IFERROR(ROUND(AVERAGE(${columnLetter}3:${columnLetter}${lastRowIndex}),1),0)`;
      rowData.push({ userEnteredValue: { formulaValue: formula } });
    }

    // Add Class Average row
    this.requests.push({
      updateCells: {
        rows: [{ values: rowData }],
        fields: 'userEnteredValue,userEnteredFormat.textFormat',
        start: { sheetId: sheetId, rowIndex: lastRowIndex + 1, columnIndex: 0 }
      }
    });
  }

  /**
   * Formats the note content with the specified reasoning and student response.
   * @param {string} reasoning - The reasoning text.
   * @param {string|any} studentResponse - The student's response text or other data.
   * @return {string} - The formatted note content.
   */
  formatNote(reasoning, studentResponse) {
    let noteContent = `Reasoning\n========\n${reasoning}`;
    if (this._shouldIncludeStudentResponse(studentResponse)) {
      noteContent += `\n\nStudent Response\n===============\n${studentResponse}`;
    }
    return noteContent;
  }

  /**
   * Private helper to determine if a student response should be included (not base64-encoded).
   * @param {any} response - The student response.
   * @returns {boolean} - True if the response is a string and not a base64 URI.
   */
  _shouldIncludeStudentResponse(response) {
    if (typeof response !== 'string') return false;
    // Most base64 URIs start with 'data:'
    return !response.startsWith('data:');
  }

  /**
   * After creating the analysis sheet, stores the average ranges for the overview sheet.
   */
  storeAverageRanges() {
    const documentProperties = PropertiesService.getDocumentProperties();
    const sheetName = this.sheet.getName();
  const submissions = this.assignment.submissions || [];
    const numStudents = submissions.length;
    const firstDataRow = 2; // Data starts from row index 2 (3rd row)
    const lastDataRow = firstDataRow + numStudents - 1;

    // Assuming that 'Averages' columns are the last three columns
    const completenessColIndex = this.headers.subHeaders.length - 3;
    const accuracyColIndex = this.headers.subHeaders.length - 2;
    const spagColIndex = this.headers.subHeaders.length - 1;

    const studentNameRange = `${sheetName}!A${firstDataRow + 1}:A${lastDataRow + 1}`;
    const completenessRange = `${sheetName}!${Utils.getColumnLetter(completenessColIndex)}${firstDataRow + 1}:${Utils.getColumnLetter(completenessColIndex)}${lastDataRow + 1}`;
    const accuracyRange = `${sheetName}!${Utils.getColumnLetter(accuracyColIndex)}${firstDataRow + 1}:${Utils.getColumnLetter(accuracyColIndex)}${lastDataRow + 1}`;
    const spagRange = `${sheetName}!${Utils.getColumnLetter(spagColIndex)}${firstDataRow + 1}:${Utils.getColumnLetter(spagColIndex)}${lastDataRow + 1}`;

    // Retrieve existing ranges
    const existingRanges = documentProperties.getProperty('averagesRanges');
    const ranges = existingRanges ? JSON.parse(existingRanges) : {};

    // Add new ranges
    ranges[sheetName] = {
      studentName: studentNameRange,
      completeness: completenessRange,
      accuracy: accuracyRange,
      spag: spagRange
    };

    // Store updated ranges
    documentProperties.setProperty('averagesRanges', JSON.stringify(ranges));
  }

  /**
   * Main method to create and populate the analysis sheet.
   */
  createAnalysisSheet() {
    this.createOrGetSheet();
    this.prepareData();
    BatchUpdateUtility.executeBatchUpdate(this.requests, SpreadsheetApp.getActiveSpreadsheet().getId());
    // After creating the sheet, store the average ranges
    this.storeAverageRanges();
  }
}
