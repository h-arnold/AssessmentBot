// AssignmentPropertiesManager.gs

/**
 * AssignmentPropertiesManager Class
 *
 * Manages storing and retrieving assignment-specific properties.
 */
class AssignmentPropertiesManager {
    /**
     * Saves slide IDs for a specific assignment.
     * @param {string} assignmentTitle - The title of the assignment.
     * @param {Object} slideIds - An object containing referenceSlideId and templateSlideId.
     * @throws {Error} When reference and template slide IDs are the same.
     */
    static saveSlideIdsForAssignment(assignmentTitle, slideIds) {
        // Validate that the slide IDs aren't the same
        if (slideIds.referenceSlideId && slideIds.templateSlideId && 
            slideIds.referenceSlideId === slideIds.templateSlideId) {
            
            const errorMessage = 'Reference slide ID and template slide ID cannot be the same.';
            
            // Log error using ProgressTracker
            const progressTracker = ProgressTracker.getInstance();
            progressTracker.logError(errorMessage);
            
            throw new Error(errorMessage);
        }
        
        const scriptProperties = PropertiesService.getScriptProperties();
        // Use the assignment ID as a key
        const key = `assignment_${assignmentTitle}`;
        const value = JSON.stringify(slideIds);
        scriptProperties.setProperty(key, value);
    }

    /**
     * Retrieves slide IDs for a specific assignment.
     * @param {string} assignmentTitle - The title of the assignment.
     * @returns {Object} An object containing referenceSlideId and templateSlideId, or empty object if not found.
     */
    static getSlideIdsForAssignment(assignmentTitle) {
        const scriptProperties = PropertiesService.getScriptProperties();
        const key = `assignment_${assignmentTitle}`;
        const value = scriptProperties.getProperty(key);
        if (value) {
            try {
                return JSON.parse(value);
            } catch (e) {
                // If parsing fails, return an empty object
                return {};
            }
        } else {
            return {};
        }
    }

    /**
     * Migrates all assignment properties by renaming 'emptySlideId' to 'templateSlideId' in stored JSON objects.
     * If you have used Assessment Bot prior to v0.4.5, this function is necessary to update your stored properties.
     * Updates the property only if the old key exists and the new key does not.
     * Logs migration actions using ProgressTracker.
     */
    static migrateEmptyTaskToTemplateTask() {
        const scriptProperties = PropertiesService.getScriptProperties();
        const allKeys = scriptProperties.getKeys();
        const progressTracker = ProgressTracker.getInstance();
        let migratedCount = 0;

        allKeys.forEach(key => {
            if (key.startsWith('assignment_')) {
                const value = scriptProperties.getProperty(key);
                if (!value) return;
                let parsed;
                try {
                    parsed = JSON.parse(value);
                } catch (e) {
                    progressTracker.logError(`Failed to parse assignment property for key: ${key}`);
                    return;
                }
                if (parsed && parsed.emptySlideId && !parsed.templateSlideId) {
                    parsed.templateSlideId = parsed.emptySlideId;
                    delete parsed.emptySlideId;
                    scriptProperties.setProperty(key, JSON.stringify(parsed));
                    migratedCount++;
                }
            }
        });
        progressTracker.logInfo(`AssignmentPropertiesManager: Migrated ${migratedCount} assignment(s) from 'emptySlideId' to 'templateSlideId'.`);
    }
}
