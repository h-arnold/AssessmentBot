/**
 * Persistence helper functions for AssignmentDefinitionController.
 * Concatenated before the main controller file in GAS runtime.
 * Contains collection management, persist/rollback, and save/load/delete operations.
 */

/**
 * Retrieves the registry collection for all definition metadata.
 *
 * @param {Object} databaseManager - DbManager singleton instance.

 * @param {string} registryCollectionName - Registry collection name.
 * @returns {Object} The JsonDb collection instance.
 */
function _getRegistryCollection(databaseManager, registryCollectionName) {
  return databaseManager.getCollection(registryCollectionName);
}

/**
 * Generates the collection name for storing a full definition.
 *
 * @param {string} fullCollectionPrefix - Collection name prefix.
 * @param {string} definitionKey - The stable definition key.
 * @returns {string} Collection name with prefix and key.
 */
function _getFullCollectionName(fullCollectionPrefix, definitionKey) {
  return fullCollectionPrefix + definitionKey;
}

/**
 * Retrieves the JsonDb collection for storing a full definition.
 *
 * @param {Object} databaseManager - DbManager singleton instance.

 * @param {string} fullCollectionPrefix - Collection name prefix.
 * @param {string} definitionKey - The stable definition key.
 * @returns {Object} The JsonDb collection instance.
 */
function _getFullCollection(databaseManager, fullCollectionPrefix, definitionKey) {
  var name = _getFullCollectionName(fullCollectionPrefix, definitionKey);
  return databaseManager.getCollection(name);
}

/**
 * Retrieves a raw full-definition document without model hydration.
 *
 * @param {Object} databaseManager - DbManager singleton instance.

 * @param {string} fullCollectionPrefix - Collection name prefix.
 * @param {string} definitionKey - Definition key.
 * @returns {Object|null} Stored full-definition JSON or null.
 */
function _getStoredFullDocument(databaseManager, fullCollectionPrefix, definitionKey) {
  if (!definitionKey) {
    return null;
  }

  var fullCollection = _getFullCollection(databaseManager, fullCollectionPrefix, definitionKey);
  return fullCollection.findOne({ definitionKey: definitionKey }) || null;
}

/**
 * Checks if an error indicates a missing collection in JsonDb.
 *
 * @param {Error} error - Error to classify.
 * @returns {boolean} True when the target collection is already absent.
 */
function _isMissingCollectionError(error) {
  return !!(error && error.code === 'COLLECTION_NOT_FOUND');
}

/**
 * Writes full-store first and registry second, then attempts rollback on registry failure.
 *
 * @param {Object} parameters - Persistence options.
 * @param {Object} parameters.databaseManager - DbManager singleton instance.
 * @param {string} parameters.registryCollectionName - Registry collection name.
 * @param {string} parameters.fullCollectionPrefix - Full collection prefix.
 * @param {Object} parameters.inMemoryFullDefinitionCache - In-memory cache Map.
 * @param {AssignmentDefinition|Object} parameters.definition - Target definition.
 * @param {AssignmentDefinition|null} parameters.previousFullDefinition - Existing persisted full definition.
 * @returns {AssignmentDefinition} Persisted definition.
 */
function _persistDefinitionWithRollback(parameters) {
  var databaseManager = parameters.dbManager;
  var registryCollectionName = parameters.registryCollectionName;
  var fullCollectionPrefix = parameters.fullCollectionPrefix;
  var inMemoryFullDefinitionCache = parameters.inMemoryFullDefinitionCache;
  var definition = parameters.definition;
  var previousFullDefinition = parameters.previousFullDefinition || null;

  var definitionInstance =
    definition instanceof AssignmentDefinition ? definition : new AssignmentDefinition(definition);

  definitionInstance.touchUpdated();

  var fullPayload = definitionInstance.toJSON();
  var partialPayload = definitionInstance.toPartialJSON();
  var filter = { definitionKey: definitionInstance.definitionKey };

  var fullCollection = _getFullCollection(
    databaseManager,
    fullCollectionPrefix,
    definitionInstance.definitionKey
  );
  var registryCollection = _getRegistryCollection(databaseManager, registryCollectionName);

  try {
    if (previousFullDefinition) {
      fullCollection.replaceOne(filter, fullPayload);
    } else {
      fullCollection.insertOne(fullPayload);
    }
    fullCollection.save();
  } catch (error) {
    var wrapped = new Error(
      'Failed to persist assignment definition to full store for ' +
        definitionInstance.definitionKey
    );
    wrapped.cause = error;
    throw wrapped;
  }

  var previousRegistryRecord = registryCollection.findOne(filter);

  try {
    if (previousRegistryRecord) {
      registryCollection.replaceOne(filter, partialPayload);
    } else {
      registryCollection.insertOne(partialPayload);
    }
    registryCollection.save();
  } catch (registryError) {
    try {
      _rollbackFullStoreWrite({
        fullCollection: fullCollection,
        filter: filter,
        previousFullDefinition: previousFullDefinition,
      });
    } catch (rollbackError) {
      var repairError = new Error(
        'Registry write failed and rollback failed. Manual repair is required.'
      );
      repairError.cause = {
        registryError: registryError,
        rollbackError: rollbackError,
      };
      throw repairError;
    }

    var wrapped2 = new Error(
      'Failed to persist assignment definition to registry for ' + definitionInstance.definitionKey
    );
    wrapped2.cause = registryError;
    throw wrapped2;
  }

  inMemoryFullDefinitionCache.set(definitionInstance.definitionKey, fullPayload);

  return AssignmentDefinition.fromJSON(fullPayload);
}

/**
 * Attempts to restore full-store state after a later write failure.
 *
 * @param {Object} parameters - Rollback parameters.
 * @param {Object} parameters.fullCollection - Full-store collection instance.
 * @param {Object} parameters.filter - Definition filter.
 * @param {AssignmentDefinition|null} parameters.previousFullDefinition - Previous definition state.
 */
function _rollbackFullStoreWrite(parameters) {
  var fullCollection = parameters.fullCollection;
  var filter = parameters.filter;
  var previousFullDefinition = parameters.previousFullDefinition;

  if (previousFullDefinition) {
    var previousPayload =
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
 * Saves the partial representation of a definition to the registry collection.
 * The partial contains only essential metadata whilst tasks are stored separately.
 *
 * @param {Object} databaseManager - DbManager singleton instance.

 * @param {string} registryCollectionName - Registry collection name.
 * @param {AssignmentDefinition|Object} definition - The definition instance or JSON object.
 * @returns {AssignmentDefinition} The definition instance deserialised from saved JSON.
 */
function savePartialDefinition(databaseManager, registryCollectionName, definition) {
  var definitionInstance =
    definition instanceof AssignmentDefinition ? definition : new AssignmentDefinition(definition);
  var payload = definitionInstance.toPartialJSON();
  var collection = _getRegistryCollection(databaseManager, registryCollectionName);
  var filter = { definitionKey: definitionInstance.definitionKey };
  var existing = collection.findOne(filter);

  if (existing) {
    collection.replaceOne(filter, payload);
  } else {
    collection.insertOne(payload);
  }

  collection.save();
  return AssignmentDefinition.fromJSON(payload);
}

// Export for Node tests / CommonJS environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    _getRegistryCollection: _getRegistryCollection,
    _getFullCollectionName: _getFullCollectionName,
    _getFullCollection: _getFullCollection,
    _getStoredFullDocument: _getStoredFullDocument,
    _isMissingCollectionError: _isMissingCollectionError,
    _persistDefinitionWithRollback: _persistDefinitionWithRollback,
    _rollbackFullStoreWrite: _rollbackFullStoreWrite,
    savePartialDefinition: savePartialDefinition,
  };
}
