/* global ABLogger */

/**
 * ABClassPersistence
 *
 * Write-through persistence for full class documents and the partials registry.
 * Depends on DbManager (stored as this._dbManager) for collection access.
 */
class ABClassPersistence {
  /**
   * Constructs ABClassPersistence.
   * @param {Object} options - Options object.
   * @param {Object} options.dbManager - The DbManager instance for collection access.
   * @param {Object} options.validation - An ABClassValidation instance.
   */
  constructor({ dbManager, validation }) {
    this._dbManager = dbManager;
    this._validation = validation;
  }

  /**
   * Write-through persistence: saves the full class document to its own collection
   * and upserts a partial summary document to the partials registry.
   * @param {ABClass|Object} abClass - The class instance or plain object to persist.
   * @returns {void}
   * @throws {Error} Rethrows any persistence error from either collection.
   */
  persistClassAndPartial(abClass) {
    const logger = ABLogger.getInstance();
    const collectionName = String(abClass.classId);
    const collection = this._dbManager.getCollection(collectionName);

    // Write the full class document first so partials are never visible
    // without a corresponding authoritative class record.
    try {
      const existing = collection.findOne({ classId: abClass.classId });

      if (existing) {
        collection.replaceOne({ classId: abClass.classId }, abClass);
      } else {
        collection.insertOne(abClass);
      }

      collection.save();
    } catch (error) {
      logger.error('_persistClassAndPartial: class collection write failed', {
        classId: abClass.classId,
        err: error,
      });
      throw error;
    }

    this._upsertClassPartial(abClass);
  }

  /**
   * Upserts the class partial document to the abclass_partials collection.
   * @param {ABClass|Object} abClass - An ABClass instance or plain object with
   *   a `classId` property and a `toPartialJSON()` method.
   * @throws {Error} Rethrows any persistence error.
   */
  _upsertClassPartial(abClass) {
    const logger = ABLogger.getInstance();
    const partialsCollection = this._dbManager.getCollection('abclass_partials');
    try {
      const partialData = abClass.toPartialJSON();
      const existingPartial = partialsCollection.findOne({ classId: abClass.classId });
      if (existingPartial) {
        partialsCollection.replaceOne({ classId: abClass.classId }, partialData);
      } else {
        partialsCollection.insertOne(partialData);
      }
      partialsCollection.save();
      logger.info('_upsertClassPartial: partial persisted', { classId: abClass.classId });
    } catch (error) {
      logger.error('_upsertClassPartial: partials collection write failed', {
        classId: abClass.classId,
        err: error,
      });
      throw error;
    }
  }
}

// Export for Node tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ABClassPersistence;
}
