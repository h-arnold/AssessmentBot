/**
 * Global function to handle version updates.
 * @param {Object} versionData Object containing version and file IDs
 * @return {Object} Result of the update operation
 */
function handleVersionUpdate(versionData) {
    const updateController = new UpdateController();
    return updateController.updateAdminSheet(versionData);
}
