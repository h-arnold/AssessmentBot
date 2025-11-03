// InitController.js

/**
 * This class handles the initialisation of the admin and assessment record sheets.
 *
 */

class InitController extends BaseSingleton {
  /**
   * Constructor is intentionally lightweight (Phase 1). Do not perform UI work here.
   * Use InitController.getInstance() + getUiManager() for lazy UI access.
   */
  constructor(isSingletonCreator = false) {
    super();
    /**
     * JSDoc Singleton Banner
     * Use InitController.getInstance(); do not call constructor directly.
     */
    // Singleton guard: constructor should only execute once via getInstance()
    if (!isSingletonCreator && InitController._instance) {
      return InitController._instance; // Return existing instance
    }
    this._initialized = false; // future hook if we add heavy init
    this.uiManager = null; // defer until needed
    if (!InitController._instance) {
      InitController._instance = this;
    }
  }

  ensureInitialized() {
    if (this._initialized) return;
    // (Currently no heavy work to do; placeholder for Phase 2.)
    this._initialized = true;
  }

  /**
   * Lazily obtain UIManager. Safe to call repeatedly.
   */
  getUiManager() {
    if (!this.uiManager) {
      try {
        this.uiManager = UIManager.getInstance();
        ABLogger.getInstance().info('UIManager lazily instantiated.');
      } catch (error) {
        ABLogger.getInstance().error('UIManager cannot be instantiated:', error?.message ?? error);
        this.uiManager = null;
      }
    }
    return this.uiManager;
  }

  /**
   * Handles the open event of the Google Sheets document.
   * Adds custom menus to the UI when the document is opened.
   */
  onOpen() {
    const cfg = ConfigurationManager.getInstance();
    const sa = new ScriptAppManager();
    const isScriptAuthorised = sa.isAuthorised();
    const isAdminSheet = cfg.getIsAdminSheet();
    ABLogger.getInstance().info(
      `InitController.onOpen() - User authorized: ${isScriptAuthorised}, Is admin sheet: ${isAdminSheet}`
    );

    const uiManager = this.getUiManager();
    if (!uiManager) {
      ABLogger.getInstance().error('UIManager is not available to add custom menus.');
      return;
    }

    if (isScriptAuthorised && isAdminSheet) {
      ABLogger.getInstance().info('Script is already authorised. Creating authorised menu.');
      uiManager.createAuthorisedMenu();
    } else if (isScriptAuthorised && !isAdminSheet) {
      // For assessment records, check if this specific user has authorised this document
      const userProps = PropertiesService.getUserProperties();
      const userAuthorisedThisDoc = userProps.getProperty('authorised') === 'true';

      ABLogger.getInstance().info(
        `Script is authorised and appears to be an Assessment Record. User has authorised this doc: ${userAuthorisedThisDoc}`
      );

      if (userAuthorisedThisDoc) {
        uiManager.createAssessmentRecordMenu();
      } else {
        uiManager.createUnauthorisedMenu();
      }
    } else {
      ABLogger.getInstance().info('Script not authorised. Creating unauthorised menu.');
      uiManager.createUnauthorisedMenu();
    }
  }

  /**
   * Handles the authorisation flow when user clicks authorise or when the script is opened after it has been authorised.
   * Determines if this is an Admin Sheet or Assessment Record and calls the appropriate initialisation method.
   */
  handleScriptInit() {
    const cfg = ConfigurationManager.getInstance();
    const sa = new ScriptAppManager();
    const scriptAuthorised = sa.isAuthorised();
    const isAdminSheet = cfg.getIsAdminSheet();
    ABLogger.getInstance().info(
      `InitController.handleScriptInit() - User authorized: ${scriptAuthorised}, Is admin sheet: ${isAdminSheet}`
    );

    // If script isn't authorised, run the first run initialisation regardless of sheet type
    if (!scriptAuthorised) {
      this.doFirstRunInit();
      // Create appropriate menu after first run init
      if (isAdminSheet) {
        this._withUI((ui) => ui.createAuthorisedMenu());
      } else {
        this._withUI((ui) => ui.createAssessmentRecordMenu());
      }
    }

    // Route to the appropriate initialisation method based on sheet type
    if (isAdminSheet) {
      this.adminScriptInit(scriptAuthorised);
    } else {
      this.assessmentRecordScriptInit();
    }
  }

  /**
   * Handles initialisation specifically for Admin Sheets
   * This includes finishing any updates and creating the proper menu.
   * @param {boolean} [scriptAuthorised] - Optional pre-computed authorization status to avoid redundant checks
   */
  adminScriptInit(scriptAuthorised) {
    // Gets the update stage.
    const cfg = ConfigurationManager.getInstance();
    const updateStage = cfg.getUpdateStage();

    // Only check auth if not already provided
    if (scriptAuthorised === undefined) {
      ABLogger.getInstance().info(
        'InitController.adminScriptInit() - Authorization not provided, checking now...'
      );
      const sa = new ScriptAppManager();
      scriptAuthorised = sa.isAuthorised();
    } else {
      ABLogger.getInstance().info(
        `InitController.adminScriptInit() - Using provided authorization status: ${scriptAuthorised}`
      );
    }

    this.setupAuthRevokeTimer();

    // If everything is up to date and the script is authorised, create the menu and finish.
    if (updateStage === 2 && scriptAuthorised) {
      this._withUI((ui) => ui.createAuthorisedMenu());
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
      this._withUI((ui) => ui.createAuthorisedMenu());
    } catch (error) {
      this._withUI((ui) => ui.createAuthorisedMenu());
      throw new Error(`Error during admin script initialisation: ${error?.message ?? error}`);
    }
  }

  /**
   * Handles initialisation specifically for Assessment Record sheets.
   * Creates the assessment record menu and sets up the authorisation revocation timer.
   */
  assessmentRecordScriptInit() {
    try {
      // Create the assessment record menu
      this._withUI((ui) => ui.createAssessmentRecordMenu());

      // Set up the authorisation revocation timer
      this.setupAuthRevokeTimer();
    } catch (error) {
      // Ensure menu is created even if there's an error
      this._withUI((ui) => ui.createAssessmentRecordMenu());
      throw new Error(`Error during assessment record initialisation: ${error?.message ?? error}`);
    }
  }

  /**
   * This method does the first run init procedure of creating an installable onOpen trigger.
   * Note: Authorization is now handled automatically by TriggerController.createOnOpenTrigger() via ScriptApp.requireScopes().
   */
  doFirstRunInit() {
    const triggerController = new TriggerController();

    // Create onOpen trigger. This will automatically prompt for authorization via requireScopes().
    triggerController.createOnOpenTrigger(`handleScriptInit`);

    // If there's no Assessment Record Template Id set in the config, set one. This avoids an infinite loop scenario explained below.
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
    const cfg = ConfigurationManager.getInstance();
    if (!cfg.getAssessmentRecordTemplateId) {
      const baseInitManager = new BaseUpdateAndInit();
      const assessmentRecordTemplateId = baseInitManager.getLatestAssessmentRecordTemplateId();
      cfg.setAssessmentRecordTemplateId(assessmentRecordTemplateId);
    }
  }

  /**
   * Internal helper to execute a function only if UI can be instantiated (avoids forcing UI for pure config paths)
   * @param {(ui: UIManager) => void} fn
   */
  _withUI(fn) {
    try {
      const ui = this.getUiManager();
      if (ui) fn(ui);
    } catch (e) {
      // Swallow to keep pure logic paths resilient in headless/triggers
      if (globalThis.__TRACE_SINGLETON__)
        ABLogger.getInstance().info('[TRACE] InitController._withUI suppressed UI error');
    }
  }

  /**
   * Sets up a time-based trigger to revoke authorization after a specified number of days.
   * Only creates the trigger if one doesn't already exist.
   * @returns {boolean} Whether a new trigger was created
   */
  setupAuthRevokeTimer() {
    // Check if trigger is already set
    const triggerAlreadySet = ConfigurationManager.getInstance().getRevokeAuthTriggerSet();

    if (triggerAlreadySet) {
      ABLogger.getInstance().info('Auth revoke trigger already exists. No new trigger created.');
      return false;
    }

    try {
      // Get the number of days until revocation
      const daysUntilRevoke = ConfigurationManager.getInstance().getDaysUntilAuthRevoke();

      // Calculate the trigger time (current time + specified days)
      const triggerTime = new Date();
      triggerTime.setDate(triggerTime.getDate() + daysUntilRevoke);

      // Create the trigger using TriggerController
      const triggerController = new TriggerController();
      triggerController.createTimeBasedTrigger('revokeAuthorisation', triggerTime);

      // Update the flag to indicate the trigger has been set
      ConfigurationManager.getInstance().setRevokeAuthTriggerSet(true);

      ABLogger.getInstance().info(
        `Auth revoke trigger set to run in ${daysUntilRevoke} days (${triggerTime}).`
      );
      return true;
    } catch (error) {
      ABLogger.getInstance().error(`Error setting up auth revoke timer: ${error}`);
      return false;
    }
  }
}

// Export for Node test environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = InitController;
}
