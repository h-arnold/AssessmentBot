// CohortAnalysisController.js

/**
 * Controller class for handling cohort analysis functionality.
 * Extracts data from assessment records and creates summary sheets for year groups.
 */
class CohortAnalysisController {
  constructor() {
    // Access the singleton instance of ProgressTracker
    this.progressTracker = ProgressTracker.getInstance();

    // Attempt to instantiate UIManager only in user context to avoid issues with triggers
    try {
      this.uiManager = new UIManager();
      console.log("UIManager instantiated successfully in CohortAnalysisController.");
    } catch (error) {
      console.error("UIManager cannot be instantiated: " + error);
      this.uiManager = null; // UIManager is not available in this context
    }
  }

  /**
   * Analyses cohort data by extracting information from assessment records and creating summary sheets.
   * This method performs the following operations:
   * 1. Extracts data from 'Overview' sheets across all assessment records
   * 2. Creates aggregated sheets for each year group
   * 3. Generates a summary sheet with year group averages
   * 
   * @throws {Error} If any step in the analysis process fails
   */
  analyseCohorts() {
    let step = 0;

    try {
      // Start progress tracking
      this.progressTracker.startTracking();

      // Show the progress modal (if the UI is available)
      if (this.uiManager) {
        this.uiManager.showProgressModal();
      } else {
        console.warn("UIManager is not available; cannot show the progress modal.");
      }

      // Extract data from the 'Overview' sheet in each assessment record and aggregate into a JSON object
      this.progressTracker.updateProgress(step++, "Extracting data from all assessment records.");

      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      const classroomsSheet = spreadsheet.getSheetByName('Classrooms');

      const sheetExtractor = new MultiSheetExtractor(classroomsSheet);
      const overviewData = sheetExtractor.processAllOverviewSheets();

      // Create aggregated sheets for each year group
      this.progressTracker.updateProgress(step++, "Creating year group sheets.");

      const cohortAnalysis = new CohortAnalysisSheetManager();
      cohortAnalysis.createYearGroupSheets(overviewData, spreadsheet.getId());

      // Create the 'Summary' sheet to display year group averages
      this.progressTracker.updateProgress(step++, "Creating the summary sheet.");

      const summarySheet = new SummarySheetManager();
      summarySheet.createSummarySheet(overviewData, spreadsheet.getId());

      // If everything went well, complete the progress
      this.progressTracker.complete();

      console.log("Cohort analysis completed successfully.");
    } catch (error) {
      // Log and display any errors
      console.error("Error during cohort analysis:", error);
      this.progressTracker.logError(error.message);
      throw error;
    }
  }
}
