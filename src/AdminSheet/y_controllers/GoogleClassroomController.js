class GoogleClassroomController {
  constructor() {
    this.classroomManager = new GoogleClassroomManager();
  }

  fetchGoogleClassrooms() {
    const progressTracker = ProgressTracker.getInstance();
    try {
      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      let classroomSheet = spreadsheet.getSheetByName('Classrooms');

      // If 'Classroom' sheet doesn't exist, create it
      if (!classroomSheet) {
        classroomSheet = spreadsheet.insertSheet('Classrooms');
      }

      // Ensure that the GoogleClassroomManager uses the 'Classroom' sheet
      this.classroomManager.sheet = classroomSheet;

      // Now call the manager's fetchGoogleClassrooms method, which writes data to the sheet
      this.classroomManager.fetchGoogleClassrooms();

      Utils.toastMessage(
        "Google Classrooms fetched and written to 'Classroom' sheet successfully.",
        'Success',
        5
      );
      console.log('Google Classrooms fetched successfully.');
    } catch (error) {
      progressTracker.logAndThrowError('Error fetching Google Classrooms: ' + error.message, error);
      Utils.toastMessage('Failed to fetch classrooms: ' + error.message, 'Error', 5);
    }
  }

  createGoogleClassrooms() {
    const progressTracker = ProgressTracker.getInstance();
    try {
      this.classroomManager.createGoogleClassrooms();
      Utils.toastMessage('Google Classrooms created successfully.', 'Success', 5);
      console.log('Google Classrooms created successfully.');
    } catch (error) {
      progressTracker.logAndThrowError('Error creating Google Classrooms: ' + error.message, error);
      Utils.toastMessage('Failed to create classrooms: ' + error.message, 'Error', 5);
    }
  }

  updateGoogleClassrooms() {
    const progressTracker = ProgressTracker.getInstance();
    try {
      // Assuming `updateClassrooms` was a method that might need to be implemented similarly to create.
      this.classroomManager.updateClassrooms(); // This method is not defined in the snippet, consider implementing.
      Utils.toastMessage('Google Classrooms updated successfully.', 'Success', 5);
      console.log('Google Classrooms updated successfully.');
    } catch (error) {
      progressTracker.logAndThrowError('Error updating Google Classrooms: ' + error.message, error);
      Utils.toastMessage('Failed to update classrooms: ' + error.message, 'Error', 5);
    }
  }

  createAssessmentRecords() {
    const progressTracker = ProgressTracker.getInstance();
    const uiManager = UIManager.getInstance();

    try {
      // Start progress tracking
      progressTracker.startTracking();

      // Show the progress modal (if the UI is available)
      if (uiManager) {
        uiManager.showProgressModal();
      } else {
        console.warn('UIManager is not available; cannot show the progress modal.');
      }

      // Perform the actual record creation (in GoogleClassroomManager)
      this.classroomManager.createAssessmentRecords();

      // If everything went well, complete the progress
      progressTracker.complete();
      Utils.toastMessage('Assessment documents set up successfully.', 'Success', 5);
      console.log('Assessment documents set up successfully.');
    } catch (error) {
      progressTracker.logAndThrowError(error.message, error);
    }
  }

  saveClassroom(courseName, courseId) {
    const progressTracker = ProgressTracker.getInstance();
    try {
      // Store class info in Document Properties
      const classInfo = {
        ClassName: courseName,
        CourseId: String(courseId),
        YearGroup: null,
      };
      ConfigurationManager.getInstance().setClassInfo(classInfo);

      console.log(`Classroom saved: ${courseName} (${courseId})`);
    } catch (error) {
      progressTracker.logAndThrowError('Error saving classroom: ' + error.message, error);
      Utils.toastMessage('Failed to save classroom: ' + error.message, 'Error', 5);
    }
  }

  getClassrooms() {
    return this.classroomManager.getActiveClassrooms();
  }
}
