// This file contains all the global functions needed to make use of the ConfigurationManager class.
// Note that the Configuration Manager is instantiated as a singleton in the `singletons.js` file in the `frontend` folder.

/**
 * Retrieves the current configuration settings from the ConfigurationManager.
 * @returns {object} An object containing the current configuration values.
 */
function getConfiguration() {
    return {
        batchSize: configurationManager.getBatchSize(),
        apiKey: configurationManager.getApiKey(),
        backendUrl: configurationManager.getBackendUrl(),
        assessmentRecordTemplateId: configurationManager.getAssessmentRecordTemplateId(),
        assessmentRecordDestinationFolder: configurationManager.getAssessmentRecordDestinationFolder(),
        updateDetailsUrl: configurationManager.getUpdateDetailsUrl(),
        updateStage: configurationManager.getUpdateStage(),
        isAdminSheet: configurationManager.getIsAdminSheet(),
        revokeAuthTriggerSet: configurationManager.getRevokeAuthTriggerSet(),
        daysUntilAuthRevoke: configurationManager.getDaysUntilAuthRevoke(),
        scriptAuthorised: configurationManager.getScriptAuthorised(),
        // Removed imageAssessmentUrl, textAssessmentUrl, tableAssessmentUrl
    }
}

/**
 * Saves the provided configuration settings using the ConfigurationManager.
 * @param {object} config - The configuration object to be saved.
 * @throws {Error} Throws an error if the configuration fails to save.
 */
function saveConfiguration(config) {
    try {
        // Save classroom data if provided
        if (config.classroom) {
            this.saveClassroom(config.classroom.courseName, config.classroom.courseId);
            delete config.classroom; // Remove classroom data before saving other configs
        }

        // Delegate configuration saving to ConfigurationManager
        if (config.batchSize !== undefined) {
            configurationManager.setBatchSize(config.batchSize);
        }
        if (config.apiKey !== undefined) {
            configurationManager.setApiKey(config.apiKey);
        }
        if (config.backendUrl !== undefined) {
            configurationManager.setBackendUrl(config.backendUrl);
        }

        // Handle Assessment Record values
        if (config.assessmentRecordTemplateId !== undefined) {
            configurationManager.setAssessmentRecordTemplateId(config.assessmentRecordTemplateId);
        }
        if (config.assessmentRecordDestinationFolder !== undefined) {
            configurationManager.setAssessmentRecordDestinationFolder(config.assessmentRecordDestinationFolder);
        }

        // Handle updateDetailsUrl parameter
        if (config.updateDetailsUrl !== undefined) {
            configurationManager.setUpdateDetailsUrl(config.updateDetailsUrl);
        }

        // Handle daysUntilAuthRevoke parameter
        if (config.daysUntilAuthRevoke !== undefined) {
            configurationManager.setDaysUntilAuthRevoke(config.daysUntilAuthRevoke);
        }

        console.log("Configuration saved successfully.");
    } catch (error) {
        console.error("Error saving configuration:", error);
        throw new Error(`Failed to save configuration. ${error.message}`);
    }
}
