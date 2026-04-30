/**
 * SheetsAssignment Class
 *
 * Represents a Google Sheets-based assignment within a course.
 * Handles spreadsheet-specific task extraction and processing.
 */
class SheetsAssignment extends Assignment {
  /**
   * Constructs a SheetsAssignment instance.
   * @param {string} courseId - The ID of the course.
   * @param {string} assignmentId - The ID of the assignment.
   * @param {AssignmentDefinition|Object} assignmentDefinition - The spreadsheet assignment definition instance or serialised data.
   */
  constructor(courseId, assignmentId, assignmentDefinition) {
    const defInstance =
      assignmentDefinition instanceof AssignmentDefinition
        ? assignmentDefinition
        : AssignmentDefinition.fromJSON(assignmentDefinition);
    super(courseId, assignmentId, defInstance);
  }

  /**
   * Deserialize SheetsAssignment from JSON data.
   * @param {object} data - JSON data object
   * @return {SheetsAssignment} Reconstructed SheetsAssignment instance
   */
  static fromJSON(data) {
    const inst = Assignment._baseFromJSON(data);
    Object.setPrototypeOf(inst, SheetsAssignment.prototype);
    return inst;
  }

  /**
   * Populates task definitions extracted from the reference and template spreadsheets.
   */
  populateTasks() {
    const { referenceDocumentId, templateDocumentId } = this.assignmentDefinition;
    const parser = new SheetsParser();
    const defs = parser.extractTaskDefinitions(referenceDocumentId, templateDocumentId);
    this.assignmentDefinition.tasks = Object.fromEntries(defs.map((td) => [td.getId(), td]));
    console.log(`Populated ${defs.length} spreadsheet TaskDefinitions.`);
  }

  /**
   * Fetches and assigns submitted Google Sheets documents for each student.
   * Only accepts Google Sheets MIME type.
   */
  fetchSubmittedDocuments() {
    // Google Sheets MIME type
    const SHEETS_MIME_TYPE = 'application/vnd.google-apps.spreadsheet';
    this.fetchSubmittedDocumentsByMimeType(SHEETS_MIME_TYPE);
  }

  /**
   * Processes all student submissions by extracting responses.
   * Implements the abstract processAllSubmissions method from the base class.
   */
  processAllSubmissions() {
    const parser = new SheetsParser();
    const taskDefs = Object.values(this.assignmentDefinition.tasks);
    this.submissions.forEach((sub) => {
      this.progressTracker.updateProgress(
        `Extracting work from spreadsheet for student ${sub.studentId}.`,
        false
      );
      if (!sub.documentId) {
        console.warn(`No document ID for studentId ${sub.studentId}; skipping.`);
        return;
      }
      const artifacts = parser.extractSubmissionArtifacts(sub.documentId, taskDefs);
      artifacts.forEach((a) => {
        const taskDef = this.assignmentDefinition.tasks[a.taskId];
        if (!taskDef) {
          console.warn('Unknown taskId ' + a.taskId + ' in spreadsheet submission extraction');
          return;
        }
        sub.upsertItemFromExtraction(taskDef, {
          pageId: a.pageId,
          content: a.content,
          metadata: a.metadata,
          documentId: a.documentId,
        });
      });
    });
  }

  /**
   * Assesses all student spreadsheet responses and applies cell-colour feedback.
   */
  assessResponses() {
    const assessor = new SheetsAssessor(this.getTasks(), this.submissions);
    assessor.assessResponses();

    const feedbackPopulator = new SheetsFeedback(this.submissions);
    feedbackPopulator.applyFeedback();
  }
}

// Export for Node/Vitest environment (ignored in GAS runtime)
if (typeof module !== 'undefined') {
  module.exports = SheetsAssignment;
}
