// AssignmentController.js

/**
 * AssignmentController Class
 *
 * Encapsulates assignment-related functionality and coordinates various components.
 */
class AssignmentController {
  /**
   *
   */
  constructor() {
    // Retain Utils for general utility methods not related to Classroom
    this.utils = Utils;

    // Access the singleton instance of ProgressTracker
    this.progressTracker = ProgressTracker.getInstance();

    // Note: Other controllers and managers are now instantiated lazily in each method
  }

  /**
   * Initialises the assessment process by saving document IDs and starting progress tracking.
   * Also attempts to warm up the LLM backend asynchronously.
   *
   * @param {string} assignmentTitle - The title of the assignment
   * @param {Object} documentIds - Object containing Google document IDs to be processed (referenceDocumentId, templateDocumentId)
   * @param {string} assignmentId - Unique identifier for the assignment
   * @throws {Error} If saving or initialisation process fails
   */
  saveStartAndShowProgress(assignmentTitle, documentIds, assignmentId) {
    try {
      const { definition } = this.ensureDefinitionFromInputs({
        assignmentTitle,
        assignmentId,
        documentIds,
      });

      this.startProcessing(assignmentId, definition.definitionKey);
      this.progressTracker.startTracking();

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
   * @param {string} definitionKey - The key of the assignment definition to use
   * @throws {Error} If trigger creation fails or if setting document properties fails
   */
  startProcessing(assignmentId, definitionKey) {
    // Lazily instantiate TriggerController
    const triggerController = new TriggerController();
    const properties = PropertiesService.getDocumentProperties();
    let triggerId;

    try {
      triggerId = triggerController.createTimeBasedTrigger('triggerProcessSelectedAssignment');
      ABLogger.getInstance().info(
        `Trigger created for triggerProcessSelectedAssignment with triggerId: ${triggerId}`
      );
    } catch (error) {
      this.progressTracker.logAndThrowError(`Error creating trigger: ${error.message}`, error);
      this.utils.toastMessage('Failed to create trigger: ' + error.message, 'Error', 5);
    }

    try {
      this.applyDocumentProperties(properties, {
        assignmentId,
        definitionKey,
        triggerId,
      });
      ABLogger.getInstance().info('Properties set for processing.');
    } catch (error) {
      this.progressTracker.logAndThrowError(`Error setting properties: ${error.message}`, error);
      this.utils.toastMessage('Failed to set processing properties: ' + error.message, 'Error', 5);
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
   * - Requires document properties: assignmentId, definitionKey, triggerId
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
      const definitionKey = properties.getProperty('definitionKey');
      const triggerId = properties.getProperty('triggerId');

      if (!assignmentId || !definitionKey || !triggerId) {
        // Lazily instantiate TriggerController to clean up pending triggers
        const triggerController = new TriggerController();
        triggerController.removeTriggers('triggerProcessSelectedAssignment');
        this.progressTracker.logAndThrowError('Missing parameters for processing.');
      }

      // Lazily instantiate TriggerController for trigger deletion
      const triggerController = new TriggerController();
      triggerController.deleteTriggerById(triggerId);
      ABLogger.getInstance().info('Trigger deleted after processing.');
      this.progressTracker.startTracking();
      this.progressTracker.updateProgress('Assessment run starting.');

      // Get Course ID from Configuration (handles migration if needed)
      const courseId = ConfigurationManager.getInstance().getAssessmentRecordCourseId();
      if (!courseId) {
        this.progressTracker.logAndThrowError(
          'Course ID could not be determined. Please ensure class info is set up.'
        );
      }

      ABLogger.getInstance().info('Course ID retrieved: ' + courseId);
      this.progressTracker.updateProgress(`Course ID retrieved: ${courseId}`, false);

      const abClassController = new ABClassController();
      const abClass = abClassController.loadClass(courseId);

      const assignmentIndex = abClass.findAssignmentIndex((a) => a.assignmentId === assignmentId);
      if (assignmentIndex >= 0) {
        abClassController.rehydrateAssignment(abClass, assignmentId);
      }

      const definitionController = new AssignmentDefinitionController();
      const definition = definitionController.getDefinitionByKey(definitionKey, { form: 'full' });
      if (!definition) {
        this.progressTracker.logAndThrowError(
          `Assignment definition not found for key ${definitionKey}. Cannot proceed.`
        );
      }

      const assignment = this.createAssignmentInstance(definition, courseId, assignmentId);

      const students = abClass.students;
      const includeImages = definition.documentType === 'SLIDES';
      this.runAssignmentPipeline(assignment, students, { includeImages, definitionController });

      // Update lastUpdated value and persist assignment data

      assignment.touchUpdated();

      // Persist assignment using controller pattern - writes full assignment to dedicated
      // collection and stores partial summary in ABClass
      abClassController.persistAssignmentRun(abClass, assignment);

      this.progressTracker.updateProgress('Assessment run completed successfully.', false);
      this.progressTracker.complete();

      this.utils.toastMessage('Assessment run completed successfully.', 'Success', 5);
      ABLogger.getInstance().info('Assessment run completed successfully.');
    } catch (error) {
      this.progressTracker.logAndThrowError(error.message, error);
    } finally {
      lock.releaseLock();
      ABLogger.getInstance().info('Lock released.');
      try {
        // Use the hydrated roster from the class record for processing. This data is transient
        // and must not be persisted with the Assignment to prevent data duplication.
        const properties = PropertiesService.getDocumentProperties();
        this.clearDocumentProperties(properties, ['assignmentId', 'definitionKey', 'triggerId']);
        ABLogger.getInstance().info('Document properties cleaned up.');
      } catch (cleanupError) {
        this.progressTracker.logError(`Failed to clean up properties: ${cleanupError.message}`, {
          err: cleanupError,
        });
      }
    }
  }

  /**
   * Creates an assignment instance using the factory pattern with progress tracking.
   * @param {AssignmentDefinition} assignmentDefinition - Embedded definition for the assignment.
   * @param {string} courseId - The Classroom course ID.
   * @param {string} assignmentId - The assignment ID.
   * @return {SlidesAssignment|SheetsAssignment} The instantiated assignment.
   */
  createAssignmentInstance(assignmentDefinition, courseId, assignmentId) {
    return this.runStage(
      'Creating Assignment instance.',
      () => Assignment.create(assignmentDefinition, courseId, assignmentId),
      'Assignment instance created.'
    );
  }

  /**
   * Runs shared assignment stages with optional image processing.
   * @param {SlidesAssignment|SheetsAssignment} assignment - Assignment instance to populate.
   * @param {Object[]} students - Students sourced from the class record.
   * @param {Object} [options] - Additional pipeline configuration.
   * @param {boolean} [options.includeImages=false] - Whether to process images.
   * @param {AssignmentDefinitionController} [options.definitionController] - Controller to persist refreshed definitions.
   */
  runAssignmentPipeline(assignment, students, options = {}) {
    const { includeImages = false, definitionController } = options;
    const controller = definitionController || new AssignmentDefinitionController();

    this.runStage(
      'Adding students from class record.',
      () => {
        students.forEach((student) => assignment.addStudent(student));
      },
      `${students.length} students added to the assignment from class record.`
    );

    const definition = assignment.assignmentDefinition;
    const referenceModified = DriveManager.getFileModifiedTime(definition.referenceDocumentId);
    const templateModified = DriveManager.getFileModifiedTime(definition.templateDocumentId);

    const needsRefresh = Utils.definitionNeedsRefresh(
      definition,
      referenceModified,
      templateModified
    );

    if (needsRefresh) {
      this.runStage(
        'Getting the tasks from the reference document.',
        () => {
          assignment.populateTasks();
          definition.updateModifiedTimestamps({
            referenceLastModified: referenceModified,
            templateLastModified: templateModified,
          });
          controller.saveDefinition(definition);
        },
        'Tasks populated from reference document.'
      );
    } else {
      this.progressTracker.updateProgress('Tasks are up to date; skipping parse.', false);
    }

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
   *
   */
  _detectDocumentType(referenceDocumentId, templateDocumentId) {
    const progressTracker = this.progressTracker;
    if (!referenceDocumentId || !templateDocumentId) {
      progressTracker.logAndThrowError('referenceDocumentId and templateDocumentId are required.');
    }

    // Enforce that reference and template documents are different
    if (referenceDocumentId === templateDocumentId) {
      progressTracker.logAndThrowError('Reference and template documents must be different.', {
        referenceDocumentId,
        templateDocumentId,
      });
    }

    const SLIDES_MIME = 'application/vnd.google-apps.presentation';
    const SHEETS_MIME = 'application/vnd.google-apps.spreadsheet';
    const resolveType = (docId) => {
      const file = DriveApp.getFileById(docId);
      const mimeType = file.getMimeType();
      if (mimeType === SLIDES_MIME) return 'SLIDES';
      if (mimeType === SHEETS_MIME) return 'SHEETS';
      progressTracker.logAndThrowError(
        `Unsupported document type: ${mimeType} for document ID ${docId}. Only Google Slides and Sheets are supported.`
      );
    };
    const referenceType = resolveType(referenceDocumentId);
    const templateType = resolveType(templateDocumentId);
    if (referenceType !== templateType) {
      progressTracker.logAndThrowError(
        `Reference document type (${referenceType}) and template document type (${templateType}) must match.`
      );
    }
    return referenceType;
  }

  /**
   * Ensures assignment definition from provided inputs.
   * @param {Object} params - Parameters object.
   * @param {string|null} params.assignmentTitle - The assignment title (optional if fetched from Classroom).
   * @param {string} params.assignmentId - The assignment ID.
   * @param {Object} params.documentIds - Object containing document IDs with properties:
   *   - referenceDocumentId or referenceSlideId
   *   - templateDocumentId or templateSlideId
   * @return {Object} { definition, courseId, abClass }
   */
  ensureDefinitionFromInputs({ assignmentTitle, assignmentId, documentIds, yearGroup = null }) {
    const referenceId = documentIds?.referenceDocumentId || documentIds?.referenceSlideId;
    const templateId = documentIds?.templateDocumentId || documentIds?.templateSlideId;

    const documentType = this._detectDocumentType(referenceId, templateId);

    const courseId = ConfigurationManager.getInstance().getAssessmentRecordCourseId();
    if (!courseId) {
      ProgressTracker.getInstance().logAndThrowError('Course ID not found in configuration.');
    }

    const courseWork = Classroom.Courses.CourseWork.get(courseId, assignmentId);
    const topicId = courseWork?.topicId || null;
    const primaryTitle = courseWork?.title || assignmentTitle;

    const abClassController = new ABClassController();
    const abClass = abClassController.loadClass(courseId);

    // Use provided yearGroup (wizard input) if supplied, otherwise fallback to the class value
    const finalYearGroup =
      yearGroup !== undefined && yearGroup !== null
        ? Number.parseInt(yearGroup, 10)
        : (abClass?.yearGroup ?? null);

    const definitionController = new AssignmentDefinitionController();
    const definition = definitionController.ensureDefinition({
      primaryTitle,
      primaryTopic: null,
      topicId,
      courseId,
      yearGroup: finalYearGroup,
      documentType,
      referenceDocumentId: referenceId,
      templateDocumentId: templateId,
    });

    return { definition, courseId, abClass };
  }

  /**
   * Creates a full AssignmentDefinition from wizard Step 3 inputs without starting the assessment.
   * Normalises reference and template document URLs/IDs, validates them, and returns a complete
   * definition payload with tasks for Step 4 (weightings).
   *
   * @param {Object} params - Wizard input parameters.
   * @param {string} params.assignmentId - Google Classroom assignment ID (required).
   * @param {string} [params.assignmentTitle] - Assignment title (fallback if not fetched from Classroom).
   * @param {string} params.referenceDocumentId - Reference document URL or file ID.
   * @param {string} params.templateDocumentId - Template document URL or file ID.
   * @return {Object} Full AssignmentDefinition JSON payload including tasks and artifacts.
   * @throws {Error} If validation fails, documents are identical, types mismatch, or assignment lacks topic.
   */
  createDefinitionFromWizardInputs({
    assignmentId,
    assignmentTitle,
    referenceDocumentId,
    templateDocumentId,
    yearGroup = null,
  }) {
    ABLogger.getInstance().info('AssignmentController.createDefinitionFromWizardInputs invoked:', {
      assignmentId,
      assignmentTitle,
      referenceDocumentId,
      templateDocumentId,
      yearGroup,
    });

    // Validate required parameters
    Validate.requireParams(
      { assignmentId, referenceDocumentId, templateDocumentId },
      'createDefinitionFromWizardInputs'
    );

    // Normalise URLs/IDs to Drive file IDs
    const normalisedReferenceId = DriveManager.normaliseToFileId(referenceDocumentId);
    const normalisedTemplateId = DriveManager.normaliseToFileId(templateDocumentId);

    // Enforce that reference and template IDs are different
    if (normalisedReferenceId === normalisedTemplateId) {
      const errorMsg = 'Reference and template documents must be different.';
      this.progressTracker.logError(errorMsg, {
        referenceDocumentId: normalisedReferenceId,
        templateDocumentId: normalisedTemplateId,
      });
      throw new Error(errorMsg);
    }

    // Build documentIds object for ensureDefinitionFromInputs
    const documentIds = {
      referenceDocumentId: normalisedReferenceId,
      templateDocumentId: normalisedTemplateId,
    };

    try {
      // Call existing pipeline to get/create definition with full tasks
      const { definition, abClass } = this.ensureDefinitionFromInputs({
        assignmentTitle,
        assignmentId,
        documentIds,
        yearGroup,
      });

      // If a yearGroup was supplied and it differs from the stored class value, persist it
      if (yearGroup !== null && yearGroup !== undefined && abClass) {
        const parsedYear = Number.isInteger(yearGroup) ? yearGroup : Number.parseInt(yearGroup, 10);
        if (Number.isNaN(parsedYear) === false && abClass.yearGroup !== parsedYear) {
          const abClassController = new ABClassController();
          abClass.yearGroup = parsedYear;
          // Persist the class yearGroup. Fail fast if persisting fails.
          abClassController.saveClass(abClass);
          ABLogger.getInstance().info('ABClass.yearGroup updated from wizard input', {
            classId: abClass.classId,
            yearGroup: parsedYear,
          });
        }
      }

      // Return full definition payload including tasks
      return definition.toJSON();
    } catch (err) {
      ABLogger.getInstance().error(
        'Error in AssignmentController.createDefinitionFromWizardInputs:',
        err?.message ?? err
      );
      throw err;
    }
  }

  /**
   * Test workflow function for debugging purposes.
   */
  testWorkflow() {
    ABLogger.getInstance().debugUi('Test workflow initiated');
    // Implementation details would go here
  }
}

if (typeof module !== 'undefined') {
  module.exports = AssignmentController;
}
