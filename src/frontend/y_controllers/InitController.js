// InitController.js

/**
 * This class handles the initialisation of the admin and assessment record sheets.
 * 
 */

class InitController {
    constructor() {
        // Attempt to instantiate UIManager only in user context to avoid issues with triggers
        try {
            this.uiManager = UIManager.getInstance();
            console.log("UIManager instantiated successfully.");
        } catch (error) {
            console.error("UIManager cannot be instantiated: " + error);
            this.uiManager = null; // UIManager is not available in this context
        }
    }

    /**
     * Handles the open event of the Google Sheets document.
     * Adds custom menus to the UI when the document is opened.
     */
    onOpen() {
        const isScriptAuthorised = configurationManager.getScriptAuthorised();
        const isAdminSheet = configurationManager.getIsAdminSheet();
        console.log("Script authorization status:", isScriptAuthorised);

        if (!this.uiManager) {
            console.error("UIManager is not available to add custom menus.");
            return;
        }

        if (isScriptAuthorised && isAdminSheet) {
            console.log("Script is already authorised. Creating authorised menu.");
            this.uiManager.createAuthorisedMenu(); 
        }
        else if (isScriptAuthorised && !isAdminSheet) {
            console.log("Script is authorised and appears to be an Assessment Record. Creating Assessment Record menu.");
            this.uiManager.createAssessmentRecordMenu();
        } else {
            console.log("Script not authorised. Creating unauthorised menu.");
            this.uiManager.createUnauthorisedMenu();
        }
    }

    /**
     * Handles the authorisation flow when user clicks authorise or when the script is opened after it has been authorised.
     * Determines if this is an Admin Sheet or Assessment Record and calls the appropriate initialisation method.
     */
    handleScriptInit() {
        const scriptAuthorised = configurationManager.getScriptAuthorised();
        const isAdminSheet = configurationManager.getIsAdminSheet();
        
        // If script isn't authorised, run the first run initialisation regardless of sheet type
        if (!scriptAuthorised) {
            this.doFirstRunInit();
            // Create appropriate menu after first run init
            if (isAdminSheet) {
                this.uiManager.createAuthorisedMenu();
            } else {
                this.uiManager.createAssessmentRecordMenu();
            }
            
        }
        
        // Route to the appropriate initialisation method based on sheet type
        if (isAdminSheet) {
            this.adminScriptInit();
        } else {
            this.assessmentRecordScriptInit();
        }
        return;
    }
    
    /**
     * Handles initialisation specifically for Admin Sheets
     * This includes finishing any updates and creating the proper menu.
     */
    adminScriptInit() {
        // Gets the update stage.
        const updateStage = configurationManager.getUpdateStage();
        const scriptAuthorised = configurationManager.getScriptAuthorised();
        
        // If everything is up to date and the script is authorised, create the menu and finish.
        if (updateStage === 2 && scriptAuthorised) {
            this.uiManager.createAuthorisedMenu();
            return;
        }
        
        // Encapsulate this logic in a try/catch block so if update isn't finished, the authorised menu is still created.
        try {
            // Checks if the update needs finishing.
            if (updateStage == 1) {
                // Finish the update if so.
                this.finishUpdate();
            }
            
            // Assuming the script didn't end early at any of the above points, create the authorised menu.
            this.uiManager.createAuthorisedMenu();
        } catch (error) {
            this.uiManager.createAuthorisedMenu();
            throw new Error(`Error during admin script initialisation: ${error.message}`);
        }
    }
    
    /**
     * Handles initialisation specifically for Assessment Record sheets.
     * Creates the assessment record menu and sets up the authorisation revocation timer.
     */
    assessmentRecordScriptInit() {
        try {
            // Create the assessment record menu
            this.uiManager.createAssessmentRecordMenu();
            
            // Set up the authorisation revocation timer
            this.setupAuthRevokeTimer();
        } catch (error) {
            // Ensure menu is created even if there's an error
            this.uiManager.createAssessmentRecordMenu();
            throw new Error(`Error during assessment record initialisation: ${error.message}`);
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

        //If there's no Assessment Record Template Id set in the config, set one. This avoids an infinite loop scenario explained below.
        this.setDefaultAssessmentRecordTemplateId();
    }

    finishUpdate() {
        const updateManager = new UpdateManager();
        updateManager.runAssessmentRecordUpdateWizard();
    }

    /**
     * Sets the default Assessment Record Template ID if it's not already set.
     * It retrieves the latest template ID from `BaseUpdateAndInit` and updates
     * the configuration.
     * This avoids an infinite loop scenario in ConfigurationManager.getAssessmentRecordTemplateId() where if it's not set, it will instaniate BaseUpdateAndInit to use the getAssessmentRecordTemplateId() method, where the constructor for that class calls the Assessment Record Template ID from ConfigurationManager.
     */
    setDefaultAssessmentRecordTemplateId() {
        if (!configurationManager.getAssessmentRecordTemplateId) {
            const baseInitManager = new BaseUpdateAndInit();
            const assessmentRecordTemplateId =
                baseInitManager.getLatestAssessmentRecordTemplateId();
            configurationManager.setAssessmentRecordTemplateId(
                assessmentRecordTemplateId,
            );
        }
    }

    /**
     * Sets up a time-based trigger to revoke authorization after a specified number of days.
     * Only creates the trigger if one doesn't already exist.
     * @returns {boolean} Whether a new trigger was created
     */
    setupAuthRevokeTimer() {
        // Check if trigger is already set
        const triggerAlreadySet = configurationManager.getRevokeAuthTriggerSet();
        
        if (triggerAlreadySet) {
            console.log("Auth revoke trigger already exists. No new trigger created.");
            return false;
        }
        
        try {
            // Get the number of days until revocation
            const daysUntilRevoke = configurationManager.getDaysUntilAuthRevoke();
            
            // Calculate the trigger time (current time + specified days)
            const triggerTime = new Date();
            triggerTime.setDate(triggerTime.getDate() + daysUntilRevoke);
            
            // Create the trigger using TriggerController
            const triggerController = new TriggerController();
            triggerController.createTimeBasedTrigger("revokeAuthorisation", triggerTime);
            
            // Update the flag to indicate the trigger has been set
            configurationManager.setRevokeAuthTriggerSet(true);
            
            console.log(`Auth revoke trigger set to run in ${daysUntilRevoke} days (${triggerTime}).`);
            return true;
        } catch (error) {
            console.error(`Error setting up auth revoke timer: ${error}`);
            return false;
        }
    }
}



