/* global ABLogger, ABClassMetadata, ArrayUtils */

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
    const prepared = this._prepareClassAndPartial(abClass);
    const logger = ABLogger.getInstance();
    const collectionName = String(abClass.classId);
    const collection = this._dbManager.getCollection(collectionName);

    // Write the full class document first so partials are never visible
    // without a corresponding authoritative class record.
    try {
      const existing = collection.findOne({ classId: abClass.classId });

      if (existing) {
        collection.replaceOne({ classId: abClass.classId }, prepared.fullData);
      } else {
        collection.insertOne(prepared.fullData);
      }

      collection.save();
    } catch (error) {
      logger.error('persistClassAndPartial: class collection write failed', {
        classId: abClass.classId,
        err: error,
      });
      throw error;
    }

    this._writePreparedClassPartial(abClass.classId, prepared.partialData);
  }

  /**
   * Prepares independent full and partial copies before either store is mutated.
   * Metadata is canonicalised through its domain constructor; the caller and its
   * serializer outputs are never modified. There is deliberately no transaction.
   * @param {ABClass|Object} abClass - Class model or supported plain-object input.
   * @returns {{fullData: Object, partialData: Object}} Prepared persistence documents.
   * @private
   */
  _prepareClassAndPartial(abClass) {
    const fullSource = typeof abClass.toJSON === 'function' ? abClass.toJSON() : abClass;
    this._validateFullProjection(abClass, fullSource);
    const partialData = this._prepareClassPartial(abClass);
    return {
      fullData: { ...fullSource, metadata: this._metadataCopy(abClass) },
      partialData,
    };
  }

  /**
   * Creates an independently-owned authoritative metadata snapshot from input.
   * @param {ABClass|Object} abClass - Class model or plain object.
   * @returns {Object|null} Defensive metadata snapshot.
   * @private
   */
  _metadataCopy(abClass) {
    return Object.hasOwn(abClass, 'metadata')
      ? new ABClassMetadata(abClass.metadata).toJSON()
      : new ABClassMetadata().toJSON();
  }

  /**
   * Validates the full serializer's metadata against caller-owned authoritative state.
   * @param {ABClass|Object} abClass - Source class.
   * @param {Object} fullSource - Full serializer output.
   * @returns {void}
   * @private
   */
  _validateFullProjection(abClass, fullSource) {
    const metadata = this._metadataCopy(abClass);
    this._validatePreparedMetadata(fullSource, metadata, 'full');
  }

  /**
   * Prepares a complete partial projection and checks any supplied metadata.
   * @param {ABClass|Object} abClass - Source class.
   * @returns {Object} Independent complete partial payload.
   * @private
   */
  _prepareClassPartial(abClass) {
    const partialSource = abClass.toPartialJSON();
    const metadata = this._metadataCopy(abClass);
    this._validatePreparedMetadata(partialSource, metadata, 'partial');
    return { ...partialSource, metadata: new ABClassMetadata(metadata).toJSON() };
  }

  /**
   * Validates metadata emitted by a projection when it is present.
   * @param {Object} projection - Full or partial serializer result.
   * @param {Object|null} metadata - Authoritative caller snapshot.
   * @param {string} projectionName - Projection name for diagnostics.
   * @returns {void}
   * @private
   */
  _validatePreparedMetadata(projection, metadata, projectionName) {
    if (!Object.hasOwn(projection, 'metadata')) return;
    const projectedMetadata = new ABClassMetadata(projection.metadata).toJSON();
    if (JSON.stringify(projectedMetadata) !== JSON.stringify(metadata)) {
      throw new TypeError(`ABClassPersistence: ${projectionName} metadata differs from source`);
    }
  }

  /**
   * Builds only the owned fields for an existing registry-row roster patch.
   * It intentionally does not read the existing row's metadata or other fields.
   * @param {Object} existingPartial - Lookup result; only its stored _id is used.
   * @param {ABClass} abClass - Refreshed class model.
   * @returns {{kind: string, id: string, patch: Object}|{kind: string, partialData: Object}} The prepared registry operation.
   * @private
   */
  _prepareRosterPartial(existingPartial, abClass) {
    if (existingPartial) {
      if (!Object.hasOwn(existingPartial, '_id') || existingPartial._id == null) {
        throw new TypeError('ABClassPersistence: existing partial row is missing stored _id');
      }
      return {
        kind: 'update',
        id: existingPartial._id,
        patch: {
          className: abClass.className ?? null,
          classOwner: abClass.serialiseOwner(abClass.classOwner),
          teachers: ArrayUtils.serialiseArray(abClass.teachers),
        },
      };
    }

    return {
      kind: 'insert',
      partialData: this._prepareClassPartial(abClass),
    };
  }

  /**
   * Writes a preflighted roster patch or complete missing-row projection.
   * @param {{kind: string, id?: string, patch?: Object, partialData?: Object}} prepared - Prepared operation.
   * @param {string} classId - Class identifier for diagnostics.
   * @returns {void}
   * @private
   */
  _writePreparedRosterPartial(prepared, classId) {
    const logger = ABLogger.getInstance();
    const partialsCollection = this._dbManager.getCollection('abclass_partials');
    if (prepared.kind === 'update') {
      const result = partialsCollection.updateOne({ _id: prepared.id }, { $set: prepared.patch });
      if (result.matchedCount === 0) {
        throw new Error(`_persistRoster: partial update matched no row for classId=${classId}`);
      }
    } else {
      partialsCollection.insertOne(prepared.partialData);
    }
    partialsCollection.save();
    logger.info('_persistRoster: partial roster persisted', { classId, kind: prepared.kind });
  }

  /**
   * Upserts the class partial document to the abclass_partials collection.
   * @param {ABClass|Object} abClass - An ABClass instance or plain object with
   *   a `classId` property and a `toPartialJSON()` method.
   * @throws {Error} Rethrows any persistence error.
   */
  _upsertClassPartial(abClass) {
    const partialData = this._prepareClassPartial(abClass);
    this._writePreparedClassPartial(abClass.classId, partialData);
  }

  /**
   * Persists an already prepared partial projection without re-projecting the model.
   * @param {string} classId - Owning class ID for lookup and diagnostics.
   * @param {Object} partialData - Complete prepared partial document.
   * @returns {void}
   * @private
   */
  _writePreparedClassPartial(classId, partialData) {
    const logger = ABLogger.getInstance();
    const partialsCollection = this._dbManager.getCollection('abclass_partials');
    try {
      const existingPartial = partialsCollection.findOne({ classId });
      if (existingPartial) {
        partialsCollection.replaceOne({ classId }, partialData);
      } else {
        partialsCollection.insertOne(partialData);
      }
      partialsCollection.save();
      logger.info('_writePreparedClassPartial: partial persisted', { classId });
    } catch (error) {
      logger.error('_writePreparedClassPartial: partials collection write failed', {
        classId,
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
