/**
 * Assignment-related global functions
 * These functions provide a global interface to the Assignment
 */

/**
 * Initiates the processing of an assignment asynchronously by setting up a trigger.
 *
 * @param {string} assignmentId - The ID of the assignment.
 * @param {string} definitionKey - The key of the assignment definition.
 * @param {string} courseId - Classroom course ID used for downstream processing.
 * @returns {string} The unique process ID.
 */
function startProcessing(assignmentId, definitionKey, courseId) {
  const controller = new AssignmentController();
  return controller.startProcessing(assignmentId, definitionKey, courseId);
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
    startProcessing,
    triggerProcessSelectedAssignment,
    removeTrigger,
    testWorkflow,
  };
}
