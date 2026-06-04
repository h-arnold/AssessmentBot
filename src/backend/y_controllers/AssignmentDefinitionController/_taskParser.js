/**
 * Task parsing and state resolution helper functions for AssignmentDefinitionController.
 * Concatenated before the main controller file in GAS runtime.
 * Contains task definition parsing, state resolution, weighting application, and document change detection.
 */

/**
 * Resolves task state and timestamp updates for upsert operations.
 *
 * @param {Object} parameters - Resolution parameters.
 * @param {boolean} parameters.isUpdate - Whether this is an update.
 * @param {Object|null} parameters.existingDefinition - Existing definition when updating.
 * @param {string} parameters.documentType - Document type.
 * @param {string} parameters.referenceDocumentId - Reference document ID.
 * @param {string} parameters.templateDocumentId - Template document ID.
 * @returns {{finalTasks: Object, referenceLastModified: string|null, templateLastModified: string|null}} Task state.
 */
function _resolveTaskStateForUpsert(parameters) {
  var isUpdate = parameters.isUpdate;
  var existingDefinition = parameters.existingDefinition;
  var documentType = parameters.documentType;
  var referenceDocumentId = parameters.referenceDocumentId;
  var templateDocumentId = parameters.templateDocumentId;

  var existingTasks = isUpdate ? existingDefinition.tasks || {} : {};
  var referenceLastModified = isUpdate ? existingDefinition.referenceLastModified : null;
  var templateLastModified = isUpdate ? existingDefinition.templateLastModified : null;

  if (
    !isUpdate ||
    _hasDocumentIdChanges(existingDefinition, referenceDocumentId, templateDocumentId)
  ) {
    referenceLastModified = DriveManager.getFileModifiedTime(referenceDocumentId);
    templateLastModified = DriveManager.getFileModifiedTime(templateDocumentId);
    var reparsedTasks = _applyStoredWeightings(
      existingTasks,
      _parseTasks({
        documentType: documentType,
        referenceDocumentId: referenceDocumentId,
        templateDocumentId: templateDocumentId,
      })
    );

    return {
      finalTasks: _defaultTaskWeightings(reparsedTasks),
      referenceLastModified: referenceLastModified,
      templateLastModified: templateLastModified,
    };
  }

  var latestReferenceModified = DriveManager.getFileModifiedTime(referenceDocumentId);
  var latestTemplateModified = DriveManager.getFileModifiedTime(templateDocumentId);
  var needsRefresh = Utils.definitionNeedsRefresh(
    existingDefinition,
    latestReferenceModified,
    latestTemplateModified
  );

  if (!needsRefresh) {
    return {
      finalTasks: existingTasks,
      referenceLastModified: referenceLastModified,
      templateLastModified: templateLastModified,
    };
  }

  return {
    finalTasks: _defaultTaskWeightings(
      _applyStoredWeightings(
        existingTasks,
        _parseTasks({
          documentType: documentType,
          referenceDocumentId: referenceDocumentId,
          templateDocumentId: templateDocumentId,
        })
      )
    ),
    referenceLastModified: latestReferenceModified,
    templateLastModified: latestTemplateModified,
  };
}

/**
 * Returns whether reference/template IDs changed during update.
 *
 * @param {Object|null} existingDefinition - Existing definition.
 * @param {string} referenceDocumentId - New reference ID.
 * @param {string} templateDocumentId - New template ID.
 * @returns {boolean} True when IDs changed.
 */
function _hasDocumentIdChanges(existingDefinition, referenceDocumentId, templateDocumentId) {
  if (!existingDefinition) {
    return true;
  }

  return (
    existingDefinition.referenceDocumentId !== referenceDocumentId ||
    existingDefinition.templateDocumentId !== templateDocumentId
  );
}

/**
 * Parses task definitions from reference and template documents.
 * Dispatches to type-specific parsers based on document type.
 *
 * @param {Object} parameters - Destructured parameters.
 * @param {string} parameters.documentType - Document type ('SLIDES' or 'SHEETS').
 * @param {string} parameters.referenceDocumentId - Reference document Google ID.
 * @param {string} parameters.templateDocumentId - Template document Google ID.
 * @returns {Object} Task definitions map with task ID as key.
 * @throws {Error} If document type is unknown or parsing fails.
 */
function _parseTasks(parameters) {
  var type = parameters.documentType.toUpperCase();
  if (type === 'SLIDES') {
    return _parseSlidesTasks(parameters.referenceDocumentId, parameters.templateDocumentId);
  }
  if (type === 'SHEETS') {
    return _parseSheetsTasks(parameters.referenceDocumentId, parameters.templateDocumentId);
  }
  ProgressTracker.getInstance().logAndThrowError(
    "Unknown documentType '" + parameters.documentType + "' when parsing tasks."
  );
}

/**
 * Parses task definitions from Google Slides documents.
 * Validates each task definition and logs errors for invalid tasks.
 *
 * @param {string} referenceDocumentId - Reference slides Google ID.
 * @param {string} templateDocumentId - Template slides Google ID.
 * @returns {Object} Map of valid task definitions indexed by task ID.
 */
function _parseSlidesTasks(referenceDocumentId, templateDocumentId) {
  var parser = new SlidesParser();
  var definitions = parser.extractTaskDefinitions(referenceDocumentId, templateDocumentId);
  var validDefs = [];

  definitions.forEach(function (definition) {
    var validation = definition.validate();
    if (!validation.ok) {
      ProgressTracker.getInstance().logError('TaskDefinition missing required slide artifacts.', {
        taskId: definition.getId(),
        errors: validation.errors,
      });
      return;
    }
    validDefs.push(definition);
  });

  ABLogger.getInstance().info('Parsed slide task definitions', {
    parsed: definitions.length,
    valid: validDefs.length,
  });

  var result = {};
  validDefs.forEach(function (td) {
    result[td.getId()] = TaskDefinition.fromJSON(td.toJSON());
  });
  return result;
}

/**
 * Parses task definitions from Google Sheets documents.
 * Validates each task definition and logs errors for invalid tasks.
 *
 * @param {string} referenceDocumentId - Reference spreadsheet Google ID.
 * @param {string} templateDocumentId - Template spreadsheet Google ID.
 * @returns {Object} Map of valid task definitions indexed by task ID.
 */
function _parseSheetsTasks(referenceDocumentId, templateDocumentId) {
  var parser = new SheetsParser();
  var definitions = parser.extractTaskDefinitions(referenceDocumentId, templateDocumentId);
  ABLogger.getInstance().info('Parsed sheet task definitions', { parsed: definitions.length });
  var result = {};
  definitions.forEach(function (td) {
    result[td.getId()] = TaskDefinition.fromJSON(td.toJSON());
  });
  return result;
}

/**
 * Applies existing task weightings to parsed task sets.
 *
 * @param {Object} existingTasks - Existing task map.
 * @param {Object} parsedTasks - Parsed task map.
 * @returns {Object} Parsed tasks with preserved matching weightings.
 */
function _applyStoredWeightings(existingTasks, parsedTasks) {
  var existingEntries = Object.entries(existingTasks || {});

  existingEntries.forEach(function (entry) {
    var taskId = entry[0];
    var existingTask = entry[1];
    var parsedTask = _findTaskById(parsedTasks, taskId);
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
 * Applies default task weightings to parsed tasks when missing.
 *
 * @param {Object} parsedTasks - Parsed task map.
 * @returns {Object} Parsed tasks with defaults applied.
 */
function _defaultTaskWeightings(parsedTasks) {
  var entries = Object.entries(parsedTasks || {});

  entries.forEach(function (entry) {
    var task = entry[1];
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
 */
function _applyTaskWeightings(tasks, taskWeightings) {
  if (!Array.isArray(taskWeightings)) {
    throw new TypeError('taskWeightings must be an array when provided.');
  }

  taskWeightings.forEach(function (patch) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      throw new TypeError('taskWeightings entries must be objects.');
    }

    var taskId = _requireTrimmedString(patch.taskId, 'taskWeightings.taskId');

    var task = _findTaskById(tasks, taskId);
    if (!task) {
      throw new Error('taskWeightings contains unknown taskId: ' + taskId);
    }

    var taskWeightingValue = Object.hasOwn(patch, 'taskWeighting') ? patch.taskWeighting : null;

    task.taskWeighting = _requireNumericOrNullWeighting(
      taskWeightingValue,
      'taskWeightings.' + taskId + '.taskWeighting'
    );
  });

  return tasks;
}

/**
 * Finds a task object by ID from a task map.
 *
 * @param {Object} tasks - Task map.
 * @param {string} taskId - Task ID.
 * @returns {Object|null} Task object or null.
 */
function _findTaskById(tasks, taskId) {
  var entries = Object.entries(tasks || {});
  var matched = null;
  for (const entry of entries) {
    if (entry[0] === taskId) {
      matched = entry;
      break;
    }
  }
  return matched ? matched[1] : null;
}

/**
 * Applies task-weighting patches when present in payload.
 *
 * @param {Object} parameters - Parameters.
 * @param {Object} parameters.tasks - Task map.
 * @param {Object} parameters.payload - Upsert payload.
 * @returns {Object} Patched or original tasks.
 */
function _applyTaskWeightingsIfProvided(parameters) {
  if (!Object.hasOwn(parameters.payload, 'taskWeightings')) {
    return parameters.tasks;
  }

  return _applyTaskWeightings(parameters.tasks, parameters.payload.taskWeightings);
}

// Export for Node tests / CommonJS environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    _resolveTaskStateForUpsert: _resolveTaskStateForUpsert,
    _hasDocumentIdChanges: _hasDocumentIdChanges,
    _parseTasks: _parseTasks,
    _parseSlidesTasks: _parseSlidesTasks,
    _parseSheetsTasks: _parseSheetsTasks,
    _applyStoredWeightings: _applyStoredWeightings,
    _defaultTaskWeightings: _defaultTaskWeightings,
    _applyTaskWeightings: _applyTaskWeightings,
    _findTaskById: _findTaskById,
    _applyTaskWeightingsIfProvided: _applyTaskWeightingsIfProvided,
  };
}
