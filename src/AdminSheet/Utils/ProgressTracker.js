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
    this.step = 0; // Add step as class attribute

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
   * Test helper to reset singleton between tests (Phase 1 convention).
   */
  static resetForTests() {
    ProgressTracker._instance = null;
  }

  /**
   * Initializes the progress tracking by resetting any existing progress data.
   */
  startTracking() {
    this.resetSteps();
    const initialData = {
      step: this.step,
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
   * @param {string} message - A descriptive message for the current step.
   * @param {boolean} incrementStep - Whether to increment the step by 1. Defaults to true.
   */
  updateProgress(message, incrementStep = true) {
    if (incrementStep) {
      // Increment the step if no specific step is provided and incrementStep is true
      this.incrementStep();
    }

    const updatedData = {
      step: this.step,
      message: message,
      completed: false,
      error: null,
      timestamp: new Date().toISOString(),
    };
    this.properties.setProperty(this.propertyKey, JSON.stringify(updatedData));
    console.log(`Progress updated: Step ${this.step} - ${message}`);
  }

  /**
   * Increments the step counter by 1 and updates the progress.
    current step.
   */
  incrementStep() {
    this.step++;
  }

  /**
   * Resets the step counter to 0.
   */
  resetSteps() {
    this.step = 0;
    const currentData = this.getCurrentProgress() || {};
    const updatedData = {
      ...currentData,
      step: this.step,
      timestamp: new Date().toISOString(),
    };
    this.properties.setProperty(this.propertyKey, JSON.stringify(updatedData));
    console.log('Steps reset to 0.');
  }

  /**
   * Marks the task as complete.
   */
  complete() {
    const currentData = this.getCurrentProgress() || {};
    const updatedData = {
      ...currentData,
      step: this.step,
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
   * This method is intended for user-facing errors that should be displayed in the UI.
   * It automatically logs to the console, so no need for additional console.error calls.
   *
   * @param {string} errorMessage - The user-facing error message to log in the UI.
   * @param {string|Error|Object} [extraErrorDetails] - Additional error details for developer logs only.
   * @returns {void}
   */
  logError(errorMessage, extraErrorDetails) {
    const currentData = this.getCurrentProgress() || {};
    const updatedData = {
      ...currentData,
      step: this.step,
      error: errorMessage, // This is what users will see in the UI
      message: 'An error occurred.',
      timestamp: new Date().toISOString(),
    };
    this.properties.setProperty(this.propertyKey, JSON.stringify(updatedData));
    console.error(`Error logged: ${errorMessage}`);

    if (extraErrorDetails) {
      this._logDeveloperDetails(extraErrorDetails);
    }
  }

  /**
   * Helper method to log developer-only error details.
   * This method formats different types of error details appropriately for console logging.
   *
   * @private
   * @param {string|Error|Object} extraErrorDetails - The error details to log for developers
   * @returns {void}
   */
  _logDeveloperDetails(extraErrorDetails) {
    // These details are only for developers, not exposed in the UI
    // Format details as strings to avoid serialization issues
    if (typeof extraErrorDetails === 'object' && extraErrorDetails !== null) {
      // If it's an Error object or has a stack property
      if (extraErrorDetails.stack) {
        console.error(`Developer details - Stack trace: ${extraErrorDetails.stack}`);
        if (extraErrorDetails.message) {
          console.error(`Developer details - Message: ${extraErrorDetails.message}`);
        }
        if (extraErrorDetails.name) {
          console.error(`Developer details - Error type: ${extraErrorDetails.name}`);
        }
      } else {
        // For other objects, try to stringify them
        try {
          console.error(`Developer details: ${JSON.stringify(extraErrorDetails)}`);
        } catch (err) {
          console.error('Developer details: [Object could not be stringified]', err);
        }
      }
    } else {
      // For strings or other primitive types – avoid default object stringification
      console.error('Developer details:', extraErrorDetails);
    }
  }

  /**
   * Captures error information from an Error object and logs it appropriately.
   * Use this method when you have an Error object and want to log it for the user.
   *
   * @param {Error} error - The error object to capture
   * @param {string} [contextMessage] - Optional context message to provide more information
   * @param {boolean} [includeStackTrace=true] - Whether to include stack trace in developer logs
   * @returns {string} - The formatted error message that was logged
   */
  captureError(error, contextMessage = '', includeStackTrace = true) {
    // Create a user-friendly error message
    const userFacingMessage = contextMessage
      ? `${contextMessage}: ${error.message || 'Unknown error'}`
      : `${error.message || 'Unknown error'}`;

    // Prepare detailed developer information
    let developerDetails;
    if (includeStackTrace && error) {
      developerDetails = {
        message: error.message,
        stack: error.stack,
        name: error.name,
        originalError: error,
      };
    } else if (error) {
      developerDetails = error;
    }

    // Log the error with appropriate separation of concerns
    this.logError(userFacingMessage, developerDetails);

    return userFacingMessage;
  }

  /**
   * Logs an error and then throws it.
   * Use this when you need to log an error for the user but also need to propagate
   * the error up the call stack.
   *
   * @param {string} errorMessage - The message to log and include in the thrown error
   * @param {string|Error|Object} [extraErrorDetails] - Additional error details for developer logs
   * @throws {Error} - Always throws an error with the errorMessage
   * @returns {never}
   */
  logAndThrowError(errorMessage, extraErrorDetails) {
    this.logError(errorMessage, extraErrorDetails);
    throw new Error(errorMessage);
  }

  /**
   * Retrieves the current progress data.
   *
   * @returns {Object|null} The current progress data or null if not found.
   */
  getCurrentProgress() {
    const progressJson = this.properties.getProperty(this.propertyKey);
    if (progressJson) {
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
        error: null,
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
    // First check if we have it locally
    if (this.step !== undefined) {
      return typeof this.step === 'number' ? this.step : parseInt(this.step.toString(), 10);
    }

    // Fall back to getting it from stored progress
    const progress = this.getCurrentProgress();
    if (!progress?.step) {
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

// Export for Node (module.exports) and attach to global when running in GAS.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProgressTracker;
} else {
  // Use globalThis instead of `this` so linters and strict environments are happy.
  globalThis.ProgressTracker = ProgressTracker; // global assignment for GAS
}
