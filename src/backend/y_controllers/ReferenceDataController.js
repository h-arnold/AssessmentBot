/* global Cohort, DbManager, Validate, YearGroup */

/**
 * ReferenceDataController
 *
 * Persists cohort and year-group reference data in dedicated JsonDbApp
 * collections with shared CRUD helpers.
 */
class ReferenceDataController {
  /**
   * Create the controller.
   */
  constructor() {
    this.dbManager = DbManager.getInstance();
  }

  /**
   * @returns {Array<{name: string, active: boolean}>}
   */
  listCohorts() {
    return this._listRecords(this._getConfig('cohort'));
  }

  /**
   * @param {{name: string, active?: boolean}} record
   * @returns {{name: string, active: boolean}}
   */
  createCohort(record) {
    Validate.requireParams({ record }, 'ReferenceDataController.createCohort');
    return this._createRecord(this._getConfig('cohort'), record);
  }

  /**
   * @param {{originalName: string, record: {name: string, active?: boolean}}} payload
   * @returns {{name: string, active: boolean}}
   */
  updateCohort(payload) {
    Validate.requireParams({ payload }, 'ReferenceDataController.updateCohort');
    const { originalName, record } = payload;
    Validate.requireParams({ originalName, record }, 'ReferenceDataController.updateCohort');
    return this._updateRecord(this._getConfig('cohort'), originalName, record);
  }

  /**
   * @param {string} name
   */
  deleteCohort(name) {
    Validate.requireParams({ name }, 'ReferenceDataController.deleteCohort');
    this._deleteRecord(this._getConfig('cohort'), name);
  }

  /**
   * @returns {Array<{name: string}>}
   */
  listYearGroups() {
    return this._listRecords(this._getConfig('yearGroup'));
  }

  /**
   * @param {{name: string}} record
   * @returns {{name: string}}
   */
  createYearGroup(record) {
    Validate.requireParams({ record }, 'ReferenceDataController.createYearGroup');
    return this._createRecord(this._getConfig('yearGroup'), record);
  }

  /**
   * @param {{originalName: string, record: {name: string}}} payload
   * @returns {{name: string}}
   */
  updateYearGroup(payload) {
    Validate.requireParams({ payload }, 'ReferenceDataController.updateYearGroup');
    const { originalName, record } = payload;
    Validate.requireParams({ originalName, record }, 'ReferenceDataController.updateYearGroup');
    return this._updateRecord(this._getConfig('yearGroup'), originalName, record);
  }

  /**
   * @param {string} name
   */
  deleteYearGroup(name) {
    Validate.requireParams({ name }, 'ReferenceDataController.deleteYearGroup');
    this._deleteRecord(this._getConfig('yearGroup'), name);
  }

  /**
   * @param {'cohort'|'yearGroup'} resourceType
   * @returns {{collectionName: string, modelClass: Function}}
   */
  _getConfig(resourceType) {
    if (resourceType === 'cohort') {
      return {
        collectionName: 'cohorts',
        modelClass: Cohort,
      };
    }

    if (resourceType === 'yearGroup') {
      return {
        collectionName: 'year_groups',
        modelClass: YearGroup,
      };
    }

    throw new Error(`Unsupported reference-data resource: ${resourceType}`);
  }

  /**
   * @param {{collectionName: string, modelClass: Function}} config
   * @returns {Array<object>}
   */
  _listRecords(config) {
    const collection = this.dbManager.getCollection(config.collectionName);
    const records = collection.find({});

    return this._sortRecordsByName(records.map((record) => this._toPlainObject(record)));
  }

  /**
   * @param {{collectionName: string, modelClass: Function}} config
   * @param {object} record
   * @returns {object}
   */
  _createRecord(config, record) {
    const collection = this.dbManager.getCollection(config.collectionName);
    const storedRecords = collection.find({});
    const serialisedRecord = this._buildRecord(config, record);
    const normalisedName = this._normaliseName(serialisedRecord.name);

    if (this._findByNormalisedName(storedRecords, normalisedName)) {
      throw new Error(`Duplicate ${config.collectionName} record: ${serialisedRecord.name}`);
    }

    collection.insertOne(serialisedRecord);
    collection.save();

    return this._toPlainObject(serialisedRecord);
  }

  /**
   * @param {{collectionName: string, modelClass: Function}} config
   * @param {string} originalName
   * @param {object} record
   * @returns {object}
   */
  _updateRecord(config, originalName, record) {
    const collection = this.dbManager.getCollection(config.collectionName);
    const storedRecords = collection.find({});
    const trimmedOriginalName = this._trimName(originalName);
    const existingRecord = this._findByExactName(storedRecords, trimmedOriginalName);

    if (!existingRecord) {
      throw new Error(`${config.collectionName} record not found: ${trimmedOriginalName}`);
    }

    const serialisedRecord = this._buildRecord(config, record);
    const normalisedReplacementName = this._normaliseName(serialisedRecord.name);
    const conflictingRecord = this._findByNormalisedName(storedRecords, normalisedReplacementName);

    if (conflictingRecord && conflictingRecord.name !== existingRecord.name) {
      throw new Error(`Duplicate ${config.collectionName} record: ${serialisedRecord.name}`);
    }

    collection.replaceOne({ name: trimmedOriginalName }, serialisedRecord);
    collection.save();

    return this._toPlainObject(serialisedRecord);
  }

  /**
   * @param {{collectionName: string}} config
   * @param {string} name
   */
  _deleteRecord(config, name) {
    const collection = this.dbManager.getCollection(config.collectionName);
    const storedRecords = collection.find({});
    const trimmedName = this._trimName(name);
    const existingRecord = this._findByExactName(storedRecords, trimmedName);

    if (!existingRecord) {
      throw new Error(`${config.collectionName} record not found: ${trimmedName}`);
    }

    collection.deleteOne({ name: trimmedName });
    collection.save();
  }

  /**
   * @param {{modelClass: Function}} config
   * @param {object} record
   * @returns {object}
   */
  _buildRecord(config, record) {
    const modelInstance = config.modelClass.fromJSON(record);
    return modelInstance.toJSON();
  }

  /**
   * @param {string} name
   * @returns {string}
   */
  _trimName(name) {
    Validate.requireParams({ name }, 'ReferenceDataController._trimName');
    if (!Validate.isString(name)) {
      throw new TypeError('name must be a string.');
    }
    return name.trim();
  }

  /**
   * @param {string} name
   * @returns {string}
   */
  _normaliseName(name) {
    return this._trimName(name).toLowerCase();
  }

  /**
   * @param {Array<object>} records
   * @param {string} name
   * @returns {object|null}
   */
  _findByExactName(records, name) {
    return records.find((record) => this._trimName(record.name) === name) || null;
  }

  /**
   * @param {Array<object>} records
   * @param {string} normalisedName
   * @returns {object|null}
   */
  _findByNormalisedName(records, normalisedName) {
    return records.find((record) => this._normaliseName(record.name) === normalisedName) || null;
  }

  /**
   * @param {object} record
   * @returns {object}
   */
  _toPlainObject(record) {
    const plainObject = {};

    Object.keys(record).forEach((key) => {
      if (key !== '_id') {
        plainObject[key] = record[key];
      }
    });

    return plainObject;
  }

  /**
   * @param {Array<object>} records
   * @returns {Array<object>}
   */
  _sortRecordsByName(records) {
    const sortedRecords = [];

    records.forEach((record) => {
      let insertionIndex = sortedRecords.length;

      for (const [index, sortedRecord] of sortedRecords.entries()) {
        if (sortedRecord.name.localeCompare(record.name) > 0) {
          insertionIndex = index;
          break;
        }
      }

      sortedRecords.splice(insertionIndex, 0, record);
    });

    return sortedRecords;
  }
}

if (typeof module !== 'undefined') {
  module.exports = ReferenceDataController;
}
