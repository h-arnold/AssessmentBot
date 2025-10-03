/**
 * Assignment-related global functions
 * These functions provide a global interface to the Assignment
 */

/**
 * Initiates the processing of an assignment asynchronously by setting up a trigger
 * and opens the progress modal.
 *
 * @param {string} assignmentTitle - The title of the assignment.
 * @param {Object} slideIds - An object containing referenceSlideId and emptySlideId.
 * @param {string} assignmentId - The ID of the assignment.
 * @param {string} referenceSlideId - The ID of the reference slide.
 * @param {string} emptySlideId - The ID of the empty slide.
 */
function saveStartAndShowProgress(
  assignmentTitle,
  slideIds,
  assignmentId,
  referenceSlideId,
  emptySlideId
) {
  // Diagnostic log added to help detect UI->server invocation regressions.
  const logger = ABLogger?.getInstance ? ABLogger.getInstance() : null;
  if (logger && typeof logger.info === 'function') {
    logger.info('saveStartAndShowProgress invoked (globals):', {
      assignmentTitle,
      slideIds,
      assignmentId,
      referenceSlideId,
      emptySlideId,
    });
  }

  const controller = new AssignmentController();
  try {
    return controller.saveStartAndShowProgress(
      assignmentTitle,
      slideIds,
      assignmentId,
      referenceSlideId,
      emptySlideId
    );
  } catch (err) {
    // Surface the error to server logs for easier debugging in deployed environments
    if (logger && typeof logger.error === 'function') {
      logger.error('Error in globals.saveStartAndShowProgress:', err?.message ?? err);
    }
    throw err;
  }
}

/**
 * Initiates the processing of an assignment asynchronously by setting up a trigger.
 *
 * @param {string} assignmentId - The ID of the assignment.
 * @param {string} referenceSlideId - The ID of the reference slide.
 * @param {string} emptySlideId - The ID of the empty slide.
 * @returns {string} The unique process ID.
 */
function startProcessing(assignmentId, referenceSlideId, emptySlideId) {
  const controller = new AssignmentController();
  return controller.startProcessing(assignmentId, referenceSlideId, emptySlideId);
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
