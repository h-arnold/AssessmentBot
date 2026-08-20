const DEFAULT_TRIGGER_DELAY_SECONDS = 5;

/**
 * Trigger controller.
 */
class TriggerController {
  /**
   * Creates a time-based trigger for the specified function to fire 5 seconds after the current time.
   *
   * @param {string} functionName - The name of the function to trigger.
   * @param {integer} triggerTime - The time the trigger should be run.
   * @returns {string} The unique ID of the created trigger.
   */
  createTimeBasedTrigger(functionName, triggerTime) {
    try {
      // Ensure user has granted required permissions for trigger installation and execution
      ScriptApp.requireScopes(ScriptApp.AuthMode.FULL, TriggerController.REQUIRED_SCOPES);

      if (!triggerTime) {
        triggerTime = new Date();
        triggerTime.setSeconds(triggerTime.getSeconds() + DEFAULT_TRIGGER_DELAY_SECONDS);
      }

      const trigger = ScriptApp.newTrigger(functionName).timeBased().at(triggerTime).create();
      ABLogger.getInstance().info(`Trigger created for ${functionName} to run at ${triggerTime}.`);
      const triggerId = trigger.getUniqueId();
      ABLogger.getInstance().info(`Trigger Id is ${triggerId}`);
      return triggerId;
    } catch (error) {
      if (error.message.includes('This script has too many triggers')) {
        ABLogger.getInstance().warn(`Too many triggers error occurred: ${error.message}`);
        this.removeTriggers(functionName);
        ABLogger.getInstance().info(
          `Removed all triggers for '${functionName}'. Retrying trigger creation...`
        );
        return this.createTimeBasedTrigger(functionName);
      } else {
        const progressTracker = ProgressTracker.getInstance();
        progressTracker.logAndThrowError(
          `Error creating trigger for ${functionName}: ${error.message}`,
          error
        );
      }
    }
  }

  /**
   * Removes all triggers associated with the specified function name.
   *
   * @param {string} functionName - The name of the function whose triggers are to be removed.
   */
  removeTriggers(functionName) {
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach((trigger) => {
      if (trigger.getHandlerFunction() === functionName) {
        ScriptApp.deleteTrigger(trigger);
        ABLogger.getInstance().info(`Trigger for ${functionName} deleted.`);
      }
    });
  }

  /**
   * Deletes the specific trigger that matches the trigger ID.
   *
   * @param {string} triggerId - The unique ID of the trigger to delete.
   */
  deleteTriggerById(triggerId) {
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach((trigger) => {
      if (trigger.getUniqueId() === triggerId) {
        ScriptApp.deleteTrigger(trigger);
        ABLogger.getInstance().info(`Trigger with ID ${triggerId} deleted.`);
      }
    });
  }

  /**
   * Stores the trigger execution context for a scheduled trigger, keyed by
   * triggerUid.
   *
   * Writes the method name string and the JSON-serialised params object to
   * Script Properties under `trigger:<uid>:method` and `trigger:<uid>:params`
   * respectively (see docs/developer/data-shapes/trigger-context.md). Written
   * by AssignmentController.startProcessing() at trigger creation time.
   *
   * @param {string} triggerUid - The unique ID of the created trigger.
   * @param {Object} context - The context to store.
   * @param {string} context.method - The trigger method name (e.g. 'processSelectedAssignment').
   * @param {Object} context.params - The params object to dispatch to the handler.
   * @returns {void}
   * @throws {Error} If any required parameter is null or undefined.
   */
  storeTriggerContext(triggerUid, { method, params }) {
    Validate.requireParams({ triggerUid, method, params }, 'storeTriggerContext');
    const properties = GASPropertiesUtils.getScriptProperties();
    GASPropertiesUtils.applyProperties(properties, {
      [`trigger:${triggerUid}:method`]: method,
      [`trigger:${triggerUid}:params`]: JSON.stringify(params),
    });
  }

  /**
   * Retrieves the stored trigger execution context for a triggerUid.
   *
   * Reads both keys directly from Script Properties via
   * GASPropertiesUtils.getScriptProperties().getProperty(key) (there is no
   * single-key getter wrapper). Returns `{ method, params }` (params
   * deserialised from JSON), `null` when the triggerUid is unknown or the
   * stored params JSON is malformed (graceful degradation), or a partial
   * context ({ method: null, params } / { method, params: null }) when only one
   * of the two keys exists.
   *
   * @param {string} triggerUid - The unique ID of the trigger.
   * @returns {{ method: ?string, params: ?Object }|null} The resolved context, a partial
   *   context, or null for an unknown triggerUid or malformed params JSON.
   */
  getTriggerContext(triggerUid) {
    Validate.requireParams({ triggerUid }, 'getTriggerContext');
    const properties = GASPropertiesUtils.getScriptProperties();
    const method = properties.getProperty(`trigger:${triggerUid}:method`);
    const parametersJson = properties.getProperty(`trigger:${triggerUid}:params`);

    // Neither key present — the triggerUid is unknown.
    if (method === null && parametersJson === null) {
      return null;
    }

    let parameters = null;
    if (parametersJson !== null) {
      try {
        parameters = JSON.parse(parametersJson);
      } catch {
        // Malformed params JSON — graceful degradation, consistent with CacheManager.get().
        return null;
      }
    }

    return { method, params: parameters };
  }

  /**
   * Removes both trigger context keys for a triggerUid.
   *
   * @param {string} triggerUid - The unique ID of the trigger whose context should be cleared.
   * @returns {void}
   * @throws {Error} If the triggerUid is null or undefined.
   */
  clearTriggerContext(triggerUid) {
    Validate.requireParams({ triggerUid }, 'clearTriggerContext');
    const properties = GASPropertiesUtils.getScriptProperties();
    GASPropertiesUtils.clearProperties(properties, [
      `trigger:${triggerUid}:method`,
      `trigger:${triggerUid}:params`,
    ]);
  }
}

// Static: required OAuth scopes for trigger installation and execution.
// Defined as a static property to avoid recreating the array per instance.
// REQUIRED_SCOPES must be kept manually in sync with the oauthScopes array in src/backend/appsscript.json.
TriggerController.REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/presentations',
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.rosters.readonly',
  'https://www.googleapis.com/auth/classroom.profile.emails',
  'https://www.googleapis.com/auth/classroom.profile.photos',
  'https://www.googleapis.com/auth/classroom.coursework.students.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/script.storage',
  'https://www.googleapis.com/auth/script.external_request',
  'https://www.googleapis.com/auth/script.container.ui',
  'https://www.googleapis.com/auth/script.scriptapp',
  'https://www.googleapis.com/auth/classroom.topics.readonly',
  'https://www.googleapis.com/auth/groups',
  'https://www.googleapis.com/auth/userinfo.email',
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TriggerController };
}
