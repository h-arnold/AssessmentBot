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

    // Note: Other controllers and managers are now instantiated lazily in each method
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

      // UIManager may not be available in non-UI contexts (e.g., time-based triggers)
      try {
        const uiManager = UIManager.getInstance();
        if (uiManager && typeof uiManager.showProgressModal === 'function') {
          uiManager.showProgressModal();
        }
      } catch (uiError) {
        // Silently ignore UI errors in non-UI contexts
        const logger = ABLogger?.getInstance ? ABLogger.getInstance() : null;
        if (logger && typeof logger.warn === 'function') {
          logger.warn('UIManager not available or failed to show progress modal:', uiError);
        }
      }

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
    // Lazily instantiate TriggerController
    const triggerController = new TriggerController();
    const properties = PropertiesService.getDocumentProperties();
    let triggerId;

    try {
      triggerId = triggerController.createTimeBasedTrigger('triggerProcessSelectedAssignment');
      console.log(
        `Trigger created for triggerProcessSelectedAssignment with triggerId: ${triggerId}`
      );
    } catch (error) {
      this.progressTracker.logAndThrowError(`Error creating trigger: ${error.message}`, error);
      this.utils.toastMessage('Failed to create trigger: ' + error.message, 'Error', 5);
    }

    try {
      this.applyDocumentProperties(properties, {
        assignmentId,
        referenceDocumentId,
        templateDocumentId,
        triggerId,
        documentType,
      });
      console.log('Properties set for processing.');
    } catch (error) {
      this.progressTracker.logAndThrowError(`Error setting properties: ${error.message}`, error);
      this.utils.toastMessage('Failed to set processing properties: ' + error.message, 'Error', 5);
    }
  }

  /**
   * Processes a Google Sheets assignment: adds the preloaded class roster, populates tasks, fetches and processes submissions, and assesses responses.
   * @param {string} courseId - The Classroom course ID
   * @param {string} assignmentId - The assignment ID
   * @param {string} referenceDocumentId - The reference Sheets document ID
   * @return {SheetsAssignment} The populated SheetsAssignment instance
   * @param {Object[]} students - The class roster sourced from the ABClass record
   * @return {SheetsAssignment} The populated SlidesAssignment instance
   */
  processSheetsAssignment(
    courseId,
    assignmentId,
    referenceDocumentId,
    templateDocumentId,
    students
  ) {
    if (!Array.isArray(students)) {
      throw new TypeError('students must be provided as an array');
    }

    const assignment = this.createAssignmentInstance(
      'SHEETS',
      courseId,
      assignmentId,
      referenceDocumentId,
      templateDocumentId
    );

    this.runAssignmentPipeline(assignment, students);

    // Use new StudentSubmission model (assignment.submissions). Legacy studentTasks removed.
    const feedback = new SheetsFeedback(assignment.submissions);
    feedback.applyFeedback();

    return assignment;
  }

  /**
   * Processes a Google Slides assignment: adds the preloaded class roster, populates tasks, fetches and processes submissions, images, and assesses responses.
   * @param {string} courseId - The Classroom course ID
   * @param {string} assignmentId - The assignment ID
   * @param {string} referenceDocumentId - The reference Slides document ID
   * @param {string} templateDocumentId - The template Slides document ID
   * @param {Object[]} students - The class roster sourced from the ABClass record
   * @return {SlidesAssignment} The populated SlidesAssignment instance
   */
  processSlidesAssignment(
    courseId,
    assignmentId,
    referenceDocumentId,
    templateDocumentId,
    students
  ) {
    if (!Array.isArray(students)) {
      throw new TypeError('students must be provided as an array');
    }

    const assignment = this.createAssignmentInstance(
      'SLIDES',
      courseId,
      assignmentId,
      referenceDocumentId,
      templateDocumentId
    );

    this.runAssignmentPipeline(assignment, students, { includeImages: true });

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

      if (
        !assignmentId ||
        !referenceDocumentId ||
        !templateDocumentId ||
        !triggerId ||
        !documentType
      ) {
        // Lazily instantiate TriggerController to clean up pending triggers
        const triggerController = new TriggerController();
        triggerController.removeTriggers('triggerProcessSelectedAssignment');
        this.progressTracker.logAndThrowError('Missing parameters for processing.');
      }

      // Lazily instantiate TriggerController for trigger deletion
      const triggerController = new TriggerController();
      triggerController.deleteTriggerById(triggerId);
      console.log('Trigger deleted after processing.');
      this.progressTracker.startTracking();
      this.progressTracker.updateProgress('Assessment run starting.');

      // Lazily instantiate ClassroomManager
      const classroomManager = new GoogleClassroomManager();
      const courseId = classroomManager.getCourseId();
      console.log('Course ID retrieved: ' + courseId);
      this.progressTracker.updateProgress(`Course ID retrieved: ${courseId}`, false);

      const abClassController = new ABClassController();
      const abClass = abClassController.loadClass(courseId);

      const assignmentIndex = abClass.findAssignmentIndex((a) => a.assignmentId === assignmentId);
      if (assignmentIndex >= 0) {
        abClassController.rehydrateAssignment(abClass, assignmentId);
      }

      // Process the assignment based on its type.
      let assignment;
      const students = abClass.students;
      // Use the hydrated roster directly; when attached to an Assignment instance it remains transient
      // and must not be persisted back to storage.

      if (documentType === 'SLIDES') {
        assignment = this.processSlidesAssignment(
          courseId,
          assignmentId,
          referenceDocumentId,
          templateDocumentId,
          students
        );
      } else if (documentType === 'SHEETS') {
        assignment = this.processSheetsAssignment(
          courseId,
          assignmentId,
          referenceDocumentId,
          templateDocumentId,
          students
        );
      } else {
        const errorMsg = `Document type '${documentType}' is not supported.`;
        this.progressTracker.logAndThrowError(errorMsg);
      }

      // Update lastUpdated value and persist assignment data

      assignment.touchUpdated();

      // Persist assignment using controller pattern - writes full assignment to dedicated
      // collection and stores partial summary in ABClass
      abClassController.persistAssignmentRun(abClass, assignment);

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
        // Use the hydrated roster from the class record for processing. This data is transient
        // and must not be persisted with the Assignment to prevent data duplication.
        const properties = PropertiesService.getDocumentProperties();
        this.clearDocumentProperties(properties, [
          'assignmentId',
          'referenceDocumentId',
          'templateDocumentId',
          'triggerId',
          'documentType',
        ]);
        console.log('Document properties cleaned up.');
      } catch (cleanupError) {
        this.progressTracker.logError(`Failed to clean up properties: ${cleanupError.message}`, {
          err: cleanupError,
        });
      }
    }
  }

  /**
   * Creates an assignment instance using the factory pattern with progress tracking.
   * @param {string} documentType - Type of the document ('SLIDES' or 'SHEETS').
   * @param {string} courseId - The Classroom course ID.
   * @param {string} assignmentId - The assignment ID.
   * @param {string} referenceDocumentId - The reference document ID.
   * @param {string} templateDocumentId - The template document ID.
   * @return {SlidesAssignment|SheetsAssignment} The instantiated assignment.
   */
  createAssignmentInstance(
    documentType,
    courseId,
    assignmentId,
    referenceDocumentId,
    templateDocumentId
  ) {
    return this.runStage(
      'Creating Assignment instance.',
      () =>
        Assignment.create(
          documentType,
          courseId,
          assignmentId,
          referenceDocumentId,
          templateDocumentId
        ),
      'Assignment instance created.'
    );
  }

  /**
   * Runs shared assignment stages with optional image processing.
   * @param {SlidesAssignment|SheetsAssignment} assignment - Assignment instance to populate.
   * @param {Object[]} students - Students sourced from the class record.
   * @param {Object} [options] - Additional pipeline configuration.
   * @param {boolean} [options.includeImages=false] - Whether to process images.
   */
  runAssignmentPipeline(assignment, students, options = {}) {
    const { includeImages = false } = options;

    this.runStage(
      'Adding students from class record.',
      () => {
        students.forEach((student) => assignment.addStudent(student));
      },
      `${students.length} students added to the assignment from class record.`
    );

    this.runStage(
      'Getting the tasks from the reference document.',
      () => {
        assignment.populateTasks();
      },
      'Tasks populated from reference document.'
    );

    this.runStage(
      'Fetching submitted documents from students.',
      () => {
        assignment.fetchSubmittedDocuments();
      },
      'Submitted documents fetched.'
    );

    this.runStage(
      'Extracting student work from documents.',
      () => {
        assignment.processAllSubmissions();
      },
      'All student work extracted.'
    );

    if (includeImages) {
      this.runStage(
        'Processing Images.',
        () => {
          assignment.processImages();
        },
        'Images uploaded.'
      );
    }

    this.runStage(
      'Assessing student responses.',
      () => {
        assignment.assessResponses();
      },
      'Responses assessed.'
    );
  }

  /**
   * Executes a pipeline stage with consistent progress updates.
   * @param {string} startMessage - Message reported before execution.
   * @param {Function} action - Stage function to execute.
   * @param {string} completionMessage - Message reported after execution.
   * @return {*} The return value of the stage function.
   */
  runStage(startMessage, action, completionMessage) {
    this.progressTracker.updateProgress(startMessage);
    const result = action();
    if (completionMessage) {
      this.progressTracker.updateProgress(completionMessage, false);
    }
    return result;
  }

  /**
   * Sets document properties using the provided key/value map.
   * @param {GoogleAppsScript.Properties.Properties} properties - Document properties service instance.
   * @param {Object} propertyMap - Map of document property names to values.
   */
  applyDocumentProperties(properties, propertyMap) {
    Object.keys(propertyMap).forEach((key) => {
      properties.setProperty(key, propertyMap[key]);
    });
  }

  /**
   * Removes multiple document properties by key.
   * @param {GoogleAppsScript.Properties.Properties} properties - Document properties service instance.
   * @param {string[]} keys - Property keys to delete.
   */
  clearDocumentProperties(properties, keys) {
    keys.forEach((key) => properties.deleteProperty(key));
  }

  /**
   * Test workflow function for debugging purposes.
   */
  testWorkflow() {
    console.log('Test workflow initiated');
    // Implementation details would go here
  }
}
