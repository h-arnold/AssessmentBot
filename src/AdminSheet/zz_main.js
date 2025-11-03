// zz_main.js
// Note that main.js needs to be prefixed with `zz` to ensure that it is placed after the classes to avoid xx not defined errors.
// Global functions that bind UI actions and triggers to MainController methods.

// Global functions have been moved to their respective class globals.js files for better organization

/**
 * Retrieves the current progress status.
 *
 * @returns {Object} The current progress data.
 */
function requestStatus() {
  const progressTracker = ProgressTracker.getInstance();
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
 * Revokes authorization for the script.
 */
function revokeAuthorisation() {
  const sa = new ScriptAppManager();
  sa.revokeAuthorisation();
}

/**
 * Creates the assessment record menu.
 * Public method for assessment record templates to call directly.
 */
function createAssessmentRecordMenu() {
  InitController.getInstance().createAssessmentRecordMenu();
}

/**
 * Creates the unauthorised menu.
 * Public method for assessment record templates to call directly.
 */
function createUnauthorisedMenu() {
  InitController.getInstance().createUnauthorisedMenu();
}

/**
 * Checks if the script is authorised.
 * Public method for assessment record templates to call directly.
 * @returns {boolean} True if authorised, false otherwise
 */
function isScriptAuthorised() {
  const sa = new ScriptAppManager();
  return sa.isAuthorised();
}

/**
 * Handles the authorisation process for Assessment Record templates.
 * Public method for assessment record templates to call during their auth flow.
 * Sets up triggers and auth revoke timer without creating menus
 * (menus are created in the template context).
 */
function handleAssessmentRecordAuth() {
  InitController.getInstance().handleAssessmentRecordAuth();
}

// Below contains the two global functions that need to run upon opening the spreadsheet.
// They've been placed here for now because GAS treats all the code in the file as one
// big file, with the files at the top of the list first and the bottom of the list last.
// Placing these last means that all other necessary classes and functions have been
// defined already.

function onOpen() {
  /**
   * @function onOpen
   * @description This function is triggered when the Google Slides document is opened.
   * It calls the `onOpen` method of the `initController` instance to perform
   * any necessary initialization tasks when the document is opened.
   */
  InitController.getInstance().onOpen();
}

/**
 * @function handleScriptInit
 * @description This function is the entry point for initializing the script.
 * It creates a new instance of the `initController` class and calls its
 * `handleScriptInit` method to start the initialization process.
 * @returns {void}
 */
function handleScriptInit() {
  InitController.getInstance().handleScriptInit();
}
