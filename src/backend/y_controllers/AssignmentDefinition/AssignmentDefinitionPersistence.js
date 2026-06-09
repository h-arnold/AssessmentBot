/**
 * AssignmentDefinitionPersistence
 *
 * Handles persistence operations for assignment definitions:
 * retrieval, listing, deletion, and dual-store persistence with rollback.
 */
class AssignmentDefinitionPersistence {
  /**
   * Creates the instance with injected dependencies.
   * @param {Object} deps - Dependency injection.
   * @param {Object} deps.dbManager - Database manager instance.
   * @param {Map} deps.cache - In-memory cache for full definitions.
   * @param {Object} deps.validation - AssignmentDefinitionValidation instance.
   */
  constructor({ dbManager, cache, validation } = {}) {
    this.dbManager = dbManager;
    this.cache = cache;
    this.validation = validation;
    this.registryCollectionName = 'assignment_definitions';
    this.fullCollectionPrefix = 'assdef_full_';
  }

  /**
   * Creates the instance with injected dependencies.
   * Retrieve a definition by its stable definition key.
   * Returns the full definition if available, or a partial metadata entry from the registry.
   *
   * @param {string} definitionKey - The stable definition key.
   * @param {Object} [options] - Retrieval options.
   * @param {'full'|'partial'} [options.form='full'] - Which store to query.
   * @returns {AssignmentDefinition|null} The definition instance, or null if not found.
   */
  getByKey(definitionKey, options = {}) {
    /* global Validate, AssignmentDefinition */
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
      fullCollection.findOne({ definitionKey }) || this.cache.get(definitionKey) || null;
    if (!fullDocument) return null;

    return AssignmentDefinition.fromJSON(fullDocument);
  }

  /**
   * Creates the instance with injected dependencies.
   * Return all partial assignment definitions from the registry as model instances.
   * Partial definitions contain essential metadata only; tasks are stored separately in full definitions.
   *
   * @returns {Array<AssignmentDefinition>} Array of all partial definitions in the registry.
   */
  getAllPartials() {
    /* global AssignmentDefinition */
    const documents = this.dbManager.readAll(this.registryCollectionName) || [];
    return documents.map((document) => AssignmentDefinition.fromJSON(document));
  }

  /**
   * Creates the instance with injected dependencies.
   * Deletes both partial and full assignment-definition records for a key.
   *
   * @param {string} definitionKey - Validated definition key.
   */
  delete(definitionKey) {
    /* global Validate */
    Validate.requireParams(
      { definitionKey },
      'AssignmentDefinitionController.deleteDefinitionByKey'
    );

    const filter = { definitionKey };
    const registry = this._getRegistryCollection();
    const fullCollectionName = this._getFullCollectionName(definitionKey);

    registry.deleteOne(filter);
    registry.save();

    this.cache.delete(definitionKey);

    try {
      this.dbManager.getDb().dropCollection(fullCollectionName);
    } catch (error) {
      if (!this._isMissingCollectionError(error)) {
        throw error;
      }
    }
  }

  /**
   * Creates the instance with injected dependencies.
   * Writes full-store first and registry second, then attempts rollback on registry failure.
   *
   * @param {Object} params - Persistence options.
   * @param {Object} params.definition - Target definition.
   * @param {Object|null} [params.previousFullDefinition=null] - Existing persisted full definition.
   * @returns {AssignmentDefinition} Persisted definition.
   */
  _persistDefinitionWithRollback({ definition, previousFullDefinition = null }) {
    /* global AssignmentDefinition */
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

    this.cache.set(definitionInstance.definitionKey, fullPayload);

    return AssignmentDefinition.fromJSON(fullPayload);
  }

  /**
   * Creates the instance with injected dependencies.
   * Attempts to restore full-store state after a later write failure.
   *
   * @param {Object} params - Rollback parameters.
   * @param {Object} params.fullCollection - Full-store collection instance.
   * @param {Object} params.filter - Definition filter.
   * @param {Object|null} params.previousFullDefinition - Previous definition state.
   * @private
   */
  _rollbackFullStoreWrite({ fullCollection, filter, previousFullDefinition }) {
    /* global AssignmentDefinition */
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
   * Creates the instance with injected dependencies.
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
   * Creates the instance with injected dependencies.
   * Retrieves the registry collection for all definition metadata.
   *
   * @returns {Object} The JsonDb collection instance.
   * @private
   */
  _getRegistryCollection() {
    return this.dbManager.getCollection(this.registryCollectionName);
  }

  /**
   * Creates the instance with injected dependencies.
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
   * Creates the instance with injected dependencies.
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
   * Creates the instance with injected dependencies.
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
}

// Export for Node tests / CommonJS environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AssignmentDefinitionPersistence;
}
