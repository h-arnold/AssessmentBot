/**
 * Assignment-related global functions
 * These functions provide a global interface to the Assignment
 */

/**
 * Initiates processing of an assignment asynchronously by setting up a trigger and opens the progress modal.
 * @param {string} assignmentTitle - The title of the assignment.
 * @param {Object} documentIds - An object containing referenceDocumentId and templateDocumentId.
 * @param {string} assignmentId - The ID of the assignment.
 * @param {string} courseId - The Classroom course ID.
 * @returns {*} The result from the AssignmentController.
 */
function saveStartAndShowProgress(assignmentTitle, documentIds, assignmentId, courseId) {
  ABLogger.getInstance().info('saveStartAndShowProgress invoked (globals):', {
    assignmentTitle,
    documentIds,
    assignmentId,
    courseId,
  });

  const controller = new AssignmentController();
  try {
    return controller.saveStartAndShowProgress(
      assignmentTitle,
      documentIds,
      assignmentId,
      courseId
    );
  } catch (error) {
    ABLogger.getInstance().error(
      'Error in globals.saveStartAndShowProgress:',
      error?.message ?? error
    );
    throw error;
  }
}

/**
 * Initiates the processing of an assignment asynchronously by setting up a trigger.
 *
 * @param {string} assignmentId - The ID of the assignment.
 * @param {string} definitionKey - The key of the assignment definition.
 * @returns {string} The unique process ID.
 */
function startProcessing(assignmentId, definitionKey) {
  const controller = new AssignmentController();
  return controller.startProcessing(assignmentId, definitionKey);
}

/**
 * Creates a full AssignmentDefinition from wizard Step 3 inputs without starting the assessment.
 * Normalises reference and template document URLs/IDs, validates them, and returns a complete
 * definition payload with tasks for Step 4 (weightings).
 *
 * @param {Object} params - Wizard input parameters.
 * @param {string} params.assignmentId - Google Classroom assignment ID (required).
 * @param {string} params.courseId - Classroom course ID (required).
 * @param {string} params.assignmentTitle - Assignment title (fallback if not fetched from Classroom).
 * @param {string} params.referenceDocumentId - Reference document URL or file ID.
 * @param {string} params.templateDocumentId - Template document URL or file ID.
 * @param {number} params.yearGroup - Optional year group for the assignment.
 * @returns {Object} Full AssignmentDefinition JSON payload including tasks and artefacts.
 * @throws {Error} If validation fails, documents are identical, types mismatch, or assignment lacks topic.
 */
function createDefinitionFromWizardInputs({
  assignmentId,
  courseId,
  assignmentTitle,
  referenceDocumentId,
  templateDocumentId,
  yearGroup = null,
}) {
  const controller = new AssignmentController();
  try {
    return controller.createDefinitionFromWizardInputs({
      assignmentId,
      courseId,
      assignmentTitle,
      referenceDocumentId,
      templateDocumentId,
      yearGroup,
    });
  } catch (error) {
    ABLogger.getInstance().error(
      'Error in globals.createDefinitionFromWizardInputs:',
      error?.message ?? error
    );
    throw error;
  }
}

/**
 * Processes the selected assignment by retrieving parameters and executing the workflow.
 * @returns {*} The result from the AssignmentController.
 */
function triggerProcessSelectedAssignment() {
  const controller = new AssignmentController();
  return controller.processSelectedAssignment();
}

/**
 * Removes a specific trigger by function name.
 *
 * @param {string} functionName - The name of the function whose triggers are to be removed.
 */
function removeTrigger(functionName) {
  const controller = new AssignmentController();
  controller.triggerController.removeTriggers(functionName);
}

/**
 * Test workflow function for debugging purposes.
 */
function testWorkflow() {
  const controller = new AssignmentController();
  controller.testWorkflow();
}

// Export for Node.js testing environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    saveStartAndShowProgress,
    startProcessing,
    createDefinitionFromWizardInputs,
    triggerProcessSelectedAssignment,
    removeTrigger,
    testWorkflow,
  };
}
