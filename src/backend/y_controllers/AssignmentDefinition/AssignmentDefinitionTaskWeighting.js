/**
 * AssignmentDefinitionTaskWeighting
 *
 * Manages task weighting operations: applying stored weightings, defaults,
 * payload patches, and finding tasks by ID.
 */
class AssignmentDefinitionTaskWeighting {
  /**
   * Creates the instance with injected dependencies.
   * @param {Object} deps - Dependency injection.
   * @param {Object} deps.validation - AssignmentDefinitionValidation instance.
   */
  constructor({ validation } = {}) {
    this.validation = validation;
  }

  /**
   * Applies existing task weightings to parsed task sets.
   *
   * @param {Object} existingTasks - Existing task map.
   * @param {Object} parsedTasks - Parsed task map.
   * @returns {Object} Parsed tasks with preserved matching weightings.
   */
  applyStoredWeightings(existingTasks, parsedTasks) {
    const existingEntries = Object.entries(existingTasks || {});

    existingEntries.forEach(([taskId, existingTask]) => {
      const parsedTask = this._findTaskById(parsedTasks, taskId);
      if (!parsedTask) {
        return;
      }

      if (!Object.hasOwn(existingTask, 'taskWeighting')) {
        return;
      }

      parsedTask.taskWeighting = existingTask.taskWeighting;
    });

    return parsedTasks;
  }

  /**
   * Ensures all parsed tasks have a taskWeighting value.
   * The TaskDefinition constructor now defaults taskWeighting to 1,
   * so this method is retained for defence-in-depth when tasks
   * arrive from non-constructor paths.
   *
   * @param {Object} parsedTasks - Parsed task map.
   * @returns {Object} Parsed tasks with defaults applied.
   */
  defaultTaskWeightings(parsedTasks) {
    const entries = Object.entries(parsedTasks || {});

    entries.forEach(([, task]) => {
      if (!task || typeof task !== 'object') {
        return;
      }

      if (task.taskWeighting === null || task.taskWeighting === undefined) {
        task.taskWeighting = 1;
      }
    });

    return parsedTasks;
  }

  /**
   * Applies payload task-weighting patches to known tasks.
   *
   * @param {Object} tasks - Task map.
   * @param {Array<Object>} taskWeightings - Patch list.
   * @returns {Object} Patched task map.
   * @throws {TypeError|Error} When taskWeightings is invalid or contains unknown taskIds.
   */
  applyTaskWeightings(tasks, taskWeightings) {
    if (!Array.isArray(taskWeightings)) {
      throw new TypeError('taskWeightings must be an array when provided.');
    }

    taskWeightings.forEach((patch) => {
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
        throw new TypeError('taskWeightings entries must be objects.');
      }

      const taskId = this.validation.requireTrimmedString(patch.taskId, 'taskWeightings.taskId');

      const task = this._findTaskById(tasks, taskId);
      if (!task) {
        throw new Error(`taskWeightings contains unknown taskId: ${taskId}`);
      }

      const taskWeightingValue = Object.hasOwn(patch, 'taskWeighting') ? patch.taskWeighting : null;

      task.taskWeighting = this.validation.requireNumericOrNullWeighting(
        taskWeightingValue,
        `taskWeightings.${taskId}.taskWeighting`
      );
    });

    return tasks;
  }

  /**
   * Finds a task object by ID from a task map using direct property access.
   *
   * @param {Object} tasks - Task map keyed by task ID.
   * @param {string} taskId - Task ID.
   * @returns {Object|null} Task object or null.
   * @private
   */
  _findTaskById(tasks, taskId) {
    /* eslint-disable-next-line security/detect-object-injection -- taskId is a validated string from the task map keys */
    return tasks ? tasks[taskId] || null : null;
  }
}

// Export for Node tests / CommonJS environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AssignmentDefinitionTaskWeighting;
}
