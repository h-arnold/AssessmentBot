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
   * Retrieves all cohort records from storage.
   * @returns {Array<{name: string, active: boolean}>} List of all cohorts sorted by name.
   */
  listCohorts() {
    return this._listRecords(this._getConfig('cohort'));
  }

  /**
   * Creates a new cohort record in storage.
   * @param {{name: string, active?: boolean}} record - The cohort data to create.
   * @returns {{name: string, active: boolean}} The persisted cohort record.
   */
  createCohort(record) {
    Validate.requireParams({ record }, 'ReferenceDataController.createCohort');
    return this._createRecord(this._getConfig('cohort'), record);
  }

  /**
   * Updates an existing cohort record in storage.
   * @param {{originalName: string, record: {name: string, active?: boolean}}} payload - Object containing the original name and updated record data.
   * @returns {{name: string, active: boolean}} The updated cohort record.
   */
  updateCohort(payload) {
    Validate.requireParams({ payload }, 'ReferenceDataController.updateCohort');
    const { originalName, record } = payload;
    Validate.requireParams({ originalName, record }, 'ReferenceDataController.updateCohort');
    return this._updateRecord(this._getConfig('cohort'), originalName, record);
  }

  /**
   * Deletes a cohort record from storage.
   * @param {string} name - The name of the cohort to delete.
   * @returns {void}
   */
  deleteCohort(name) {
    Validate.requireParams({ name }, 'ReferenceDataController.deleteCohort');
    this._deleteRecord(this._getConfig('cohort'), name);
  }

  /**
   * Retrieves all year group records from storage.
   * @returns {Array<{name: string}>} List of all year groups sorted by name.
   */
  listYearGroups() {
    return this._listRecords(this._getConfig('yearGroup'));
  }

  /**
   * Creates a new year group record in storage.
   * @param {{name: string}} record - The year group data to create.
   * @returns {{name: string}} The persisted year group record.
   */
  createYearGroup(record) {
    Validate.requireParams({ record }, 'ReferenceDataController.createYearGroup');
    return this._createRecord(this._getConfig('yearGroup'), record);
  }

  /**
   * Updates an existing year group record in storage.
   * @param {{originalName: string, record: {name: string}}} payload - Object containing the original name and updated record data.
   * @returns {{name: string}} The updated year group record.
   */
  updateYearGroup(payload) {
    Validate.requireParams({ payload }, 'ReferenceDataController.updateYearGroup');
    const { originalName, record } = payload;
    Validate.requireParams({ originalName, record }, 'ReferenceDataController.updateYearGroup');
    return this._updateRecord(this._getConfig('yearGroup'), originalName, record);
  }

  /**
   * Deletes a year group record from storage.
   * @param {string} name - The name of the year group to delete.
   * @returns {void}
   */
  deleteYearGroup(name) {
    Validate.requireParams({ name }, 'ReferenceDataController.deleteYearGroup');
    this._deleteRecord(this._getConfig('yearGroup'), name);
  }

  /**
   * Retrieves configuration object for a resource type (cohort or yearGroup).
   * Contains collection name and model class to use for that resource.
   *
   * @param {string} resourceType - Resource type identifier ('cohort' or 'yearGroup').
   * @returns {{collectionName: string, modelClass: Function}} Configuration object.
   * @throws {Error} If resourceType is not supported.
   * @private
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
   * Retrieves all records from a collection and normalises them.
   * Records are sorted by name ascending and storage metadata is stripped.
   *
   * @param {{collectionName: string, modelClass: Function}} config - Resource configuration.
   * @returns {Array<Object>} Plain record objects sorted by name.
   * @private
   */
  _listRecords(config) {
    const collection = this.dbManager.getCollection(config.collectionName);
    const records = collection.find({});

    return this._sortRecordsByName(records.map((record) => this._toPlainObject(record)));
  }

  /**
   * Creates a new record in the collection.
   * Validates for duplicates (by normalised name) before insertion.
   *
   * @param {{collectionName: string, modelClass: Function}} config - Resource configuration.
   * @param {Object} record - The record to create.
   * @returns {Object} The persisted record as a plain object.
   * @throws {Error} If a duplicate record (by normalised name) already exists.
   * @private
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
   * Updates an existing record by name.
   * Validates for duplicates (by normalised name) before replacement, excluding the original record.
   *
   * @param {{collectionName: string, modelClass: Function}} config - Resource configuration.
   * @param {string} originalName - The original record name to find and replace.
   * @param {Object} record - The updated record data.
   * @returns {Object} The updated record as a plain object.
   * @throws {Error} If the original record is not found or a duplicate exists.
   * @private
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
   * Deletes an existing record by name.
   *
   * @param {{collectionName: string}} config - Resource configuration.
   * @param {string} name - The record name to find and delete.
   * @throws {Error} If the record is not found.
   * @private
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
   * Builds a record by deserialising from JSON and reserialising.
   * Ensures the record conforms to the model class serialisation format.
   *
   * @param {{modelClass: Function}} config - Resource configuration.
   * @param {Object} record - The record data to build.
   * @returns {Object} The built (serialised) record.
   * @private
   */
  _buildRecord(config, record) {
    const modelInstance = config.modelClass.fromJSON(record);
    return modelInstance.toJSON();
  }

  /**
   * Trims whitespace from a name string.
   *
   * @param {string} name - The name to trim.
   * @returns {string} The trimmed name.
   * @throws {TypeError} If name is not a string.
   * @private
   */
  _trimName(name) {
    Validate.requireParams({ name }, 'ReferenceDataController._trimName');
    if (!Validate.isString(name)) {
      throw new TypeError('name must be a string.');
    }
    return name.trim();
  }

  /**
   * Normalises a name by trimming and converting to lowercase for comparison purposes.
   *
   * @param {string} name - The name to normalise.
   * @returns {string} The normalised name.
   * @private
   */
  _normaliseName(name) {
    return this._trimName(name).toLowerCase();
  }

  /**
   * Finds a record by exact (trimmed) name match from a list.
   *
   * @param {Array<Object>} records - List of records to search.
   * @param {string} name - The exact name to find (with trimming).
   * @returns {Object|null} The matching record or null if not found.
   * @private
   */
  _findByExactName(records, name) {
    return records.find((record) => this._trimName(record.name) === name) || null;
  }

  /**
   * Finds a record by normalised name match from a list.
   * Useful for case-insensitive duplicate detection.
   *
   * @param {Array<Object>} records - List of records to search.
   * @param {string} normalisedName - The normalised name to find.
   * @returns {Object|null} The matching record or null if not found.
   * @private
   */
  _findByNormalisedName(records, normalisedName) {
    return records.find((record) => this._normaliseName(record.name) === normalisedName) || null;
  }

  /**
   * Converts a record to a plain object, stripping storage-only metadata (e.g. _id).
   *
   * @param {Object} record - The record to convert.
   * @returns {Object} Plain object without storage metadata.
   * @private
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
   * Sorts records by name using merge sort algorithm.
   *
   * @param {Array<Object>} records - Records to sort.
   * @returns {Array<Object>} Sorted records by name ascending.
   * @private
   */
  _sortRecordsByName(records) {
    const minimumMergeSortPartitionSize = 2;

    if (records.length < minimumMergeSortPartitionSize) {
      return [...records];
    }

    const midpoint = Math.floor(records.length / minimumMergeSortPartitionSize);
    const leftRecords = [];
    const rightRecords = [];

    for (const [index, record] of records.entries()) {
      if (index < midpoint) {
        leftRecords.push(record);
      } else {
        rightRecords.push(record);
      }
    }

    return this._mergeSortedRecords(
      this._sortRecordsByName(leftRecords),
      this._sortRecordsByName(rightRecords)
    );
  }

  /**
   * Merges two sorted record arrays by name in ascending order.
   * Used by merge sort to combine sorted partitions.
   *
   * @param {Array<Object>} leftRecords - Left sorted partition.
   * @param {Array<Object>} rightRecords - Right sorted partition.
   * @returns {Array<Object>} Merged sorted records.
   * @private
   */
  _mergeSortedRecords(leftRecords, rightRecords) {
    const mergedRecords = [];
    let leftIndex = 0;
    let rightIndex = 0;

    while (leftIndex < leftRecords.length && rightIndex < rightRecords.length) {
      if (leftRecords[leftIndex].name.localeCompare(rightRecords[rightIndex].name) <= 0) {
        mergedRecords.push(leftRecords[leftIndex]);
        leftIndex += 1;
      } else {
        mergedRecords.push(rightRecords[rightIndex]);
        rightIndex += 1;
      }
    }

    while (leftIndex < leftRecords.length) {
      mergedRecords.push(leftRecords[leftIndex]);
      leftIndex += 1;
    }

    while (rightIndex < rightRecords.length) {
      mergedRecords.push(rightRecords[rightIndex]);
      rightIndex += 1;
    }

    return mergedRecords;
  }
}

if (typeof module !== 'undefined') {
  module.exports = ReferenceDataController;
}
