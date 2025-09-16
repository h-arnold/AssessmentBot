class TriggerController {
  constructor() {
    // Initialization logic can be added here if needed
  }

  /**
   * Creates a time-based trigger for the specified function to fire 5 seconds after the current time.
   *
   * @param {string} functionName - The name of the function to trigger.
   * @param {integer} triggerTime - The time the trigger should be run.
   * @returns {string} The unique ID of the created trigger.
   */
  createTimeBasedTrigger(functionName, triggerTime) {
    try {
      if (!triggerTime) {
        triggerTime = new Date();
        triggerTime.setSeconds(triggerTime.getSeconds() + 5);
      }

      const trigger = ScriptApp.newTrigger(functionName).timeBased().at(triggerTime).create();
      console.log(`Trigger created for ${functionName} to run at ${triggerTime}.`);
      const triggerId = trigger.getUniqueId();
      console.log(`Trigger Id is ${triggerId}`);
      return triggerId;
    } catch (error) {
      if (error.message.includes('This script has too many triggers')) {
        console.warn(`Too many triggers error occurred: ${error.message}`);
        this.removeTriggers('triggerProcessSelectedAssignment');
        console.log(
          "Removed all triggers for 'triggerProcessSelectedAssignment'. Retrying trigger creation..."
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
   * Removes existing onOpen triggers.
   */
  removeOnOpenTriggers() {
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach((trigger) => {
      if (trigger.getEventType() === ScriptApp.EventType.ON_OPEN) {
        ScriptApp.deleteTrigger(trigger);
        console.log(`Existing onOpen trigger deleted.`);
      }
    });
  }

  /**
   * Creates an onOpen trigger for the specified function, removing any existing onOpen triggers beforehand.
   *
   * @param {string} functionName - The name of the function to trigger on open.
   * @returns {string} The unique ID of the created trigger.
   */
  createOnOpenTrigger(functionName) {
    try {
      this.removeOnOpenTriggers();

      // Create new onOpen trigger
      const trigger = ScriptApp.newTrigger(functionName)
        .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
        .onOpen()
        .create();
      console.log(`OnOpen trigger created for ${functionName}.`);
      return trigger.getUniqueId();
    } catch (error) {
      const progressTracker = ProgressTracker.getInstance();
      progressTracker.logAndThrowError(
        `Error creating onOpen trigger for ${functionName}: ${error.message}`,
        error
      );
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
        console.log(`Trigger for ${functionName} deleted.`);
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
        console.log(`Trigger with ID ${triggerId} deleted.`);
      }
    });
  }
}
