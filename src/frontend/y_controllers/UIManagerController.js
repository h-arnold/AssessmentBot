// src/frontend/y_controllers/UIManagerController.js
/**
 * Controller class for managing UI interactions.
 * Encapsulates the global global UIManager functions stored in /src/fronted/UIManager/globals.js
 */
class UIManagerController {

    /**
     * Constructor for the UIManagerController class.
     */
    constructor() {
      try {
        this.uiManager = new UIManager();
        console.log("UIManager instantiated successfully.");
      } catch (error) {
        console.error("UIManager cannot be instantiated: " + error);
        this.uiManager = null; // UIManager is not available in this context
      }
    }

    /**
     * Opens the reference slide modal with assignment data.
     *
     * @param {string} assignmentData - The JSON string containing assignment data.
     */
    openReferenceSlideModal(assignmentData) {
      if (this.uiManager) {
        return this.uiManager.openReferenceSlideModal(assignmentData);
      } else {
        console.error('UIManager is not available to open the reference slide modal.');
      }
    }

    /**
     * Opens the progress modal dialog.
     */
    showProgressModal() {
      if (this.uiManager) {
        this.uiManager.showProgressModal();
      } else {
        console.error('UIManager is not available to show the progress modal.');
      }
    }

    /**
     * Shows the configuration dialog modal.
     */
    showConfigurationDialog() {
      if (this.uiManager) {
        return this.uiManager.showConfigurationDialog();
      } else {
        console.error('UIManager is not available to show the configuration dialog.');
      }
    }

    /**
     * Shows the assignment dropdown modal.
     */
    showAssignmentDropdown() {
      if (this.uiManager) {
        return this.uiManager.showAssignmentDropdown();
      } else {
        console.error('UIManager is not available to show the assignment dropdown.');
      }
    }

    /**
     * Shows the classroom dropdown modal.
     */
    showClassroomDropdown() {
      if (this.uiManager) {
        return this.uiManager.showClassroomDropdown();
      } else {
        console.error('UIManager is not available to show the classroom dropdown.');
      }
    }

    /**
     * Displays the version selector interface.
     * @returns {void}
     * @public
     */
    showVersionSelector() {
      if (this.uiManager) {
        return this.uiManager.showVersionSelector();
      } else {
        console.error('UIManager is not available to show the version selector.');
      }
    }

      /**
       * Gets the Google Classroom assignments for a given class.
       * @param {string} courseId 
       * @returns {object}
       */
    getAssignments(courseId) {
        if (this.uiManager) {
            return mainController.getAssignments(courseId); // Delegate to MainController
        } else {
            console.error('UIManager is not available to get assignments.');
        }
    }

          /**
     * Retrieves the classroom data. This function proxies the call to the UIManager.
     * @returns {Object} The classroom data.
     */
    getClassroomData() {
        if (this.uiManager) {
            return this.uiManager.getClassroomData();
        } else {
            console.error('UIManager is not available to get classroom data.');
        }
    }

    /**
     * Saves the classroom data. This function proxies the call to the UIManager.
     * @param {Array<Array<string>>} rows The classroom data to be saved.
     */
    saveClassroomData(rows) {
        if (this.uiManager) {
            this.uiManager.saveClassroomData(rows);
        } else {
            console.error('UIManager is not available to save classroom data.');
        }
    }

    /**
     * Shows the classroom editor modal. This function proxies the call to the UIManager.
     */
    showClassroomEditorModal() {
        if (this.uiManager) {
            this.uiManager.showClassroomEditorModal();
        } else {
            console.error('UIManager is not available to show the classroom editor modal.');
        }
    }
  }
