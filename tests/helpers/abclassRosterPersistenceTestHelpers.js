/**
 * Shared harness for `abclassRosterPersistence.test.js`.
 *
 * Builds dual-store mocks that record operation order and supplies canonical
 * ABClass fixtures from the synthetic corpus.
 */

import { expect, vi } from 'vitest';
import { withTemporaryGlobals } from './globalMockManager.js';
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';

const { ABClass } = require('#backend/Models/ABClass.js');
const { Teacher } = require('#backend/Models/Teacher.js');
const ABClassPersistence = require('#backend/y_controllers/ABClassController/ABClassPersistence.js');
const ABClassRoster = require('#backend/y_controllers/ABClassController/ABClassRoster.js');
const ABClassValidation = require('#backend/y_controllers/ABClassController/ABClassValidation.js');

const clone = (value) => structuredClone(value);
const writes = ['insertOne', 'replaceOne', 'updateOne', 'save'];
const successResult = { matchedCount: 1, modifiedCount: 1, acknowledged: true };

function createCollection(label, order, result) {
  const collection = {
    findOne: vi.fn((...args) => {
      order.push(`${label}.findOne`, args);
      return result;
    }),
  };
  for (const method of writes) {
    collection[method] = vi.fn((...args) => order.push(`${label}.${method}`, args));
  }
  collection.updateOne.mockImplementation((...args) => {
    order.push(`${label}.updateOne`, args);
    return successResult;
  });
  return collection;
}

/**
 * Builds a canonical ABClass from the committed medium profile.
 * @returns {ABClass} Deserialised class with a non-null metadata snapshot.
 */
export function canonicalClass() {
  const row = Object.values(loadBackendModelInputs('medium').classesById).find(
    (candidate) => candidate.metadata !== null
  );
  return withTemporaryGlobals({ Teacher: () => Teacher }, () => ABClass.fromJSON(clone(row)));
}

/**
 * Builds the full and partial collections, persistence owners, and an operation log.
 * @param {Object} options - Stored registry row, update result, and injected failures.
 * @returns {Object} Roster, persistence, mock collections, and recorded operation order.
 */
export function makeRoster({ partialRow, updateResult, failures }) {
  const order = [];
  const full = createCollection('full', order);
  const partial = createCollection('partial', order, partialRow);
  partial.updateOne.mockImplementation((...args) => {
    order.push('partial.updateOne', args);
    if (failures.update) throw failures.update;
    return updateResult;
  });
  partial.insertOne.mockImplementation((...args) => {
    order.push('partial.insertOne', args);
    if (failures.insert) throw failures.insert;
  });
  for (const [store, target] of [
    ['full', full],
    ['partial', partial],
  ]) {
    target.save.mockImplementation(() => {
      order.push(`${store}.save`);
      if (failures[`${store}Save`]) throw failures[`${store}Save`];
    });
  }
  const dbManager = {
    getCollection: vi.fn((name) => (name === 'abclass_partials' ? partial : full)),
  };
  const validation = new ABClassValidation();
  const persistence = new ABClassPersistence({ dbManager, validation });
  const roster = new ABClassRoster({ dbManager, validation, persistence });
  return { roster, persistence, full, partial, order };
}

/**
 * Builds mock stores that already hold the refreshed roster, with optional overrides.
 * @param {ABClass} abClass - Refreshed class model.
 * @param {Object} [options] - Stored registry row and full document overrides.
 * @returns {Object} Matching stored records plus the roster mocks.
 */
export function makeMatchingRoster(abClass, { partialRow, existingDocument } = {}) {
  const resolvedPartialRow =
    partialRow === undefined
      ? { ...abClass.toPartialJSON(), _id: 'matching-partial-id' }
      : partialRow;

  return {
    existingDocument: existingDocument ?? abClass.toJSON(),
    partialRow: resolvedPartialRow,
    ...makeRoster({
      partialRow: resolvedPartialRow,
      updateResult: successResult,
      failures: {},
    }),
  };
}

/**
 * Asserts the skip path performed no writes and emitted the single expected log.
 * @param {Object} options - Logger, class, mock stores, and preparation spy.
 * @returns {void}
 */
export function expectSkip({ logger, abClass, full, partial, prepare }) {
  for (const store of [full, partial]) {
    for (const method of writes) expect(store[method]).not.toHaveBeenCalled();
  }
  expect(prepare).not.toHaveBeenCalled();
  expect(logger.info).toHaveBeenCalledTimes(1);
  expect(logger.info).toHaveBeenCalledWith(
    '_persistRoster: roster unchanged; skipping persistence',
    { classId: abClass.classId }
  );
  expect(logger.error).not.toHaveBeenCalled();
}

/**
 * Runs the skip path with optionally overridden stored records and asserts it skipped.
 * @param {Object} options - Logger, class, and stored-record overrides.
 * @returns {Object} The roster mocks used for the run.
 */
export function expectSkippedPersist({ logger, abClass, partialRow, existingDocument }) {
  const fixture = makeMatchingRoster(abClass, { partialRow, existingDocument });
  const prepare = vi.spyOn(fixture.persistence, '_prepareRosterPartial');
  fixture.roster._persistRoster(fixture.full, fixture.existingDocument, abClass);
  expectSkip({ logger, abClass, full: fixture.full, partial: fixture.partial, prepare });
  return fixture;
}

/**
 * Replaces matching stored records with copies whose object keys are reversed.
 * @param {Object} existingDocument - Stored full document.
 * @param {Object} partialRow - Stored registry row.
 * @returns {void}
 */
export function reorderStoredKeys(existingDocument, partialRow) {
  const reorder = (value) => Object.fromEntries(Object.entries(value).reverse());
  existingDocument.classOwner = reorder(existingDocument.classOwner);
  existingDocument.teachers = existingDocument.teachers.map(reorder);
  partialRow.classOwner = reorder(partialRow.classOwner);
  partialRow.teachers = partialRow.teachers.map(reorder);
}

/**
 * Asserts both stores took the write path.
 * @param {Object} full - Full class collection mock.
 * @param {Object} partial - Registry collection mock.
 * @returns {void}
 */
export function expectStoreWrites(full, partial) {
  expect(full.updateOne).toHaveBeenCalledTimes(1);
  expect(full.save).toHaveBeenCalledTimes(1);
  expect(partial.updateOne).toHaveBeenCalledTimes(1);
  expect(partial.save).toHaveBeenCalledTimes(1);
}

/**
 * Asserts the skip log was not emitted.
 * @param {Object} logger - Mock logger.
 * @returns {void}
 */
export function expectNoSkipLog(logger) {
  expect(logger.info).not.toHaveBeenCalledWith(
    '_persistRoster: roster unchanged; skipping persistence',
    expect.anything()
  );
}

export { writes };
