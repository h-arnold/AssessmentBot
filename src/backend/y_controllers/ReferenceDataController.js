/* global Cohort, DbManager, Validate, YearGroup */

let fallbackKeyCounter = 0;

/**
 * Generates a stable key for reference-data records.
 * @returns {string} Stable key.
 */
function generateStableKey() {
  if (typeof Utilities !== 'undefined' && typeof Utilities.getUuid === 'function') {
    return Utilities.getUuid();
  }

  fallbackKeyCounter += 1;
  return `${Date.now()}-${fallbackKeyCounter}`;
}

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
   * @returns {Array<{key: string, name: string, active: boolean, startYear: number, startMonth: number}>} List of all cohorts sorted by name.
   */
  listCohorts() {
    return this._listRecords(this._getConfig('cohort'));
  }

  /**
   * Creates a new cohort record in storage.
   * @param {{name: string, active?: boolean, startYear?: number, startMonth?: number}} record - The cohort data to create.
   * @returns {{key: string, name: string, active: boolean, startYear: number, startMonth: number}} The persisted cohort record.
   */
  createCohort(record) {
    Validate.requireParams({ record }, 'ReferenceDataController.createCohort');
    return this._createRecord(this._getConfig('cohort'), record);
  }

  /**
   * Updates an existing cohort record in storage.
   * @param {{key: string, record: {name: string, active?: boolean, startYear?: number, startMonth?: number}}} payload - Object containing key and updated record data.
   * @returns {{key: string, name: string, active: boolean, startYear: number, startMonth: number}} The updated cohort record.
   */
  updateCohort(payload) {
    Validate.requireParams({ payload }, 'ReferenceDataController.updateCohort');
    const { key, record } = payload;
    Validate.requireParams({ key, record }, 'ReferenceDataController.updateCohort');
    return this._updateRecord(this._getConfig('cohort'), key, record);
  }

  /**
   * Deletes a cohort record from storage.
   * @param {string} key - The key of the cohort to delete.
   * @returns {void}
   */
  deleteCohort(key) {
    Validate.requireParams({ key }, 'ReferenceDataController.deleteCohort');
    this._deleteRecord(this._getConfig('cohort'), key);
  }

  /**
   * Retrieves all year group records from storage.
   * @returns {Array<{key: string, name: string}>} List of all year groups sorted by name.
   */
  listYearGroups() {
    return this._listRecords(this._getConfig('yearGroup'));
  }

  /**
   * Creates a new year group record in storage.
   * @param {{name: string}} record - The year group data to create.
   * @returns {{key: string, name: string}} The persisted year group record.
   */
  createYearGroup(record) {
    Validate.requireParams({ record }, 'ReferenceDataController.createYearGroup');
    return this._createRecord(this._getConfig('yearGroup'), record);
  }

  /**
   * Updates an existing year group record in storage.
   * @param {{key: string, record: {name: string}}} payload - Object containing key and updated record data.
   * @returns {{key: string, name: string}} The updated year group record.
   */
  updateYearGroup(payload) {
    Validate.requireParams({ payload }, 'ReferenceDataController.updateYearGroup');
    const { key, record } = payload;
    Validate.requireParams({ key, record }, 'ReferenceDataController.updateYearGroup');
    return this._updateRecord(this._getConfig('yearGroup'), key, record);
  }

  /**
   * Deletes a year group record from storage.
   * @param {string} key - The key of the year group to delete.
   * @returns {void}
   */
  deleteYearGroup(key) {
    Validate.requireParams({ key }, 'ReferenceDataController.deleteYearGroup');
    this._deleteRecord(this._getConfig('yearGroup'), key);
  }

  /**
   * Returns config for a supported resource type.
   * @param {string} resourceType - Supported reference-data resource.
   * @returns {{collectionName: string, modelClass: Function, partialsReferenceField: string}} Resource config.
   */
  _getConfig(resourceType) {
    if (resourceType === 'cohort') {
      return {
        collectionName: 'cohorts',
        modelClass: Cohort,
        partialsReferenceField: 'cohortKey',
      };
    }

    if (resourceType === 'yearGroup') {
      return {
        collectionName: 'year_groups',
        modelClass: YearGroup,
        partialsReferenceField: 'yearGroupKey',
      };
    }

    throw new Error(`Unsupported reference-data resource: ${resourceType}`);
  }

  /**
   * Lists and sorts records by name.
   * @param {{collectionName: string}} config - Resource configuration.
   * @returns {Array<Object>} Sorted plain records.
   */
  _listRecords(config) {
    const collection = this.dbManager.getCollection(config.collectionName);
    const records = collection.find({});

    return this._sortRecordsByName(records.map((record) => this._toPlainObject(record)));
  }

  /**
   * Creates and persists a new keyed record.
   * @param {{collectionName: string, modelClass: Function}} config - Resource configuration.
   * @param {Object} record - Incoming record payload.
   * @returns {Object} Persisted plain record.
   */
  _createRecord(config, record) {
    const collection = this.dbManager.getCollection(config.collectionName);
    const storedRecords = collection.find({});
    const serialisedRecord = this._buildRecord(config, {
      ...record,
      key: generateStableKey(),
    });
    const normalisedName = this._normaliseName(serialisedRecord.name);

    if (this._findByNormalisedName(storedRecords, normalisedName)) {
      throw new Error(`Duplicate ${config.collectionName} record: ${serialisedRecord.name}`);
    }

    collection.insertOne(serialisedRecord);
    collection.save();

    return this._toPlainObject(serialisedRecord);
  }

  /**
   * Updates and persists an existing keyed record.
   * @param {{collectionName: string, modelClass: Function}} config - Resource configuration.
   * @param {string} key - Stable key to update.
   * @param {Object} record - Update payload.
   * @returns {Object} Persisted plain record.
   */
  _updateRecord(config, key, record) {
    const collection = this.dbManager.getCollection(config.collectionName);
    const storedRecords = collection.find({});
    const trimmedKey = this._trimKey(key);
    const existingRecord = this._findByKey(storedRecords, trimmedKey);

    if (!existingRecord) {
      throw new Error(`${config.collectionName} record not found: ${trimmedKey}`);
    }

    const serialisedRecord = this._buildRecord(config, {
      ...existingRecord,
      ...record,
      key: trimmedKey,
    });
    const normalisedReplacementName = this._normaliseName(serialisedRecord.name);
    const conflictingRecord = this._findByNormalisedName(storedRecords, normalisedReplacementName);

    if (conflictingRecord && conflictingRecord.key !== existingRecord.key) {
      throw new Error(`Duplicate ${config.collectionName} record: ${serialisedRecord.name}`);
    }

    collection.replaceOne({ key: trimmedKey }, serialisedRecord);
    collection.save();

    return this._toPlainObject(serialisedRecord);
  }

  /**
   * Deletes a keyed record if unused by class partials.
   * @param {{collectionName: string, partialsReferenceField: string}} config - Resource configuration.
   * @param {string} key - Stable key to delete.
   * @returns {void}
   */
  _deleteRecord(config, key) {
    const collection = this.dbManager.getCollection(config.collectionName);
    const storedRecords = collection.find({});
    const trimmedKey = this._trimKey(key);
    const existingRecord = this._findByKey(storedRecords, trimmedKey);

    if (!existingRecord) {
      throw new Error(`${config.collectionName} record not found: ${trimmedKey}`);
    }

    const partialsCollection = this.dbManager.getCollection('abclass_partials');
    const partials = partialsCollection.find({});
    const isInUse = partials.some(
      (partial) =>
        partial &&
        typeof partial === 'object' &&
        partial[config.partialsReferenceField] === trimmedKey
    );

    if (isInUse) {
      const error = new Error(
        `${config.collectionName} record is referenced by one or more classes`
      );
      error.reason = 'IN_USE';
      throw error;
    }

    collection.deleteOne({ key: trimmedKey });
    collection.save();
  }

  /**
   * Builds a canonical serialised record through the model contract.
   * @param {{modelClass: Function}} config - Resource configuration.
   * @param {Object} record - Raw record data.
   * @returns {Object} Canonical serialised record.
   */
  _buildRecord(config, record) {
    const modelInstance = config.modelClass.fromJSON(record);
    return modelInstance.toJSON();
  }

  /**
   * Trims and validates a key.
   * @param {string} key - Key to trim.
   * @returns {string} Trimmed key.
   */
  _trimKey(key) {
    Validate.requireParams({ key }, 'ReferenceDataController._trimKey');

    if (!Validate.isString(key)) {
      throw new TypeError('key must be a string.');
    }

    return key.trim();
  }

  /**
   * Normalises a name for duplicate checks.
   * @param {string} name - Name to normalise.
   * @returns {string} Lower-case trimmed name.
   */
  _normaliseName(name) {
    Validate.requireParams({ name }, 'ReferenceDataController._normaliseName');

    if (!Validate.isString(name)) {
      throw new TypeError('name must be a string.');
    }

    return name.trim().toLowerCase();
  }

  /**
   * Finds a record by key.
   * @param {Array<Object>} records - Source records.
   * @param {string} key - Key to match.
   * @returns {Object|null} Matching record.
   */
  _findByKey(records, key) {
    return records.find((record) => this._trimKey(record.key) === key) || null;
  }

  /**
   * Finds a record by normalised name.
   * @param {Array<Object>} records - Source records.
   * @param {string} normalisedName - Normalised name.
   * @returns {Object|null} Matching record.
   */
  _findByNormalisedName(records, normalisedName) {
    return records.find((record) => this._normaliseName(record.name) === normalisedName) || null;
  }

  /**
   * Removes storage-only metadata from a record.
   * @param {Object} record - Stored record.
   * @returns {Object} Plain record.
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
   * Sorts records by name using merge sort.
   * @param {Array<Object>} records - Records to sort.
   * @returns {Array<Object>} Sorted records.
   */
  _sortRecordsByName(records) {
    const minimumMergeSortPartitionSize = 2;

    if (records.length < minimumMergeSortPartitionSize) {
      return [...records];
    }

    const midpoint = Math.floor(records.length / minimumMergeSortPartitionSize);
    const left = this._sortRecordsByName(records.slice(0, midpoint));
    const right = this._sortRecordsByName(records.slice(midpoint));

    return this._mergeByName(left, right);
  }

  /**
   * Merges two sorted record lists by name.
   * @param {Array<Object>} leftRecords - Left sorted partition.
   * @param {Array<Object>} rightRecords - Right sorted partition.
   * @returns {Array<Object>} Merged sorted records.
   */
  _mergeByName(leftRecords, rightRecords) {
    const mergedRecords = [];
    let leftIndex = 0;
    let rightIndex = 0;

    while (leftIndex < leftRecords.length && rightIndex < rightRecords.length) {
      const leftName = leftRecords[leftIndex].name;
      const rightName = rightRecords[rightIndex].name;

      if (leftName.localeCompare(rightName) <= 0) {
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ReferenceDataController;
}
