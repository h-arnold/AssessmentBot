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
      console.log('UIManager instantiated successfully.');
    } catch (error) {
      console.error('UIManager cannot be instantiated: ' + error);
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
  saveStartAndShowProgress(
    assignmentTitle,
    documentIds,
    assignmentId,
    referenceDocumentId,
    templateDocumentId
  ) {
    try {
      // Save and immediately get the stored assignment properties (including documentType)
      const assignmentProps = AssignmentPropertiesManager.saveDocumentIdsForAssignment(
        assignmentTitle,
        documentIds
      );
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
    } catch (error) {
      this.utils.toastMessage('Failed to start processing: ' + error.message, 'Error', 5);
      this.progressTracker.logAndThrowError(
        'Error in saveStartAndShowProgress: ' + error.message,
        error
      );
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
      console.log(
        `Trigger created for triggerProcessSelectedAssignment with triggerId: ${triggerId}`
      );
    } catch (error) {
      this.progressTracker.logAndThrowError(`Error creating trigger: ${error.message}`, error);
      this.utils.toastMessage('Failed to create trigger: ' + error.message, 'Error', 5);
    }

    try {
      properties.setProperty('assignmentId', assignmentId);
      properties.setProperty('referenceDocumentId', referenceDocumentId);
      properties.setProperty('templateDocumentId', templateDocumentId);
      properties.setProperty('triggerId', triggerId);
      properties.setProperty('documentType', documentType); // Store documentType for downstream use
      console.log('Properties set for processing.');
    } catch (error) {
      this.progressTracker.logAndThrowError(`Error setting properties: ${error.message}`, error);
      this.utils.toastMessage('Failed to set processing properties: ' + error.message, 'Error', 5);
    }
  }

  /**
   * Processes a Google Slides assignment: fetches students, adds them, populates tasks, fetches and processes submissions, images, and assesses responses.
   * @param {string} courseId - The Classroom course ID
   * @param {string} assignmentId - The assignment ID
   * @param {string} referenceDocumentId - The reference Slides document ID
   * @param {string} templateDocumentId - The template Slides document ID
   * @return {SheetsAssignment} The populated SlidesAssignment instance
   */
  processSheetsAssignment(courseId, assignmentId, referenceDocumentId, templateDocumentId) {
    this.progressTracker.updateProgress('Creating Assignment instance.');
    const assignment = new SheetsAssignment(
      courseId,
      assignmentId,
      referenceDocumentId,
      templateDocumentId
    );
    this.progressTracker.updateProgress('Assignment instance created.', false);

    this.progressTracker.updateProgress('Fetching all students.');
    const students = ClassroomManager.fetchAllStudents(courseId);
    this.progressTracker.updateProgress(`${students.length} students fetched.`, false);

    this.progressTracker.updateProgress('Adding students to the assignment.');
    students.forEach((student) => assignment.addStudent(student));
    this.progressTracker.updateProgress('All students added to the assignment.', false);

    this.progressTracker.updateProgress('Getting the tasks from the reference document.');
    assignment.populateTasks();
    this.progressTracker.updateProgress('Tasks populated from reference document.', false);

    this.progressTracker.updateProgress('Fetching submitted documents from students.');
    assignment.fetchSubmittedDocuments();
    this.progressTracker.updateProgress('Submitted documents fetched.', false);

    this.progressTracker.updateProgress('Extracting student work from documents.');
    assignment.processAllSubmissions();
    this.progressTracker.updateProgress('All student work extracted.', false);

    this.progressTracker.updateProgress('Assessing student responses.');
    assignment.assessResponses();
    this.progressTracker.updateProgress('Responses assessed.', false);

    // Use new StudentSubmission model (assignment.submissions). Legacy studentTasks removed.
    const feedback = new SheetsFeedback(assignment.submissions);
    feedback.applyFeedback();

    return assignment;
  }

  /**
   * Processes a Google Slides assignment: fetches students, adds them, populates tasks, fetches and processes submissions, images, and assesses responses.
   * @param {string} courseId - The Classroom course ID
   * @param {string} assignmentId - The assignment ID
   * @param {string} referenceDocumentId - The reference Slides document ID
   * @param {string} templateDocumentId - The template Slides document ID
   * @return {SlidesAssignment} The populated SlidesAssignment instance
   */
  processSlidesAssignment(courseId, assignmentId, referenceDocumentId, templateDocumentId) {
    this.progressTracker.updateProgress('Creating Assignment instance.');
    const assignment = new SlidesAssignment(
      courseId,
      assignmentId,
      referenceDocumentId,
      templateDocumentId
    );
    this.progressTracker.updateProgress('Assignment instance created.', false);

    this.progressTracker.updateProgress('Fetching all students.');
    const students = ClassroomManager.fetchAllStudents(courseId);
    this.progressTracker.updateProgress(`${students.length} students fetched.`, false);

    this.progressTracker.updateProgress('Adding students to the assignment.');
    students.forEach((student) => assignment.addStudent(student));
    this.progressTracker.updateProgress('All students added to the assignment.', false);

    this.progressTracker.updateProgress('Getting the tasks from the reference document.');
    assignment.populateTasks();
    this.progressTracker.updateProgress('Tasks populated from reference document.', false);

    this.progressTracker.updateProgress('Fetching submitted documents from students.');
    assignment.fetchSubmittedDocuments();
    this.progressTracker.updateProgress('Submitted documents fetched.', false);

    this.progressTracker.updateProgress('Extracting student work from documents.');
    assignment.processAllSubmissions();
    this.progressTracker.updateProgress('All student work extracted.', false);

    this.progressTracker.updateProgress('Processing Images.');
    assignment.processImages();
    this.progressTracker.updateProgress('Images uploaded.', false);

    this.progressTracker.updateProgress('Assessing student responses.');
    assignment.assessResponses();
    this.progressTracker.updateProgress('Responses assessed.', false);

    return assignment;
  }

  /**
   * Analyses the assignment data and generates analysis and overview sheets.
   * @param {SlidesAssignment} assignment - The processed SlidesAssignment instance
   */
  analyseAssignmentData(assignment) {
    this.progressTracker.updateProgress('Creating the analysis sheet.');
    const analysisSheet = new AnalysisSheetManager(assignment);
    analysisSheet.createAnalysisSheet();
    this.progressTracker.updateProgress('Analysis sheet created.', false);

    this.progressTracker.updateProgress('Updating the overview sheet.');
    const overviewSheetManager = new OverviewSheetManager();
    overviewSheetManager.createOverviewSheet();
    this.progressTracker.updateProgress('Overview sheet updated.', false);
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
      this.utils.toastMessage('Another process is currently running. Please wait.', 'Error', 5);
      return;
    }

    try {
      const properties = PropertiesService.getDocumentProperties();
      const assignmentId = properties.getProperty('assignmentId');
      const referenceDocumentId = properties.getProperty('referenceDocumentId');
      const templateDocumentId = properties.getProperty('templateDocumentId');
      const triggerId = properties.getProperty('triggerId');
      const documentType = properties.getProperty('documentType');
      let step = 1;

      if (
        !assignmentId ||
        !referenceDocumentId ||
        !templateDocumentId ||
        !triggerId ||
        !documentType
      ) {
        this.triggerController.removeTriggers('triggerProcessSelectedAssignment');
        this.progressTracker.logAndThrowError('Missing parameters for processing.');
      }

      this.triggerController.deleteTriggerById(triggerId);
      console.log('Trigger deleted after processing.');
      this.progressTracker.startTracking();
      this.progressTracker.updateProgress('Assessment run starting.');

      const courseId = this.classroomManager.getCourseId();
      console.log('Course ID retrieved: ' + courseId);
      this.progressTracker.updateProgress(`Course ID retrieved: ${courseId}`, false);

      const abClassManager = new ABClassManager;  
      const abClass = abClassManager.loadClass(courseId);

      // Process the assignment based on its type.
      let assignment;
      if (documentType === 'SLIDES') {
        assignment = this.processSlidesAssignment(
          courseId,
          assignmentId,
          referenceDocumentId,
          templateDocumentId,
          documentType
        );
      } else if (documentType === 'SHEETS') {
        assignment = this.processSheetsAssignment(
          courseId,
          assignmentId,
          referenceDocumentId,
          templateDocumentId
        );
      } else {
        const errorMsg = `Document type '${documentType}' is not supported.`;
        this.progressTracker.logAndThrowError(errorMsg);
      }

      // Update lastUpdated value - when JsonDbApp is integrated, this will also be the point where the assignment data is written to the DB

      assignment.touchUpdated();

      // Save assignment data to class

      abClass.addAssignment(assignment);

      // Analyse assignment data
      this.analyseAssignmentData(assignment);

      this.progressTracker.updateProgress('Assessment run completed successfully.', false);
      this.progressTracker.complete();

      this.utils.toastMessage('Assessment run completed successfully.', 'Success', 5);
      console.log('Assessment run completed successfully.');
    } catch (error) {
      this.progressTracker.logAndThrowError(error.message, error);
    } finally {
      lock.releaseLock();
      console.log('Lock released.');
      try {
        const properties = PropertiesService.getDocumentProperties();
        properties.deleteProperty('assignmentId');
        properties.deleteProperty('referenceDocumentId');
        properties.deleteProperty('templateDocumentId');
        properties.deleteProperty('triggerId');
        properties.deleteProperty('documentType'); // Clean up documentType property as well
        console.log('Document properties cleaned up.');
      } catch (cleanupError) {
        this.logError(`Failed to clean up properties: ${cleanupError.message}`, cleanupError);
      }
    }
  }

  /**
   * Test workflow function for debugging purposes.
   */
  testWorkflow() {
    console.log('Test workflow initiated');
    // Implementation details would go here
  }
}
