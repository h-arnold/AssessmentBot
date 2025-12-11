/**
 * Assignment-related global functions
 * These functions provide a global interface to the Assignment
 */

/**
 * Initiates the processing of an assignment asynchronously by setting up a trigger
 * and opens the progress modal.
 *
 * @param {string} assignmentTitle - The title of the assignment.
 * @param {Object} documentIds - An object containing referenceDocumentId and templateDocumentId.
 * @param {string} assignmentId - The ID of the assignment.
 * @param {string} referenceDocumentId - The ID of the reference document.
 * @param {string} templateDocumentId - The ID of the template document.
 */
function saveStartAndShowProgress(
  assignmentTitle,
  documentIds,
  assignmentId,
  referenceDocumentId,
  templateDocumentId
) {
  ABLogger.getInstance().info('saveStartAndShowProgress invoked (globals):', {
    assignmentTitle,
    documentIds,
    assignmentId,
    referenceDocumentId,
    templateDocumentId,
  });

  const controller = new AssignmentController();
  try {
    return controller.saveStartAndShowProgress(
      assignmentTitle,
      documentIds,
      assignmentId,
      referenceDocumentId,
      templateDocumentId
    );
  } catch (err) {
    ABLogger.getInstance().error('Error in globals.saveStartAndShowProgress:', err?.message ?? err);
    throw err;
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
 * Processes the selected assignment by retrieving parameters and executing the workflow.
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
