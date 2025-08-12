// globals.js for Cohort Analysis
// Global functions that bind UI actions to CohortAnalysisController methods

/**
 * Global function to initiate cohort analysis.
 * Creates a CohortAnalysisController instance and calls its analyseCohorts method.
 */
function analyseCohorts() {
  const cohortAnalysisController = new CohortAnalysisController();
  cohortAnalysisController.analyseCohorts();
}
