// GoogleClassroomManager.gs

/**
This class is responsible for the management of Google Classrooms for the ClassroomSheetManager - so providing the ability to edit and modify Google Classroom data from the Classroom Manager sheet. This will get refactored away at somepoint as we progress towards using JsonDbApp for everything, but for now it will remain in place as it has important functionality relating to the generation and updating of Assessment Records.
*/
class GoogleClassroomManager {
  constructor() {
    this.configManager = ConfigurationManager.getInstance();
    this.classrooms = [];
    this.templateSheetId = '';
    this.destinationFolderId = '';

    // Only instantiate the ClassroomSheetManager class if this is being run from the Admin Sheet.
    if (Utils.validateIsAdminSheet(false)) {
      this.csm = new ClassroomSheetManager(); // Instantiate ClassroomSheetManager
    }
  }

  /**
   * Fetches Google Classrooms and writes their details to the provided sheet.
   *
   * Ensures the createAssessmentRecord column exists and sets its default value to FALSE.
   */
  fetchGoogleClassrooms() {
    try {
      // Retrieve all active classrooms
      const classrooms = this.getActiveClassrooms();

      // Clear existing data
      this.csm.clearSheet(); // Use ClassroomSheetManager

      // Set the headers
      const headers = [
        'Classroom ID',
        'Name',
        'Teacher 1',
        'Teacher 2',
        'Teacher 3',
        'Teacher 4',
        'Enrollment Code',
        'createAssessmentRecord',
      ];
      this.csm.writeHeaders(headers); // Use ClassroomSheetManager

      // Prepare all rows in memory before appending
      const rows = classrooms.map((course) => {
        // Fetch teachers for the course using ClassroomApiClient
        const teachers = ClassroomApiClient.fetchTeachers(course.id) || [];
        const teacherEmails = teachers.map((teacher) => teacher.email);

        return [
          course.id || '',
          course.name || '',
          teacherEmails[0] || '',
          teacherEmails[1] || '',
          teacherEmails[2] || '',
          teacherEmails[3] || '',
          course.enrollmentCode || '',
          false, // Default value for createAssessmentRecord
        ];
      });

      // Append all rows in one go using batch update
      this.csm.appendRows(rows); // Use ClassroomSheetManager

      console.log(
        'Classrooms fetched and written to sheet successfully with createAssessmentRecord column.'
      );
    } catch (error) {
      ProgressTracker.getInstance().logAndThrowError('Failed to fetch Google Classrooms', error);
    }
  }

  /**
   * Creates Google Classrooms for rows missing a Classroom ID.
   *
   * Ensures necessary values are stored in the sheet.
   */
  createGoogleClassrooms() {
    const data = this.csm.getData(); // Use ClassroomSheetManager

    // Ensure the createAssessmentRecord column exists
    let hasCreateAssessmentRecord = data[0].includes('createAssessmentRecord');
    if (!hasCreateAssessmentRecord) {
      // Before: this.sheet.getRange(1, data[0].length + 1).setValue('createAssessmentRecord');
      const headers = [...data[0], 'createAssessmentRecord'];
      this.csm.writeHeaders(headers); // Use ClassroomSheetManager to add the header
    }

    const rowsToUpdate = [];
    // Process rows without Classroom IDs
    data.forEach((row, index) => {
      if (index === 0 || row[0]) return; // Skip header row and rows with existing Classroom IDs

      try {
        const classroom = new GoogleClassroom({
          name: row[1],
          ownerId: row[2],
          teachers: row.slice(2, 6).filter((email) => email), // Teacher emails
        });
        classroom.create();
        // Use updateProgress to record informational messages without incrementing the step
        ProgressTracker.getInstance().updateProgress(`Classroom created: ${row[1]}`, false);

        // Update Classroom ID in the sheet
        // Before: this.sheet.getRange(index + 1, 1).setValue(classroom.id);
        // Before: this.sheet.getRange(index + 1, row.length + 1).setValue(false);
        rowsToUpdate.push({ rowIndex: index, courseId: classroom.id });
      } catch (error) {
        ProgressTracker.getInstance().logError(
          `Failed to create classroom for row ${index + 1}: ${error.message}`
        );
      }
    });

    if (rowsToUpdate.length > 0) {
      const updateRows = rowsToUpdate.map((update) => {
        const newRowData = ['', ...data[update.rowIndex].slice(1), false]; // Ensure 'createAssessmentRecord' is false
        newRowData[0] = update.courseId;
        return newRowData;
      });
      this.csm.writeData(updateRows, []); // Use ClassroomSheetManager to update rows
    }

    console.log(
      'Google Classrooms created successfully with createAssessmentRecord column updated.'
    );
  }

  /**
   * Copies templates for classrooms flagged with createAssessmentRecord set to TRUE.
   *
   * Adds "Year Group" and "Spreadsheet ID" columns (if missing) in one final batch update,
   * and updates the progress after each successfully copied template.
   *
   * Finally, shares the destination folder with all teacher emails found in the sheet.
   */
  createAssessmentRecords() {
    this.templateSheetId = ConfigurationManager.getInstance().getAssessmentRecordTemplateId();
    this.destinationFolderId =
      ConfigurationManager.getInstance().getAssessmentRecordDestinationFolder();

    // Use the ProgressTracker singleton directly; it will manage step increments itself
    ProgressTracker.getInstance().updateProgress('Creating Assessment Records');

    // Get and validate data
    const data = this.validateAssessmentRecordsSetup();

    // Ensure required columns exist
    const { headers, createARIndex, templateFileIdIndex, yearGroupIndex } =
      this.ensureRequiredColumns(data);

    // Process rows and collect updates
    const { rowUpdates, teacherEmailsSet } = this.processAssessmentRecordRows(data, createARIndex);

    // Update the sheet with new data
    this.updateSheetWithRecords(data, headers, rowUpdates, templateFileIdIndex, yearGroupIndex);

    // Share folder with teachers
    this.shareWithTeachers(teacherEmailsSet);

    console.log('Assessment records created successfully where flagged.');
  }

  /**
   * Validates setup and returns data for assessment record creation
   * @returns {Array} The sheet data
   */
  validateAssessmentRecordsSetup() {
    // Retrieve all rows
    const data = this.csm.getData();

    // Quick check that there's something to process
    if (data.length < 2) {
      const errorMessage =
        'No classrooms in the classroom sheet. Please fetch or create them first.';
      ProgressTracker.getInstance().logAndThrowError(errorMessage);
    }

    return data;
  }

  /**
   * Ensures required columns exist and returns column information
   * @param {Array} data - The sheet data
   * @returns {Object} Object containing headers and column indices
   */
  ensureRequiredColumns(data) {
    // Identify the header row and find createAssessmentRecord column
    const headers = data[0];
    const createARIndex = headers.indexOf('createAssessmentRecord');
    if (createARIndex === -1) {
      const errorMessage = "No 'createAssessmentRecord' column found. Please ensure it exists.";
      ProgressTracker.getInstance().logAndThrowError(errorMessage);
    }

    // Check if 'Template File Id' column exists
    let templateFileIdIndex = headers.indexOf('AR File ID');
    if (templateFileIdIndex === -1) {
      templateFileIdIndex = headers.length; // Add it to the end
      headers.push('AR File ID');
    }

    // Check if 'Year Group' column exists
    let yearGroupIndex = headers.indexOf('Year Group');
    if (yearGroupIndex === -1) {
      yearGroupIndex = headers.length;
      headers.push('Year Group');
    }

    return { headers, createARIndex, templateFileIdIndex, yearGroupIndex };
  }

  /**
   * Processes assessment record rows and returns updates
   * @param {Array} data - The sheet data
   * @param {number} createARIndex - Index of createAssessmentRecord column
   * @returns {Object} Object containing rowUpdates and teacherEmailsSet
   */
  processAssessmentRecordRows(data, createARIndex) {
    // Store row updates in memory for a final single batch update
    const rowUpdates = [];

    // Gather teacher emails from columns "Teacher 1" through "Teacher 4"
    const teacherEmailsSet = new Set();

    // Loop over all data rows and copy the template if createAssessmentRecord = true
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      // Collect any teacher emails from columns 2..5
      for (let col = 2; col <= 5; col++) {
        if (row[col]?.trim()) {
          teacherEmailsSet.add(row[col].trim());
        }
      }

      if (row[createARIndex] === true) {
        try {
          const courseId = row[0]; // Gets the ClassID from column A
          const className = row[1]; // Gets the Class Name from column B

          const copyResult = DriveManager.copyTemplateSheet(
            this.templateSheetId,
            this.destinationFolderId,
            className
          );

          if (copyResult.status === 'copied') {
            const newFileId = copyResult.fileId; // definitely not null in 'copied' case
            rowUpdates.push({
              rowIndex: i, // 0-based index in `data`
              templateFileIdValue: newFileId,
            });

            // Adds the class info to the newly created assessment record
            ClassroomSheetManager.appendClassInfo(newFileId, className, courseId);

            // Update progress each time we successfully copy a template
            ProgressTracker.getInstance().updateProgress(
              `Created assessment record for: ${className}`
            );
          } else if (copyResult.status === 'skipped') {
            console.log(copyResult.message);
            // Push the existing file ID to the spreadsheet instead
            const existingFiledId = copyResult.fileId;
            rowUpdates.push({
              rowIndex: i, // 0-based index in `data`
              templateFileIdValue: existingFiledId,
            });

            // Record a skipped message and allow the tracker to increment its internal step
            ProgressTracker.getInstance().updateProgress(
              `Skipping record for: ${className} (already exists)`
            );
          }
        } catch (error) {
          const errMsg = `Failed to copy template for row ${i + 1}: ${error.message}`;
          ProgressTracker.getInstance().logAndThrowError(errMsg, error);
        }
      }
    }

    return { rowUpdates, teacherEmailsSet };
  }

  /**
   * Updates the sheet with new record data
   * @param {Array} data - The original sheet data
   * @param {Array} headers - The updated headers
   * @param {Array} rowUpdates - Array of row updates to apply
   * @param {number} templateFileIdIndex - Index of template file ID column
   * @param {number} yearGroupIndex - Index of year group column
   */
  updateSheetWithRecords(data, headers, rowUpdates, templateFileIdIndex, yearGroupIndex) {
    // Build our final batch requests array
    const rowsToWrite = data.map((row, index) => {
      const update = rowUpdates.find((u) => u.rowIndex === index);
      if (update) {
        const updatedRow = [...row];
        if (templateFileIdIndex < updatedRow.length) {
          updatedRow[templateFileIdIndex] = update.templateFileIdValue;
        } else {
          updatedRow.push(update.templateFileIdValue);
        }
        return updatedRow;
      }
      return row;
    });

    // Clear Google Sheet otherwise the batch request appends to existing rows and creates duplicates
    this.csm.clearSheet();

    // Update headers if new columns were added
    if (templateFileIdIndex === headers.length - 1 || yearGroupIndex === headers.length - 1) {
      this.csm.writeHeaders(headers);
    }

    // Write other values to the sheet
    this.csm.writeData(rowsToWrite.slice(1), []); // Use ClassroomSheetManager to update rows
  }

  /**
   * Shares the destination folder with teachers
   * @param {Set} teacherEmailsSet - Set of teacher email addresses
   */
  shareWithTeachers(teacherEmailsSet) {
    // Finally, share the folder with all teacher emails
    if (teacherEmailsSet.size > 0) {
      try {
        const shareResult = DriveManager.shareFolder(this.destinationFolderId, teacherEmailsSet);
        // Use the shareResult status to update progress or log a message
        if (shareResult.status === 'complete') {
          ProgressTracker.getInstance().updateProgress(
            `Folder shared with all ${teacherEmailsSet.size} teacher(s) successfully.`,
            true
          );
        } else if (shareResult.status === 'partial') {
          ProgressTracker.getInstance().updateProgress(
            `Some teachers shared, some failed. Check logs.`,
            false
          );
        } else if (shareResult.status === 'none') {
          ProgressTracker.getInstance().updateProgress(
            `No teacher emails provided; folder sharing skipped.`,
            false
          );
        }
        console.log(shareResult.message);
      } catch (error) {
        // If we throw on an error (folder not found, etc.)
        ProgressTracker.getInstance().logError(`Failed to share folder: ${error.message}`, error);
      }
    } else {
      console.log('No teacher emails were found. Folder not shared with anyone.');
    }
  }

  /**
   * Retrieves assignments for a given course.
   * @param {string} courseId - The ID of the course.
   * @returns {Object[]} The list of assignments.
   */
  getAssignments(courseId) {
    try {
      const courseWork = Classroom.Courses.CourseWork.list(courseId);
      let assignments = [];

      if (courseWork.courseWork && courseWork.courseWork.length > 0) {
        assignments = courseWork.courseWork.map((assignment) => {
          return {
            id: assignment.id,
            title: assignment.title,
            updateTime: new Date(assignment.updateTime),
          };
        });

        // Sort assignments by update time in descending order
        assignments.sort((a, b) => b.updateTime - a.updateTime);
      }

      console.log(`${assignments.length} assignments retrieved for courseId: ${courseId}`);
      return assignments;
    } catch (error) {
      const errorMessage = `Error retrieving assignments for courseId ${courseId}`;
      ProgressTracker.getInstance().logAndThrowError(errorMessage, error);
    }
  }

  /**
   * Retrieves all active Google Classroom courses available to the user.
   * @return {Object[]} An array of objects containing course IDs and names.
   */
  getActiveClassrooms() {
    try {
      const courses = ClassroomApiClient.fetchAllActiveClassrooms();
      return courses;
    } catch (error) {
      const userMessage =
        'Failed to retrieve active classrooms. Please ensure that the Classroom API is enabled and you have the necessary permissions.';
      this.progressTracker.logAndThrowError(userMessage, error);
    }
  }

  /**
   * Retrieves the course ID from the legacy 'ClassInfo' sheet.
   * @deprecated This method is only used for migration purposes by ConfigurationManager.getClassInfo().
   *             New code should use ConfigurationManager.getInstance().getAssessmentRecordCourseId().
   * @returns {string} The course ID.
   */
  getCourseId() {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getSheetByName('ClassInfo');

    // If ClassInfo sheet doesn't exist or course ID is missing
    if (!sheet || !sheet?.getRange('B2')?.getValue()) {
      console.error('ClassInfo sheet not found or missing course ID.');

      // Create a detailed error message for logging
      const errorMessage =
        'Cannot assess assignments: No classroom is selected or the ClassInfo sheet is missing.';
      const detailedError =
        'The Assessment Bot requires a classroom to be selected before assessing assignments. ' +
        'The ClassInfo sheet which contains this information is missing or incomplete.';

      ProgressTracker.getInstance().logError(errorMessage, detailedError);

      // Use UIManager to handle the classroom selection prompt
      // Attempt to show a UI prompt to help the user select a classroom. Capture any UI errors
      // so they can be included in the thrown error's developer details.
      let uiError = null;
      try {
        const uiManager = UIManager.getInstance();
        uiManager.promptMissingClassroomSelection();
      } catch (e) {
        uiError = e;
        ProgressTracker.getInstance().captureError(e, 'Cannot show UI prompt using UIManager');
      }

      ProgressTracker.getInstance().logAndThrowError(
        errorMessage + " Please use the 'Change Class' menu option to select a classroom first.",
        uiError
      );
    }

    const courseId = sheet.getRange('B2').getValue();
    return courseId.toString();
  }

  /**
   * Deletes the ClassInfo sheet if it exists.
   * Used after migrating Class Info to Document Properties.
   */
  deleteClassInfoSheet() {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getSheetByName('ClassInfo');
    if (sheet) {
      spreadsheet.deleteSheet(sheet);
      console.log('Legacy ClassInfo sheet deleted.');
    }
  }
}
