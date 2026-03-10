/**
 * ReferenceDataController – cohort and year-group persistence tests (RED Phase)
 *
 * Section 2 of ACTION_PLAN.md: "Backend controller and persistence"
 *
 * These tests define the CRUD contract for cohort and year-group reference data
 * backed by dedicated JsonDbApp collections.
 *
 * These tests MUST FAIL until ReferenceDataController implements the required
 * behaviour.
 */

import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { Validate } from '../../src/backend/Utils/Validate.js';
import {
  cleanupControllerTestMocks,
  createMockCollection,
  setupControllerTestMocks,
} from '../helpers/mockFactories.js';

const originalValidate = globalThis.Validate;
const originalCohort = globalThis.Cohort;
const originalYearGroup = globalThis.YearGroup;

function setGlobalValue(key, originalValue, replacement) {
  globalThis[key] = replacement;
}

function restoreGlobalValue(key, originalValue) {
  if (originalValue === undefined) {
    delete globalThis[key];
    return;
  }

  globalThis[key] = originalValue;
}

function setupReferenceDataDbMocks(cohortsCollection, yearGroupsCollection) {
  const mockDbManager = {
    getCollection: vi.fn((name) => {
      if (name === 'cohorts') return cohortsCollection;
      if (name === 'year_groups') return yearGroupsCollection;
      throw new Error(`Unexpected collection: ${name}`);
    }),
  };

  globalThis.DbManager = {
    getInstance: () => mockDbManager,
  };

  return mockDbManager;
}

function normaliseLookupName(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : null;
}

function primeCollectionLookup(collection, records) {
  collection.find.mockReturnValue(records);
  collection.findOne.mockImplementation((filter = {}) => {
    const requestedName = normaliseLookupName(filter?.name);

    if (requestedName === null) {
      return records[0] ?? null;
    }

    return records.find((record) => normaliseLookupName(record?.name) === requestedName) ?? null;
  });
}

beforeAll(async () => {
  const cohortModule = await import('../../src/backend/Models/Cohort.js');
  const yearGroupModule = await import('../../src/backend/Models/YearGroup.js');

  setGlobalValue('Validate', originalValidate, Validate);
  setGlobalValue('Cohort', originalCohort, cohortModule.Cohort ?? cohortModule.default?.Cohort);
  setGlobalValue(
    'YearGroup',
    originalYearGroup,
    yearGroupModule.YearGroup ?? yearGroupModule.default?.YearGroup
  );
});

afterAll(() => {
  restoreGlobalValue('Validate', originalValidate);
  restoreGlobalValue('Cohort', originalCohort);
  restoreGlobalValue('YearGroup', originalYearGroup);
});

let ReferenceDataController;
let cohortsCollection;
let yearGroupsCollection;
let mockDbManager;

beforeEach(async () => {
  cohortsCollection = createMockCollection(vi);
  yearGroupsCollection = createMockCollection(vi);

  setupControllerTestMocks(vi);
  mockDbManager = setupReferenceDataDbMocks(cohortsCollection, yearGroupsCollection);

  const controllerModule =
    await import('../../src/backend/y_controllers/ReferenceDataController.js');
  ReferenceDataController =
    controllerModule.default ?? controllerModule.ReferenceDataController ?? controllerModule;
});

afterEach(() => {
  cleanupControllerTestMocks();
  vi.restoreAllMocks();
});

describe('ReferenceDataController – cohort persistence (Section 2)', () => {
  it('listing empty cohorts returns []', () => {
    primeCollectionLookup(cohortsCollection, []);

    const controller = new ReferenceDataController();
    const result = controller.listCohorts();

    expect(mockDbManager.getCollection).toHaveBeenCalledWith('cohorts');
    expect(cohortsCollection.find).toHaveBeenCalledTimes(1);
    expect(result).toEqual([]);
  });

  it('creating cohort persists { name, active } to cohorts', () => {
    primeCollectionLookup(cohortsCollection, []);

    const controller = new ReferenceDataController();
    const result = controller.createCohort({ name: '2028', active: false });

    expect(mockDbManager.getCollection).toHaveBeenCalledWith('cohorts');
    expect(cohortsCollection.insertOne).toHaveBeenCalledTimes(1);
    expect(cohortsCollection.insertOne).toHaveBeenCalledWith({ name: '2028', active: false });
    expect(cohortsCollection.save).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ name: '2028', active: false });
  });

  it('creating cohort with omitted active persists active: true', () => {
    primeCollectionLookup(cohortsCollection, []);

    const controller = new ReferenceDataController();
    const result = controller.createCohort({ name: '2029' });

    expect(mockDbManager.getCollection).toHaveBeenCalledWith('cohorts');
    expect(cohortsCollection.insertOne).toHaveBeenCalledWith({ name: '2029', active: true });
    expect(result).toEqual({ name: '2029', active: true });
  });

  it('creating cohort with invalid payload rejected', () => {
    primeCollectionLookup(cohortsCollection, []);

    const controller = new ReferenceDataController();

    expect(() => controller.createCohort({ name: '2030', active: 'yes please' })).toThrow(
      /boolean|invalid/i
    );
    expect(mockDbManager.getCollection).toHaveBeenCalledWith('cohorts');
    expect(cohortsCollection.insertOne).not.toHaveBeenCalled();
    expect(cohortsCollection.save).not.toHaveBeenCalled();
  });

  it('creating duplicate cohort differing only by case rejected', () => {
    primeCollectionLookup(cohortsCollection, [{ name: 'Alpha Cohort', active: true }]);

    const controller = new ReferenceDataController();

    expect(() => controller.createCohort({ name: 'alpha cohort', active: true })).toThrow(
      /duplicate/i
    );
    expect(mockDbManager.getCollection).toHaveBeenCalledWith('cohorts');
    expect(cohortsCollection.insertOne).not.toHaveBeenCalled();
  });

  it('creating duplicate cohort differing only by surrounding whitespace rejected', () => {
    primeCollectionLookup(cohortsCollection, [{ name: 'Beta Cohort', active: true }]);

    const controller = new ReferenceDataController();

    expect(() => controller.createCohort({ name: '  Beta Cohort  ', active: true })).toThrow(
      /duplicate/i
    );
    expect(mockDbManager.getCollection).toHaveBeenCalledWith('cohorts');
    expect(cohortsCollection.insertOne).not.toHaveBeenCalled();
  });

  it('listing cohorts sorted by name', () => {
    primeCollectionLookup(cohortsCollection, [
      { _id: 'c-2', name: 'Zulu', active: true },
      { _id: 'c-1', name: 'Alpha', active: false },
      { _id: 'c-3', name: 'Lima', active: true },
    ]);

    const controller = new ReferenceDataController();
    const result = controller.listCohorts();

    expect(mockDbManager.getCollection).toHaveBeenCalledWith('cohorts');
    expect(result).toEqual([
      { name: 'Alpha', active: false },
      { name: 'Lima', active: true },
      { name: 'Zulu', active: true },
    ]);
  });

  it('updating existing cohort can change only active', () => {
    primeCollectionLookup(cohortsCollection, [{ name: '2026', active: true }]);

    const controller = new ReferenceDataController();
    const result = controller.updateCohort({
      originalName: '2026',
      record: { name: '2026', active: false },
    });

    expect(mockDbManager.getCollection).toHaveBeenCalledWith('cohorts');
    expect(cohortsCollection.replaceOne).toHaveBeenCalledTimes(1);
    expect(cohortsCollection.replaceOne).toHaveBeenCalledWith(
      { name: '2026' },
      { name: '2026', active: false }
    );
    expect(cohortsCollection.save).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ name: '2026', active: false });
  });

  it('updating existing cohort can rename when unique', () => {
    primeCollectionLookup(cohortsCollection, [{ name: '2026', active: true }]);

    const controller = new ReferenceDataController();
    const result = controller.updateCohort({
      originalName: '2026',
      record: { name: '2027', active: true },
    });

    expect(mockDbManager.getCollection).toHaveBeenCalledWith('cohorts');
    expect(cohortsCollection.replaceOne).toHaveBeenCalledWith(
      { name: '2026' },
      { name: '2027', active: true }
    );
    expect(result).toEqual({ name: '2027', active: true });
  });

  it('updating cohort with invalid payload rejected', () => {
    primeCollectionLookup(cohortsCollection, [{ name: '2026', active: true }]);

    const controller = new ReferenceDataController();

    expect(() =>
      controller.updateCohort({
        originalName: '2026',
        record: { name: '2026', active: 'no thanks' },
      })
    ).toThrow(/boolean|invalid/i);
    expect(mockDbManager.getCollection).toHaveBeenCalledWith('cohorts');
    expect(cohortsCollection.replaceOne).not.toHaveBeenCalled();
    expect(cohortsCollection.save).not.toHaveBeenCalled();
  });

  it('updating missing cohort rejected', () => {
    primeCollectionLookup(cohortsCollection, [{ name: '2026', active: true }]);

    const controller = new ReferenceDataController();

    expect(() =>
      controller.updateCohort({
        originalName: '2030',
        record: { name: '2030', active: true },
      })
    ).toThrow(/not found|missing/i);
    expect(mockDbManager.getCollection).toHaveBeenCalledWith('cohorts');
    expect(cohortsCollection.replaceOne).not.toHaveBeenCalled();
  });

  it('updating cohort to duplicate renamed value rejected', () => {
    primeCollectionLookup(cohortsCollection, [
      { name: '2026', active: true },
      { name: '2027', active: false },
    ]);

    const controller = new ReferenceDataController();

    expect(() =>
      controller.updateCohort({
        originalName: '2026',
        record: { name: '2027', active: true },
      })
    ).toThrow(/duplicate|conflict/i);
    expect(mockDbManager.getCollection).toHaveBeenCalledWith('cohorts');
    expect(cohortsCollection.replaceOne).not.toHaveBeenCalled();
  });

  it('deleting existing cohort removes it', () => {
    primeCollectionLookup(cohortsCollection, [{ name: '2026', active: true }]);

    const controller = new ReferenceDataController();
    controller.deleteCohort('2026');

    expect(mockDbManager.getCollection).toHaveBeenCalledWith('cohorts');
    expect(cohortsCollection.deleteOne).toHaveBeenCalledTimes(1);
    expect(cohortsCollection.deleteOne).toHaveBeenCalledWith({ name: '2026' });
    expect(cohortsCollection.save).toHaveBeenCalledTimes(1);
  });

  it('deleting missing cohort rejected', () => {
    primeCollectionLookup(cohortsCollection, []);

    const controller = new ReferenceDataController();

    expect(() => controller.deleteCohort('2026')).toThrow(/not found|missing/i);
    expect(mockDbManager.getCollection).toHaveBeenCalledWith('cohorts');
    expect(cohortsCollection.deleteOne).not.toHaveBeenCalled();
  });

  it('updating cohort using same normalised name with different display casing succeeds when no conflicting record exists', () => {
    primeCollectionLookup(cohortsCollection, [{ name: 'cohort alpha', active: true }]);

    const controller = new ReferenceDataController();
    const result = controller.updateCohort({
      originalName: 'cohort alpha',
      record: { name: 'Cohort Alpha', active: false },
    });

    expect(mockDbManager.getCollection).toHaveBeenCalledWith('cohorts');
    expect(cohortsCollection.replaceOne).toHaveBeenCalledWith(
      { name: 'cohort alpha' },
      { name: 'Cohort Alpha', active: false }
    );
    expect(result).toEqual({ name: 'Cohort Alpha', active: false });
  });
});

describe('ReferenceDataController – year-group persistence (Section 2)', () => {
  it('listing empty year_groups returns []', () => {
    primeCollectionLookup(yearGroupsCollection, []);

    const controller = new ReferenceDataController();
    const result = controller.listYearGroups();

    expect(mockDbManager.getCollection).toHaveBeenCalledWith('year_groups');
    expect(yearGroupsCollection.find).toHaveBeenCalledTimes(1);
    expect(result).toEqual([]);
  });

  it('creating year group persists { name } to year_groups', () => {
    primeCollectionLookup(yearGroupsCollection, []);

    const controller = new ReferenceDataController();
    const result = controller.createYearGroup({ name: 'Year 10' });

    expect(mockDbManager.getCollection).toHaveBeenCalledWith('year_groups');
    expect(yearGroupsCollection.insertOne).toHaveBeenCalledTimes(1);
    expect(yearGroupsCollection.insertOne).toHaveBeenCalledWith({ name: 'Year 10' });
    expect(yearGroupsCollection.save).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ name: 'Year 10' });
  });

  it('creating year group with invalid payload rejected', () => {
    primeCollectionLookup(yearGroupsCollection, []);

    const controller = new ReferenceDataController();

    expect(() => controller.createYearGroup({ name: '   ' })).toThrow(/non-empty string|invalid/i);
    expect(mockDbManager.getCollection).toHaveBeenCalledWith('year_groups');
    expect(yearGroupsCollection.insertOne).not.toHaveBeenCalled();
    expect(yearGroupsCollection.save).not.toHaveBeenCalled();
  });

  it('creating duplicate year group differing only by case rejected', () => {
    primeCollectionLookup(yearGroupsCollection, [{ name: 'Year 10' }]);

    const controller = new ReferenceDataController();

    expect(() => controller.createYearGroup({ name: 'year 10' })).toThrow(/duplicate/i);
    expect(mockDbManager.getCollection).toHaveBeenCalledWith('year_groups');
    expect(yearGroupsCollection.insertOne).not.toHaveBeenCalled();
  });

  it('listing year groups sorted by name', () => {
    primeCollectionLookup(yearGroupsCollection, [
      { _id: 'yg-3', name: 'Year 9' },
      { _id: 'yg-1', name: 'Year 10' },
      { _id: 'yg-2', name: 'Year 11' },
    ]);

    const controller = new ReferenceDataController();
    const result = controller.listYearGroups();

    expect(mockDbManager.getCollection).toHaveBeenCalledWith('year_groups');
    expect(result).toEqual([{ name: 'Year 10' }, { name: 'Year 11' }, { name: 'Year 9' }]);
  });

  it('updating existing year group can rename when unique', () => {
    primeCollectionLookup(yearGroupsCollection, [{ name: 'Year 10' }]);

    const controller = new ReferenceDataController();
    const result = controller.updateYearGroup({
      originalName: 'Year 10',
      record: { name: 'Year 11' },
    });

    expect(mockDbManager.getCollection).toHaveBeenCalledWith('year_groups');
    expect(yearGroupsCollection.replaceOne).toHaveBeenCalledWith(
      { name: 'Year 10' },
      { name: 'Year 11' }
    );
    expect(yearGroupsCollection.save).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ name: 'Year 11' });
  });

  it('updating year group with invalid payload rejected', () => {
    primeCollectionLookup(yearGroupsCollection, [{ name: 'Year 10' }]);

    const controller = new ReferenceDataController();

    expect(() =>
      controller.updateYearGroup({
        originalName: 'Year 10',
        record: { name: '' },
      })
    ).toThrow(/non-empty string|invalid/i);
    expect(mockDbManager.getCollection).toHaveBeenCalledWith('year_groups');
    expect(yearGroupsCollection.replaceOne).not.toHaveBeenCalled();
    expect(yearGroupsCollection.save).not.toHaveBeenCalled();
  });

  it('updating missing year group rejected', () => {
    primeCollectionLookup(yearGroupsCollection, [{ name: 'Year 10' }]);

    const controller = new ReferenceDataController();

    expect(() =>
      controller.updateYearGroup({
        originalName: 'Year 12',
        record: { name: 'Year 12' },
      })
    ).toThrow(/not found|missing/i);
    expect(mockDbManager.getCollection).toHaveBeenCalledWith('year_groups');
    expect(yearGroupsCollection.replaceOne).not.toHaveBeenCalled();
  });

  it('updating year group to duplicate renamed value rejected', () => {
    primeCollectionLookup(yearGroupsCollection, [{ name: 'Year 10' }, { name: 'Year 11' }]);

    const controller = new ReferenceDataController();

    expect(() =>
      controller.updateYearGroup({
        originalName: 'Year 10',
        record: { name: 'year 11' },
      })
    ).toThrow(/duplicate|conflict/i);
    expect(mockDbManager.getCollection).toHaveBeenCalledWith('year_groups');
    expect(yearGroupsCollection.replaceOne).not.toHaveBeenCalled();
  });

  it('deleting existing year group removes it', () => {
    primeCollectionLookup(yearGroupsCollection, [{ name: 'Year 10' }]);

    const controller = new ReferenceDataController();
    controller.deleteYearGroup('Year 10');

    expect(mockDbManager.getCollection).toHaveBeenCalledWith('year_groups');
    expect(yearGroupsCollection.deleteOne).toHaveBeenCalledTimes(1);
    expect(yearGroupsCollection.deleteOne).toHaveBeenCalledWith({ name: 'Year 10' });
    expect(yearGroupsCollection.save).toHaveBeenCalledTimes(1);
  });

  it('deleting missing year group rejected', () => {
    primeCollectionLookup(yearGroupsCollection, []);

    const controller = new ReferenceDataController();

    expect(() => controller.deleteYearGroup('Year 10')).toThrow(/not found|missing/i);
    expect(mockDbManager.getCollection).toHaveBeenCalledWith('year_groups');
    expect(yearGroupsCollection.deleteOne).not.toHaveBeenCalled();
  });

  it('updating year group using same normalised name with different display casing succeeds when no conflicting record exists', () => {
    primeCollectionLookup(yearGroupsCollection, [{ name: 'year 10' }]);

    const controller = new ReferenceDataController();
    const result = controller.updateYearGroup({
      originalName: 'year 10',
      record: { name: 'Year 10' },
    });

    expect(mockDbManager.getCollection).toHaveBeenCalledWith('year_groups');
    expect(yearGroupsCollection.replaceOne).toHaveBeenCalledWith(
      { name: 'year 10' },
      { name: 'Year 10' }
    );
    expect(result).toEqual({ name: 'Year 10' });
  });
});

describe('ReferenceDataController – transport-safe responses (Section 2)', () => {
  it('controller list responses exclude _id', () => {
    primeCollectionLookup(cohortsCollection, [{ _id: 'cohort-1', name: '2026', active: true }]);
    primeCollectionLookup(yearGroupsCollection, [{ _id: 'yg-1', name: 'Year 10' }]);

    const controller = new ReferenceDataController();
    const cohorts = controller.listCohorts();
    const yearGroups = controller.listYearGroups();

    expect(mockDbManager.getCollection).toHaveBeenCalledWith('cohorts');
    expect(mockDbManager.getCollection).toHaveBeenCalledWith('year_groups');
    expect(cohorts).toEqual([{ name: '2026', active: true }]);
    expect(yearGroups).toEqual([{ name: 'Year 10' }]);
    expect(cohorts[0]).not.toHaveProperty('_id');
    expect(yearGroups[0]).not.toHaveProperty('_id');
  });

  it('controller create responses exclude _id', () => {
    primeCollectionLookup(cohortsCollection, []);
    primeCollectionLookup(yearGroupsCollection, []);
    cohortsCollection.insertOne.mockImplementation((doc) => {
      doc._id = 'generated-cohort-id';
    });
    yearGroupsCollection.insertOne.mockImplementation((doc) => {
      doc._id = 'generated-year-group-id';
    });

    const controller = new ReferenceDataController();
    const cohort = controller.createCohort({ name: '2031', active: true });
    const yearGroup = controller.createYearGroup({ name: 'Year 12' });

    expect(mockDbManager.getCollection).toHaveBeenCalledWith('cohorts');
    expect(mockDbManager.getCollection).toHaveBeenCalledWith('year_groups');
    expect(cohort).toEqual({ name: '2031', active: true });
    expect(yearGroup).toEqual({ name: 'Year 12' });
    expect(cohort).not.toHaveProperty('_id');
    expect(yearGroup).not.toHaveProperty('_id');
  });

  it('controller update responses exclude _id', () => {
    primeCollectionLookup(cohortsCollection, [{ name: '2026', active: true }]);
    primeCollectionLookup(yearGroupsCollection, [{ name: 'Year 10' }]);
    cohortsCollection.replaceOne.mockImplementation((filter, doc) => {
      doc._id = 'updated-cohort-id';
    });
    yearGroupsCollection.replaceOne.mockImplementation((filter, doc) => {
      doc._id = 'updated-year-group-id';
    });

    const controller = new ReferenceDataController();
    const cohort = controller.updateCohort({
      originalName: '2026',
      record: { name: '2027', active: false },
    });
    const yearGroup = controller.updateYearGroup({
      originalName: 'Year 10',
      record: { name: 'Year 11' },
    });

    expect(mockDbManager.getCollection).toHaveBeenCalledWith('cohorts');
    expect(mockDbManager.getCollection).toHaveBeenCalledWith('year_groups');
    expect(cohort).toEqual({ name: '2027', active: false });
    expect(yearGroup).toEqual({ name: 'Year 11' });
    expect(cohort).not.toHaveProperty('_id');
    expect(yearGroup).not.toHaveProperty('_id');
  });
});
