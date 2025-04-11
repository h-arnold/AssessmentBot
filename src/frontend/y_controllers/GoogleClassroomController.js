class GoogleClassroomController {
    constructor() {
        this.classroomManager = new GoogleClassroomManager();
    }

    fetchGoogleClassrooms() {
        try {
            const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
            let classroomSheet = spreadsheet.getSheetByName("Classrooms");

            // If 'Classroom' sheet doesn't exist, create it
            if (!classroomSheet) {
                classroomSheet = spreadsheet.insertSheet("Classrooms");
            }

            // Ensure that the GoogleClassroomManager uses the 'Classroom' sheet
            this.classroomManager.sheet = classroomSheet;

            // Now call the manager's fetchGoogleClassrooms method, which writes data to the sheet
            this.classroomManager.fetchGoogleClassrooms();

            Utils.toastMessage("Google Classrooms fetched and written to 'Classroom' sheet successfully.", "Success", 5);
            console.log("Google Classrooms fetched successfully.");
        } catch (error) {
            console.error("Error fetching Google Classrooms:", error);
            Utils.toastMessage("Failed to fetch classrooms: " + error.message, "Error", 5);
            throw error;
        }
    }


    createGoogleClassrooms() {
        try {
            this.classroomManager.createGoogleClassrooms();
            Utils.toastMessage("Google Classrooms created successfully.", "Success", 5);
            console.log("Google Classrooms created successfully.");
        } catch (error) {
            console.error("Error creating Google Classrooms:", error);
            Utils.toastMessage("Failed to create classrooms: " + error.message, "Error", 5);
            throw error;
        }
    }

    updateGoogleClassrooms() {
        try {
            // Assuming `updateClassrooms` was a method that might need to be implemented similarly to create.
            this.classroomManager.updateClassrooms(); // This method is not defined in the snippet, consider implementing.
            Utils.toastMessage("Google Classrooms updated successfully.", "Success", 5);
            console.log("Google Classrooms updated successfully.");
        } catch (error) {
            console.error("Error updating Google Classrooms:", error);
            Utils.toastMessage("Failed to update classrooms: " + error.message, "Error", 5);
            throw error;
        }
    }

    createAssessmentRecords() {
        // Lazy isntantiation of ProgressTracker and UIManager as they're only needed for this method.
        // TODO: Potentially move this method elsewhere - this would probably be better in the BaseUpdateAndInit class I think
        const progressTracker = new ProgressTracker();
        const uiManager = UIManager.getInstance();

        try {
            // Start progress tracking
            progressTracker.startTracking();

            // Show the progress modal (if the UI is available)
            if (uiManager) {
                uiManager.showProgressModal();
            } else {
                console.warn("UIManager is not available; cannot show the progress modal.");
            }

            // Perform the actual record creation (in GoogleClassroomManager)
            this.classroomManager.createAssessmentRecords();

            // If everything went well, complete the progress
            progressTracker.complete();
            Utils.toastMessage("Assessment documents set up successfully.", "Success", 5);
            console.log("Assessment documents set up successfully.");
        } catch (error) {
            // Log and display any errors
            console.error("Error setting up assessment documents:", error);
            progressTracker.logError(error.message);
            Utils.toastMessage(`Failed to set up assessment documents: ${error.message} \n ${error.stack}`, "Error", 5);
            throw error;
        }
    }


    saveClassroom(courseName, courseId) {
        try {
            // Directly update ClassInfo sheet
            const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
            let sheet = spreadsheet.getSheetByName('ClassInfo');

            // If 'ClassInfo' sheet doesn't exist, create it
            if (!sheet) {
                sheet = spreadsheet.insertSheet('ClassInfo');
            }

            // Set headers in A1 and B1
            sheet.getRange('A1').setValue('Class Name');
            sheet.getRange('A2').setValue('Course ID');

            // Write the selected classroom's name and ID to A2 and B2
            sheet.getRange('B1').setValue(courseName);
            sheet.getRange('B2').setValue(courseId);

            console.log(`Classroom saved: ${courseName} (${courseId})`);
        } catch (error) {
            console.error("Error saving classroom:", error);
            Utils.toastMessage("Failed to save classroom: " + error.message, "Error", 5);
            throw error;
        }
    }

    getClassrooms() {
        return this.classroomManager.getActiveClassrooms()
    }
}