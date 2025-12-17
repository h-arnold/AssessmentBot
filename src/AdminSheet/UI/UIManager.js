// UIManager.gs
/**
 * @class UIManager
 * @description Manages the user interface operations in Google Apps Script environment with robust error handling and context-aware UI operations.
 * The class implements a "safe UI operation" pattern through encapsulation, where all UI operations are wrapped in safety checks.
 * This ensures that UI operations only execute when the UI context is available, preventing runtime errors in contexts where UI operations are not possible
 * (such as time-driven triggers or background operations).
 *
 * Key features:
 * - Automatic UI context detection and graceful degradation
 * - Safe UI operation wrapper for all UI interactions
 * - Comprehensive menu management for different authorization states
 * - Modal dialog management for various user interactions
 * - Classroom data management integration
 *
 * @property {boolean} uiAvailable - Indicates whether UI operations are possible in current context
 * @property {GoogleAppsScript.Base.Ui} ui - Reference to Google Apps Script UI instance, null if UI is unavailable
 * @property {GoogleClassroomManager} classroomManager - Instance of GoogleClassroomManager for classroom operations
 *
 * @example
 * const uiManager = new UIManager();
 * uiManager.safeUiOperation(() => {
 *   // Your UI operation here
 *   this.ui.alert('Hello World');
 * }, "showAlert");
 */

class UIManager extends BaseSingleton {
  /**
   * Static method to get the UIManager instance
   * @returns {UIManager} The singleton UIManager instance
   */

  /**
   * Static method to check if UI is available in the current execution context
   * @returns {boolean} True if UI is available, false otherwise
   */
  static isUiAvailable() {
    try {
      const ui = SpreadsheetApp.getUi();
      // Just getting UI object isn't sufficient - try a simple operation
      // but don't actually add to UI in this check
      ui.createMenu('Test');
      return true;
    } catch (error) {
      ABLogger.getInstance().warn('UI operations are not available in this context', {
        err: error,
      });
      return false;
    }
  }

  constructor(isSingletonCreator = false) {
    super();
    /**
     * JSDoc Singleton Banner
     * Use UIManager.getInstance(); do not call constructor directly.
     */
    // Singleton guard: constructor should only run once via getInstance()
    if (!isSingletonCreator && UIManager._instance) {
      throw new Error('Use UIManager.getInstance() to access the UIManager singleton.');
    }

    // Defer UI availability probe until first safe UI op (lazy probing)
    this._uiProbed = false;
    this.uiAvailable = false; // Unknown until probed
    this.ui = null; // Will be set if probe succeeds

    // Always initialize this regardless of UI availability
    this.classroomManager = null; // Defer classroom manager creation until first classroom-related call

    // Store the instance only if we don't already have one
    if (!UIManager._instance) {
      UIManager._instance = this;
    }
  }

  /**
   * Safely executes UI operations only if UI is available
   * @param {Function} operation - The UI operation to perform
   * @param {string} operationName - Name of the operation for logging
   * @returns {*} Result of the operation or null if UI is unavailable
   */
  safeUiOperation(operation, operationName = 'UI operation') {
    // Ensure we've probed the UI lazily
    if (!this._uiProbed) this.probeUiIfNeeded();
    if (!this.uiAvailable) {
      ABLogger.getInstance().debugUi(`Skipped ${operationName}: UI not available in this context`);
      return null;
    }
    try {
      return operation();
    } catch (error) {
      console.error(`Error in ${operationName}: ${error}`);
      return null;
    }
  }
  probeUiIfNeeded() {
    if (this._uiProbed) return;
    this._uiProbed = true;
    let available = false;
    try {
      available = UIManager.isUiAvailable();
    } catch (e) {
      ABLogger.getInstance().warn('UI availability probe failed', { err: e });
      available = false;
    }
    this.uiAvailable = available;
    if (available) {
      try {
        this.ui = SpreadsheetApp.getUi();
        ABLogger.getInstance().debugUi('UI probe successful; UI acquired.');
      } catch (err) {
        ABLogger.getInstance().error('Failed to acquire Spreadsheet UI', { err });
        this.uiAvailable = false;
        this.ui = null;
      }
    } else {
      ABLogger.getInstance().debugUi('UI probe completed: UI not available.');
    }
  }
  ensureClassroomManager() {
    if (!this.classroomManager) {
      if (globalThis.__TRACE_SINGLETON__)
        console.log('[TRACE][HeavyInit] UIManager.ensureClassroomManager');
      this.classroomManager = new GoogleClassroomManager();
      ABLogger.getInstance().debugUi('GoogleClassroomManager lazily instantiated.');
    }
    return this.classroomManager;
  }

  /**
   * Internal helper to DRY modal template instantiation.
   * @param {string} file - Template file path relative to root (e.g. 'UI/AssignmentDropdown')
   * @param {Object} data - Key/values assigned onto the template before evaluation.
   * @param {string} title - Dialog title
   * @param {{width?:number,height?:number}} opts - Dimensions (defaults applied if absent)
   */
  _showTemplateDialog(file, data, title, { width = 400, height = 300 } = {}) {
    this.safeUiOperation(() => {
      const template = HtmlService.createTemplateFromFile(file);
      if (data && typeof data === 'object') {
        Object.keys(data).forEach((k) => {
          template[k] = data[k];
        });
      }
      const htmlOutput = template.evaluate().setWidth(width).setHeight(height);
      this.ui.showModalDialog(htmlOutput, title);
    }, `_showTemplateDialog:${title}`);
  }

  /**
   * Creates a limited menu for unauthorized state
   */
  createUnauthorisedMenu() {
    this.safeUiOperation(() => {
      const menu = this.ui
        .createMenu('Assessment Bot')
        .addItem('Authorise App', 'handleScriptInit');
      menu.addToUi();
    }, 'createUnauthorisedMenu');
  }

  /**
   * Creates a single menu option to complete update process.
   *
   */
  createFinishUpdateMenu() {
    this.safeUiOperation(() => {
      const menu = this.ui
        .createMenu('Assessment Bot')
        .addItem('Finish Update', 'handleAuthorisation');
      menu.addToUi();
    }, 'createFinishUpdateMenu');
  }

  /**
   * Creates the full menu for authorized state
   *
   */
  createAuthorisedMenu() {
    this.safeUiOperation(() => {
      const ui = this.ui;

      // Create the root menu
      const menu = ui.createMenu('Assessment Bot').addItem('Analyse Cohorts', 'analyseCohorts');

      // Add a sub-menu for Google Classrooms operations
      const classroomsSubMenu = ui
        .createMenu('Google Classrooms')
        .addItem('Fetch Classrooms', 'handleFetchGoogleClassrooms')
        .addItem('Create Classrooms', 'handleCreateGoogleClassrooms')
        //.addItem('Update Classrooms', 'handleUpdateGoogleClassrooms');
        .addItem('Create Assessment Records', 'createAssessmentRecords');
      menu.addSubMenu(classroomsSubMenu);

      // Add a sub-menu for Settings
      const settingsSubMenu = ui
        .createMenu('Settings')
        .addItem('Settings', 'showConfigurationDialog')
        .addItem('Update Assessment Bot', 'showVersionSelector');
      menu.addSubMenu(settingsSubMenu);

      // Add a sub-menu for Debug operations
      const debugSubMenu = ui
        .createMenu('Debug')
        .addItem('Assess Student Work', 'showAssignmentDropdown')
        .addItem('Check Progress', 'showProgressModal');
      menu.addSubMenu(debugSubMenu);

      // Add the menu to the UI
      menu.addToUi();
    }, 'createAuthorisedMenu');
  }

  /**
   * Creates a menu for Assessment Record sheets.
   * This menu is added to Assessment Record spreadsheets to provide functionality
   * similar to the menu defined in menus.js for assessment record templates.
   */
  createAssessmentRecordMenu() {
    this.safeUiOperation(() => {
      const ui = SpreadsheetApp.getUi();
      ui.createMenu('Assessment Bot')
        .addItem('Assess Assignment', 'assessAssignment')
        .addItem('Check Progress', 'showProgressModal')
        .addItem('Change Class', 'showClassroomDropdown')
        .addToUi();

      ABLogger.getInstance().debugUi('Assessment Record menu created.');
    }, 'createAssessmentRecordMenu');
  }

  /**
   * Shows the configuration dialog modal.
   */
  showConfigurationDialog() {
    this.safeUiOperation(() => {
      const html = HtmlService.createHtmlOutputFromFile('UI/ConfigurationDialog')
        .setWidth(500)
        .setHeight(600); // Adjust the size as needed

      this.ui.showModalDialog(html, 'Configure Script Properties');
      ABLogger.getInstance().debugUi('Configuration dialog displayed.');
    }, 'showConfigurationDialog');
  }

  /**
   * Shows a modal dialog with a dropdown of assignments to choose from.
   */
  showAssignmentDropdown() {
    const cm = this.ensureClassroomManager();
    const courseId = cm.getCourseId();
    const assignments = cm.getAssignments(courseId);
    const maxTitleLength = this.getMaxTitleLength(assignments);
    const modalWidth = Math.max(300, maxTitleLength * 10);
    this._showTemplateDialog('UI/AssignmentDropdown', { assignments }, 'Select Assignment', {
      width: modalWidth,
      height: 250,
    });
    ABLogger.getInstance().debugUi('Assignment dropdown modal displayed.');
  }

  /**
   * Gets the maximum length of assignment titles.
   *
   * @param {Object[]} assignments - The list of assignments.
   * @returns {number} The maximum length of assignment titles.
   */
  getMaxTitleLength(assignments) {
    let maxLength = 0;
    assignments.forEach((assignment) => {
      if (assignment.title.length > maxLength) {
        maxLength = assignment.title.length;
      }
    });
    return maxLength;
  }

  /**
   * Opens a modal dialog to get the reference and empty slide IDs.
   *
   * @param {string} assignmentData - The assignment data (JSON string).
   */
  openReferenceSlideModal(assignmentData) {
    this.safeUiOperation(() => {
      try {
        const assignmentDataObj = JSON.parse(assignmentData);
        const courseId = this.ensureClassroomManager().getCourseId();
        const courseWork = Classroom.Courses.CourseWork.get(courseId, assignmentDataObj.id);
        const topicId = courseWork?.topicId || null;
        const abClassController = new ABClassController();
        const abClass = abClassController.loadClass(courseId);
        const yearGroup = abClass?.yearGroup ?? null;
        const primaryTopic = topicId ? ClassroomApiClient.fetchTopicName(courseId, topicId) : null;
        const definitionKey = AssignmentDefinition.buildDefinitionKey({
          primaryTitle: assignmentDataObj.name,
          primaryTopic,
          yearGroup,
        });
        const definition = new AssignmentDefinitionController().getDefinitionByKey(definitionKey);
        const savedDocumentIds = definition
          ? {
              referenceDocumentId: definition.referenceDocumentId,
              templateDocumentId: definition.templateDocumentId,
            }
          : {};
        this._showTemplateDialog(
          'UI/SlideIdsModal',
          { assignmentDataObj, savedDocumentIds },
          'Enter Slide IDs',
          { width: 400, height: 350 }
        );
        ABLogger.getInstance().debugUi('Reference slide IDs modal displayed.');
      } catch (error) {
        ProgressTracker.getInstance().logError('Failed to open slide IDs modal.', { err: error });
        Utils.toastMessage('Failed to open slide IDs modal: ' + error.message, 'Error', 5);
      }
    }, 'openReferenceSlideModal');
  }

  /**
   * Shows a modal dialog with a dropdown list of active Google Classroom courses.
   */
  showClassroomDropdown() {
    this.safeUiOperation(() => {
      try {
        const cm = this.ensureClassroomManager();
        const classrooms = cm.getActiveClassrooms();
        classrooms.sort((a, b) => a.name.localeCompare(b.name));
        this._showTemplateDialog('UI/ClassroomDropdown', { classrooms }, 'Select Classroom', {
          width: 500,
          height: 300,
        });
        ABLogger.getInstance().debugUi('Classroom dropdown modal displayed.');
      } catch (error) {
        console.error('Error displaying classroom dropdown modal:', error);
        Utils.toastMessage('Failed to load classrooms: ' + error.message, 'Error', 5);
      }
    }, 'showClassroomDropdown');
  }

  /**
   * Saves the reference and template slide/document IDs for a given assignment title.
   * Persists document IDs into the assignment definition so the pipeline can access them.
   *
   * @param {string} assignmentId The Google Classroom assignment ID.
   * @param {Object} documentIds An object containing referenceDocumentId and templateDocumentId.
   */
  saveDocumentIdsForAssignment(assignmentId, documentIds) {
    try {
      const assignmentController = new AssignmentController();
      const { definition } = assignmentController.ensureDefinitionFromInputs({
        assignmentTitle: null,
        assignmentId,
        documentIds,
      });

      this.utils.toastMessage('Document IDs saved successfully.', 'Success', 3);
      return definition.definitionKey;
    } catch (error) {
      ProgressTracker.getInstance().logError('Error in saveDocumentIdsForAssignment.', {
        err: error,
      });
      this.utils.toastMessage(`Failed to save document IDs: ${error.message}`, 'Error', 5);
      throw error;
    }
  }

  /**
   * Opens the progress modal.
   */
  showProgressModal() {
    this.safeUiOperation(() => {
      const html = HtmlService.createHtmlOutputFromFile('UI/ProgressModal')
        .setWidth(400)
        .setHeight(160);
      this.ui.showModalDialog(html, 'Progress');
      ABLogger.getInstance().debugUi('Progress modal displayed.');
    }, 'showProgressModal');
  }

  /**
   * Retrieves the classroom data from the 'Classroom' sheet.
   * Returns an array of objects representing rows.
   */
  getClassroomData() {
    const sheet = this.ensureClassroomManager().sheet;
    const data = sheet.getDataRange().getValues();

    if (data.length < 2) {
      return []; // No data rows
    }

    // Expected headers: Classroom ID, Name, Teacher 1, Teacher 2, Teacher 3, Teacher 4, Enrollment Code, createAssessmentRecord, Template File Id
    const result = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      // Safely read columns by index
      const classroomID = row[0];
      const name = row[1];
      const teacher1 = row[2];
      const teacher2 = row[3];
      const teacher3 = row[4];
      const teacher4 = row[5];
      const enrollmentCode = row[6];
      const createAssessmentRecord = row[7];
      const templateFileId = row[8];

      result.push({
        ClassroomID: classroomID,
        Name: name,
        Teacher1: teacher1,
        Teacher2: teacher2,
        Teacher3: teacher3,
        Teacher4: teacher4,
        EnrollmentCode: enrollmentCode,
        createAssessmentRecord:
          createAssessmentRecord === true || createAssessmentRecord === 'true',
        TemplateFileId: templateFileId,
      });
    }

    return result;
  }

  /**
   * Saves the updated classroom data back to the 'Classroom' sheet.
   * @param {Object[]} rows - The updated rows of data.
   */
  saveClassroomData(rows) {
    const sheet = this.ensureClassroomManager().sheet;
    const data = sheet.getDataRange().getValues();

    if (data.length < 2) {
      throw new Error('No data to save to. The sheet is empty.');
    }

    // We assume the header row is fixed in the format:
    // Classroom ID | Name | Teacher 1 | Teacher 2 | Teacher 3 | Teacher 4 | Enrollment Code | createAssessmentRecord | Template File Id
    const headerMap = {
      ClassroomID: 0,
      Name: 1,
      Teacher1: 2,
      Teacher2: 3,
      Teacher3: 4,
      Teacher4: 5,
      EnrollmentCode: 6,
      createAssessmentRecord: 7,
      TemplateFileId: 8,
    };

    // Build a lookup map from ClassroomID to row index
    const idToRow = {};
    for (let i = 1; i < data.length; i++) {
      const classroomID = data[i][0];
      if (classroomID) {
        idToRow[classroomID.toString()] = i; // Store the row index in the data array
      }
    }

    // Update data array with new values
    rows.forEach((rowObj) => {
      const rowIndex = idToRow[rowObj.ClassroomID];
      if (rowIndex === undefined) {
        // If ClassroomID not found, we skip or could throw an error
        console.warn(`ClassroomID ${rowObj.ClassroomID} not found in the sheet. Skipping update.`);
        return;
      }

      // Update only editable fields
      data[rowIndex][headerMap['Name']] = rowObj.Name;
      data[rowIndex][headerMap['Teacher1']] = rowObj.Teacher1;
      data[rowIndex][headerMap['Teacher2']] = rowObj.Teacher2;
      data[rowIndex][headerMap['Teacher3']] = rowObj.Teacher3;
      data[rowIndex][headerMap['Teacher4']] = rowObj.Teacher4;
      data[rowIndex][headerMap['EnrollmentCode']] = rowObj.EnrollmentCode;
      data[rowIndex][headerMap['createAssessmentRecord']] = rowObj.createAssessmentRecord === true;
      // TemplateFileId and ClassroomID remain unchanged
    });

    // Write updated data back to the sheet
    sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
  }

  /**
   * Shows a modal dialog for editing classroom data.
   */
  showClassroomEditorModal() {
    this.safeUiOperation(() => {
      const html = HtmlService.createHtmlOutputFromFile('UI/ClassroomEditorModal')
        .setWidth(900)
        .setHeight(600); // Adjust width and height as needed

      this.ui.showModalDialog(html, 'Edit Classrooms');
      ABLogger.getInstance().debugUi('Classroom editor modal displayed.');
    }, 'showClassroomEditorModal');
  }

  /**
   * Displays a modal dialog for version selection.
   * Creates and shows a UI dialog that allows users to select from available versions for update.
   * Fetches version details through UpdateManager and displays them in a templated HTML modal.
   *
   * @throws {Error} If version details cannot be fetched
   *
   * @example
   * const uiManager = new UIManager();
   * uiManager.showVersionSelector();
   */
  showVersionSelector() {
    this.safeUiOperation(() => {
      try {
        const updateManager = new UpdateManager();
        const versions = updateManager.fetchVersionDetails();
        if (!versions) throw new Error('Failed to fetch version details');
        this._showTemplateDialog(
          'UI/VersionSelectorModal',
          { versions },
          'Select Version to Update To',
          { width: 400, height: 250 }
        );
      } catch (error) {
        console.error('Error showing version selector:', error);
        Utils.toastMessage('Failed to load versions: ' + error.message, 'Error', 5);
      }
    }, 'showVersionSelector');
  }

  /**
   * Opens a specified URL in a new browser window using Google Apps Script's UI service.
   * Creates a temporary HTML dialog that triggers the window opening and then closes itself.
   *
   * @param {string} url - The URL to open in the new window
   * @throws {Error} Throws an error if URL parameter is empty or undefined
   * @return {void}
   *
   * @example
   * // Opens Google in a new window
   * openUrlInNewWindow('https://www.google.com');
   */
  openUrlInNewWindow(url) {
    this.safeUiOperation(() => {
      try {
        if (!url) {
          throw new Error('URL is required');
        }

        const html = HtmlService.createHtmlOutput(
          `<script>window.open('${url}', '_blank'); google.script.host.close();</script>`
        )
          .setWidth(1)
          .setHeight(1);

        this.ui.showModalDialog(html, 'Opening...');
        ABLogger.getInstance().debugUi(`Opening URL in new window: ${url}`);
      } catch (error) {
        console.error(`Failed to open URL: ${error.message}`);
        throw error;
      }
    }, 'openUrlInNewWindow');
  }

  /**
   * Shows a generic modal dialog with custom HTML content
   * @param {string} htmlContent - The HTML content to display
   * @param {string} title - The title of the modal
   * @param {number} width - The width of the modal in pixels
   * @param {number} height - The height of the modal in pixels
   */
  showGenericModal(htmlContent, title, width = 400, height = 300) {
    this.safeUiOperation(() => {
      const html = HtmlService.createHtmlOutput(htmlContent).setWidth(width).setHeight(height);
      this.ui.showModalDialog(html, title);
    }, 'showGenericModal');
  }

  /**
   * Shows the authorization modal with the provided authorisation URL
   * @param {string} authUrl - The authorization URL to display
   */
  showAuthorisationModal(authUrl) {
    this.safeUiOperation(() => {
      const htmlContent = `
                  <div style="text-align: center; padding: 20px;">
                      <h2>Authorization Required</h2>
                      <p>This application needs authorization to access your Google services.</p>
                      <p>Click the button below to authorize:</p>
                      <button onclick="window.open('${authUrl}', '_blank'); google.script.host.close();" 
                              style="padding: 10px 20px; font-size: 16px; cursor: pointer;">
                          Authorize Access
                      </button>
                  </div>`;

      this.showGenericModal(htmlContent, 'Authorization Required', 450, 250);
      ABLogger.getInstance().debugUi('Authorization modal displayed.');
    }, 'showAuthorisationModal');
  }
}

// Export for Node tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UIManager;
}
