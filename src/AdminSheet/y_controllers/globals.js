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
