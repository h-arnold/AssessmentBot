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
      // Log a concise error identifier only. Use optional chaining to avoid
      // referencing properties on possibly undefined/null error objects.
      console.error(`Error retrieving configuration value for ${name}: ${err?.name ?? 'Error'}`);
      errors.push(`${name}: ${err?.message ?? 'REDACTED'}`);
      return fallback;
    }
  }

  function maskApiKey(key) {
    if (!key) return '';
    const s = String(key);
    if (s.length <= 4) return '****';
    return '****' + s.slice(-4);
  }

  const cfg = ConfigurationManager.getInstance();
  const rawApiKey = safeGet(() => cfg.getApiKey(), 'apiKey', '');

  const config = {
    backendAssessorBatchSize: safeGet(
      () => cfg.getBackendAssessorBatchSize(),
      'backendAssessorBatchSize',
      30
    ),
    // Return a redacted API key to prevent accidental clear-text logging.
    apiKey: maskApiKey(rawApiKey),
    // Provide a boolean so callers can know whether a key is present without exposing it.
    hasApiKey: !!rawApiKey,
    backendUrl: safeGet(() => cfg.getBackendUrl(), 'backendUrl', ''),
    assessmentRecordTemplateId: safeGet(
      () => cfg.getAssessmentRecordTemplateId(),
      'assessmentRecordTemplateId',
      ''
    ),
    assessmentRecordDestinationFolder: safeGet(
      () => cfg.getAssessmentRecordDestinationFolder(),
      'assessmentRecordDestinationFolder',
      ''
    ),
    updateDetailsUrl: safeGet(() => cfg.getUpdateDetailsUrl(), 'updateDetailsUrl', ''),
    updateStage: safeGet(() => cfg.getUpdateStage(), 'updateStage', 0),
    isAdminSheet: safeGet(() => cfg.getIsAdminSheet(), 'isAdminSheet', false),
    revokeAuthTriggerSet: safeGet(
      () => cfg.getRevokeAuthTriggerSet(),
      'revokeAuthTriggerSet',
      false
    ),
    daysUntilAuthRevoke: safeGet(() => cfg.getDaysUntilAuthRevoke(), 'daysUntilAuthRevoke', 60),
    scriptAuthorised: safeGet(() => cfg.getScriptAuthorised(), 'scriptAuthorised', false),
    slidesFetchBatchSize: safeGet(() => cfg.getSlidesFetchBatchSize(), 'slidesFetchBatchSize', 20),
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
      // Log only a concise identifier using optional chaining to be safe.
      console.error(`Error saving configuration value for ${name}: ${err?.name ?? 'Error'}`);
      errors.push(`${name}: REDACTED`);
      return false;
    }
  }

  // Save classroom data if provided
  if (config.classroom) {
    try {
      this.saveClassroom(config.classroom.courseName, config.classroom.courseId);
      delete config.classroom; // Remove classroom data before saving other configs
    } catch (err) {
      // Keep the logged output concise to avoid exposing sensitive details.
      console.error('Error saving classroom configuration:', err?.name ?? 'Error');
      errors.push(`classroom: ${err?.message ?? 'REDACTED'}`);
    }
  }

  // Delegate configuration saving to ConfigurationManager using safeSet
  if (config.backendAssessorBatchSize !== undefined) {
    safeSet(
      () =>
        ConfigurationManager.getInstance().setBackendAssessorBatchSize(
          config.backendAssessorBatchSize
        ),
      'backendAssessorBatchSize'
    );
  }
  if (config.slidesFetchBatchSize !== undefined) {
    safeSet(
      () => ConfigurationManager.getInstance().setSlidesFetchBatchSize(config.slidesFetchBatchSize),
      'slidesFetchBatchSize'
    );
  }
  if (config.apiKey !== undefined) {
    safeSet(() => ConfigurationManager.getInstance().setApiKey(config.apiKey), 'apiKey');
  }
  if (config.backendUrl !== undefined) {
    safeSet(
      () => ConfigurationManager.getInstance().setBackendUrl(config.backendUrl),
      'backendUrl'
    );
  }

  // Handle Assessment Record values
  if (config.assessmentRecordTemplateId !== undefined) {
    safeSet(
      () =>
        ConfigurationManager.getInstance().setAssessmentRecordTemplateId(
          config.assessmentRecordTemplateId
        ),
      'assessmentRecordTemplateId'
    );
  }
  if (config.assessmentRecordDestinationFolder !== undefined) {
    safeSet(
      () =>
        ConfigurationManager.getInstance().setAssessmentRecordDestinationFolder(
          config.assessmentRecordDestinationFolder
        ),
      'assessmentRecordDestinationFolder'
    );
  }

  // Handle updateDetailsUrl parameter
  if (config.updateDetailsUrl !== undefined) {
    safeSet(
      () => ConfigurationManager.getInstance().setUpdateDetailsUrl(config.updateDetailsUrl),
      'updateDetailsUrl'
    );
  }

  // Handle daysUntilAuthRevoke parameter
  if (config.daysUntilAuthRevoke !== undefined) {
    safeSet(
      () => ConfigurationManager.getInstance().setDaysUntilAuthRevoke(config.daysUntilAuthRevoke),
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

// Export functions for Node test environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getConfiguration, saveConfiguration };
}
