// Global helpers for assignment definitions (UI-facing)

/**
 * Return all partial assignment definitions (redacted) as plain objects.
 * Used by the Assessment Wizard (and other UI surfaces).
 *
 * @returns {Array<Object>} Array of partial AssignmentDefinition JSON objects
 */
function getAllPartialDefinitions() {
  const controller = new AssignmentDefinitionController();
  try {
    const defs = controller.getAllPartialDefinitions();
    return defs.map((d) => (d && typeof d.toPartialJSON === 'function' ? d.toPartialJSON() : d));
  } catch (err) {
    const progressTracker = ProgressTracker.getInstance();
    progressTracker.logAndThrowError(
      'Failed to get assignment definitions. Please try again.',
      err
    );
  }
}

/**
 * Return all partial assignment definitions for the wizard list view.
 *
 * @returns {Array<Object>} Array of partial AssignmentDefinition JSON objects
 */
function listAllDefinitionsForWizard() {
  const controller = new AssignmentDefinitionController();
  try {
    const defs = controller.listAllPartialDefinitions();
    return defs.map((d) => (d && typeof d.toPartialJSON === 'function' ? d.toPartialJSON() : d));
  } catch (err) {
    const progressTracker = ProgressTracker.getInstance();
    progressTracker.logAndThrowError(
      'Failed to list assignment definitions. Please try again.',
      err
    );
  }
}

/**
 * Links an assignment to an existing definition by adding alternate metadata.
 *
 * @param {Object} payload
 * @param {string} payload.definitionKey
 * @param {string} payload.alternateTitle
 * @param {string} payload.alternateTopic
 * @returns {Object} Updated definition JSON
 */
function linkAssignmentToDefinition(payload) {
  try {
    Validate.requireParams({ payload }, 'linkAssignmentToDefinition');
    Validate.requireParams(
      {
        definitionKey: payload.definitionKey,
        alternateTitle: payload.alternateTitle,
        alternateTopic: payload.alternateTopic,
      },
      'linkAssignmentToDefinition'
    );
    const controller = new AssignmentDefinitionController();
    const updated = controller.linkAssignmentToDefinition(payload);
    return updated && typeof updated.toPartialJSON === 'function'
      ? updated.toPartialJSON()
      : updated;
  } catch (err) {
    const progressTracker = ProgressTracker.getInstance();
    progressTracker.logAndThrowError('Failed to link assignment. Please try again.', err);
  }
}

/**
 * Creates a new assignment definition from document URLs.
 *
 * @param {Object} payload
 * @param {string} payload.assignmentId
 * @param {string} payload.courseId
 * @param {string} payload.primaryTitle
 * @param {string} payload.primaryTopic
 * @param {number|null} payload.yearGroup
 * @param {string} payload.documentType
 * @param {string} payload.referenceUrl
 * @param {string} payload.templateUrl
 * @returns {Object} New definition JSON
 */
function createDefinitionFromUrls(payload) {
  try {
    Validate.requireParams({ payload }, 'createDefinitionFromUrls');
    Validate.requireParams(
      {
        assignmentId: payload.assignmentId,
        courseId: payload.courseId,
        primaryTitle: payload.primaryTitle,
        primaryTopic: payload.primaryTopic,
        referenceUrl: payload.referenceUrl,
        templateUrl: payload.templateUrl,
      },
      'createDefinitionFromUrls'
    );
    const controller = new AssignmentDefinitionController();
    const created = controller.createDefinitionFromUrls(payload);
    return created && typeof created.toPartialJSON === 'function'
      ? created.toPartialJSON()
      : created;
  } catch (err) {
    const progressTracker = ProgressTracker.getInstance();
    progressTracker.logAndThrowError('Failed to create assignment definition.', err);
  }
}

/**
 * Starts an assessment run from the wizard for an existing definition.
 *
 * @param {string} assignmentId
 * @param {string} definitionKey
 * @returns {*} Result from AssignmentController
 */
function startAssessmentFromWizard(assignmentId, definitionKey) {
  try {
    Validate.requireParams({ assignmentId, definitionKey }, 'startAssessmentFromWizard');
    const controller = new AssignmentController();
    return controller.startAssessmentFromWizard(assignmentId, definitionKey);
  } catch (err) {
    const progressTracker = ProgressTracker.getInstance();
    progressTracker.logAndThrowError('Failed to start assessment. Please try again.', err);
  }
}
