
// InitController.js

/**
 * This class handles the initialisation of the admin and assessment record sheets.
 * 
 */

class InitController {
    constructor() {
        this.uiManager = new UIManager();
    }

    /**
     * Handles the open event of the Google Sheets document.
     * Adds custom menus to the UI when the document is opened.
     */
    onOpen() {
        const isScriptAuthorised = configurationManager.getScriptAuthorised();
        if (this.uiManager && !isScriptAuthorised) {
            this.uiManager.createUnauthorisedMenu();
            console.log("Creating unauthorised menu.")
        } else if (!this.uiManager) {
            console.error("UIManager is not available to add custom menus.");
        }
        else if (isScriptAuthorised) {
            console.log(`Script is already authorised. Creating authorised menu.`)
        }
        else {
            console.log("Who knows what's gone wrong?")
        }
    }

    /**
  * Handles the authorisation flow when user clicks authorise or when the script is opened after it has been authorised. This includes finishing any updates.
  */
    handleScriptInit() {
        // Gets the update stage.
        const updateStage = configurationManager.getUpdateStage();
        // We the authorisation status of a script as a config value because finding retrieving a script property is much quicker than checking the auth status each time. There is some error handling below for instances where the script has been deauthorised.
        const scriptAuthorised = configurationManager.getScriptAuthorised();


        // If everything is up to date and the script is authorised, create the menu and finish.
        if (updateStage === 2 && scriptAuthorised) {
            this.uiManager.createAuthorisedMenu();
            return;
        }

        // Encapsulate this logic in a try/catch block so if the firstRunInit or update isn't finished, ,the authorised menu is still created.
        try {
            // If the script hasn't been authorised, run the First Run Script Initialisation Process.
            if (!scriptAuthorised) {
                this.doFirstRunInit();
            }

            // Checks if the update needs finishing.
            if (updateStage == 1) {
                // Finish the update if so.
                this.finishUpdate();

            }

            // Assuming the script didn't end early at any of the above points, create the authorised menu.
            this.uiManager.createAuthorisedMenu();
        } catch (error) {
            this.uiManager.createAuthorisedMenu();
            throw new Error(`Error during script initialisation: ${error.message}`);
        }
    }

    /**
 * This method does the first run init procedure of triggering the auth process, creating an installable onOpen trigger and updating the scriptAuthorised flag in the config parameters.
 */
    doFirstRunInit() {
        const sa = new ScriptAppManager()
        const triggerController = new TriggerController();

        // This should trigger the auth process if it hasn't been granted.
        const authStatus = sa.handleAuthFlow();

        // Trigger the authorisation process if needed
        if (authStatus.needsAuth) {
            this.uiManager.showAuthorisationModal(authStatus.authUrl)
        }

        // Assuming auth flow has taken place, add a trigger to call this method.
        triggerController.createOnOpenTrigger(`handleScriptInit`)

        // Set script authorised to true to avoid calling the auth process again.
        configurationManager.setScriptAuthorised(true);
    }

    finishUpdate() {
        const updateManager = new UpdateManager();
        updateManager.runAssessmentRecordUpdateWizard();
    }

}



