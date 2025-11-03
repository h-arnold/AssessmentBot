//////////////////////////////////////////////////////////////////////////////////////////////
// init.js
// Initialisation and menu functions for the Assessment Record Template.
// These are split out from the original `menus.js` to improve readability.
//////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Checks if the current user has authorised this assessment record.
 * @return {boolean} True if the user has previously authorised this document, false otherwise.
 */
function hasUserAuthorisedThisDocument() {
  const userProps = PropertiesService.getUserProperties();
  return userProps.getProperty('authorised') === 'true';
}

/**
 * Marks the current user as authorised for this assessment record.
 */
function markUserAsAuthorised() {
  const userProps = PropertiesService.getUserProperties();
  userProps.setProperty('authorised', 'true');
}

/**
 * Creates the unauthorised menu with an Authorise button.
 * This menu is displayed when the user has not yet authorised the assessment record.
 */
function createUnauthorisedMenu() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Assessment Bot').addItem('Authorise App', 'handleScriptInit').addToUi();
}

/**
 * Creates the assessment record menu with all available options.
 * This menu is displayed after the user has authorised the assessment record.
 */
function createAssessmentRecordMenu() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Assessment Bot')
    .addItem('Assess Assignment', 'assessAssignment')
    .addItem('Check Progress', 'showProgressModal')
    .addItem('Change Class', 'showClassroomDropdown')
    .addToUi();
}

function onOpen() {
  // Check if the current user has authorised this assessment record
  const userAuthorisedThisDoc = hasUserAuthorisedThisDocument();

  // Create appropriate menu based on authorisation state
  if (userAuthorisedThisDoc) {
    createAssessmentRecordMenu();
  } else {
    createUnauthorisedMenu();
  }
}

function handleScriptInit() {
  try {
    // Call the library to handle the authorisation process
    // This will create triggers and set up the auth revoke timer
    AssessmentBot.handleAssessmentRecordAuth();

    // Mark the user as authorised after successful initialisation
    markUserAsAuthorised();

    // Create the assessment record menu now that auth is complete
    createAssessmentRecordMenu();
  } catch (error) {
    SpreadsheetApp.getUi().alert('Error during authorisation: ' + error.message);
    throw error;
  }
}

/**
 * Revokes the current user's authorisation for this assessment record.
 * Calls the library function and clears the user's authorisation flag from User Properties.
 * @return {Object} Status object indicating success or failure
 */
function revokeAuthorisation() {
  const result = AssessmentBot.revokeAuthorisation();

  // Clear the user's authorisation flag for this document
  if (result.success) {
    const userProps = PropertiesService.getUserProperties();
    userProps.deleteProperty('authorised');

    // Recreate the unauthorised menu
    createUnauthorisedMenu();
  }

  return result;
}
