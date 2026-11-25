/**
 * ProgressTracker class to manage progress updates.
 * Implemented as a Singleton to ensure only one instance exists.
 *
 * @remarks The active run context belongs to one execution: every GAS invocation
 * gets its own singleton instance, so a bound request ID cannot leak between
 * runs. The facade therefore does not set FREEZE_AFTER_INIT, because the
 * context is mutated after ensureInitialized().
 */
class ProgressTracker extends BaseSingleton {
  /**
   * Initialises the ProgressTracker singleton instance.
   * @param {boolean} [isSingletonCreator=false] - Internal flag indicating whether this is the singleton creator instance.
   */
  constructor(isSingletonCreator = false) {
    super();
    /**
     * JSDoc Singleton Banner
     * Use ProgressTracker.getInstance(); do not call constructor directly.
     */
    // Defer heavy work (PropertiesService access) until ensureInitialized()
    /** @type {GoogleAppsScript.Properties.Properties|null} User Property store */
    this.properties = null;
    /** @type {number} Step counter for the current execution */
    this.step = 0;
    /** @type {string|null} Active run correlation ID; generated on demand when absent */
    this.activeRequestId = null;
    /** @type {boolean} Whether lazy initialisation has run */
    this._initialized = false;
    if (!ProgressTracker._instance) {
      ProgressTracker._instance = this;
    }

    ABLogger.getInstance().info('ProgressTracker instance created.');
  }

  /**
   * Resets the singleton cache and active run context for tests.
   * @returns {void}
   */
  static resetForTests() {
    if (ProgressTracker._instance) {
      ProgressTracker._instance.activeRequestId = null;
    }
    super.resetForTests();
    ProgressTracker._instance = null;
  }

  /**
   * Acquires the User Property store on first use.
   * @returns {void}
   */
  ensureInitialized() {
    if (this._initialized) return;
    if (globalThis.__TRACE_SINGLETON__) {
      ABLogger.getInstance().debug('[TRACE][HeavyInit] ProgressTracker.ensureInitialized');
    }
    this.properties = GASPropertiesUtils.getUserProperties();
    this._initialized = true;
    BaseSingleton._maybeFreeze(this);
  }

  /**
   * Binds the active run context, generating a correlation ID when none is
   * set. Write and read paths call this first so an unbound call can never
   * touch the bare pre-upgrade key: a generated ID places the record in the
   * keyed namespace, and the store embeds the ID in the record itself.
   *
   * @private
   * @returns {void}
   */
  _ensureRunContext() {
    if (typeof this.activeRequestId === 'string' && this.activeRequestId.length > 0) return;
    this.activeRequestId = Utilities.getUuid();
  }

  /**
   * Initialises progress tracking and binds the active run context.
   * @param {string|null} [requestId] - Correlation ID for the run; a fresh
   *   correlation ID is generated when absent or empty.
   * @returns {void}
   */
  startTracking(requestId = null) {
    this.ensureInitialized();
    if (typeof requestId === 'string' && requestId.length > 0) {
      this.activeRequestId = requestId;
    } else {
      this._ensureRunContext();
    }
    this.step = 0;
    const initialData = this._record({
      message: 'Starting the assessment. This may take up to a minute...',
      completed: false,
      error: null,
    });
    ProgressTrackerStore.write(this.properties, this.activeRequestId, initialData);
    ABLogger.getInstance().info('Progress tracking started.');
    globalThis.ProgressTrackerCleanup.schedule(this.properties);
  }

  /**
   * Updates the current progress with the given step number and message.
   * @param {string} message - A descriptive message for the current step.
   * @param {boolean} shouldIncrementStep - Whether to increment the step by 1. Defaults to true.
   */
  updateProgress(message, shouldIncrementStep = true) {
    this.ensureInitialized();
    this._ensureRunContext();
    if (shouldIncrementStep) {
      // Increment the step if no specific step is provided and shouldIncrementStep is true
      this.incrementStep();
    }

    const updatedData = this._record({ message, completed: false, error: null });
    ProgressTrackerStore.write(this.properties, this.activeRequestId, updatedData);
    ABLogger.getInstance().info(`Progress updated: Step ${this.step} - ${message}`);
    globalThis.ProgressTrackerCleanup.schedule(this.properties);
  }

  /**
   * Increments the in-memory step counter by 1.
   */
  incrementStep() {
    this.step++;
  }

  /**
   * Resets the step counter to 0.
   */
  resetSteps() {
    this._ensureRunContext();
    this.step = 0;
    const currentData = this.getCurrentProgress() || {};
    const updatedData = this._record({}, currentData);
    ProgressTrackerStore.write(this.properties, this.activeRequestId, updatedData);
    ABLogger.getInstance().info('Steps reset to 0.');
  }

  /**
   * Marks the task as complete.
   */
  complete() {
    this.ensureInitialized();
    this._ensureRunContext();
    const currentData = this.getCurrentProgress() || {};
    const updatedData = this._record(
      { completed: true, message: 'Task completed successfully.' },
      currentData
    );
    // Write while the context is still bound, then release it. Clearing first
    // would send the terminal write to a freshly generated context instead.
    ProgressTrackerStore.write(this.properties, this.activeRequestId, updatedData);
    ABLogger.getInstance().info('Progress tracking completed successfully.');
    this.activeRequestId = null;
    globalThis.ProgressTrackerCleanup.schedule(this.properties);
  }

  /**
   * Logs an error encountered during the process.
   * This method is intended for user-facing errors that should be displayed in the UI.
   * It also records developer diagnostics through the shared logger when provided.
   *
   * @param {string} errorMessage - The user-facing error message to log in the UI.
   * @param {string|Error|Object} [extraErrorDetails] - Additional error details for developer logs only.
   * @param {{deferCleanup?: boolean}} [options] - When true, skip scheduling cleanup; a write schedules it by default.
   * @returns {void}
   */
  logError(errorMessage, extraErrorDetails, options) {
    this.ensureInitialized();
    this._ensureRunContext();
    const currentData = this.getCurrentProgress() || {};
    const updatedData = this._record(
      { error: errorMessage, message: 'An error occurred.' },
      currentData
    );
    ProgressTrackerStore.write(this.properties, this.activeRequestId, updatedData);
    ABLogger.getInstance().error('ProgressTracker logged a user-facing error.', {
      errorMessage,
    });

    if (extraErrorDetails) {
      this._logDeveloperDetails(extraErrorDetails);
    }

    if (!options?.deferCleanup) {
      globalThis.ProgressTrackerCleanup.schedule();
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
        ABLogger.getInstance().error('Developer details - Stack trace:', extraErrorDetails.stack);
        if (extraErrorDetails.message) {
          ABLogger.getInstance().error('Developer details - Message:', extraErrorDetails.message);
        }
        if (extraErrorDetails.name) {
          ABLogger.getInstance().error('Developer details - Error type:', extraErrorDetails.name);
        }
      } else {
        // For other objects, try to stringify them
        try {
          ABLogger.getInstance().error('Developer details:', JSON.stringify(extraErrorDetails));
        } catch (error) {
          ABLogger.getInstance().error(
            'Developer details: [Object could not be stringified]',
            error
          );
        }
      }
    } else {
      // For strings or other primitive types – avoid default object stringification
      ABLogger.getInstance().error('Developer details:', extraErrorDetails);
    }
  }

  /**
   * Captures error information from an Error object and logs it appropriately.
   * Use this method when you have an Error object and want to log it for the user.
   *
   * @param {Error} error - The error object to capture
   * @param {string} [contextMessage] - Optional context message to provide more information
   * @param {boolean} [shouldIncludeStackTrace=true] - Whether to include stack trace in developer logs
   * @returns {string} - The formatted error message that was logged
   */
  captureError(error, contextMessage = '', shouldIncludeStackTrace = true) {
    // Create a user-friendly error message
    const userFacingMessage = contextMessage
      ? `${contextMessage}: ${error.message || 'Unknown error'}`
      : error.message || 'Unknown error';

    // Prepare detailed developer information
    let developerDetails;
    if (shouldIncludeStackTrace && error) {
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
   * @param {{deferCleanup?: boolean}} [options] - When true, skip scheduling cleanup; a write schedules it by default.
   * @throws {Error} Always throws an error with the errorMessage.
   * @returns {never} This method always throws and never returns.
   */
  logAndThrowError(errorMessage, extraErrorDetails, options) {
    this.logError(errorMessage, extraErrorDetails, options);
    throw new Error(errorMessage);
  }

  /**
   * Builds the record to persist for the current step.
   *
   * The caller's fields are merged over the stored record when one is passed,
   * then the in-memory step counter and a fresh timestamp are stamped on top.
   * The write paths that keep stored fields (reset, complete, error) pass the
   * record they read; the fresh-record paths (start, update) omit it.
   *
   * @private
   * @param {Object} fields - The fields this write sets.
   * @param {Object} [current] - The stored record to merge underneath.
   * @returns {Object} The record ready to persist.
   */
  _record(fields, current = {}) {
    return {
      ...current,
      ...fields,
      step: this.step,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Retrieves the current progress data.
   *
   * @returns {Object|null} The current progress data or null if not found.
   */
  getCurrentProgress() {
    this.ensureInitialized();
    this._ensureRunContext();
    const progress = ProgressTrackerStore.read(this.properties, this.activeRequestId);
    if (progress) {
      return progress;
    }
    ABLogger.getInstance().info('No progress data found.');
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
   * Returns the current step number.
   *
   * With an active run context, this reads the step value from the bound
   * record, returning null when the record or its step is missing. Otherwise,
   * this returns the in-memory step counter.
   *
   * @returns {number|null} The current step number or null.
   */
  getStepAsNumber() {
    if (this.activeRequestId) {
      const step = this.getCurrentProgress()?.step;

      if (step === undefined || step === null) {
        return null;
      }

      return typeof step === 'number' ? step : Number.parseInt(step, 10);
    }

    return this.step;
  }

  /**
   * Deletes the record for the active run context; an unbound call binds a
   * generated context first, so pre-upgrade bare-key data is left alone.
   */
  clearProgress() {
    this.ensureInitialized();
    this._ensureRunContext();
    ProgressTrackerStore.delete(this.properties, this.activeRequestId);
    ABLogger.getInstance().info('All progress data cleared.');
  }
}

const ProgressTrackerProxy = new Proxy(ProgressTracker, {
  construct(target, arguments_, newTarget) {
    if (target._instance) {
      return target._instance;
    }

    const instance = Reflect.construct(target, arguments_, newTarget);
    target._instance = instance;
    return instance;
  },
});

// Export for Node (module.exports) and attach to global when running in GAS.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProgressTrackerProxy;
} else {
  // Use globalThis instead of `this` so linters and strict environments are happy.
  globalThis.ProgressTracker = ProgressTrackerProxy; // global assignment for GAS
}
