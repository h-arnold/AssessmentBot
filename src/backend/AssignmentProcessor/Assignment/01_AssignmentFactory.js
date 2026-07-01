/**
 * AssignmentFactory — Factory sub-class
 *
 * Owns static create() and fromJSON() methods for polymorphic assignment
 * construction based on documentType.
 *
 * Depends on global `SlidesAssignment`, `SheetsAssignment`, `AssignmentDefinition`,
 * and `ProgressTracker` (GAS runtime globals).
 * @namespace
 */
const AssignmentFactory = {
  /**
   * Factory method to create the correct Assignment subclass based on documentType.
   * @param {AssignmentDefinition|Object} assignmentDefinition - Embedded definition containing docType and task metadata.
   * @param {string} courseId - The ID of the course.
   * @param {string} assignmentId - The ID of the assignment.
   * @returns {Assignment} Instance of appropriate subclass (SlidesAssignment or SheetsAssignment).
   * @throws {Error} If documentType is invalid or unknown.
   */
  create(assignmentDefinition, courseId, assignmentId) {
    if (!assignmentDefinition?.documentType) {
      throw new TypeError(
        'assignmentDefinition with documentType is required to create Assignment.'
      );
    }

    const type = assignmentDefinition.documentType.toUpperCase();

    if (type === 'SLIDES') {
      return new SlidesAssignment(courseId, assignmentId, assignmentDefinition);
    }

    if (type === 'SHEETS') {
      return new SheetsAssignment(courseId, assignmentId, assignmentDefinition);
    }

    throw new Error(
      `Unknown documentType: ${assignmentDefinition.documentType}. Valid types are 'SLIDES' or 'SHEETS'. See docs/developer/DATA_SHAPES.md for details.`
    );
  },

  /**
   * Polymorphic deserialisation routing based on documentType field.
   * Routes to appropriate subclass fromJSON or creates base Assignment for legacy data.
   * @param {object} data - JSON data object.
   * @returns {Assignment} Instance of appropriate class (SlidesAssignment, SheetsAssignment, or base Assignment).
   */
  fromJSON(data) {
    if (!data || typeof data !== 'object')
      throw new Error('Invalid data supplied to Assignment.fromJSON');

    if (!data.courseId || !data.assignmentId) {
      throw new Error('courseId and assignmentId are required fields in Assignment data');
    }

    if (!data.assignmentDefinition) {
      if (!data.documentType) {
        ProgressTracker.getInstance().logAndThrowError(
          `Assignment data missing documentType for courseId=${data.courseId}, assignmentId=${data.assignmentId}`,
          { data }
        );
      }

      data.assignmentDefinition = new AssignmentDefinition({
        primaryTitle: data.assignmentName || `Assignment ${data.assignmentId}`,
        primaryTopic: data.assignmentName || 'Assignment',
        documentType: data.documentType,
        referenceDocumentId: data.referenceDocumentId,
        templateDocumentId: data.templateDocumentId,
        tasks: 'tasks' in data ? data.tasks : {},
        referenceLastModified: data.referenceLastModified ?? null,
        templateLastModified: data.templateLastModified ?? null,
      }).toJSON();
    }

    const documentType = data.assignmentDefinition.documentType;

    if (!documentType || typeof documentType !== 'string') {
      ProgressTracker.getInstance().logAndThrowError(
        `Assignment data missing documentType for courseId=${data.courseId}, assignmentId=${data.assignmentId}`,
        { data }
      );
    }

    const type = documentType.toUpperCase();

    if (type === 'SLIDES') {
      return SlidesAssignment.fromJSON(data);
    }

    if (type === 'SHEETS') {
      return SheetsAssignment.fromJSON(data);
    }

    ProgressTracker.getInstance().logAndThrowError(
      `Unknown assignment documentType '${documentType}' for courseId=${data.courseId}, assignmentId=${data.assignmentId}`,
      { documentType: documentType, data }
    );
  },
};

// Export for Node/Vitest environment (ignored in GAS runtime)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AssignmentFactory;
}
