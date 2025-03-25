// z_main.js
// Global functions that bind UI actions and triggers to MainController methods.

//

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
function saveStartAndShowProgress(assignmentTitle, slideIds, assignmentId, referenceSlideId, emptySlideId) {
  const mainController = new MainController();
  return mainController.saveStartAndShowProgress(assignmentTitle, slideIds, assignmentId, referenceSlideId, emptySlideId);
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
  const mainController = new MainController();
  return mainController.startProcessing(assignmentId, referenceSlideId, emptySlideId);
}

/**
 * Processes the selected assignment by retrieving parameters and executing the workflow.
 */
function triggerProcessSelectedAssignment() {
  const mainController = new MainController();
  return mainController.processSelectedAssignment();
}

/**
 * Saves slide IDs for a specific assignment.
 *
 * @param {string} assignmentId - The ID of the assignment.
 * @param {Object} slideIds - An object containing referenceSlideId and emptySlideId.
 */
function saveSlideIdsForAssignment(assignmentId, slideIds) {
  const mainController = new MainController();
  return mainController.saveSlideIdsForAssignment(assignmentId, slideIds);
}









/**
 * Removes a specific trigger by function name.
 *
 * @param {string} functionName - The name of the function whose triggers are to be removed.
 */
function removeTrigger(functionName) {
  mainController.triggerController.removeTriggers(functionName);
}

/**
 * Retrieves the current progress status.
 *
 * @returns {Object} The current progress data.
 */
function requestStatus() {
  const progressTracker = new ProgressTracker();
  return progressTracker.getStatus();
}

/**
 * Clears all cache keys from the script cache.
 */
function clearAllCacheKeys() {
  const cache = CacheService.getScriptCache();
  cache.removeAll(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
}

/**


// The analyseCohorts function has been moved to CohortAnalysis/globals.js
// Removed to avoid duplication

/**
 * Test workflow function for debugging purposes.
 */
function testWorkflow() {
  mainController.testWorkflow();
}

function revokeAuthorisation() {
  const sa = new ScriptAppManager()
  sa.revokeAuthorisation();
}

