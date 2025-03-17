/**
 * ProgressTracker class to manage progress updates.
 * Implemented as a Singleton to ensure only one instance exists.
 */
class ProgressTracker {
  constructor() {
    // Ensure only one instance exists (singleton enforcement)
    if (ProgressTracker._instance) {
      return ProgressTracker._instance;
    }

    // Initialize properties
    this.properties = PropertiesService.getDocumentProperties();
    this.propertyKey = 'ProgressTracker';

    // Store the instance
    ProgressTracker._instance = this;

    console.log('ProgressTracker instance created.');
  }

  /**
   * Static method to retrieve the singleton instance.
   *
   * @returns {ProgressTracker} The singleton instance of ProgressTracker.
   */
  static getInstance() {
    if (!ProgressTracker._instance) {
      new ProgressTracker(); // Automatically creates and stores the instance
    }
    return ProgressTracker._instance;
  }

  /**
   * Initializes the progress tracking by resetting any existing progress data.
   */
  startTracking() {
    const initialData = {
      step: 0,
      message: 'Starting the assessment. This may take up to a minute...',
      completed: false,
      error: null,
      timestamp: new Date().toISOString(),
    };
    this.properties.setProperty(this.propertyKey, JSON.stringify(initialData));
    console.log('Progress tracking started.');
  }

  /**
   * Updates the current progress with the given step number and message.
   *
   * @param {number|string} step - The current step number (can be a string with numbers).
   * @param {string} message - A descriptive message for the current step.
   */
  updateProgress(step, message) {
    const currentData = this.getCurrentProgress() || {};
    const updatedData = {
      step: step ?? currentData.step,
      message: message,
      completed: false,
      error: null,
      timestamp: new Date().toISOString(),
    };
    this.properties.setProperty(this.propertyKey, JSON.stringify(updatedData));
    console.log(`Progress updated: Step ${step} - ${message}`);
  }

  /**
   * Marks the task as complete.
   */
  complete() {
    const currentData = this.getCurrentProgress() || {};
    const updatedData = {
      step: currentData.step,
      completed: true,
      message: 'Task completed successfully.',
      timestamp: new Date().toISOString(),
    };
    this.properties.setProperty(this.propertyKey, JSON.stringify(updatedData));
    console.log('Progress tracking completed successfully.');

    // As ProgressTracker.complete() is only called at the end of a significant task, 
    // it is likely that the document properties have been updated.
    // Therefore, we serialise the properties here to ensure the latest data is saved. 
    // This is important because there's no way of copying DocumentProperties between documents, 
    // which is crucial for the update process. Doing this ensures that the latest properties 
    // are saved and can be deserialised later.
    // Only serialise properties if this isn't the Admin Sheet. The admin sheet gets its properties serialised during the update process.

    if (!configurationManager.getIsAdminSheet()) {
      const propertiesCloner = new PropertiesCloner();
      propertiesCloner.serialiseProperties(true, false); //serialise document properties only because only the admin script uses ScriptProperties.
    }
  }


  /**
   * Logs an error encountered during the process.
   *
   * @param {string} errorMessage - The error message to log.
   */
  logError(errorMessage) {
    const currentData = this.getCurrentProgress() || {};
    const updatedData = {
      ...currentData,
      error: errorMessage,
      message: 'An error occurred.',
      timestamp: new Date().toISOString(),
    };
    this.properties.setProperty(this.propertyKey, JSON.stringify(updatedData));
    console.error(`Error logged: ${errorMessage}`);
  }

  /**
   * Retrieves the current progress data.
   *
   * @returns {Object|null} The current progress data or null if not found.
   */
  getCurrentProgress() {
    const progressJson = this.properties.getProperty(this.propertyKey);
    if (progressJson) {
      //console.log('Current progress retrieved.'); //Uncomment to debug
      return JSON.parse(progressJson);
    }
    console.log('No progress data found.');
    return null;
  }

  /**
   * Retrieves the current progress status formatted for client-side consumption.
   *
   * @returns {Object} The current progress data.
   */
  getStatus() {
    const progress = this.getCurrentProgress();

    if (!progress) {
      return {
        step: 0,
        message: 'No progress data found.',
        completed: false,
        error: null
      };
    }

    return progress;
  }

  /**
   * Extracts and returns the step number as an integer.
   * If the step contains text and numbers, it parses and extracts the number.
   *
   * @returns {number|null} The extracted step number or null if not found.
   */
  getStepAsNumber() {
    const progress = this.getCurrentProgress();
    if (!progress || !progress.step) {
      console.log('No step data available.');
      return null;
    }

    const step = progress.step;
    const numberMatch = step.toString().match(/\d+/); // Extract the first number in the string
    return numberMatch ? parseInt(numberMatch[0], 10) : null;
  }

  /**
   * Clears all progress data.
   */
  clearProgress() {
    this.properties.deleteProperty(this.propertyKey);
    console.log('All progress data cleared.');
  }
}
