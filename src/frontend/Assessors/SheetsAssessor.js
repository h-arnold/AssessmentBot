/**  Sheets Assessor Class
 * Handles the non-LLM assessment of student responses in Google Sheets assignments.
 *
 */

class SheetsAssessor {
  constructor(tasks, studentTasks) {
    this.tasks = tasks;
    this.studentTasks = studentTasks;
    this.progressTracker = ProgressTracker.getInstance();
  }

  /**
   * Assesses all responses for all students.
   * Iterates through student tasks and their responses,
   * dispatching to specific assessment methods based on response type.
   */
  assessResponses() {
    this.studentTasks.forEach((studentTask) => {
      // Essential check - skip if student task or responses don't exist
      if (!studentTask || !studentTask.responses) {
        console.warn(`Student task or responses missing for student: ${studentTask?.student?.name || 'Unknown'}`);
        return;
      }

      this.progressTracker.updateProgress(`Assessing ${studentTask.student.name}'s spreadsheet.`, false);

      Object.entries(studentTask.responses).forEach(([taskKey, studentResponseEntry]) => {
        // Skip null responses (intentionally not attempted tasks)
        if (studentResponseEntry === null) {
          return;
        }

        // Skip non-formula responses or empty responses
        if (!studentResponseEntry.response || !Array.isArray(studentResponseEntry.response)) {
          return;
        }

        // Get reference task
        const referenceTask = this.tasks[taskKey];
        if (!referenceTask) {
          this.progressTracker.logError(`Reference task missing for ${taskKey}, student ${studentTask.student.name}`);
          throw new Error(`Reference task missing for ${taskKey}, student ${studentTask.student.name}`);
        }

        // Assess formulas
        const assessmentResults = this.assessFormulaeTasks(
          studentResponseEntry, 
          referenceTask, 
          taskKey, 
          studentTask.student.name
        );
        
        if (!assessmentResults) {
          return;
        }

        // Add assessments to the student task
        studentTask.addAssessment(taskKey, 'completeness', assessmentResults.completenessAssessment);
        studentTask.addAssessment(taskKey, 'accuracy', assessmentResults.accuracyAssessment);
        studentTask.addAssessment(taskKey, 'spag', assessmentResults.spagAssessment);

        // Add formula comparison results directly - addAssessment ensures assessments object exists
        studentResponseEntry.assessments.formulaComparison = assessmentResults.formulaComparisonResults;

        // Add cell reference feedback to the response using the feedback model
        if (assessmentResults.formulaComparisonResults.cellReferenceFeedback) {
          studentTask.addFeedback(taskKey, assessmentResults.formulaComparisonResults.cellReferenceFeedback);
        }
      });
    });
  }

  /**
   * Assesses an individual student's formula response against a reference task and returns assessment data.
   * This method is called by `assessResponses` when a formula-based response is identified.
   * @param {Object} studentResponseEntry - The student's response entry for the task, containing the `response` array.
   * @param {Object} referenceTask - The reference task object, containing the `taskReference` array.
   * @param {string} taskKey - The key identifying the task.
   * @param {string} studentName - The name of the student (for logging purposes).
   * @return {Object|null} An object containing assessment instances and comparison results, or null if inputs are invalid.
   */
  assessFormulaeTasks(studentResponseEntry, referenceTask, taskKey, studentName) {
    if (!studentResponseEntry || !studentResponseEntry.response || !referenceTask || !referenceTask.taskReference) {
      console.warn(`Invalid input for assessFormulaeTasks for taskKey: ${taskKey}, student: ${studentName}`);
      this.progressTracker.logError(`Invalid data for formula assessment for task ${taskKey}, student ${studentName}`);
      return null;
    }

    const studentArray = studentResponseEntry.response;
    const referenceArray = referenceTask.taskReference;

    // Compare the two arrays of formula objects and count correct, incorrect, and not attempted responses
    const comparisonResults = this._compareFormulaArrays(referenceArray, studentArray);

    // Calculate assessment scores based on the comparison results
    const scores = this.calculateFormulaeAssessmentScores(comparisonResults, referenceArray.length);

    // Add reasoning stats to the completeness and accuracy scores.
    // No need for SPaG reasoning as it's not applicable for formulae.
    const completenessReasoning = this._generateCompletenessReasoning(comparisonResults, referenceArray.length);
    const accuracyReasoning = this._generateAccuracyReasoning(comparisonResults, referenceArray.length);

    // Create assessment objects for completeness, accuracy, and SPaG (SPaG will always be 'N')
    const completenessAssessment = new Assessment(scores.completenessScore, completenessReasoning);
    const accuracyAssessment = new Assessment(scores.accuracyScore, accuracyReasoning);
    const spagAssessment = new Assessment(scores.spagScore, "SPaG is not assessed for formulae tasks.");

    console.log(`Assessed formulae task ${taskKey} for ${studentName}: ${JSON.stringify(comparisonResults)}`, false);

    return {
      completenessAssessment: completenessAssessment,
      accuracyAssessment: accuracyAssessment,
      spagAssessment: spagAssessment,
      formulaComparisonResults: comparisonResults
    };
  }

  /**
   * Compares two arrays of formula objects and counts correct, incorrect, and not attempted responses.
   * Also outputs a list of incorrect formulae with student and reference formulae.
   * @param {Array} referenceArray - Array of reference formula objects ({referenceFormula, location} or similar).
   * @param {Array} studentArray - Array of student formula objects ({formula, location} or similar).
   * @return {Object} Object with counts and feedback objects.
   */
  _compareFormulaArrays(referenceArray, studentArray) {
    let correct = 0;
    let incorrect = 0;
    let notAttempted = 0;
    const cellReferenceFeedback = new CellReferenceFeedback();
    let incorrectFormulae = [];

    for (let i = 0; i < referenceArray.length; i++) {
      const ref = referenceArray[i];
      const student = studentArray[i] || {};
      const refFormula = ref.referenceFormula || ref.formula || "";
      const studentFormula = student.formula || "";

      if (studentFormula === refFormula) {
        cellReferenceFeedback.addItem(student.location, "correct");
        correct++;
      } else if (studentFormula === "") {
        cellReferenceFeedback.addItem(student.location, "notAttempted");
        notAttempted++;
      } else {
        cellReferenceFeedback.addItem(student.location, "incorrect");
        incorrect++;

        incorrectFormulae.push({
          studentFormula: studentFormula,
          referenceFormula: refFormula
        });
      }
    }

    return { 
      correct, 
      incorrect, 
      notAttempted, 
      incorrectFormulae, 
      cellReferenceFeedback 
    };
  }

  /**
   * Converts an array of incorrect formulae objects into a formatted string.
   * Each entry is separated by two new lines, and within each entry,
   * the student and reference formulae are separated by a single newline.
   * @param {Array} incorrectFormulae - Array of objects: {studentFormula, referenceFormula}
   * @return {string} Formatted string for display or feedback.
   * @private
   */
  _formatIncorrectFormulaeList(incorrectFormulae) {
    if (!Array.isArray(incorrectFormulae) || incorrectFormulae.length === 0) {
      return '';
    }
    return incorrectFormulae.map(item =>
      `Student Formula: ${item.studentFormula}\nCorrect Formula: ${item.referenceFormula}`
    ).join('\n\n');
  }

  /**
   * Generates a formatted accuracy reasoning string for formula assessment.
   * Includes incorrect formulae list only if there are any incorrect answers.
   * @param {Object} comparisonResults - Result object from compareFormulaArrays.
   * @param {number} totalFormulae - Total number of formulae in the reference array.
   * @return {string} Formatted reasoning string.
   * @private
   */
  _generateAccuracyReasoning(comparisonResults, totalFormulae) {
    let reasoning = `Attempted ${totalFormulae - comparisonResults.notAttempted} formulae.\n${comparisonResults.correct} correct, ${comparisonResults.incorrect} incorrect.`;
    if (comparisonResults.incorrect > 0) {
      reasoning += `\n\n===============\nIncorrect Formulae:\n===============\n\n${this._formatIncorrectFormulaeList(comparisonResults.incorrectFormulae)}`;
    }
    return reasoning;
  }

  /**
   * Generates a formatted completeness reasoning string for formula assessment.
   * @param {Object} comparisonResults - Result object from compareFormulaArrays.
   * @param {number} totalFormulae - Total number of formulae in the reference array.
   * @return {string} Formatted completeness reasoning.
   * @private
   */
  _generateCompletenessReasoning(comparisonResults, totalFormulae) {
    return `Completed ${comparisonResults.correct + comparisonResults.incorrect} out of ${totalFormulae} formulae. ${comparisonResults.notAttempted} not attempted.`;
  }

  /**
   * Calculates assessment scores for formulae based on provided scores and the total count of formulae.
   *
   * @param {Array<number>} scores - An array of scores for each formula assessed.
   * @param {number} countOfFormulae - The total number of formulae to be assessed.
   * @returns {Object} An object containing:
   *   - {number} completenessScore: The score representing formula completeness.
   *   - {number} accuracyScore: The score representing formula accuracy.
   *   - {string} spagScore: Always returns 'N' as SPaG is not assessed for formulae.
   */
  calculateFormulaeAssessmentScores(scores, countOfFormulae) {
    const completenessScore = this._calculateFormulaeCompletenessScore(scores, countOfFormulae);
    const accuracyScore = this._calculateFormalaeAccuracyScore(scores, countOfFormulae);
    return {
      completenessScore,
      accuracyScore,
      spagScore: "N" //always return 'N' for formulae scores because SPaG isn't being assessed.
    };

  }

  /**
   * Calculates the completeness score for formulae based on the number of attempted formulae.
   *
   * @param {Object} scores - An object containing the count of not attempted formulae.
   * @param {number} scores.notAttempted - The number of formulae that were not attempted.
   * @param {number} countOfFormulae - The total number of formulae.
   * @returns {number} The completeness score, scaled to 5 and rounded to 2 decimal places. Returns 0 if no formulae were attempted.
   */
  _calculateFormulaeCompletenessScore(scores, countOfFormulae) {
    // If all formulae are not attempted, return 0 to avoid division by zero
    if (scores.notAttempted === countOfFormulae) {
      return 0;
    }
    // If all formulae are attempted, return 5 to avoid division by zero
    if (scores.notAttempted === 0) {
      return 5;
    }
    // Calculate completeness score based on the number of attempted formulae
    // and the total number of formulae
    // Scale the score to a range of 0 to 5
    // and round to 2 decimal places

    const completenessScore = (countOfFormulae - scores.notAttempted) / countOfFormulae * 5;
    return Number(completenessScore.toFixed(2)); // Round score to  2 decimal places
  }

  /**
   * Calculates the accuracy score for formulae based on the number of correct answers.
   * The score is scaled to a range of 0 to 5 and rounded to 2 decimal places.
   *
   * @param {Object} scores - An object containing the count of correct formulae.
   * @param {number} scores.correct - The number of correct formulae.
   * @param {number} countOfFormulae - The total number of formulae to assess.
   * @returns {number} The calculated accuracy score (0 to 5, rounded to 2 decimal places).
   */
  _calculateFormalaeAccuracyScore(scores, countOfFormulae) {
    if (scores.correct === 0) {
      return 0; // If no correct answers, return 0
    }
    // If all formulae are correct, return 5 to avoid division by zero
    if (scores.correct === countOfFormulae) {
      return 5;
    }
    // Calculate accuracy score based on the number of correct formulae
    // and the total number of formulae
    // Scale the score to a range of 0 to 5
    // and round to 2 decimal places
    const accuracyScore = (scores.correct / (countOfFormulae - scores.notAttempted)) * 5;
    return Number(accuracyScore.toFixed(2)); // Round score to 2 decimal places
  }
}
