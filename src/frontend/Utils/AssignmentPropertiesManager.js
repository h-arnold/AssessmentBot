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
     * @param {Object} slideIds - An object containing referenceSlideId and emptySlideId.
     */
    static saveSlideIdsForAssignment(assignmentTitle, slideIds) {
        const scriptProperties = PropertiesService.getScriptProperties();
        // Use the assignment ID as a key
        const key = `assignment_${assignmentTitle}`;
        const value = JSON.stringify(slideIds);
        scriptProperties.setProperty(key, value);
    }

    /**
     * Retrieves slide IDs for a specific assignment.
     * @param {string} assignmentTitle - The title of the assignment.
     * @returns {Object} An object containing referenceSlideId and emptySlideId, or empty object if not found.
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
}
