/**
 * SlidesAssignment Class
 * 
 * Represents a Google Slides-based assignment within a course.
 * Handles slide-specific task extraction and processing.
 */
class SheetsAssignment extends Assignment {
  /**
   * Constructs a SheetsAsignment instance.
   * @param {string} courseId - The ID of the course.
   * @param {string} assignmentId - The ID of the assignment.
   * @param {string} referenceDocumentId - The ID of the reference slides document.
   * @param {string} templateDocumentId - The ID of the template slides document.
   */
  constructor(courseId, assignmentId, referenceDocumentId, templateDocumentId) {
    super(courseId, assignmentId);
    this.referenceDocumentId = referenceDocumentId;
    this.templateDocumentId = templateDocumentId;
  }

  populateTasks() {
    const sheetsParser = new SheetsParser();

    // Extract reference tasks
    this.tasks = sheetsParser.extractTasks(this.referenceDocumentId, this.templateDocumentId);

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
    const sheetsParser = new SheetsParser();

    this.studentTasks.forEach(studentTask => {
      this.progressTracker.updateProgress(`Extracting work from ${studentTask.student.name}'s spreadsheet.`, false); // Corrected British English spelling
      if (studentTask.documentId) {
        studentTask.extractAndAssignResponses(sheetsParser, this.tasks);
      } else {
        console.warn(`No document ID for student: ${studentTask.student.email}. Skipping response extraction.`);
      }
    });
  }

  /**
   * Helper to determine if a student response entry is valid (not undefined/null and has a response).
   * @param {Object} studentResponseEntry
   * @return {boolean}
   */
  hasValidStudentResponse(studentResponseEntry) {
    return !!(
      studentResponseEntry &&
      typeof studentResponseEntry.response !== 'undefined' &&
      studentResponseEntry.response !== null
    );
  }

  /**
   * Helper to determine if a reference task entry is valid (not undefined/null and has a taskReference).
   * @param {Object} referenceTask
   * @return {boolean}
   */
  hasValidReferenceTask(referenceTask) {
    return !!(
      referenceTask &&
      typeof referenceTask.taskReference !== 'undefined' &&
      referenceTask.taskReference !== null
    );
  }

  assessResponses() {
    //Construct a sheets assessor instance with the reference and student tasks.
    const sheetsAssesor = new SheetsAssessor(this.tasks, this.studentTasks);

    const assessments = sheetsAssesor.assessResponses();
  }
}
    