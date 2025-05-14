/**
 * SlidesAssignment Class
 * 
 * Represents a Google Slides-based assignment within a course.
 * Handles slide-specific task extraction and processing.
 */
class SheetsAssignment extends Assignment {
  /**
   * Constructs a SlidesAssignment instance.
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

  assessResponses() {
    this.studentTasks.forEach(studentTask => {
      Object.keys(studentTask.responses).forEach(taskKey => { // Corrected: taskKey is the key from studentTask.responses
        const studentResponseEntry = studentTask.responses[taskKey];

        // Ensure student has a response for this taskKey
        if (!studentResponseEntry || typeof studentResponseEntry.response === 'undefined' || studentResponseEntry.response === null) {
          console.warn(`No response found for taskKey '${taskKey}' for student ${studentTask.student.name}. Skipping assessment for this task.`);

          return; // Move to the next taskKey
        }
        const studentArray = studentResponseEntry.response;

        const referenceTask = this.tasks[taskKey]; // Access reference task using taskKey

        // Ensure there is a reference task for this taskKey
        if (!referenceTask || typeof referenceTask.taskReference === 'undefined' || referenceTask.taskReference === null) {
          console.warn(`No reference task or taskReference found for taskKey '${taskKey}'. Skipping assessment for this task.`);
          // TODO: Handle missing reference task (e.g., log error, cannot assess)
          return; // Move to the next taskKey
        }
        const referenceArray = referenceTask.taskReference;

        // Compare the two arrays and assign a score.
        const results = this.compareFormulaArrays(referenceArray, studentArray);
        
        // TODO: Store 'results' in an appropriate place, e.g., studentResponseEntry.assessments
        // For example:
        // studentResponseEntry.assessments = studentResponseEntry.assessments || {};
        // studentResponseEntry.assessments.formulaComparison = results;
        // this.progressTracker.logProgress(`Assessed task ${taskKey} for ${studentTask.student.name}: ${JSON.stringify(results)}`);
      });
    });
  }

  /**
   * Compares two arrays of formula objects and counts correct, incorrect, and not attempted responses.
   * @param {Array} referenceArray - Array of reference formula objects ({referenceFormula, location} or similar).
   * @param {Array} studentArray - Array of student formula objects ({formula, location} or similar).
   * @return {Object} Object with counts: {correct, incorrect, notAttempted}
   */
  compareFormulaArrays(referenceArray, studentArray) {
    let correct = 0;
    let incorrect = 0;
    let notAttempted = 0;

    for (let i = 0; i < referenceArray.length; i++) {
      const ref = referenceArray[i];
      const student = studentArray[i] || {};
      const refFormula = ref.referenceFormula || ref.formula || "";
      const studentFormula = student.formula || "";

      if (studentFormula === refFormula) {
        correct++;
      } else if (studentFormula === "") {
        notAttempted++;
      } else {
        incorrect++;
      }
    }

    return { correct, incorrect, notAttempted };
  }
}