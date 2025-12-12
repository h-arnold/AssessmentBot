class AssignmentDefinitionController {
  constructor() {
    this.dbManager = DbManager.getInstance();
    this.progressTracker = ProgressTracker.getInstance();
    this.registryCollectionName = 'assignment_definitions';
    this.fullCollectionPrefix = 'assdef_full_';
  }

  /**
   * Ensure an AssignmentDefinition exists and is fresh for the provided identifiers.
   * Parses documents when missing or stale and persists immediately.
   * @param {Object} params
   * @param {string} params.primaryTitle
   * @param {string|null} [params.primaryTopic]
   * @param {string|null} [params.topicId]
   * @param {string|null} [params.courseId]
   * @param {number|null} [params.yearGroup]
   * @param {string} params.documentType - 'SLIDES' | 'SHEETS'
   * @param {string} params.referenceDocumentId
   * @param {string} params.templateDocumentId
   * @return {AssignmentDefinition}
   */
  ensureDefinition({
    primaryTitle,
    primaryTopic = null,
    topicId = null,
    courseId = null,
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
   * @param {string} definitionKey
   * @param {Object} [options]
   * @param {'full'|'partial'} [options.form='full'] - Which store to query.
   * @return {AssignmentDefinition|null}
   */
  getDefinitionByKey(definitionKey, options = {}) {
    const { form = 'full' } = options;
    if (!definitionKey) return null;

    if (form === 'partial') {
      const registry = this._getRegistryCollection();
      const doc = registry.findOne({ definitionKey }) || null;
      if (!doc) return null;
      return AssignmentDefinition.fromJSON(doc);
    }

    const fullCollection = this._getFullCollection(definitionKey);
    const fullDoc = fullCollection.findOne({ definitionKey }) || null;
    if (!fullDoc) return null;
    return AssignmentDefinition.fromJSON(fullDoc);
  }

  /**
   * Persist a definition to the JsonDb collection (upsert by definitionKey).
   * @param {AssignmentDefinition|Object} definition
   * @return {AssignmentDefinition}
   */
  saveDefinition(definition) {
    const defInstance =
      definition instanceof AssignmentDefinition
        ? definition
        : new AssignmentDefinition(definition);
    defInstance.touchUpdated();
    const fullPayload = defInstance.toJSON();
    const fullCollection = this._getFullCollection(defInstance.definitionKey);
    const filter = { definitionKey: defInstance.definitionKey };
    const existingFull = fullCollection.findOne(filter);

    if (existingFull) {
      fullCollection.replaceOne(filter, fullPayload);
    } else {
      fullCollection.insertOne(fullPayload);
    }

    fullCollection.save();

    this.savePartialDefinition(defInstance);

    return AssignmentDefinition.fromJSON(fullPayload);
  }

  savePartialDefinition(definition) {
    const defInstance =
      definition instanceof AssignmentDefinition
        ? definition
        : new AssignmentDefinition(definition);
    const payload = defInstance.toPartialJSON();
    const collection = this._getRegistryCollection();
    const filter = { definitionKey: defInstance.definitionKey };
    const existing = collection.findOne(filter);

    if (existing) {
      collection.replaceOne(filter, payload);
    } else {
      collection.insertOne(payload);
    }

    collection.save();
    return AssignmentDefinition.fromJSON(payload);
  }

  _getRegistryCollection() {
    return this.dbManager.getCollection(this.registryCollectionName);
  }

  _getFullCollectionName(definitionKey) {
    return `${this.fullCollectionPrefix}${definitionKey}`;
  }

  _getFullCollection(definitionKey) {
    const name = this._getFullCollectionName(definitionKey);
    return this.dbManager.getCollection(name);
  }

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

    return Object.fromEntries(validDefs.map((td) => [td.getId(), td]));
  }

  _parseSheetsTasks(referenceDocumentId, templateDocumentId) {
    const parser = new SheetsParser();
    const definitions = parser.extractTaskDefinitions(referenceDocumentId, templateDocumentId);
    ABLogger.getInstance().info('Parsed sheet task definitions', { parsed: definitions.length });
    return Object.fromEntries(definitions.map((td) => [td.getId(), td]));
  }
}

// Export for Node tests / CommonJS environments
if (typeof module !== 'undefined') {
  module.exports = AssignmentDefinitionController;
}
