// GoogleClassroomManager.gs

/**
Manages Google Classroom operations and associated tasks.
*/
class GoogleClassroomManager {
  constructor() {
    this.configManager = configurationManager;
    this.classrooms = [];
    this.templateSheetId = ""
    this.destinationFolderId = "" 
    this.progressTracker = ProgressTracker.getInstance();

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
        'createAssessmentRecord'
      ];
      this.csm.writeHeaders(headers); // Use ClassroomSheetManager

      // Prepare all rows in memory before appending
      const rows = classrooms.map(course => {
        // Fetch teachers for the course
        const teachers = Classroom.Courses.Teachers.list(course.id).teachers || [];
        const teacherEmails = teachers.map(teacher => teacher.profile.emailAddress);

        return [
          course.id || '',
          course.name || '',
          teacherEmails[0] || '',
          teacherEmails[1] || '',
          teacherEmails[2] || '',
          teacherEmails[3] || '',
          course.enrollmentCode || '',
          false // Default value for createAssessmentRecord
        ];
      });

      // Append all rows in one go using batch update
      this.csm.appendRows(rows); // Use ClassroomSheetManager

      console.log('Classrooms fetched and written to sheet successfully with createAssessmentRecord column.');
    } catch (error) {
      console.error(`Failed to fetch Google Classrooms: ${error.message}`);
      throw error;
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
      hasCreateAssessmentRecord = true;
    }

    const rowsToUpdate = [];
    // Process rows without Classroom IDs
    data.forEach((row, index) => {
      if (index === 0 || row[0]) return; // Skip header row and rows with existing Classroom IDs

      try {
        const classroom = new GoogleClassroom({
          name: row[1],
          ownerId: row[2],
          teachers: row.slice(2, 6).filter(email => email) // Teacher emails
        });
        classroom.create();
        this.progressTracker.logInfo(`Classroom created: ${row[1]}`);

        // Update Classroom ID in the sheet
        // Before: this.sheet.getRange(index + 1, 1).setValue(classroom.id);
        // Before: this.sheet.getRange(index + 1, row.length + 1).setValue(false);
        rowsToUpdate.push({ rowIndex: index, courseId: classroom.id });

      } catch (error) {
        this.progressTracker.logError(`Failed to create classroom for row ${index + 1}: ${error.message}`);
      }
    });

    if (rowsToUpdate.length > 0) {
      const updateRows = rowsToUpdate.map(update => {
        const newRowData = ['', ...data[update.rowIndex].slice(1), false]; // Ensure 'createAssessmentRecord' is false
        newRowData[0] = update.courseId;
        return newRowData;
      });
      this.csm.writeData(updateRows, []); // Use ClassroomSheetManager to update rows
    }

    console.log('Google Classrooms created successfully with createAssessmentRecord column updated.');
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
    this.templateSheetIds = configurationManager.getAssessmentRecordTemplateId();
    this.destinationFolderId = configurationManager.getAssessmentRecordDestinationFolder();

    // 0) Initialise progress tracker
    let step = 0 //initialise step variable for the Progress Tracker
    this.progressTracker.updateProgress(step, 'Creating Assessment Records');

    // 1) Retrieve all rows
    const data = this.csm.getData(); 

    // 2) Quick check that there's something to process
    if (data.length < 2) {
      const errorMessage = "`No classrooms in the classroom sheet. Please fetch or create them first.`";
      this.progressTracker.logError(errorMessage);
      throw new Error(errorMessage);
    }

    // 3) Identify the header row and find createAssessmentRecord column
    const headers = data[0];
    const createARIndex = headers.indexOf('createAssessmentRecord');
    if (createARIndex === -1) {
      const errorMessage = "No 'createAssessmentRecord' column found. Please ensure it exists.";
      this.progressTracker.logError(errorMessage);
      throw new Error(errorMessage);
    }

    // 4) Check if 'Template File Id' column exists
    let templateFileIdIndex = headers.indexOf('AR File ID');
    if (templateFileIdIndex === -1) {
      templateFileIdIndex = headers.length; // Add it to the end
      headers.push('AR File ID');
    }

    // 5) Check if 'Year Group' column exists
    let yearGroupIndex = headers.indexOf('Year Group');
    if (yearGroupIndex === -1) {
      yearGroupIndex = headers.length;
      headers.push('Year Group');
    }


    // 6) We'll store row updates in memory for a final single batch update
    //    rowUpdates = array of { rowIndex, templateFileIdValue, spreadsheetIdValue }
    const rowUpdates = [];

    // 6a) We'll also gather teacher emails from columns "Teacher 1" through "Teacher 4"
    //     (which are columns 2..5 if the header is [Classroom ID (0), Name (1), Teacher 1 (2) ...])
    //     Adjust indices if your sheet differs.
    const teacherEmailsSet = new Set();

    // 7) Loop over all data rows and copy the template if createAssessmentRecord = true
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      // Collect any teacher emails from columns 2..5
      for (let col = 2; col <= 5; col++) {
        if (row[col] && row[col].trim()) {
          teacherEmailsSet.add(row[col].trim());
        }
      }

      if (row[createARIndex] === true) {
        try {
          const courseId = row[0] // Gets the ClassID from column A
          const className = row[1]; // Gets the Class Name from column B

          const copyResult = DriveManager.copyTemplateSheet(
            this.templateSheetId,
            this.destinationFolderId,
            className
          );

          if (copyResult.status === 'copied') {
            const newFileId = copyResult.fileId; // definitely not null in 'copied' case
            // We'll store the new file's ID in both 'Template File Id' and 'Spreadsheet ID'
            // so we can apply them all together in a single batch update at the end.
            rowUpdates.push({
              rowIndex: i, // 0-based index in `data`
              templateFileIdValue: newFileId
            });

            //Adds the class info to the newly created assessment record.

            ClassroomSheetManager.appendClassInfo(newFileId, className, courseId)

            // Update progress each time we successfully copy a template
            this.progressTracker.updateProgress(
              ++step,
              `Created assessment record for: ${className}`
            );
          } else if (copyResult.status === 'skipped') {
            console.log(copyResult.message);
            // Push the existing file ID to the readpsheet instead
            const existingFiledId = copyResult.fileId
            rowUpdates.push({
              rowIndex: i, // 0-based index in `data`
              templateFileIdValue: existingFiledId
            });

            this.progressTracker.updateProgress(
              ++step,
              `Skipping record for: ${className} (already exists)`
            );
          }
        } catch (error) {
          const errMsg = `Failed to copy template for row ${i + 1}: ${error.message}`;
          this.progressTracker.logError(errMsg);
          console.error(errMsg);
          throw new error(errMsg);
        }
      }
    }

    // 8) Build our final batch requests array
    const rowsToWrite = data.map((row, index) => {
      const update = rowUpdates.find(u => u.rowIndex === index);
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

    // 9) Clear Google Sheet otherwise the batch request appends to existing rows and creates duplicates.

    this.csm.clearSheet();

    // 10) Writes updated sheet

    // Update headers if new columns were added
    if (templateFileIdIndex === headers.length -1 || yearGroupIndex === headers.length -1) {
      this.csm.writeHeaders(headers);
    }

    // Writes other values to the sheet.

    this.csm.writeData(rowsToWrite.slice(1), []); // Use ClassroomSheetManager to update rows

    console.log("Assessment records created successfully where flagged.");

    // 11) Finally, share the folder with all teacher emails
    // (assuming your DriveManager has the updated shareFolder method)
    if (teacherEmailsSet.size > 0) {
      try {
        const shareResult = DriveManager.shareFolder(this.destinationFolderId, teacherEmailsSet);
        // Use the shareResult status to update progress or log a message
        if (shareResult.status === 'complete') {
          this.progressTracker.updateProgress(++step,
            `Folder shared with all ${teacherEmailsSet.size} teacher(s) successfully.`
          );
        } else if (shareResult.status === 'partial') {
          this.progressTracker.updateProgress(null,
            `Some teachers shared, some failed. Check logs.`
          );
        } else if (shareResult.status === 'none') {
          this.progressTracker.updateProgress(null,
            `No teacher emails provided; folder sharing skipped.`
          );
        }
        console.log(shareResult.message);
      } catch (error) {
        // If we throw on an error (folder not found, etc.)
        this.progressTracker.logError(`Failed to share folder: ${error.message}`);
        console.error(`Failed to share folder: ${error.message}`);
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

      console.log(
        `${assignments.length} assignments retrieved for courseId: ${courseId}`
      );
      return assignments;
    } catch (error) {
      console.error(
        `Error retrieving assignments for courseId ${courseId}: ${error}`
      );
      throw error;
    }
  }

  /**
   * Retrieves all active Google Classroom courses available to the user.
   * @return {Object[]} An array of objects containing course IDs and names.
   */
  getActiveClassrooms() {
    try {
      let courses = [];
      let pageToken;
      do {
        const response = Classroom.Courses.list({
          pageToken: pageToken,
          courseStates: ['ACTIVE']
        });
        if (response.courses && response.courses.length > 0) {
          const activeCourses = response.courses.map(course => ({
            id: course.id,
            name: course.name
          }));
          courses = courses.concat(activeCourses);
        }
        pageToken = response.nextPageToken;
      } while (pageToken);

      console.log(`${courses.length} active classrooms retrieved.`);
      return courses;
    } catch (error) {
      console.error('Error fetching active classrooms:', error);
      throw new Error('Failed to retrieve active classrooms. Please ensure that the Classroom API is enabled and you have the necessary permissions.');
    }
  }

  /**
   * Retrieves the course ID from the 'ClassInfo' sheet.
   * @returns {string} The course ID.
   */
  getCourseId() {
    // Before: const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    // Before: const sheet = spreadsheet.getSheetByName("ClassInfo");
    // After:  Consider if ClassroomSheetManager should handle this, but for now, keep it simple.
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getSheetByName("ClassInfo");
    if (!sheet) {
      console.error("ClassInfo sheet not found.");
      throw new Error("ClassInfo sheet not found.");
    }
    const courseId = sheet.getRange("B2").getValue();
    if (!courseId) {
      console.error("Course ID not found in ClassInfo sheet.");
      throw new Error("Course ID not found in ClassInfo sheet.");
    }
    return courseId.toString();
  }
}
