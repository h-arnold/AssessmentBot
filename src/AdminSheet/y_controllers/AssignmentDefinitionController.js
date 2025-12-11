class AssignmentDefinitionController {
  constructor() {
    this.dbManager = DbManager.getInstance();
    this.progressTracker = ProgressTracker.getInstance();
    this.collectionName = 'assignment_definitions';
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

    const canonicalTopic = this._resolveTopicName({ primaryTopic, topicId, courseId });
    const definitionKey = AssignmentDefinition.buildDefinitionKey({
      primaryTitle,
      primaryTopic: canonicalTopic,
      yearGroup,
    });

    const referenceLastModified = DriveManager.getFileModifiedTime(referenceDocumentId);
    const templateLastModified = DriveManager.getFileModifiedTime(templateDocumentId);

    let definition = this.getDefinitionByKey(definitionKey);

    const needsRefresh = this._needsRefresh(
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
      if (!definition.definitionKey) {
        definition.definitionKey = definitionKey;
      }
      this.saveDefinition(definition);
      return definition;
    }

    // Ensure persisted metadata stays aligned when timestamps were absent but no refresh required
    if (!definition.referenceLastModified || !definition.templateLastModified) {
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
   * @return {AssignmentDefinition|null}
   */
  getDefinitionByKey(definitionKey) {
    const collection = this._getCollection();
    const doc = collection.findOne({ definitionKey }) || null;
    if (!doc) return null;
    return AssignmentDefinition.fromJSON(doc);
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
    const payload = defInstance.toJSON();
    const collection = this._getCollection();
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

  _getCollection() {
    return this.dbManager.getCollection(this.collectionName);
  }

  _needsRefresh(definition, referenceLastModified, templateLastModified) {
    if (!definition) return true;
    const tasksMissing = !definition.tasks || Object.keys(definition.tasks).length === 0;
    const missingTimestamps = !definition.referenceLastModified || !definition.templateLastModified;
    if (tasksMissing || missingTimestamps) return true;

    const referenceIsNewer = this._isNewer(referenceLastModified, definition.referenceLastModified);
    const templateIsNewer = this._isNewer(templateLastModified, definition.templateLastModified);
    return referenceIsNewer || templateIsNewer;
  }

  _isNewer(fresh, stored) {
    if (!fresh || !stored) return false;
    const freshDate = new Date(fresh);
    const storedDate = new Date(stored);
    if (Number.isNaN(freshDate.getTime()) || Number.isNaN(storedDate.getTime())) return false;
    return freshDate.getTime() > storedDate.getTime();
  }

  _resolveTopicName({ primaryTopic, topicId, courseId }) {
    if (primaryTopic) return primaryTopic;
    if (!topicId) {
      this.progressTracker.logAndThrowError(
        'primaryTopic or topicId must be provided to resolve topic.'
      );
    }
    if (!courseId) {
      this.progressTracker.logAndThrowError(
        'courseId is required to resolve topic name from topicId.'
      );
    }

    const topicName = ClassroomApiClient.fetchTopicName(courseId, topicId);
    if (!topicName) {
      this.progressTracker.logAndThrowError(
        'Failed to resolve topic name from Classroom Topics API.'
      );
    }
    return topicName;
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
