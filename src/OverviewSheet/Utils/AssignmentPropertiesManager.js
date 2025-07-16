// AssignmentPropertiesManager.gs

/**
 * AssignmentPropertiesManager Class
 *
 * Manages storing and retrieving assignment-specific properties.
 */
class AssignmentPropertiesManager {
    /**
     * Determines the type of a Google Drive document based on its ID.
     * @param {string} documentId - The ID of the Google Drive file.
     * @return {string} - The document type ("SLIDES", "SHEETS") or throws an error for unsupported types.
     * @throws {Error} If the document type is not supported or the file cannot be accessed.
     */
    static getDocumentTypeById(documentId) {
        const progressTracker = ProgressTracker.getInstance();
        
        if (!documentId) {
            progressTracker.logAndThrowError("Document ID cannot be null or empty.");
        }
        
        try {
            const file = DriveApp.getFileById(documentId);
            const mimeType = file.getMimeType();

            if (mimeType === MimeType.GOOGLE_SLIDES) {
                return "SLIDES";
            } else if (mimeType === MimeType.GOOGLE_SHEETS) {
                return "SHEETS";
            } else {
                progressTracker.logAndThrowError(`Unsupported document type: ${mimeType} for document ID ${documentId}. Only Google Slides and Sheets are supported.`);
            }
        } catch (e) {
            // Capture the error with more specific details
            progressTracker.logAndThrowError(`Failed to determine document type for ID ${documentId}. Ensure the ID is correct and you have permissions.`, e);
        }
    }

    /**
     * Saves document IDs and type for a specific assignment.
     * @param {string} assignmentTitle - The title of the assignment.
     * @param {Object} documentIds - An object containing referenceDocumentId and templateDocumentId.
     * @throws {Error} When reference and template document IDs are the same, or types differ/are unsupported.
     */
    static saveDocumentIdsForAssignment(assignmentTitle, documentIds) {
        const progressTracker = ProgressTracker.getInstance();
        
        if (!documentIds || !documentIds.referenceDocumentId || !documentIds.templateDocumentId) {
            progressTracker.logAndThrowError('Reference and template document IDs must be provided.');
        }

        if (documentIds.referenceDocumentId === documentIds.templateDocumentId) {
            progressTracker.logAndThrowError('Reference document ID and template document ID cannot be the same.');
        }

        let referenceDocType;
        let templateDocType;

        try {
            referenceDocType = this.getDocumentTypeById(documentIds.referenceDocumentId);
            templateDocType = this.getDocumentTypeById(documentIds.templateDocumentId);
        } catch (error) {
            // Error already logged by getDocumentTypeById, rethrow to stop execution
            const progressTracker = ProgressTracker.getInstance();
            progressTracker.logAndThrowError(`Error determining document types: ${error.message}`, error);
        }

        if (referenceDocType !== templateDocType) {
            const errorMessage = `Reference document type (${referenceDocType}) and template document type (${templateDocType}) must match.`;
            const progressTracker = ProgressTracker.getInstance();
            progressTracker.logAndThrowError(errorMessage);
        }
        
        const scriptProperties = PropertiesService.getScriptProperties();
        const key = `assignment_${assignmentTitle}`;
        const valueToStore = {
            referenceDocumentId: documentIds.referenceDocumentId,
            templateDocumentId: documentIds.templateDocumentId,
            documentType: referenceDocType // Since they are the same
        };
        scriptProperties.setProperty(key, JSON.stringify(valueToStore));
        return valueToStore; // Return the stored object for immediate downstream use
    }

    /**
     * Retrieves document IDs and type for a specific assignment.
     * Provides backward compatibility for older stored properties.
     * @param {string} assignmentTitle - The title of the assignment.
     * @returns {Object} An object containing referenceDocumentId, templateDocumentId, and documentType, 
     *                   or an empty object if not found or parsing fails.
     */
    static getDocumentIdsForAssignment(assignmentTitle) {
        const scriptProperties = PropertiesService.getScriptProperties();
        const key = `assignment_${assignmentTitle}`;
        const value = scriptProperties.getProperty(key);

        if (value) {
            try {
                let parsedValue = JSON.parse(value);

                // Backward compatibility:
                // If documentType is missing, assume SLIDES and check for old property names
                if (!parsedValue.documentType) {
                    // Check if old slideId properties exist and new documentId properties don't
                    if (parsedValue.referenceSlideId && !parsedValue.referenceDocumentId) {
                        parsedValue.referenceDocumentId = parsedValue.referenceSlideId;
                        delete parsedValue.referenceSlideId;
                    }
                    if (parsedValue.templateSlideId && !parsedValue.templateDocumentId) {
                        parsedValue.templateDocumentId = parsedValue.templateSlideId;
                        delete parsedValue.templateSlideId;
                    }
                    // If, after potential migration, the main IDs are still missing, it's an issue.
                    // However, we primarily set the default documentType here.
                    parsedValue.documentType = "SLIDES"; // Default to SLIDES for old data
                }
                
                // Ensure the main properties exist, even if they are null (e.g. after migration from very old format)
                // This is more of a safeguard for the return structure.
                return {
                    referenceDocumentId: parsedValue.referenceDocumentId || null,
                    templateDocumentId: parsedValue.templateDocumentId || null,
                    documentType: parsedValue.documentType || "SLIDES" // Final fallback
                };

            } catch (e) {
                const progressTracker = ProgressTracker.getInstance();
                progressTracker.captureError(e, `Error parsing properties for assignment "${assignmentTitle}"`);
                // If parsing fails, return an empty object or a default structure
                return {}; 
            }
        } else {
            return {}; // No property found for this assignment title
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
                    progressTracker.logError(`Failed to parse assignment property for key: ${key}`, e);
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
