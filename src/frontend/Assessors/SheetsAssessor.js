/**  Sheets Assessor Class
 * Handles the non-LLM assessment of student responses in Google Sheets assignments.
 *
 */

class SheetsAssessor {
  constructor(tasks, studentTasks) {
    this.tasks = tasks;
    this.studentTasks = studentTasks;
    this.progressTracker = progressTracker.getInstance();
  }

  /**
   * Assesses all responses for all students.
   * Iterates through student tasks and their responses,
   * dispatching to specific assessment methods based on response type.
   */
  assessResponses() {
    this.studentTasks.forEach((studentTask) => {
      if (!studentTask || !studentTask.responses) {
        console.warn(`Student task or responses missing for student: ${studentTask?.student?.name || 'Unknown'}`);
        return;
      }
      Object.entries(studentTask.responses).forEach(([taskKey, studentResponseEntry]) => {
        // Ensure studentResponseEntry and its response property exist
        if (studentResponseEntry && studentResponseEntry.response) {
          if (Array.isArray(studentResponseEntry.response)) {
            const referenceTask = this.tasks[taskKey];
            if (referenceTask) {
              this.assessFormulaeTasks(studentResponseEntry, referenceTask, taskKey, studentTask.student.name);
            } else {
              console.warn(`Reference task not found for key: ${taskKey} for student ${studentTask.student.name}. Skipping formula assessment.`);
              this.progressTracker.logError(`Reference task missing for ${taskKey}, student ${studentTask.student.name}`);
            }
          }

        } else {
          // Log if a response entry is missing or malformed, but not for intentionally null responses
          if (studentResponseEntry !== null) { // Allow for intentionally null responses (e.g. not attempted)
             console.warn(`Malformed or missing response entry for taskKey: ${taskKey}, student: ${studentTask.student.name}`);
          }
        }
      });
    });
  }

  /**
   * Assesses an individual student's formula response against a reference task.
   * This method is called by `assessResponses` when a formula-based response is identified.
   * @param {Object} studentResponseEntry - The student's response entry for the task, containing the `response` array.
   * @param {Object} referenceTask - The reference task object, containing the `taskReference` array.
   * @param {string} taskKey - The key identifying the task.
   * @param {string} studentName - The name of the student (for logging purposes).
   */
  assessFormulaeTasks(studentResponseEntry, referenceTask, taskKey, studentName) {
    const studentArray = studentResponseEntry.response;
    const referenceArray = referenceTask.taskReference;

    // Basic validation
    if (!Array.isArray(studentArray) || !Array.isArray(referenceArray)) {
      console.error(`Invalid data for formula comparison for task ${taskKey}, student ${studentName}. StudentArray or ReferenceArray is not an array.`);
      this.progressTracker.logError(`Invalid data for formula comparison for task ${taskKey}, student ${studentName}.`);
      studentResponseEntry.assessments = studentResponseEntry.assessments || {};
      studentResponseEntry.assessments.formulaComparison = { 
        error: "Invalid data provided for comparison.", 
        correct: 0, 
        incorrect: 0, 
        notAttempted: Array.isArray(referenceArray) ? referenceArray.length : 0 
      };
      return;
    }
    
    const results = this.compareFormulaArrays(referenceArray, studentArray);

    studentResponseEntry.assessments = studentResponseEntry.assessments || {};
    studentResponseEntry.assessments.formulaComparison = results;
    this.progressTracker.logProgress(`Assessed formulae task ${taskKey} for ${studentName}: ${JSON.stringify(results)}`);
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
