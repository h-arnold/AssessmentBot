// TriggerController.gs

/**
 * TriggerController Class
 *
 * Manages the creation and deletion of triggers.
 */
class TriggerController {
  constructor() {
    // Initialization logic can be added here if needed
  }

  /**
  * Creates a time-based trigger for the specified function to fire 5 seconds after the current time.
  *
  * @param {string} functionName - The name of the function to trigger.
  * @param {integer} timeInDays - The time the trigger should be run
  * @returns {string} The unique ID of the created trigger.
  */
  createTimeBasedTrigger(functionName, triggerTime) {
    try {
      // If triggerTime is undefined or null, assume that we're setting a trigger to start the trigger process as soon as possible.
      if (!triggerTime) {
        // Calculate the time 5 seconds from now
        const triggerTime = new Date();
        triggerTime.setSeconds(triggerTime.getSeconds() + 5);
      }

      

      // Create the trigger for the exact time
      const trigger = ScriptApp.newTrigger(functionName)
        .timeBased()
        .at(triggerTime)
        .create();
      console.log(`Trigger created for ${functionName} to run at ${triggerTime}.`);
      const triggerId = trigger.getUniqueId()
      console.log(`Trigger Id is ${triggerId}`)
      return triggerId;
    } catch (error) {
      if (error.message.includes("This script has too many triggers")) {
        console.warn(`Too many triggers error occurred: ${error.message}`);
        this.removeTriggers("triggerProcessSelectedAssignment");
        console.log("Removed all triggers for 'triggerProcessSelectedAssignment'. Retrying trigger creation...");
        return this.createTimeBasedTrigger(functionName);
      } else {
        console.error(`Error creating trigger for ${functionName}: ${error}`);
        throw error;
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
    triggers.forEach(trigger => {
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
    triggers.forEach(trigger => {
      if (trigger.getUniqueId() === triggerId) {
        ScriptApp.deleteTrigger(trigger);
        console.log(`Trigger with ID ${triggerId} deleted.`);
      }
    });
  }
}
