/**
 * FirstRunManager Class
 * Handles the first run of the Assessment Bot Admin Sheet by:
 * 1. Setting the isAdminSheet configuration flag.
 * 2. Prompting the user to enter configuration values.
 * 3. Copying the Assessment Record template.
 * 4. Launching a wizard to set up the Assessment Record template.
 * 5. Creating the 'Classrooms' sheet.
 * 6. (Optionally) Prompting the user to fetch or create Google Classrooms.
 */
class FirstRunManager extends BaseUpdateAndInit {
  constructor() {
    super();
    // For the first run, ensure the admin sheet flag is set.
    configurationManager.setIsAdminSheet(true);

    // (Optionally) re-instantiate the UI manager for first-run dialogs.
    this.uiManager = UIManager.getInstance();
  }

  /**
   * Runs the complete first-run setup process.
   */
  runFirstRunSetup() {
    // Step 1: Prompt user to enter configuration values.
    this.uiManager.showConfigurationDialog();

    // Step 2: Copy the Assessment Record Template.
    this.destinationFolderId = configurationManager.getAssessmentRecordDestinationFolder();
    this.assessmentRecordTemplateId = this.copyAssessmentRecordTemplate();
    configurationManager.setAssessmentRecordTemplateId(this.assessmentRecordTemplateId);

    // Step 3: Launch the wizard to set up the Assessment Record template.
    const assessmentRecordTemplateUrl = this.getAssessmentRecordTemplateUrl(
      this.assessmentRecordTemplateId
    );
    const sa = new ScriptAppManager();
    const adminScriptId = sa.getScriptId();

    // Save the current state in case it is needed later.
    this.saveState();

    // Assumes you have an HTML file for the First Run Wizard.
    const template = HtmlService.createTemplateFromFile('FirstRun/FirstRunWizard');
    template.assessmentRecordTemplateUrl = assessmentRecordTemplateUrl;
    template.adminScriptId = adminScriptId;

    const htmlOutput = template.evaluate().setWidth(600).setHeight(400);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'First Run Setup Wizard');

    // Step 4: Create the 'Classrooms' sheet.
    const classroomManager = new GoogleClassroomManager();
    classroomManager.createClassroomsSheet();

    // Step 5: Additional prompting for Google Classroom setup can be handled via the wizard or further dialogs.
  }
}
