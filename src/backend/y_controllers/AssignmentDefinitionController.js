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

    let definition = this.getDefinitionByKey(definitionKey, { form: 'full' });

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
   * Retrieve a definition by its composite key.
   * Returns the full definition if available, or a partial metadata entry from the registry.
   * @param {string} definitionKey - The composite definition key.
   * @param {Object} [options] - Retrieval options.
   * @param {'full'|'partial'} [options.form='full'] - Which store to query.
   * @returns {AssignmentDefinition|null} The definition instance, or null if not found.
   */
  getDefinitionByKey(definitionKey, options = {}) {
    const { form = 'full' } = options;
    if (!definitionKey) return null;

    if (form === 'partial') {
      const registry = this._getRegistryCollection();
      const document = registry.findOne({ definitionKey }) || null;
      if (!document) return null;
      return AssignmentDefinition.fromJSON(document);
    }

    const fullCollection = this._getFullCollection(definitionKey);
    const fullDocument = fullCollection.findOne({ definitionKey }) || null;
    if (!fullDocument) return null;
    return AssignmentDefinition.fromJSON(fullDocument);
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
    definitionInstance.touchUpdated();
    const fullPayload = definitionInstance.toJSON();
    const fullCollection = this._getFullCollection(definitionInstance.definitionKey);
    const filter = { definitionKey: definitionInstance.definitionKey };
    const existingFull = fullCollection.findOne(filter);

    if (existingFull) {
      fullCollection.replaceOne(filter, fullPayload);
    } else {
      fullCollection.insertOne(fullPayload);
    }

    fullCollection.save();

    this.savePartialDefinition(definitionInstance);

    return AssignmentDefinition.fromJSON(fullPayload);
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
   * @param {string} definitionKey - The definition composite key.
   * @returns {string} Collection name with prefix and key.
   * @private
   */
  _getFullCollectionName(definitionKey) {
    return `${this.fullCollectionPrefix}${definitionKey}`;
  }

  /**
   * Retrieves the JsonDb collection for storing a full definition.
   *
   * @param {string} definitionKey - The definition composite key.
   * @returns {Object} The JsonDb collection instance.
   * @private
   */
  _getFullCollection(definitionKey) {
    const name = this._getFullCollectionName(definitionKey);
    return this.dbManager.getCollection(name);
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
}

// Export for Node tests / CommonJS environments
if (typeof module !== 'undefined') {
  module.exports = AssignmentDefinitionController;
}
