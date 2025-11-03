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
   * @param {string} referenceDocumentId - The ID of the reference spreadsheet document.
   * @param {string} templateDocumentId - The ID of the template spreadsheet document.
   */
  constructor(courseId, assignmentId, referenceDocumentId, templateDocumentId) {
    super(courseId, assignmentId);
    this.referenceDocumentId = referenceDocumentId;
    this.templateDocumentId = templateDocumentId;
    this.documentType = 'SHEETS';
  }

  /**
   * Serialize SheetsAssignment to JSON, including subclass-specific fields.
   * @return {object} JSON representation including documentType, referenceDocumentId, templateDocumentId
   */
  toJSON() {
    const base = super.toJSON();
    return {
      ...base,
      documentType: this.documentType,
      referenceDocumentId: this.referenceDocumentId,
      templateDocumentId: this.templateDocumentId,
    };
  }

  /**
   * Deserialize SheetsAssignment from JSON data.
   * @param {object} data - JSON data object
   * @return {SheetsAssignment} Reconstructed SheetsAssignment instance
   */
  static fromJSON(data) {
    const inst = Assignment._baseFromJSON(data);
    Object.setPrototypeOf(inst, SheetsAssignment.prototype);
    inst.referenceDocumentId = data.referenceDocumentId ?? null;
    inst.templateDocumentId = data.templateDocumentId ?? null;
    inst.documentType = 'SHEETS';
    return inst;
  }

  populateTasks() {
    const parser = new SheetsParser();
    const defs = parser.extractTaskDefinitions(this.referenceDocumentId, this.templateDocumentId);
    this.tasks = Object.fromEntries(defs.map((td) => [td.getId(), td]));
    console.log(`Populated ${defs.length} spreadsheet TaskDefinitions.`);
  }

  /**
   * Fetches and assigns submitted Google Sheets documents for each student.
   * Only accepts Google Sheets MIME type.
   */
  fetchSubmittedDocuments() {
    // Google Sheets MIME type
    const SHEETS_MIME_TYPE = MimeType.GOOGLE_SHEETS;
    this.fetchSubmittedDocumentsByMimeType(SHEETS_MIME_TYPE);
  }

  /**
   * Processes all student submissions by extracting responses.
   * Implements the abstract processAllSubmissions method from the base class.
   */
  processAllSubmissions() {
    const parser = new SheetsParser();
    const taskDefs = Object.values(this.tasks);
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
        const taskDef = this.tasks[a.taskId];
        if (!taskDef) {
          console.warn('Unknown taskId ' + a.taskId + ' in spreadsheet submission extraction');
          return;
        }
        sub.upsertItemFromExtraction(taskDef, {
          pageId: a.pageId,
          content: a.content,
          metadata: a.metadata,
        });
      });
    });
  }

  /**
   * Helper to determine if a student response entry is valid (not undefined/null and has a response).
   * @param {Object} studentResponseEntry
   * @return {boolean}
   */
  hasValidStudentResponse(studentResponseEntry) {
    // Use optional chaining to check presence of response property and ensure it's not null/undefined
    return studentResponseEntry?.response !== undefined && studentResponseEntry?.response !== null;
  }

  /**
   * Helper to determine if a reference task entry is valid (not undefined/null and has a taskReference).
   * @param {Object} referenceTask
   * @return {boolean}
   */
  hasValidReferenceTask(referenceTask) {
    // Optional chaining for concise existence check
    return referenceTask?.taskReference !== undefined && referenceTask?.taskReference !== null;
  }

  assessResponses() {
    // Spreadsheet assessment now expected to route via dedicated assessor using artifacts.
    // Placeholder: integrate AssessmentEngineRouter in later phase.
    if (typeof SheetsAssessor === 'undefined') {
      console.log('SheetsAssessor not available; skipping spreadsheet assessment.');
    } else {
      const assessor = new SheetsAssessor(this.tasks, this.submissions); //
      // Use optional chaining to call assessResponses if present
      assessor.assessResponses?.();
    }
  }
}

// Export for Node/Vitest environment (ignored in GAS runtime)
if (typeof module !== 'undefined') {
  module.exports = SheetsAssignment;
}
