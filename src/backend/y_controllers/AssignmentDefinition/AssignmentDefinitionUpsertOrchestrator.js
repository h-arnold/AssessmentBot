/**
 * AssignmentDefinitionUpsertOrchestrator
 *
 * Orchestrates the full upsert flow for assignment definitions:
 * validation, reference data resolution, task parsing, task weighting,
 * deduplication checks, persistence, and rollback.
 */
class AssignmentDefinitionUpsertOrchestrator {
  /**
   * Creates the instance with injected dependencies.
   * @param {Object} deps - Dependency injection.
   * @param {Object} deps.dbManager - Database manager instance.
   * @param {Object} deps.persistence - AssignmentDefinitionPersistence instance.
   * @param {Object} deps.taskParser - AssignmentDefinitionTaskParser instance.
   * @param {Object} deps.taskWeighting - AssignmentDefinitionTaskWeighting instance.
   * @param {Object} deps.referenceData - AssignmentDefinitionReferenceData instance.
   * @param {Object} deps.validation - AssignmentDefinitionValidation instance.
   */
  constructor({
    dbManager,
    persistence,
    taskParser,
    taskWeighting,
    referenceData,
    validation,
  } = {}) {
    this.dbManager = dbManager;
    this.persistence = persistence;
    this.taskParser = taskParser;
    this.taskWeighting = taskWeighting;
    this.referenceData = referenceData;
    this.validation = validation;
  }

  /**
   * Creates the instance with injected dependencies.
   * Creates or updates a reusable assignment definition.
   * This is now the SOLE creation/update method per SPEC.md v1.9.0 (ensureDefinition removed).
   *
   * @param {Object} payload - Upsert payload.
   * @returns {AssignmentDefinition} Persisted full definition.
   */
  upsert(payload) {
    /* global Validate, AssignmentDefinition */
    Validate.requireParams({ payload }, 'AssignmentDefinitionController.upsertDefinition');

    // Inlined validation logic from _buildUpsertContext
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new TypeError('upsertDefinition payload must be an object.');
    }

    const isUpdate = this.validation.isNonEmptyString(payload.definitionKey);
    const existingDefinition = isUpdate
      ? this.persistence._getStoredFullDocument(payload.definitionKey.trim())
      : null;

    if (isUpdate && !existingDefinition) {
      throw new Error(`Unknown definitionKey for update: ${payload.definitionKey}`);
    }

    const primaryTitle = this.validation.requireTrimmedString(payload.primaryTitle, 'primaryTitle');
    const primaryTopicKey = this.validation.requireTrimmedString(
      payload.primaryTopicKey,
      'primaryTopicKey'
    );
    const referenceDocumentId = this.validation.requireTrimmedString(
      payload.referenceDocumentId,
      'referenceDocumentId'
    );
    const templateDocumentId = this.validation.requireTrimmedString(
      payload.templateDocumentId,
      'templateDocumentId'
    );

    if (referenceDocumentId === templateDocumentId) {
      throw new Error('referenceDocumentId and templateDocumentId must be different.');
    }

    const yearGroupContext = this._resolveYearGroupContext({ payload });

    const topicRecord = this.referenceData.requireExistingAssignmentTopic(primaryTopicKey);

    this._assertNoDuplicateBusinessTuple({
      definitionKeyToIgnore: isUpdate ? existingDefinition.definitionKey : null,
      primaryTitle,
      primaryTopicKey,
      yearGroupKey: yearGroupContext.yearGroupKey,
    });

    const taskState = this._resolveTaskState({
      isUpdate,
      existingDefinition,
      documentType: this._resolveDocumentType({ payload, existingDefinition }),
      referenceDocumentId,
      templateDocumentId,
    });

    const finalTasks = this._applyTaskWeightingsIfProvided({
      tasks: taskState.finalTasks,
      payload,
    });

    const definition = new AssignmentDefinition({
      primaryTitle,
      primaryTopicKey,
      primaryTopic: topicRecord.name,
      yearGroupKey: yearGroupContext.yearGroupKey,
      yearGroupLabel: yearGroupContext.yearGroupLabel,
      alternateTitles: this._resolveAlternateTitles({
        payload,
        isUpdate,
        existingDefinition,
      }),
      assignmentWeighting: this._resolveAssignmentWeighting({
        payload,
        isUpdate,
        existingDefinition,
      }),
      documentType: this._resolveDocumentType({ payload, existingDefinition }),
      referenceDocumentId,
      templateDocumentId,
      referenceLastModified: taskState.referenceLastModified,
      templateLastModified: taskState.templateLastModified,
      tasks: finalTasks,
      createdAt: isUpdate ? existingDefinition.createdAt : null,
      updatedAt: isUpdate ? existingDefinition.updatedAt : null,
      definitionKey: isUpdate ? existingDefinition.definitionKey : this._generateStableKey(),
    });

    const persistedDefinition = this.persistence._persistDefinitionWithRollback({
      definition,
      previousFullDefinition: existingDefinition,
    });

    return persistedDefinition;
  }

  /**
   * Creates the instance with injected dependencies.
   * Resolves alternate titles for upsert operations.
   *
   * @param {Object} params - Resolution parameters.
   * @param {Object} params.payload - Upsert payload.
   * @param {boolean} params.isUpdate - Whether this is an update.
   * @param {Object|null} params.existingDefinition - Existing definition when updating.
   * @returns {Array<string>} Resolved alternate titles.
   * @private
   */
  _resolveAlternateTitles({ payload, isUpdate, existingDefinition }) {
    const shouldPreserveAlternateTitles = isUpdate && !Object.hasOwn(payload, 'alternateTitles');

    if (shouldPreserveAlternateTitles) {
      return existingDefinition.alternateTitles || [];
    }

    return this.validation.normaliseAlternateTitles(payload.alternateTitles);
  }

  /**
   * Creates the instance with injected dependencies.
   * Resolves assignment weighting for upsert operations.
   * Returns the raw payload value without defaulting.
   *
   * @param {Object} params - Resolution parameters.
   * @param {Object} params.payload - Upsert payload.
   * @param {boolean} params.isUpdate - Whether this is an update.
   * @param {Object|null} params.existingDefinition - Existing definition when updating.
   * @returns {number|null|undefined} Assignment weighting (raw payload value).
   * @private
   */
  _resolveAssignmentWeighting({ payload, isUpdate, existingDefinition }) {
    if (Object.hasOwn(payload, 'assignmentWeighting')) {
      const value = payload.assignmentWeighting;
      if (value !== null && value !== undefined) {
        this.validation.requireNumericOrNullWeighting(value, 'assignmentWeighting');
      }
      return value;
    }
  }

  /**
   * Creates the instance with injected dependencies.
   * Resolves year-group context for upsert operations.
   *
   * @param {Object} params - Resolution parameters.
   * @param {Object} params.payload - Upsert payload.
   * @returns {{yearGroupKey: string, yearGroupLabel: string}} Year-group context.
   * @private
   */
  _resolveYearGroupContext({ payload }) {
    if (!Object.hasOwn(payload, 'yearGroupKey') || payload.yearGroupKey === null) {
      throw new Error('yearGroupKey must be provided for save writes.');
    }

    const resolvedYearGroup = this.referenceData.requireExistingYearGroupRecord(
      payload.yearGroupKey
    );
    return {
      yearGroupKey: resolvedYearGroup.key,
      yearGroupLabel: resolvedYearGroup.name,
    };
  }

  /**
   * Creates the instance with injected dependencies.
   * Resolves task state and timestamp updates for upsert operations.
   *
   * @param {Object} params - Resolution parameters.
   * @param {boolean} params.isUpdate - Whether this is an update.
   * @param {Object|null} params.existingDefinition - Existing definition when updating.
   * @param {string} params.documentType - Document type.
   * @param {string} params.referenceDocumentId - Reference document ID.
   * @param {string} params.templateDocumentId - Template document ID.
   * @returns {{finalTasks: Object, referenceLastModified: string|null, templateLastModified: string|null}} Task state.
   * @private
   */
  _resolveTaskState({
    isUpdate,
    existingDefinition,
    documentType,
    referenceDocumentId,
    templateDocumentId,
  }) {
    /* global DriveManager, DateUtils */
    const existingTasks = isUpdate ? existingDefinition.tasks || {} : {};
    let referenceLastModified = isUpdate ? existingDefinition.referenceLastModified : null;
    let templateLastModified = isUpdate ? existingDefinition.templateLastModified : null;

    if (
      !isUpdate ||
      this._hasDocumentIdChanges(existingDefinition, referenceDocumentId, templateDocumentId)
    ) {
      referenceLastModified = DriveManager.getFileModifiedTime(referenceDocumentId);
      templateLastModified = DriveManager.getFileModifiedTime(templateDocumentId);
      const reparsedTasks = this.taskWeighting.applyStoredWeightings(
        existingTasks,
        this.taskParser.parseTasks({
          documentType,
          referenceDocumentId,
          templateDocumentId,
        })
      );

      return {
        finalTasks: this.taskWeighting.defaultTaskWeightings(reparsedTasks),
        referenceLastModified,
        templateLastModified,
      };
    }

    const latestReferenceModified = DriveManager.getFileModifiedTime(referenceDocumentId);
    const latestTemplateModified = DriveManager.getFileModifiedTime(templateDocumentId);
    const needsRefresh = DateUtils.definitionNeedsRefresh(
      existingDefinition,
      latestReferenceModified,
      latestTemplateModified
    );

    if (!needsRefresh) {
      return {
        finalTasks: existingTasks,
        referenceLastModified,
        templateLastModified,
      };
    }

    return {
      finalTasks: this.taskWeighting.defaultTaskWeightings(
        this.taskWeighting.applyStoredWeightings(
          existingTasks,
          this.taskParser.parseTasks({
            documentType,
            referenceDocumentId,
            templateDocumentId,
          })
        )
      ),
      referenceLastModified: latestReferenceModified,
      templateLastModified: latestTemplateModified,
    };
  }

  /**
   * Creates the instance with injected dependencies.
   * Applies task-weighting patches when present in payload.
   *
   * @param {Object} params - Parameters.
   * @param {Object} params.tasks - Task map.
   * @param {Object} params.payload - Upsert payload.
   * @returns {Object} Patched or original tasks.
   * @private
   */
  _applyTaskWeightingsIfProvided({ tasks, payload }) {
    if (!Object.hasOwn(payload, 'taskWeightings')) {
      return tasks;
    }

    return this.taskWeighting.applyTaskWeightings(tasks, payload.taskWeightings);
  }

  /**
   * Creates the instance with injected dependencies.
   * Returns whether reference/template IDs changed during update.
   *
   * @param {Object|null} existingDefinition - Existing definition.
   * @param {string} referenceDocumentId - New reference ID.
   * @param {string} templateDocumentId - New template ID.
   * @returns {boolean} True when IDs changed.
   * @private
   */
  _hasDocumentIdChanges(existingDefinition, referenceDocumentId, templateDocumentId) {
    if (!existingDefinition) {
      return true;
    }

    return (
      existingDefinition.referenceDocumentId !== referenceDocumentId ||
      existingDefinition.templateDocumentId !== templateDocumentId
    );
  }

  /**
   * Creates the instance with injected dependencies.
   * Resolves document type for upsert operations.
   *
   * @param {Object} params - Resolution params.
   * @param {Object} params.payload - Upsert payload.
   * @param {Object|null} params.existingDefinition - Existing definition for updates.
   * @returns {string} Document type.
   * @private
   */
  _resolveDocumentType({ payload, existingDefinition }) {
    if (this.validation.isNonEmptyString(payload.documentType)) {
      return payload.documentType.trim().toUpperCase();
    }

    if (existingDefinition?.documentType) {
      return existingDefinition.documentType;
    }

    throw new Error('documentType must be provided for create upserts.');
  }

  /**
   * Creates the instance with injected dependencies.
   * Generates a stable opaque definition key.
   *
   * @returns {string} Stable identifier.
   * @private
   */
  _generateStableKey() {
    /* global Utilities */
    if (typeof Utilities === 'undefined' || typeof Utilities.getUuid !== 'function') {
      throw new TypeError('Utilities.getUuid must be available to generate definitionKey.');
    }

    const generatedDefinitionKey = Utilities.getUuid();

    if (!this.validation.isNonEmptyString(generatedDefinitionKey)) {
      throw new TypeError('Utilities.getUuid must return a non-empty string definitionKey.');
    }

    return generatedDefinitionKey.trim();
  }

  /**
   * Creates the instance with injected dependencies.
   * Validates that no duplicate business tuple exists in registry rows.
   *
   * @param {Object} params - Duplicate-check params.
   * @param {string|null} params.definitionKeyToIgnore - Definition key to exclude from duplicate checks.
   * @param {string} params.primaryTitle - Candidate title.
   * @param {string} params.primaryTopicKey - Candidate topic key.
   * @param {string} params.yearGroupKey - Candidate year-group key.
   * @private
   */
  _assertNoDuplicateBusinessTuple({
    definitionKeyToIgnore,
    primaryTitle,
    primaryTopicKey,
    yearGroupKey,
  }) {
    const rows = this.dbManager.readAll(this.persistence.registryCollectionName) || [];
    const expectedTitle = this.validation.normaliseTitleForDuplicate(primaryTitle);

    const conflict = rows.find((row) => {
      if (!row || typeof row !== 'object') {
        return false;
      }

      if (definitionKeyToIgnore && row.definitionKey === definitionKeyToIgnore) {
        return false;
      }

      return (
        this.validation.normaliseTitleForDuplicate(row.primaryTitle) === expectedTitle &&
        row.primaryTopicKey === primaryTopicKey &&
        row.yearGroupKey === yearGroupKey
      );
    });

    if (conflict) {
      throw new Error(
        `Duplicate assignment definition for tuple (${primaryTitle}, ${primaryTopicKey}, ${yearGroupKey})`
      );
    }
  }
}

// Export for Node tests / CommonJS environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AssignmentDefinitionUpsertOrchestrator;
}
