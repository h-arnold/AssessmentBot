const MIN_WEIGHTING = 0;
const MAX_WEIGHTING = 10;

/**
 * AssignmentDefinitionController
 *
 * Manages the creation, retrieval, and persistence of assignment definitions.
 * Definitions are stored in a registry collection and full documents in dedicated collections.
 */
class AssignmentDefinitionController {
  /**
   * Initialises the AssignmentDefinitionController.
   * Sets up database manager and registry/collection naming conventions for persisting assignment definitions.
   */
  constructor() {
    this.dbManager = DbManager.getInstance();
    this.progressTracker = ProgressTracker.getInstance();
    this.registryCollectionName = 'assignment_definitions';
    this.fullCollectionPrefix = 'assdef_full_';
    this.inMemoryFullDefinitionCache = new Map();
  }

  /**
   * Ensure an AssignmentDefinition exists and is fresh for the provided identifiers.
   * Parses documents when missing or stale and persists immediately.
   * @param {Object} params - Configuration parameters.
   * @param {string} params.primaryTitle - The primary title of the assignment.
   * @param {string|null} [params.primaryTopic] - Topic name (optional).
   * @param {string|null} [params.topicId] - Topic ID to look up (optional).
   * @param {string} params.courseId - Classroom course ID.
   * @param {number|null} [params.yearGroup] - Year group level (optional).
   * @param {string} params.documentType - Document type ('SLIDES' or 'SHEETS').
   * @param {string} params.referenceDocumentId - Google ID of the reference document.
   * @param {string} params.templateDocumentId - Google ID of the template document.
   * @returns {AssignmentDefinition} The fresh or newly created assignment definition.
   */
  ensureDefinition({
    primaryTitle,
    primaryTopic = null,
    topicId = null,
    courseId = '',
    yearGroup = null,
    documentType,
    referenceDocumentId,
    templateDocumentId,
  }) {
    if (!primaryTitle) {
      this.progressTracker.logAndThrowError(
        'primaryTitle is required to ensure assignment definition.'
      );
    }
    if (!documentType) {
      this.progressTracker.logAndThrowError(
        'documentType is required to ensure assignment definition.'
      );
    }
    if (!referenceDocumentId || !templateDocumentId) {
      this.progressTracker.logAndThrowError(
        'referenceDocumentId and templateDocumentId are required to ensure assignment definition.'
      );
    }

    let canonicalTopic = this._resolveTopicName({ primaryTopic, topicId, courseId });
    if (!canonicalTopic) {
      this.progressTracker.logAndThrowError(
        'Cannot create assignment definition: topic name is required but could not be resolved.',
        { primaryTitle, primaryTopic, topicId, courseId }
      );
    }
    const definitionKey = AssignmentDefinition.buildDefinitionKey({
      primaryTitle,
      primaryTopic: canonicalTopic,
      yearGroup,
    });

    const referenceLastModified = DriveManager.getFileModifiedTime(referenceDocumentId);
    const templateLastModified = DriveManager.getFileModifiedTime(templateDocumentId);

    const storedDefinition = this._getStoredFullDocument(definitionKey);
    let definition = storedDefinition ? AssignmentDefinition.fromJSON(storedDefinition) : null;

    const needsRefresh = Utils.definitionNeedsRefresh(
      definition,
      referenceLastModified,
      templateLastModified
    );

    if (!definition) {
      definition = new AssignmentDefinition({
        primaryTitle,
        primaryTopic: canonicalTopic,
        yearGroup,
        documentType,
        referenceDocumentId,
        templateDocumentId,
        referenceLastModified,
        templateLastModified,
        tasks: {},
        definitionKey,
      });
    }

    if (needsRefresh) {
      const tasks = this._parseTasks({ documentType, referenceDocumentId, templateDocumentId });
      definition.tasks = tasks;
      definition.updateModifiedTimestamps({
        referenceLastModified,
        templateLastModified,
      });
      this.saveDefinition(definition);
    }

    return definition;
  }

  /**
   * Creates or updates a reusable assignment definition.
   *
   * @param {Object} payload - Upsert payload.
   * @returns {AssignmentDefinition} Persisted full definition.
   */
  upsertDefinition(payload) {
    Validate.requireParams({ payload }, 'AssignmentDefinitionController.upsertDefinition');

    const context = this._buildUpsertContext(payload);
    const topicRecord = this._requireExistingAssignmentTopic(context.primaryTopicKey);

    this._assertNoDuplicateBusinessTuple({
      definitionKeyToIgnore: context.isUpdate ? context.existingDefinition.definitionKey : null,
      primaryTitle: context.primaryTitle,
      primaryTopicKey: context.primaryTopicKey,
      yearGroup: context.yearGroup,
      yearGroupKey: context.yearGroupKey,
    });

    const taskState = this._resolveTaskStateForUpsert({
      isUpdate: context.isUpdate,
      existingDefinition: context.existingDefinition,
      documentType: context.documentType,
      referenceDocumentId: context.referenceDocumentId,
      templateDocumentId: context.templateDocumentId,
    });

    const finalTasks = this._applyTaskWeightingsIfProvided({
      tasks: taskState.finalTasks,
      payload,
    });

    const definition = new AssignmentDefinition({
      primaryTitle: context.primaryTitle,
      primaryTopicKey: context.primaryTopicKey,
      primaryTopic: topicRecord.name,
      yearGroup: context.yearGroup,
      yearGroupKey: context.yearGroupKey,
      yearGroupLabel: context.yearGroupLabel,
      alternateTitles: context.alternateTitles,
      alternateTopics: context.isUpdate ? context.existingDefinition.alternateTopics || [] : [],
      documentType: context.documentType,
      referenceDocumentId: context.referenceDocumentId,
      templateDocumentId: context.templateDocumentId,
      referenceLastModified: taskState.referenceLastModified,
      templateLastModified: taskState.templateLastModified,
      assignmentWeighting: context.assignmentWeighting,
      tasks: finalTasks,
      createdAt: context.isUpdate ? context.existingDefinition.createdAt : null,
      updatedAt: context.isUpdate ? context.existingDefinition.updatedAt : null,
      definitionKey: context.definitionKey,
    });

    const persistedDefinition = this._persistDefinitionWithRollback({
      definition,
      previousFullDefinition: context.existingDefinition,
    });

    return this._toCanonicalFullDefinitionResponse(persistedDefinition);
  }

  /**
   * Builds validated upsert context values.
   *
   * @param {Object} payload - Upsert payload.
   * @returns {Object} Normalised context.
   * @private
   */
  _buildUpsertContext(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new TypeError('upsertDefinition payload must be an object.');
    }

    const isUpdate = this._isNonEmptyString(payload.definitionKey);
    const existingDefinition = isUpdate
      ? this._getStoredFullDocument(payload.definitionKey.trim())
      : null;

    if (isUpdate && !existingDefinition) {
      throw new Error(`Unknown definitionKey for update: ${payload.definitionKey}`);
    }

    const primaryTitle = this._requireTrimmedString(payload.primaryTitle, 'primaryTitle');
    const primaryTopicKey = this._requireTrimmedString(payload.primaryTopicKey, 'primaryTopicKey');
    const referenceDocumentId = this._requireTrimmedString(
      payload.referenceDocumentId,
      'referenceDocumentId'
    );
    const templateDocumentId = this._requireTrimmedString(
      payload.templateDocumentId,
      'templateDocumentId'
    );

    if (referenceDocumentId === templateDocumentId) {
      throw new Error('referenceDocumentId and templateDocumentId must be different.');
    }

    const yearGroupContext = this._resolveYearGroupContextForUpsert({
      payload,
      isUpdate,
      existingDefinition,
    });

    return {
      isUpdate,
      existingDefinition,
      primaryTitle,
      primaryTopicKey,
      referenceDocumentId,
      templateDocumentId,
      yearGroup: yearGroupContext.yearGroup,
      yearGroupKey: yearGroupContext.yearGroupKey,
      yearGroupLabel: yearGroupContext.yearGroupLabel,
      alternateTitles: this._resolveAlternateTitlesForUpsert({
        payload,
        isUpdate,
        existingDefinition,
      }),
      assignmentWeighting: this._resolveAssignmentWeightingForUpsert({
        payload,
        isUpdate,
        existingDefinition,
      }),
      definitionKey: isUpdate
        ? existingDefinition.definitionKey
        : this._generateStableDefinitionKey(),
      documentType: this._resolveDocumentTypeForUpsert({ payload, existingDefinition }),
    };
  }

  /**
   * Resolves alternate titles for upsert operations.
   *
   * @param {Object} params - Resolution parameters.
   * @param {Object} params.payload - Upsert payload.
   * @param {boolean} params.isUpdate - Whether this is an update.
   * @param {Object|null} params.existingDefinition - Existing definition when updating.
   * @returns {Array<string>} Resolved alternate titles.
   * @private
   */
  _resolveAlternateTitlesForUpsert({ payload, isUpdate, existingDefinition }) {
    const shouldPreserveAlternateTitles = isUpdate && !Object.hasOwn(payload, 'alternateTitles');

    if (shouldPreserveAlternateTitles) {
      return existingDefinition.alternateTitles || [];
    }

    return this._normaliseAlternateTitles(payload.alternateTitles);
  }

  /**
   * Resolves assignment weighting for upsert operations.
   *
   * @param {Object} params - Resolution parameters.
   * @param {Object} params.payload - Upsert payload.
   * @param {boolean} params.isUpdate - Whether this is an update.
   * @param {Object|null} params.existingDefinition - Existing definition when updating.
   * @returns {number|null} Assignment weighting.
   * @private
   */
  _resolveAssignmentWeightingForUpsert({ payload, isUpdate, existingDefinition }) {
    if (Object.hasOwn(payload, 'assignmentWeighting')) {
      return this._requireNumericOrNullWeighting(
        payload.assignmentWeighting,
        'assignmentWeighting'
      );
    }

    return isUpdate ? existingDefinition.assignmentWeighting : null;
  }

  /**
   * Resolves year-group context for upsert operations.
   *
   * @param {Object} params - Resolution parameters.
   * @param {Object} params.payload - Upsert payload.
   * @returns {{yearGroup: number|null, yearGroupKey: string, yearGroupLabel: string|null}} Year-group context.
   * @private
   */
  _resolveYearGroupContextForUpsert({ payload }) {
    if (!Object.hasOwn(payload, 'yearGroupKey') || payload.yearGroupKey === null) {
      throw new Error('yearGroupKey must be provided for save writes.');
    }

    const resolvedYearGroup = this._requireExistingYearGroupRecord(payload.yearGroupKey);
    return {
      yearGroup: resolvedYearGroup.yearGroup ?? null,
      yearGroupKey: resolvedYearGroup.key,
      yearGroupLabel: resolvedYearGroup.name,
    };
  }

  /**
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
  _resolveTaskStateForUpsert({
    isUpdate,
    existingDefinition,
    documentType,
    referenceDocumentId,
    templateDocumentId,
  }) {
    const existingTasks = isUpdate ? existingDefinition.tasks || {} : {};
    let referenceLastModified = isUpdate ? existingDefinition.referenceLastModified : null;
    let templateLastModified = isUpdate ? existingDefinition.templateLastModified : null;

    if (
      !isUpdate ||
      this._hasDocumentIdChanges(existingDefinition, referenceDocumentId, templateDocumentId)
    ) {
      referenceLastModified = DriveManager.getFileModifiedTime(referenceDocumentId);
      templateLastModified = DriveManager.getFileModifiedTime(templateDocumentId);
      const reparsedTasks = this._applyStoredWeightings(
        existingTasks,
        this._parseTasks({
          documentType,
          referenceDocumentId,
          templateDocumentId,
        })
      );

      return {
        finalTasks: this._defaultTaskWeightings(reparsedTasks),
        referenceLastModified,
        templateLastModified,
      };
    }

    const latestReferenceModified = DriveManager.getFileModifiedTime(referenceDocumentId);
    const latestTemplateModified = DriveManager.getFileModifiedTime(templateDocumentId);
    const needsRefresh = Utils.definitionNeedsRefresh(
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
      finalTasks: this._defaultTaskWeightings(
        this._applyStoredWeightings(
          existingTasks,
          this._parseTasks({
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

    return this._applyTaskWeightings(tasks, payload.taskWeightings);
  }

  /**
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
   * Retrieve a definition by its stable definition key.
   * Returns the full definition if available, or a partial metadata entry from the registry.
   * @param {string} definitionKey - The stable definition key.
   * @param {Object} [options] - Retrieval options.
   * @param {'full'|'partial'} [options.form='full'] - Which store to query.
   * @returns {AssignmentDefinition|null} The definition instance, or null if not found.
   */
  getDefinitionByKey(definitionKey, options = {}) {
    Validate.requireParams({ definitionKey }, 'AssignmentDefinitionController.getDefinitionByKey');

    const { form = 'full' } = options;

    if (form === 'partial') {
      const registry = this._getRegistryCollection();
      const document = registry.findOne({ definitionKey }) || null;
      if (!document) return null;
      return AssignmentDefinition.fromJSON(document);
    }

    const fullCollection = this._getFullCollection(definitionKey);
    const fullDocument =
      fullCollection.findOne({ definitionKey }) ||
      this.inMemoryFullDefinitionCache.get(definitionKey) ||
      null;
    if (!fullDocument) return null;

    const hydratedDefinition = AssignmentDefinition.fromJSON(fullDocument);

    if (!this._isNonEmptyString(fullDocument.yearGroupKey)) {
      throw new Error(
        `Stored definition ${definitionKey} is missing required yearGroupKey for canonical reads.`
      );
    }

    return this._toCanonicalFullDefinitionResponse(hydratedDefinition);
  }

  /**
   * Return all partial assignment definitions from the registry as model instances.
   * Partial definitions contain essential metadata only; tasks are stored separately in full definitions.
   * @returns {Array<AssignmentDefinition>} Array of all partial definitions in the registry.
   */
  getAllPartialDefinitions() {
    const documents = this.dbManager.readAll(this.registryCollectionName) || [];
    return documents.map((document) => AssignmentDefinition.fromJSON(document));
  }

  /**
   * Persist a definition to the JsonDb collection (upsert by definitionKey).
   * Saves both the full definition and a partial registry entry.
   * @param {AssignmentDefinition|Object} definition - The definition instance or JSON object to save.
   * @returns {AssignmentDefinition} The saved definition deserialised from persisted JSON.
   */
  saveDefinition(definition) {
    const definitionInstance =
      definition instanceof AssignmentDefinition
        ? definition
        : new AssignmentDefinition(definition);

    return this._persistDefinitionWithRollback({
      definition: definitionInstance,
      previousFullDefinition: this._getStoredFullDocument(definitionInstance.definitionKey),
    });
  }

  /**
   * Saves the partial representation of a definition to the registry collection.
   * The partial contains only essential metadata whilst tasks are stored separately.
   * @param {AssignmentDefinition|Object} definition - The definition instance or JSON object.
   * @returns {AssignmentDefinition} The definition instance deserialised from saved JSON.
   * @private
   */
  savePartialDefinition(definition) {
    const definitionInstance =
      definition instanceof AssignmentDefinition
        ? definition
        : new AssignmentDefinition(definition);
    const payload = definitionInstance.toPartialJSON();
    const collection = this._getRegistryCollection();
    const filter = { definitionKey: definitionInstance.definitionKey };
    const existing = collection.findOne(filter);

    if (existing) {
      collection.replaceOne(filter, payload);
    } else {
      collection.insertOne(payload);
    }

    collection.save();
    return AssignmentDefinition.fromJSON(payload);
  }

  /**
   * Deletes both partial and full assignment-definition records for a key.
   *
   * @param {string} definitionKey - Validated definition key.
   */
  deleteDefinitionByKey(definitionKey) {
    Validate.requireParams(
      { definitionKey },
      'AssignmentDefinitionController.deleteDefinitionByKey'
    );

    const filter = { definitionKey };
    const registry = this._getRegistryCollection();
    const fullCollectionName = this._getFullCollectionName(definitionKey);

    registry.deleteOne(filter);
    registry.save();

    this.inMemoryFullDefinitionCache.delete(definitionKey);

    try {
      this.dbManager.getDb().dropCollection(fullCollectionName);
    } catch (error) {
      if (!this._isMissingCollectionError(error)) {
        throw error;
      }
    }
  }

  /**
   * Checks if an error indicates a missing collection in JsonDb.
   *
   * @param {Error} error - Error to classify.
   * @returns {boolean} True when the target collection is already absent.
   * @private
   */
  _isMissingCollectionError(error) {
    return error?.code === 'COLLECTION_NOT_FOUND';
  }

  /**
   * Retrieves the registry collection for all definition metadata.
   *
   * @returns {Object} The JsonDb collection instance.
   * @private
   */
  _getRegistryCollection() {
    return this.dbManager.getCollection(this.registryCollectionName);
  }

  /**
   * Generates the collection name for storing a full definition.
   *
   * @param {string} definitionKey - The stable definition key.
   * @returns {string} Collection name with prefix and key.
   * @private
   */
  _getFullCollectionName(definitionKey) {
    return `${this.fullCollectionPrefix}${definitionKey}`;
  }

  /**
   * Retrieves the JsonDb collection for storing a full definition.
   *
   * @param {string} definitionKey - The stable definition key.
   * @returns {Object} The JsonDb collection instance.
   * @private
   */
  _getFullCollection(definitionKey) {
    const name = this._getFullCollectionName(definitionKey);
    return this.dbManager.getCollection(name);
  }

  /**
   * Retrieves a raw full-definition document without model hydration.
   *
   * @param {string} definitionKey - Definition key.
   * @returns {Object|null} Stored full-definition JSON or null.
   * @private
   */
  _getStoredFullDocument(definitionKey) {
    if (!definitionKey) {
      return null;
    }

    const fullCollection = this._getFullCollection(definitionKey);
    return fullCollection.findOne({ definitionKey }) || null;
  }

  /**
   * Resolves the canonical topic name from provided metadata or API.
   * Returns null if no topic is available (assignment may not have one).
   *
   * @param {Object} params - Destructured parameters.
   * @param {string} [params.primaryTopic] - Provided topic name.
   * @param {string} [params.topicId] - Topic ID to look up.
   * @param {string} [params.courseId] - Course ID for topic lookup.
   * @returns {string|null} Topic name or null if not found.
   * @private
   */
  _resolveTopicName({ primaryTopic, topicId, courseId }) {
    if (primaryTopic) return primaryTopic;
    if (!topicId) {
      return null; // An assignment may not have a topic.
    }
    if (!courseId) {
      this.progressTracker.logAndThrowError(
        'courseId is required to resolve topic name from topicId.'
      );
    }

    // fetchTopicName can return null if the topic is not found, which is a valid state.
    return ClassroomApiClient.fetchTopicName(courseId, topicId);
  }

  /**
   * Parses task definitions from reference and template documents.
   * Dispatches to type-specific parsers based on document type.
   *
   * @param {Object} params - Destructured parameters.
   * @param {string} params.documentType - Document type ('SLIDES' or 'SHEETS').
   * @param {string} params.referenceDocumentId - Reference document Google ID.
   * @param {string} params.templateDocumentId - Template document Google ID.
   * @returns {Object} Task definitions map with task ID as key.
   * @throws {Error} If document type is unknown or parsing fails.
   * @private
   */
  _parseTasks({ documentType, referenceDocumentId, templateDocumentId }) {
    const type = documentType.toUpperCase();
    if (type === 'SLIDES') {
      return this._parseSlidesTasks(referenceDocumentId, templateDocumentId);
    }
    if (type === 'SHEETS') {
      return this._parseSheetsTasks(referenceDocumentId, templateDocumentId);
    }
    this.progressTracker.logAndThrowError(
      `Unknown documentType '${documentType}' when parsing tasks.`
    );
  }

  /**
   * Parses task definitions from Google Slides documents.
   * Validates each task definition and logs errors for invalid tasks.
   *
   * @param {string} referenceDocumentId - Reference slides Google ID.
   * @param {string} templateDocumentId - Template slides Google ID.
   * @returns {Object} Map of valid task definitions indexed by task ID.
   * @private
   */
  _parseSlidesTasks(referenceDocumentId, templateDocumentId) {
    const parser = new SlidesParser();
    const definitions = parser.extractTaskDefinitions(referenceDocumentId, templateDocumentId);
    const validDefs = [];

    definitions.forEach((definition) => {
      const validation = definition.validate();
      if (!validation.ok) {
        this.progressTracker.logError('TaskDefinition missing required slide artifacts.', {
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

    return Object.fromEntries(
      validDefs.map((td) => [td.getId(), TaskDefinition.fromJSON(td.toJSON())])
    );
  }

  /**
   * Parses task definitions from Google Sheets documents.
   * Validates each task definition and logs errors for invalid tasks.
   *
   * @param {string} referenceDocumentId - Reference spreadsheet Google ID.
   * @param {string} templateDocumentId - Template spreadsheet Google ID.
   * @returns {Object} Map of valid task definitions indexed by task ID.
   * @private
   */
  _parseSheetsTasks(referenceDocumentId, templateDocumentId) {
    const parser = new SheetsParser();
    const definitions = parser.extractTaskDefinitions(referenceDocumentId, templateDocumentId);
    ABLogger.getInstance().info('Parsed sheet task definitions', { parsed: definitions.length });
    return Object.fromEntries(
      definitions.map((td) => [td.getId(), TaskDefinition.fromJSON(td.toJSON())])
    );
  }

  /**
   * Writes full-store first and registry second, then attempts rollback on registry failure.
   *
   * @param {Object} params - Persistence options.
   * @param {AssignmentDefinition|Object} params.definition - Target definition.
   * @param {AssignmentDefinition|null} [params.previousFullDefinition=null] - Existing persisted full definition.
   * @returns {AssignmentDefinition} Persisted definition.
   * @private
   */
  _persistDefinitionWithRollback({ definition, previousFullDefinition = null }) {
    const definitionInstance =
      definition instanceof AssignmentDefinition
        ? definition
        : new AssignmentDefinition(definition);

    definitionInstance.touchUpdated();

    const fullPayload = definitionInstance.toJSON();
    const partialPayload = definitionInstance.toPartialJSON();
    const filter = { definitionKey: definitionInstance.definitionKey };

    const fullCollection = this._getFullCollection(definitionInstance.definitionKey);
    const registryCollection = this._getRegistryCollection();

    try {
      if (previousFullDefinition) {
        fullCollection.replaceOne(filter, fullPayload);
      } else {
        fullCollection.insertOne(fullPayload);
      }
      fullCollection.save();
    } catch (error) {
      const wrapped = new Error(
        `Failed to persist assignment definition to full store for ${definitionInstance.definitionKey}`
      );
      wrapped.cause = error;
      throw wrapped;
    }

    const previousRegistryRecord = registryCollection.findOne(filter);

    try {
      if (previousRegistryRecord) {
        registryCollection.replaceOne(filter, partialPayload);
      } else {
        registryCollection.insertOne(partialPayload);
      }
      registryCollection.save();
    } catch (registryError) {
      try {
        this._rollbackFullStoreWrite({
          fullCollection,
          filter,
          previousFullDefinition,
        });
      } catch (rollbackError) {
        const repairError = new Error(
          'Registry write failed and rollback failed. Manual repair is required.'
        );
        repairError.cause = {
          registryError,
          rollbackError,
        };
        throw repairError;
      }

      const wrapped = new Error(
        `Failed to persist assignment definition to registry for ${definitionInstance.definitionKey}`
      );
      wrapped.cause = registryError;
      throw wrapped;
    }

    this.inMemoryFullDefinitionCache.set(definitionInstance.definitionKey, fullPayload);

    return AssignmentDefinition.fromJSON(fullPayload);
  }

  /**
   * Attempts to restore full-store state after a later write failure.
   *
   * @param {Object} params - Rollback parameters.
   * @param {Object} params.fullCollection - Full-store collection instance.
   * @param {Object} params.filter - Definition filter.
   * @param {AssignmentDefinition|null} params.previousFullDefinition - Previous definition state.
   * @private
   */
  _rollbackFullStoreWrite({ fullCollection, filter, previousFullDefinition }) {
    if (previousFullDefinition) {
      const previousPayload =
        previousFullDefinition instanceof AssignmentDefinition
          ? previousFullDefinition.toJSON()
          : previousFullDefinition;
      fullCollection.replaceOne(filter, previousPayload);
    } else {
      fullCollection.deleteOne(filter);
    }

    fullCollection.save();
  }

  /**
   * Applies existing task weightings to parsed task sets.
   *
   * @param {Object} existingTasks - Existing task map.
   * @param {Object} parsedTasks - Parsed task map.
   * @returns {Object} Parsed tasks with preserved matching weightings.
   * @private
   */
  _applyStoredWeightings(existingTasks, parsedTasks) {
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
   * Applies default task weightings to parsed tasks when missing.
   *
   * @param {Object} parsedTasks - Parsed task map.
   * @returns {Object} Parsed tasks with defaults applied.
   * @private
   */
  _defaultTaskWeightings(parsedTasks) {
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
   * @private
   */
  _applyTaskWeightings(tasks, taskWeightings) {
    if (!Array.isArray(taskWeightings)) {
      throw new TypeError('taskWeightings must be an array when provided.');
    }

    taskWeightings.forEach((patch) => {
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
        throw new TypeError('taskWeightings entries must be objects.');
      }

      const taskId = this._requireTrimmedString(patch.taskId, 'taskWeightings.taskId');

      const task = this._findTaskById(tasks, taskId);
      if (!task) {
        throw new Error(`taskWeightings contains unknown taskId: ${taskId}`);
      }

      const taskWeightingValue = Object.hasOwn(patch, 'taskWeighting') ? patch.taskWeighting : null;

      task.taskWeighting = this._requireNumericOrNullWeighting(
        taskWeightingValue,
        `taskWeightings.${taskId}.taskWeighting`
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
   * @private
   */
  _findTaskById(tasks, taskId) {
    const entries = Object.entries(tasks || {});
    const matched = entries.find(([candidateTaskId]) => candidateTaskId === taskId);
    return matched ? matched[1] : null;
  }

  /**
   * Validates that no duplicate business tuple exists in registry rows.
   *
   * @param {Object} params - Duplicate-check params.
   * @param {string|null} params.definitionKeyToIgnore - Definition key to exclude from duplicate checks.
   * @param {string} params.primaryTitle - Candidate title.
   * @param {string} params.primaryTopicKey - Candidate topic key.
   * @param {number|null} params.yearGroup - Candidate legacy year group.
   * @param {string|null} params.yearGroupKey - Candidate year-group key.
   * @private
   */
  _assertNoDuplicateBusinessTuple({
    definitionKeyToIgnore,
    primaryTitle,
    primaryTopicKey,
    yearGroup,
    yearGroupKey,
  }) {
    const rows = this.dbManager.readAll(this.registryCollectionName) || [];
    const expectedTitle = this._normaliseTitleForDuplicate(primaryTitle);

    const conflict = rows.find((row) => {
      if (!row || typeof row !== 'object') {
        return false;
      }

      if (definitionKeyToIgnore && row.definitionKey === definitionKeyToIgnore) {
        return false;
      }

      return (
        this._normaliseTitleForDuplicate(row.primaryTitle) === expectedTitle &&
        row.primaryTopicKey === primaryTopicKey &&
        (row.yearGroupKey ?? row.yearGroup ?? null) === (yearGroupKey ?? yearGroup ?? null)
      );
    });

    if (conflict) {
      throw new Error(
        `Duplicate assignment definition for tuple (${primaryTitle}, ${primaryTopicKey}, ${yearGroupKey ?? yearGroup ?? null})`
      );
    }
  }

  /**
   * Resolves and validates an assignment topic by key.
   *
   * @param {string} primaryTopicKey - Topic key.
   * @returns {{key: string, name: string}} Topic record.
   * @private
   */
  _requireExistingAssignmentTopic(primaryTopicKey) {
    const topics = this._listAssignmentTopics();
    const topicRecord = topics.find((topic) => topic?.key === primaryTopicKey) || null;

    if (!topicRecord) {
      throw new Error(`Unknown primaryTopicKey: ${primaryTopicKey}`);
    }

    return topicRecord;
  }

  /**
   * Lists assignment-topic records.
   *
   * @returns {Array<{key: string, name: string}>} Topic records.
   * @private
   */
  _listAssignmentTopics() {
    const controller = new ReferenceDataController();
    return controller.listAssignmentTopics();
  }

  /**
   * Resolves and validates a year-group record by key.
   *
   * @param {string} yearGroupKey - Year-group key.
   * @returns {{key: string, name: string, yearGroup: number|null}} Year-group record.
   * @private
   */
  _requireExistingYearGroupRecord(yearGroupKey) {
    const normalisedYearGroupKey = this._requireTrimmedString(yearGroupKey, 'yearGroupKey');
    const yearGroups = this._listYearGroups();
    const yearGroupRecord =
      yearGroups.find((yearGroup) => yearGroup?.key === normalisedYearGroupKey) || null;

    if (!yearGroupRecord) {
      throw new Error(`Unknown yearGroupKey: ${yearGroupKey}`);
    }

    return yearGroupRecord;
  }

  /**
   * Lists year-group reference records.
   *
   * @returns {Array<{key: string, name: string, yearGroup?: number}>} Year-group records.
   * @private
   */
  _listYearGroups() {
    const controller = new ReferenceDataController();
    return controller.listYearGroups();
  }

  /**
   * Maps a full assignment definition to the canonical editable transport shape.
   *
   * @param {AssignmentDefinition|Object} definition - Definition source.
   * @returns {Object} Canonical full-definition payload.
   * @private
   */
  _toCanonicalFullDefinitionResponse(definition) {
    const source = definition instanceof AssignmentDefinition ? definition.toJSON() : definition;

    const resolvedYearGroup = source.yearGroupKey
      ? this._listYearGroups().find((yearGroup) => yearGroup?.key === source.yearGroupKey) || null
      : null;

    const resolvedYearGroupLabel =
      resolvedYearGroup && typeof resolvedYearGroup.name === 'string'
        ? resolvedYearGroup.name
        : null;
    const canonicalYearGroupLabel = source.yearGroupKey
      ? resolvedYearGroupLabel
      : (source.yearGroupLabel ?? resolvedYearGroupLabel);

    const canonicalTasks = Object.entries(source.tasks || {})
      .filter(([, task]) => task && task.taskWeighting !== null && task.taskWeighting !== undefined)
      .map(([taskId, task]) => ({
        taskId,
        taskTitle: task.taskTitle,
        taskWeighting: task.taskWeighting,
      }));

    return {
      definitionKey: source.definitionKey,
      primaryTitle: source.primaryTitle,
      primaryTopicKey: source.primaryTopicKey,
      primaryTopic: source.primaryTopic,
      yearGroupKey: source.yearGroupKey ?? null,
      yearGroupLabel: canonicalYearGroupLabel,
      alternateTitles: source.alternateTitles || [],
      alternateTopics: source.alternateTopics || [],
      documentType: source.documentType,
      referenceDocumentId: source.referenceDocumentId,
      templateDocumentId: source.templateDocumentId,
      assignmentWeighting: source.assignmentWeighting,
      tasks: canonicalTasks,
      createdAt: source.createdAt || null,
      updatedAt: source.updatedAt || null,
    };
  }

  /**
   * Returns the document type used for upsert parsing.
   *
   * @param {Object} params - Resolution params.
   * @param {Object} params.payload - Upsert payload.
   * @param {Object|null} params.existingDefinition - Existing definition for updates.
   * @returns {string} Document type.
   * @private
   */
  _resolveDocumentTypeForUpsert({ payload, existingDefinition }) {
    if (this._isNonEmptyString(payload.documentType)) {
      return payload.documentType.trim().toUpperCase();
    }

    if (existingDefinition?.documentType) {
      return existingDefinition.documentType;
    }

    throw new Error('documentType must be provided for create upserts.');
  }

  /**
   * Generates a stable opaque definition key.
   *
   * @returns {string} Stable identifier.
   * @private
   */
  _generateStableDefinitionKey() {
    if (typeof Utilities === 'undefined' || typeof Utilities.getUuid !== 'function') {
      throw new TypeError('Utilities.getUuid must be available to generate definitionKey.');
    }

    const generatedDefinitionKey = Utilities.getUuid();

    if (!this._isNonEmptyString(generatedDefinitionKey)) {
      throw new TypeError('Utilities.getUuid must return a non-empty string definitionKey.');
    }

    return generatedDefinitionKey.trim();
  }

  /**
   * Validates weighting values for assignment and task contracts.
   *
   * @param {*} value - Candidate weighting.
   * @param {string} fieldName - Field label for diagnostics.
   * @returns {number|null} Validated weighting.
   * @private
   */
  _requireNumericOrNullWeighting(value, fieldName) {
    if (value === null) {
      return null;
    }

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new TypeError(`${fieldName} must be a number or null.`);
    }

    if (value < MIN_WEIGHTING) {
      throw new RangeError(`${fieldName} must be between ${MIN_WEIGHTING} and ${MAX_WEIGHTING}.`);
    }

    if (value > MAX_WEIGHTING) {
      throw new RangeError(`${fieldName} must be between ${MIN_WEIGHTING} and ${MAX_WEIGHTING}.`);
    }

    return value;
  }

  /**
   * Returns whether the value is a non-empty string after trim.
   *
   * @param {*} value - Value to check.
   * @returns {boolean} True when non-empty trimmed string.
   * @private
   */
  _isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
  }

  /**
   * Requires a non-empty string and returns trimmed value.
   *
   * @param {*} value - Candidate value.
   * @param {string} fieldName - Field for diagnostics.
   * @returns {string} Trimmed string.
   * @private
   */
  _requireTrimmedString(value, fieldName) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`${fieldName} must be a non-empty string.`);
    }

    return value.trim();
  }

  /**
   * Normalises duplicate-check title format.
   *
   * @param {string} title - Candidate title.
   * @returns {string} Normalised title.
   * @private
   */
  _normaliseTitleForDuplicate(title) {
    return String(title || '')
      .trim()
      .toLowerCase();
  }

  /**
   * Normalises year-group payload values.
   *
   * @param {*} yearGroup - Candidate year group.
   * @returns {number|null} Normalised value.
   * @private
   */
  _normaliseYearGroup(yearGroup) {
    if (yearGroup === null || yearGroup === undefined) {
      return null;
    }

    if (!Number.isInteger(yearGroup)) {
      throw new TypeError('yearGroup must be an integer or null.');
    }

    return yearGroup;
  }

  /**
   * Normalises alternate titles payload.
   *
   * @param {*} alternateTitles - Candidate title list.
   * @returns {Array<string>} Normalised title list.
   * @private
   */
  _normaliseAlternateTitles(alternateTitles) {
    if (alternateTitles === undefined || alternateTitles === null) {
      return [];
    }

    if (!Array.isArray(alternateTitles)) {
      throw new TypeError('alternateTitles must be an array when provided.');
    }

    return alternateTitles.map((title, index) => {
      if (typeof title !== 'string' || title.trim().length === 0) {
        throw new Error(`alternateTitles[${index}] must be a non-empty string.`);
      }
      return title.trim();
    });
  }
}

// Export for Node tests / CommonJS environments
if (typeof module !== 'undefined') {
  module.exports = AssignmentDefinitionController;
}
