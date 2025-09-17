// This file contains all the global functions needed to make use of the ConfigurationManager class.
// Note that the Configuration Manager is instantiated as a singleton in the `singletons.js` file in the `frontend` folder.

/**
 * Retrieves the current configuration settings from the ConfigurationManager.
 * @returns {object} An object containing the current configuration values.
 */
function getConfiguration() {
  const errors = [];

  function safeGet(getter, name, fallback = '') {
    try {
      return getter();
    } catch (err) {
      // Avoid logging full error objects which may contain sensitive details.
      console.error(
        `Error retrieving configuration value for ${name}: ${err && err.name ? err.name : 'Error'}`
      );
      errors.push(`${name}: ${err && err.message ? err.message : 'REDACTED'}`);
      return fallback;
    }
  }

  function maskApiKey(key) {
    if (!key) return '';
    const s = String(key);
    if (s.length <= 4) return '****';
    return '****' + s.slice(-4);
  }

  const rawApiKey = safeGet(() => configurationManager.getApiKey(), 'apiKey', '');

  const config = {
    backendAssessorBatchSize: safeGet(
      () => configurationManager.getBackendAssessorBatchSize(),
      'backendAssessorBatchSize',
      30
    ),
    // Return a redacted API key to prevent accidental clear-text logging.
    apiKey: maskApiKey(rawApiKey),
    // Provide a boolean so callers can know whether a key is present without exposing it.
    hasApiKey: !!rawApiKey,
    backendUrl: safeGet(() => configurationManager.getBackendUrl(), 'backendUrl', ''),
    assessmentRecordTemplateId: safeGet(
      () => configurationManager.getAssessmentRecordTemplateId(),
      'assessmentRecordTemplateId',
      ''
    ),
    assessmentRecordDestinationFolder: safeGet(
      () => configurationManager.getAssessmentRecordDestinationFolder(),
      'assessmentRecordDestinationFolder',
      ''
    ),
    updateDetailsUrl: safeGet(
      () => configurationManager.getUpdateDetailsUrl(),
      'updateDetailsUrl',
      ''
    ),
    updateStage: safeGet(() => configurationManager.getUpdateStage(), 'updateStage', 0),
    isAdminSheet: safeGet(() => configurationManager.getIsAdminSheet(), 'isAdminSheet', false),
    revokeAuthTriggerSet: safeGet(
      () => configurationManager.getRevokeAuthTriggerSet(),
      'revokeAuthTriggerSet',
      false
    ),
    daysUntilAuthRevoke: safeGet(
      () => configurationManager.getDaysUntilAuthRevoke(),
      'daysUntilAuthRevoke',
      60
    ),
    scriptAuthorised: safeGet(
      () => configurationManager.getScriptAuthorised(),
      'scriptAuthorised',
      false
    ),
    slidesFetchBatchSize: safeGet(
      () => configurationManager.getSlidesFetchBatchSize(),
      'slidesFetchBatchSize',
      20
    ),
  };

  if (errors.length > 0) {
    config.loadError = errors.join('; ');
  }

  return config;
}

/**
 * Saves the provided configuration settings using the ConfigurationManager.
 * @param {object} config - The configuration object to be saved.
 * @throws {Error} Throws an error if the configuration fails to save.
 */
function saveConfiguration(config) {
  const errors = [];

  function safeSet(action, name) {
    try {
      action();
      return true;
    } catch (err) {
      // Avoid logging or storing potentially sensitive details (e.g. API keys) in clear text.
      // Log only a generic error identifier and mark the detailed message as redacted.
      console.error(`Error saving configuration value for ${name}: REDACTED`);
      errors.push(`${name}: REDACTED`);
      return false;
    }
  }

  // Save classroom data if provided
  if (config.classroom) {
    try {
      saveClassroom(config.classroom.courseName, config.classroom.courseId);
      delete config.classroom; // Remove classroom data before saving other configs
    } catch (err) {
      console.error('Error saving classroom configuration:', err);
      errors.push(`classroom: ${err.message}`);
    }
  }

  // Delegate configuration saving to ConfigurationManager using safeSet
  if (config.backendAssessorBatchSize !== undefined) {
    safeSet(
      () => configurationManager.setBackendAssessorBatchSize(config.backendAssessorBatchSize),
      'backendAssessorBatchSize'
    );
  }
  if (config.slidesFetchBatchSize !== undefined) {
    safeSet(
      () => configurationManager.setSlidesFetchBatchSize(config.slidesFetchBatchSize),
      'slidesFetchBatchSize'
    );
  }
  if (config.apiKey !== undefined) {
    safeSet(() => configurationManager.setApiKey(config.apiKey), 'apiKey');
  }
  if (config.backendUrl !== undefined) {
    safeSet(() => configurationManager.setBackendUrl(config.backendUrl), 'backendUrl');
  }

  // Handle Assessment Record values
  if (config.assessmentRecordTemplateId !== undefined) {
    safeSet(
      () => configurationManager.setAssessmentRecordTemplateId(config.assessmentRecordTemplateId),
      'assessmentRecordTemplateId'
    );
  }
  if (config.assessmentRecordDestinationFolder !== undefined) {
    safeSet(
      () =>
        configurationManager.setAssessmentRecordDestinationFolder(
          config.assessmentRecordDestinationFolder
        ),
      'assessmentRecordDestinationFolder'
    );
  }

  // Handle updateDetailsUrl parameter
  if (config.updateDetailsUrl !== undefined) {
    safeSet(
      () => configurationManager.setUpdateDetailsUrl(config.updateDetailsUrl),
      'updateDetailsUrl'
    );
  }

  // Handle daysUntilAuthRevoke parameter
  if (config.daysUntilAuthRevoke !== undefined) {
    safeSet(
      () => configurationManager.setDaysUntilAuthRevoke(config.daysUntilAuthRevoke),
      'daysUntilAuthRevoke'
    );
  }

  if (errors.length > 0) {
    const message = `Failed to save some configuration values: ${errors.join('; ')}`;
    console.error(message);
    return { success: false, error: message };
  }

  console.log('Configuration saved successfully.');
  return { success: true };
}
