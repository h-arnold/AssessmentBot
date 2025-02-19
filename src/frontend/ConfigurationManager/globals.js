// This file contains all the global functions needed to make use of the ConfigurationManager class.
// Note that the Configuration Manager is instantiated as a singleton in the `singletons.js` file in the `frontend` folder.

/**
 * Retrieves the current configuration settings from the ConfigurationManager.
 * @returns {object} An object containing the current configuration values.
 */
function getConfiguration() {
    return {
        batchSize: configurationManager.getBatchSize(),
        langflowApiKey: configurationManager.getLangflowApiKey(),
        langflowUrl: configurationManager.getLangflowUrl(),
        imageFlowUid: configurationManager.getImageFlowUid(),
        textAssessmentTweakId: configurationManager.getTextAssessmentTweakId(),
        tableAssessmentTweakId: configurationManager.getTableAssessmentTweakId(),
        imageAssessmentTweakId: configurationManager.getImageAssessmentTweakId(),
        assessmentRecordTemplateId: configurationManager.getAssessmentRecordTemplateId(),
        assessmentRecordDestinationFolder: configurationManager.getAssessmentRecordDestinationFolder(),
        updateDetailsUrl: configurationManager.getUpdateDetailsUrl(),
        revokeAuthTriggerSet: configurationManager.getRevokeAuthTriggerSet(),
        daysUntilAuthRevoke: configurationManager.getDaysUntilAuthRevoke(),
        scriptAuthorised: configurationManager.getScriptAuthorised()
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
        if (config.langflowApiKey !== undefined) {
            configurationManager.setLangflowApiKey(config.langflowApiKey);
        }
        if (config.langflowUrl !== undefined) {
            configurationManager.setLangflowUrl(config.langflowUrl);
        }
        if (config.imageFlowUid !== undefined) {
            configurationManager.setImageFlowUid(config.imageFlowUid);
        }

        // Handle Tweak IDs
        if (config.textAssessmentTweakId !== undefined) {
            configurationManager.setTextAssessmentTweakId(config.textAssessmentTweakId);
        }
        if (config.tableAssessmentTweakId !== undefined) {
            configurationManager.setTableAssessmentTweakId(config.tableAssessmentTweakId);
        }
        if (config.imageAssessmentTweakId !== undefined) {
            configurationManager.setImageAssessmentTweakId(config.imageAssessmentTweakId);
        }

        // Handle Assessment Record values
        if (config.assessmentRecordTemplateId !== undefined) {
            configurationManager.setAssessmentRecordTemplateId(config.assessmentRecordTemplateId);
        }
        if (config.assessmentRecordDestinationFolder !== undefined) {
            configurationManager.setAssessmentRecordDestinationFolder(config.assessmentRecordDestinationFolder);
        }

        // Handle daysUntilAuthRevoke parameter
        if (config.daysUntilAuthRevoke !== undefined) {
            configurationManager.setDaysUntilAuthRevoke(config.daysUntilAuthRevoke);
        }

        console.log("Configuration saved successfully.");
    } catch (error) {
        console.error("Error saving configuration:", error);
        throw new Error("Failed to save configuration. Please check the inputs.");
    }
}
