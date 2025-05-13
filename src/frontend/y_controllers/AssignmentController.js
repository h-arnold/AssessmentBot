// AssignmentController.js

/**
 * AssignmentController Class
 *
 * Encapsulates assignment-related functionality and coordinates various components.
 */
class AssignmentController {
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
      this.uiManager = UIManager.getInstance();
      console.log("UIManager instantiated successfully.");
    } catch (error) {
      console.error("UIManager cannot be instantiated: " + error);
      this.uiManager = null; // UIManager is not available in this context
    }
  }


  /**
   * Initializes the assessment process by saving document IDs and starting progress tracking.
   * Also attempts to warm up the LLM backend asynchronously.
   * 
   * @param {string} assignmentTitle - The title of the assignment
   * @param {Object} documentIds - Object containing Google document IDs to be processed (referenceDocumentId, templateDocumentId)
   * @param {string} assignmentId - Unique identifier for the assignment
   * @param {string} referenceDocumentId - ID of the reference/master document
   * @param {string} templateDocumentId - ID of the template document
   * @throws {Error} If saving or initialization process fails
   */
  saveStartAndShowProgress(assignmentTitle, documentIds, assignmentId, referenceDocumentId, templateDocumentId) {
    try {
      // Save and immediately get the stored assignment properties (including documentType)
      const assignmentProps = AssignmentPropertiesManager.saveDocumentIdsForAssignment(assignmentTitle, documentIds);
      const documentType = assignmentProps.documentType;
      this.startProcessing(assignmentId, referenceDocumentId, templateDocumentId, documentType);
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

  /**
   * Initiates the Assignment Assessment Workflow by creating a time-based trigger and storing necessary properties.
   * This method sets up `triggerProcessSelectedAssignment` by creating the trigger and storing assignment details 
   * in document properties for access when the trigger executes.
   *
   * @param {string} assignmentId - The ID of the assignment to be processed
   * @param {string} referenceDocumentId - The ID of the reference/solution document
   * @param {string} templateDocumentId - The ID of the template document
   * @param {string} documentType - The type of the document (e.g., "SLIDES" or "SHEETS")
   * @throws {Error} If trigger creation fails or if setting document properties fails
   */
  startProcessing(assignmentId, referenceDocumentId, templateDocumentId, documentType) {
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
      properties.setProperty('referenceDocumentId', referenceDocumentId);
      properties.setProperty('templateDocumentId', templateDocumentId);
      properties.setProperty('triggerId', triggerId);
      properties.setProperty('documentType', documentType); // Store documentType for downstream use
      console.log("Properties set for processing.");
    } catch (error) {
      console.error(`Error setting properties: ${error}`);
      this.utils.toastMessage("Failed to set processing properties: " + error.message, "Error", 5);
      throw error;
    }
  }

  /**
   * Processes and assesses a selected Google Classroom assignment.
   * This is the main orchestration method that handles the complete assessment workflow:
   * - Manages document locks to prevent concurrent processing
   * - Retrieves and validates required parameters
   * - Creates an Assignment instance with student data
   * - Extracts and processes student submissions
   * - Processes images from submissions
   * - Assesses student responses
   * - Generates analysis sheets and overview reports
   * 
   * The method includes progress tracking and error handling throughout the process.
   * It cleans up resources (locks, properties) even if errors occur.
   * 
   * @throws {Error} If required parameters are missing or if processing fails
   * @returns {void}
   * 
   * Dependencies:
   * - Requires document properties: assignmentId, referenceDocumentId, templateDocumentId, triggerId
   * - Uses services: LockService, PropertiesService
   * - Relies on controllers: triggerController, progressTracker, classroomManager
   * - Integrates with: Assignment, Student, AnalysisSheetManager, OverviewSheetManager
   */
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
      const referenceDocumentId = properties.getProperty('referenceDocumentId');
      const templateDocumentId = properties.getProperty('templateDocumentId');
      const triggerId = properties.getProperty('triggerId');
      let step = 1;

      if (!assignmentId || !referenceDocumentId || !templateDocumentId || !triggerId) {
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
      const assignment = new SlidesAssignment(courseId, assignmentId, referenceDocumentId, templateDocumentId);
      this.progressTracker.updateProgress(null, "Assignment instance created.");

      this.progressTracker.updateProgress(step++, "Fetching all students.");
      const students = Student.fetchAllStudents(courseId);
      this.progressTracker.updateProgress(null, `${students.length} students fetched.`);

      this.progressTracker.updateProgress(step++, "Adding students to the assignment.");
      students.forEach(student => assignment.addStudent(student));
      this.progressTracker.updateProgress(null, "All students added to the assignment.");

      this.progressTracker.updateProgress(step++, "Getting the tasks from the reference document.");
      assignment.populateTasksFromSlides();
      this.progressTracker.updateProgress(null, "Tasks populated from reference document.");

      this.progressTracker.updateProgress(step++, "Fetching submitted documents from students.");
      assignment.fetchSubmittedSlides();
      this.progressTracker.updateProgress(null, "Submitted documents fetched.");

      this.progressTracker.updateProgress(step++, "Extracting student work from documents.");
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
        properties.deleteProperty('referenceDocumentId');
        properties.deleteProperty('templateDocumentId');
        properties.deleteProperty('triggerId');
        properties.deleteProperty('documentType'); // Clean up documentType property as well
        console.log("Document properties cleaned up.");
      } catch (cleanupError) {
        this.progressTracker.logError(`Failed to clean up properties: ${cleanupError.message}`);
        console.error(`Error during property cleanup: ${cleanupError}`);
      }
    }
  }

  /**
   * Test workflow function for debugging purposes.
   */
  testWorkflow() {
    console.log("Test workflow initiated");
    // Implementation details would go here
  }
}