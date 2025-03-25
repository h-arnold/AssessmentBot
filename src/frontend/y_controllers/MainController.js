// MainController.js

/**
 * MainController Class
 *
 * Encapsulates global functions and coordinates various components.
 */
class MainController {
  constructor() {
    // Retain Utils for general utility methods not related to Classroom
    this.utils = Utils;

    // Access the singleton instance of ProgressTracker
    this.progressTracker = ProgressTracker.getInstance();

    // Instantiate TriggerController
    this.triggerController = new TriggerController();

    // Instantiate other components
    this.llmRequestManager = new LLMRequestManager();

    // Instantiate GoogleClassroomManager with necessary parameters
    this.classroomManager = new GoogleClassroomManager();

    // Attempt to instantiate UIManager only in user context to avoid issues with triggers
    try {
      this.uiManager = new UIManager();
      console.log("UIManager instantiated successfully.");
    } catch (error) {
      console.error("UIManager cannot be instantiated: " + error);
      this.uiManager = null; // UIManager is not available in this context
    }

  }


}

  /** 
   * === Workflow Methods ===
   */

  saveStartAndShowProgress(assignmentTitle, slideIds, assignmentId, referenceSlideId, emptySlideId) {
    try {
      this.saveSlideIdsForAssignment(assignmentTitle, slideIds);
      this.startProcessing(assignmentId, referenceSlideId, emptySlideId);
      this.progressTracker.startTracking();
      
      // Null check is necessary because UIManager may be null when running from time-based triggers
      // or when executed in contexts where UI interactions are not available
      if (this.uiManager) {
        this.uiManager.showProgressModal();
      }

      //This is a hacky way of asynchronously 'warming up' the langflow backend which from a cold start takes around 60 seconds. 
      // As the rest of the workflow is run from a time-based trigger, waiting for a response from this method shouldn't affect the startup time for the rest of the assessment.
      this.llmRequestManager.warmUpLLM();

    } catch (error) {
      this.utils.toastMessage("Failed to start processing: " + error.message, "Error", 5);
      console.error("Error in saveStartAndShowProgress:", error);
    }
  }

  startProcessing(assignmentId, referenceSlideId, emptySlideId) {
    const properties = PropertiesService.getDocumentProperties();
    let triggerId;

    try {
      triggerId = this.triggerController.createTimeBasedTrigger('triggerProcessSelectedAssignment');
      console.log(`Trigger created for triggerProcessSelectedAssignment with triggerId: ${triggerId}`);
    } catch (error) {
      console.error(`Error creating trigger: ${error}`);
      this.utils.toastMessage("Failed to create trigger: " + error.message, "Error", 5);
      throw error;
    }

    try {
      properties.setProperty('assignmentId', assignmentId);
      properties.setProperty('referenceSlideId', referenceSlideId);
      properties.setProperty('emptySlideId', emptySlideId);
      properties.setProperty('triggerId', triggerId);
      console.log("Properties set for processing.");
    } catch (error) {
      console.error(`Error setting properties: ${error}`);
      this.utils.toastMessage("Failed to set processing properties: " + error.message, "Error", 5);
      throw error;
    }
  }

  // showProgressModal() method removed as it was redundant

  processSelectedAssignment() {
    const lock = LockService.getDocumentLock();

    if (!lock.tryLock(5000)) {
      this.progressTracker.logError(`Script is already running. Please try again later.`);
      this.utils.toastMessage("Another process is currently running. Please wait.", "Error", 5);
      return;
    }

    try {
      const properties = PropertiesService.getDocumentProperties();
      const assignmentId = properties.getProperty('assignmentId');
      const referenceSlideId = properties.getProperty('referenceSlideId');
      const emptySlideId = properties.getProperty('emptySlideId');
      const triggerId = properties.getProperty('triggerId');
      let step = 1;

      if (!assignmentId || !referenceSlideId || !emptySlideId || !triggerId) {
        this.triggerController.removeTriggers('triggerProcessSelectedAssignment');
        throw new Error("Missing parameters for processing.");
      }

      this.triggerController.deleteTriggerById(triggerId);
      console.log("Trigger deleted after processing.");

      this.progressTracker.startTracking();
      this.progressTracker.updateProgress(step++, "Assessment run starting.");

      const courseId = this.classroomManager.getCourseId();
      console.log('Course ID retrieved: ' + courseId);
      this.progressTracker.updateProgress(step++, `Course ID retrieved: ${courseId}`);

      this.progressTracker.updateProgress(step++, "Creating Assignment instance.");
      const assignment = new Assignment(courseId, assignmentId, referenceSlideId, emptySlideId);
      this.progressTracker.updateProgress(null, "Assignment instance created.");

      this.progressTracker.updateProgress(step++, "Fetching all students.");
      const students = Student.fetchAllStudents(courseId);
      this.progressTracker.updateProgress(null, `${students.length} students fetched.`);

      this.progressTracker.updateProgress(step++, "Adding students to the assignment.");
      students.forEach(student => assignment.addStudent(student));
      this.progressTracker.updateProgress(null, "All students added to the assignment.");

      this.progressTracker.updateProgress(step++, "Getting the tasks from the reference slides.");
      assignment.populateTasksFromSlides();
      this.progressTracker.updateProgress(null, "Tasks populated from reference slides.");

      this.progressTracker.updateProgress(step++, "Fetching submitted slides from students.");
      assignment.fetchSubmittedSlides();
      this.progressTracker.updateProgress(null, "Submitted slides fetched.");

      this.progressTracker.updateProgress(step++, "Extracting student work from slides.");
      assignment.processAllSubmissions();
      this.progressTracker.updateProgress(null, "All student work extracted.");

      this.progressTracker.updateProgress(step++, "Processing Images.");
      assignment.processImages();
      this.progressTracker.updateProgress(null, "Images uploaded.");

      this.progressTracker.updateProgress(step++, "Assessing student responses.");
      assignment.assessResponses();
      this.progressTracker.updateProgress(null, "Responses assessed.");

      this.progressTracker.updateProgress(step++, "Creating the analysis sheet.");
      const analysisSheet = new AnalysisSheetManager(assignment);
      analysisSheet.createAnalysisSheet();
      this.progressTracker.updateProgress(null, "Analysis sheet created.");

      this.progressTracker.updateProgress(step++, "Updating the overview sheet.");
      const overviewSheetManager = new OverviewSheetManager();
      overviewSheetManager.createOverviewSheet();
      this.progressTracker.updateProgress(null, "Overview sheet updated.");

      this.progressTracker.updateProgress(null, "Assessment run completed successfully.");
      this.progressTracker.complete();

      this.utils.toastMessage("Assessment run completed successfully.", "Success", 5);
      console.log("Assessment run completed successfully.");

    } catch (error) {
      this.progressTracker.logError(error.message);
      console.error("Error during assessment process:", error);
      this.utils.toastMessage("An error occurred: " + error.message, "Error", 5);
      throw error;
    } finally {
      lock.releaseLock();
      console.log("Lock released.");

      try {
        const properties = PropertiesService.getDocumentProperties();
        properties.deleteProperty('assignmentId');
        properties.deleteProperty('referenceSlideId');
        properties.deleteProperty('emptySlideId');
        properties.deleteProperty('triggerId');
        console.log("Document properties cleaned up.");
      } catch (cleanupError) {
        this.progressTracker.logError(`Failed to clean up properties: ${cleanupError.message}`);
        console.error(`Error during property cleanup: ${cleanupError}`);
      }
    }
  }

}