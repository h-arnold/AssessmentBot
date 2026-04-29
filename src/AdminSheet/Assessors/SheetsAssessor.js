/**  Sheets Assessor Class
 * Handles the non-LLM assessment of student responses in Google Sheets assignments.
 *
 */

class SheetsAssessor {
  constructor(tasks, studentTasks) {
    this.tasks = tasks;
    this.submissions = studentTasks;
    this.progressTracker = ProgressTracker.getInstance();
  }

  /**
   * Assesses all responses for all students.
   * Iterates through student tasks and their responses,
   * dispatching to specific assessment methods based on response type.
   */
  assessResponses() {
    this.submissions.forEach((submission) => {
      const studentName =
        submission?.studentName || submission?.student?.name || submission?.studentId || 'Unknown';

      if (!submission?.items) {
        ABLogger.getInstance().warn(`Submission or items missing for student: ${studentName}`);
        return;
      }

      this.progressTracker.updateProgress(`Assessing ${studentName}'s spreadsheet.`, false);

      Object.entries(submission.items).forEach(([taskKey, submissionItem]) => {
        if (!submissionItem) {
          return;
        }

        const itemType = submissionItem.getType();
        if (itemType !== 'SPREADSHEET') {
          return;
        }

        const referenceTask = this.tasks[taskKey];
        if (!referenceTask) {
          this.progressTracker.logAndThrowError(
            `Reference task missing for ${taskKey}, student ${studentName}`
          );
        }

        const assessmentResults = this.assessFormulaeTasks(
          submissionItem,
          referenceTask,
          taskKey,
          studentName
        );

        if (!assessmentResults) {
          return;
        }

        submissionItem.addAssessment('completeness', assessmentResults.completenessAssessment);
        submissionItem.addAssessment('accuracy', assessmentResults.accuracyAssessment);
        submissionItem.addAssessment('spag', assessmentResults.spagAssessment);
        submissionItem.assessments.formulaComparison = this._serialiseFormulaComparisonResults(
          assessmentResults.formulaComparisonResults
        );

        if (assessmentResults.formulaComparisonResults.cellReferenceFeedback) {
          submissionItem.addFeedback(
            'cellReference',
            assessmentResults.formulaComparisonResults.cellReferenceFeedback
          );
        }
      });
    });
  }

  /**
   * Assesses an individual student's formula response against a reference task and returns assessment data.
   * This method is called by `assessResponses` when a formula-based response is identified.
   * @param {Object} submissionItem - The student's submission item for the task.
   * @param {Object} referenceTask - The task definition or legacy reference task.
   * @param {string} taskKey - The key identifying the task.
   * @param {string} studentName - The name of the student (for logging purposes).
   * @return {Object|null} An object containing assessment instances and comparison results, or null if inputs are invalid.
   */
  assessFormulaeTasks(submissionItem, referenceTask, taskKey, studentName) {
    const studentArray = this._getStudentFormulaContent(submissionItem) || [];
    const referenceArray = this._getReferenceFormulaContent(referenceTask);
    if (!referenceArray) {
      this.progressTracker.logError(
        `Invalid data for formula assessment for task ${taskKey}, student ${studentName}`
      );
      return null;
    }

    const comparisonResults = this._compareFormulaArrays(
      referenceArray,
      studentArray,
      referenceTask.taskMetadata || {}
    );
    const totalFormulae = comparisonResults.totalFormulae;
    if (totalFormulae === 0) {
      ABLogger.getInstance().warn(
        `No reference formulae found for spreadsheet task ${taskKey}, student ${studentName}`
      );
      return null;
    }

    const scores = this.calculateFormulaeAssessmentScores(comparisonResults, totalFormulae);

    const completenessReasoning = this._generateCompletenessReasoning(
      comparisonResults,
      totalFormulae
    );
    const accuracyReasoning = this._generateAccuracyReasoning(comparisonResults, totalFormulae);

    const completenessAssessment = new Assessment(scores.completenessScore, completenessReasoning);
    const accuracyAssessment = new Assessment(scores.accuracyScore, accuracyReasoning);
    const spagAssessment = new Assessment(
      scores.spagScore,
      'SPaG is not assessed for formulae tasks.'
    );

    ABLogger.getInstance().info(
      `Assessed formulae task ${taskKey} for ${studentName}: ${JSON.stringify({
        correct: comparisonResults.correct,
        incorrect: comparisonResults.incorrect,
        notAttempted: comparisonResults.notAttempted,
      })}`
    );

    return {
      completenessAssessment: completenessAssessment,
      accuracyAssessment: accuracyAssessment,
      spagAssessment: spagAssessment,
      formulaComparisonResults: comparisonResults,
    };
  }

  _getStudentFormulaContent(submissionItem) {
    if (Array.isArray(submissionItem?.artifact?.content)) {
      return submissionItem.artifact.content;
    }
    if (Array.isArray(submissionItem?.response)) {
      return submissionItem.response;
    }
    return null;
  }

  _getReferenceFormulaContent(referenceTask) {
    const referenceArtifact =
      typeof referenceTask?.getPrimaryReference === 'function'
        ? referenceTask.getPrimaryReference()
        : null;
    if (Array.isArray(referenceArtifact?.content)) {
      return referenceArtifact.content;
    }
    if (Array.isArray(referenceTask?.taskReference)) {
      return referenceTask.taskReference;
    }
    return null;
  }

  _serialiseFormulaComparisonResults(comparisonResults) {
    return {
      ...comparisonResults,
      cellReferenceFeedback: comparisonResults.cellReferenceFeedback?.toJSON
        ? comparisonResults.cellReferenceFeedback.toJSON()
        : comparisonResults.cellReferenceFeedback,
    };
  }

  /**
   * Compares either legacy formula lists or current 2D spreadsheet grids.
   * @param {Array} referenceArray - Reference formulas.
   * @param {Array} studentArray - Student formulas.
   * @param {Object} taskMetadata - Bounding-box metadata for spreadsheet grids.
   * @return {Object} Object with counts and feedback objects.
   */
  _compareFormulaArrays(referenceArray, studentArray, taskMetadata = {}) {
    if (this._isLegacyFormulaList(referenceArray)) {
      return this._compareLegacyFormulaArrays(referenceArray, studentArray);
    }
    return this._compareGridFormulaArrays(referenceArray, studentArray, taskMetadata);
  }

  _isLegacyFormulaList(formulaArray) {
    return (
      Array.isArray(formulaArray) &&
      formulaArray.some((item) => item && typeof item === 'object' && Array.isArray(item.location))
    );
  }

  _compareGridFormulaArrays(referenceGrid, studentGrid, taskMetadata = {}) {
    let correct = 0;
    let incorrect = 0;
    let notAttempted = 0;
    const cellReferenceFeedback = new CellReferenceFeedback();
    const incorrectFormulae = [];
    const bbox = taskMetadata.bbox || taskMetadata.boundingBox || null;
    const rowOffset = bbox ? (bbox.startRow || 1) - 1 : 0;
    const columnOffset = bbox ? (bbox.startColumn || 1) - 1 : 0;
    let totalFormulae = 0;

    for (let row = 0; row < referenceGrid.length; row++) {
      const refRow = Array.isArray(referenceGrid[row]) ? referenceGrid[row] : [];
      const studentRow = Array.isArray(studentGrid[row]) ? studentGrid[row] : [];

      for (let column = 0; column < refRow.length; column++) {
        const refFormula = refRow[column] || '';
        if (!refFormula) {
          continue;
        }

        totalFormulae++;
        const studentFormula = studentRow[column] || '';
        const location = [row + rowOffset, column + columnOffset];

        if (studentFormula === refFormula) {
          cellReferenceFeedback.addItem(location, 'correct');
          correct++;
          continue;
        }

        if (!studentFormula) {
          cellReferenceFeedback.addItem(location, 'notAttempted');
          notAttempted++;
          continue;
        }

        cellReferenceFeedback.addItem(location, 'incorrect');
        incorrect++;
        incorrectFormulae.push({
          studentFormula,
          referenceFormula: refFormula,
          location,
        });
      }
    }

    return {
      correct,
      incorrect,
      notAttempted,
      incorrectFormulae,
      cellReferenceFeedback,
      totalFormulae,
    };
  }

  _compareLegacyFormulaArrays(referenceArray, studentArray) {
    let correct = 0;
    let incorrect = 0;
    let notAttempted = 0;
    const cellReferenceFeedback = new CellReferenceFeedback();
    const incorrectFormulae = [];

    for (let i = 0; i < referenceArray.length; i++) {
      const ref = referenceArray[i];
      const student = studentArray[i] || {};
      const refFormula = ref.referenceFormula || ref.formula || '';
      const studentFormula = student.formula || '';
      const location = student.location || ref.location;

      if (studentFormula === refFormula) {
        cellReferenceFeedback.addItem(location, 'correct');
        correct++;
      } else if (studentFormula === '') {
        cellReferenceFeedback.addItem(location, 'notAttempted');
        notAttempted++;
      } else {
        cellReferenceFeedback.addItem(location, 'incorrect');
        incorrect++;
        incorrectFormulae.push({
          studentFormula,
          referenceFormula: refFormula,
          location,
        });
      }
    }

    return {
      correct,
      incorrect,
      notAttempted,
      incorrectFormulae,
      cellReferenceFeedback,
      totalFormulae: referenceArray.length,
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
    return incorrectFormulae
      .map(
        (item) =>
          `Student Formula: ${item.studentFormula}\nCorrect Formula: ${item.referenceFormula}`
      )
      .join('\n\n');
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
    let reasoning = `Attempted ${totalFormulae - comparisonResults.notAttempted} formulae.\n${
      comparisonResults.correct
    } correct, ${comparisonResults.incorrect} incorrect.`;
    if (comparisonResults.incorrect > 0) {
      reasoning += `\n\n===============\nIncorrect Formulae:\n===============\n\n${this._formatIncorrectFormulaeList(
        comparisonResults.incorrectFormulae
      )}`;
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
    return `Completed ${
      comparisonResults.correct + comparisonResults.incorrect
    } out of ${totalFormulae} formulae. ${comparisonResults.notAttempted} not attempted.`;
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
    const accuracyScore = this._calculateFormulaeAccuracyScore(scores, countOfFormulae);
    return {
      completenessScore,
      accuracyScore,
      spagScore: 'N', //always return 'N' for formulae scores because SPaG isn't being assessed.
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

    const completenessScore = ((countOfFormulae - scores.notAttempted) / countOfFormulae) * 5;
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
  _calculateFormulaeAccuracyScore(scores, countOfFormulae) {
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

if (typeof module !== 'undefined') {
  module.exports = SheetsAssessor;
}
