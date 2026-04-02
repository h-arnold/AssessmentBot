/**
 * ReferenceDataController – cohort and year-group persistence tests
 *
 * Encodes the key-based reference-data contract from Workstream 1:
 * - Cohort shape: { key, name, active, startYear, startMonth }
 * - YearGroup shape: { key, name }
 * - Create generates a UUID key; update/delete identify records by key
 * - Academic-year defaults applied on create when startYear/startMonth are omitted
 * - deleteCohort/deleteYearGroup reject in-use deletes with machine-readable reason
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

/**
 * Returns the expected academic-year start year for the given JS Date.
 * Sep–Dec: current calendar year; Jan–Aug: previous calendar year.
 */
function expectedAcademicYearStart(date) {
  const month = date.getMonth() + 1; // 1-indexed
  return month >= 9 ? date.getFullYear() : date.getFullYear() - 1;
}

function setupReferenceDataDbMocks(cohortsCollection, yearGroupsCollection, partialsCollection) {
  const mockDbManager = {
    getCollection: vi.fn((name) => {
      if (name === 'cohorts') return cohortsCollection;
      if (name === 'year_groups') return yearGroupsCollection;
      if (name === 'abclass_partials') return partialsCollection;
      throw new Error(`Unexpected collection: ${name}`);
    }),
  };

  globalThis.DbManager = {
    getInstance: () => mockDbManager,
  };

  return mockDbManager;
}

/** Prime collection mocks for key-based lookups */
function primeCollectionLookupByKey(collection, records) {
  collection.find.mockReturnValue(records);
  collection.findOne.mockImplementation((filter = {}) => {
    if (filter?.key) {
      return records.find((r) => r.key === filter.key) ?? null;
    }
    return records[0] ?? null;
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
let partialsCollection;
let mockDbManager;

beforeEach(async () => {
  cohortsCollection = createMockCollection(vi);
  yearGroupsCollection = createMockCollection(vi);
  partialsCollection = createMockCollection(vi);

  setupControllerTestMocks(vi);
  mockDbManager = setupReferenceDataDbMocks(
    cohortsCollection,
    yearGroupsCollection,
    partialsCollection
  );

  const controllerModule =
    await import('../../src/backend/y_controllers/ReferenceDataController.js');
  ReferenceDataController =
    controllerModule.default ?? controllerModule.ReferenceDataController ?? controllerModule;
});

afterEach(() => {
  vi.useRealTimers();
  cleanupControllerTestMocks();
  vi.restoreAllMocks();
});

describe('ReferenceDataController – cohort key-based persistence', () => {
  it('listing empty cohorts returns []', () => {
    primeCollectionLookupByKey(cohortsCollection, []);

    const result = new ReferenceDataController().listCohorts();

    expect(mockDbManager.getCollection).toHaveBeenCalledWith('cohorts');
    expect(cohortsCollection.find).toHaveBeenCalledTimes(1);
    expect(result).toEqual([]);
  });

  it('creating cohort generates a UUID key and persists { key, name, active, startYear, startMonth }', () => {
    primeCollectionLookupByKey(cohortsCollection, []);

    const result = new ReferenceDataController().createCohort({
      name: '2028',
      active: false,
      startYear: 2027,
      startMonth: 9,
    });

    expect(mockDbManager.getCollection).toHaveBeenCalledWith('cohorts');
    expect(cohortsCollection.insertOne).toHaveBeenCalledTimes(1);
    const persisted = cohortsCollection.insertOne.mock.calls[0][0];
    expect(persisted).toHaveProperty('key');
    expect(typeof persisted.key).toBe('string');
    expect(persisted.key.length).toBeGreaterThan(0);
    expect(persisted.name).toBe('2028');
    expect(persisted.active).toBe(false);
    expect(persisted.startYear).toBe(2027);
    expect(persisted.startMonth).toBe(9);
    expect(cohortsCollection.save).toHaveBeenCalledTimes(1);
    expect(result.key).toBe(persisted.key);
    expect(result.name).toBe('2028');
    expect(result.active).toBe(false);
  });

  it('creating cohort with omitted active persists active: true', () => {
    primeCollectionLookupByKey(cohortsCollection, []);

    const result = new ReferenceDataController().createCohort({
      name: '2029',
      startYear: 2028,
      startMonth: 9,
    });

    const persisted = cohortsCollection.insertOne.mock.calls[0][0];
    expect(persisted.active).toBe(true);
    expect(result.active).toBe(true);
  });

  it('creating cohort with omitted startMonth defaults to 9 (September)', () => {
    primeCollectionLookupByKey(cohortsCollection, []);

    new ReferenceDataController().createCohort({ name: '2030', active: true, startYear: 2029 });

    const persisted = cohortsCollection.insertOne.mock.calls[0][0];
    expect(persisted.startMonth).toBe(9);
  });

  it('creating cohort with omitted startYear defaults to academic-year start (Sep–Dec → current year)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-10-15'));

    primeCollectionLookupByKey(cohortsCollection, []);
    new ReferenceDataController().createCohort({ name: '2025 cohort', active: true });

    const persisted = cohortsCollection.insertOne.mock.calls[0][0];
    expect(persisted.startYear).toBe(expectedAcademicYearStart(new Date('2025-10-15')));

    vi.useRealTimers();
  });

  it('creating cohort with omitted startYear defaults to academic-year start (Jan–Aug → previous year)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-03-15'));

    primeCollectionLookupByKey(cohortsCollection, []);
    new ReferenceDataController().createCohort({ name: '2024 cohort', active: true });

    const persisted = cohortsCollection.insertOne.mock.calls[0][0];
    expect(persisted.startYear).toBe(expectedAcademicYearStart(new Date('2025-03-15')));

    vi.useRealTimers();
  });

  it('creating cohort with invalid active rejected without persistence', () => {
    primeCollectionLookupByKey(cohortsCollection, []);

    expect(() =>
      new ReferenceDataController().createCohort({ name: '2030', active: 'yes' })
    ).toThrow(/boolean|invalid/i);
    expect(cohortsCollection.insertOne).not.toHaveBeenCalled();
    expect(cohortsCollection.save).not.toHaveBeenCalled();
  });

  it('listing cohorts returns { key, name, active, startYear, startMonth } items sorted by name', () => {
    primeCollectionLookupByKey(cohortsCollection, [
      {
        _id: 'c-2',
        key: 'coh-z',
        name: 'Zulu Cohort',
        active: true,
        startYear: 2026,
        startMonth: 9,
      },
      {
        _id: 'c-1',
        key: 'coh-a',
        name: 'Alpha Cohort',
        active: false,
        startYear: 2024,
        startMonth: 9,
      },
      {
        _id: 'c-3',
        key: 'coh-l',
        name: 'Lima Cohort',
        active: true,
        startYear: 2025,
        startMonth: 9,
      },
    ]);

    const result = new ReferenceDataController().listCohorts();

    expect(result).toEqual([
      { key: 'coh-a', name: 'Alpha Cohort', active: false, startYear: 2024, startMonth: 9 },
      { key: 'coh-l', name: 'Lima Cohort', active: true, startYear: 2025, startMonth: 9 },
      { key: 'coh-z', name: 'Zulu Cohort', active: true, startYear: 2026, startMonth: 9 },
    ]);
    expect(result[0]).not.toHaveProperty('_id');
  });

  it('updating cohort by key can change name, active, startYear, startMonth', () => {
    primeCollectionLookupByKey(cohortsCollection, [
      { key: 'coh-001', name: '2026', active: true, startYear: 2025, startMonth: 9 },
    ]);

    const result = new ReferenceDataController().updateCohort({
      key: 'coh-001',
      record: { name: '2026', active: false, startYear: 2025, startMonth: 9 },
    });

    expect(cohortsCollection.replaceOne).toHaveBeenCalledTimes(1);
    expect(cohortsCollection.replaceOne).toHaveBeenCalledWith(
      { key: 'coh-001' },
      expect.objectContaining({ key: 'coh-001', name: '2026', active: false })
    );
    expect(cohortsCollection.save).toHaveBeenCalledTimes(1);
    expect(result.key).toBe('coh-001');
    expect(result.active).toBe(false);
  });

  it('updating cohort preserves the original key even when display name changes', () => {
    primeCollectionLookupByKey(cohortsCollection, [
      { key: 'coh-001', name: '2026', active: true, startYear: 2025, startMonth: 9 },
    ]);

    const result = new ReferenceDataController().updateCohort({
      key: 'coh-001',
      record: { name: '2026-27', active: true, startYear: 2025, startMonth: 9 },
    });

    expect(result.key).toBe('coh-001');
    expect(result.name).toBe('2026-27');
  });

  it('updating missing cohort key rejected', () => {
    primeCollectionLookupByKey(cohortsCollection, [
      { key: 'coh-001', name: '2026', active: true, startYear: 2025, startMonth: 9 },
    ]);

    expect(() =>
      new ReferenceDataController().updateCohort({
        key: 'coh-999',
        record: { name: '2030', active: true, startYear: 2029, startMonth: 9 },
      })
    ).toThrow(/not found|missing/i);
    expect(cohortsCollection.replaceOne).not.toHaveBeenCalled();
  });

  it('deleting cohort by key removes it', () => {
    primeCollectionLookupByKey(cohortsCollection, [
      { key: 'coh-001', name: '2026', active: true, startYear: 2025, startMonth: 9 },
    ]);
    partialsCollection.find.mockReturnValue([]);

    new ReferenceDataController().deleteCohort('coh-001');

    expect(cohortsCollection.deleteOne).toHaveBeenCalledWith({ key: 'coh-001' });
    expect(cohortsCollection.save).toHaveBeenCalledTimes(1);
  });

  it('deleting missing cohort key rejected', () => {
    primeCollectionLookupByKey(cohortsCollection, []);

    expect(() => new ReferenceDataController().deleteCohort('coh-999')).toThrow(
      /not found|missing/i
    );
    expect(cohortsCollection.deleteOne).not.toHaveBeenCalled();
  });

  it('deleteCohort rejects with machine-readable IN_USE reason when cohort is referenced by an ABClass', () => {
    primeCollectionLookupByKey(cohortsCollection, [
      { key: 'coh-001', name: '2026', active: true, startYear: 2025, startMonth: 9 },
    ]);
    // An ABClass references this cohort key
    partialsCollection.find.mockReturnValue([{ classId: 'class-001', cohortKey: 'coh-001' }]);

    let error;
    try {
      new ReferenceDataController().deleteCohort('coh-001');
    } catch (err) {
      error = err;
    }

    expect(error).toBeDefined();
    expect(error.reason ?? error.code ?? error.message).toMatch(/IN_USE|in.use|in_use|referenced/i);
    expect(cohortsCollection.deleteOne).not.toHaveBeenCalled();
    expect(cohortsCollection.save).not.toHaveBeenCalled();
  });
});

describe('ReferenceDataController – year-group key-based persistence', () => {
  it('listing empty year_groups returns []', () => {
    primeCollectionLookupByKey(yearGroupsCollection, []);

    const result = new ReferenceDataController().listYearGroups();

    expect(mockDbManager.getCollection).toHaveBeenCalledWith('year_groups');
    expect(yearGroupsCollection.find).toHaveBeenCalledTimes(1);
    expect(result).toEqual([]);
  });

  it('creating year group generates a UUID key and persists { key, name }', () => {
    primeCollectionLookupByKey(yearGroupsCollection, []);

    const result = new ReferenceDataController().createYearGroup({ name: 'Year 10' });

    expect(mockDbManager.getCollection).toHaveBeenCalledWith('year_groups');
    expect(yearGroupsCollection.insertOne).toHaveBeenCalledTimes(1);
    const persisted = yearGroupsCollection.insertOne.mock.calls[0][0];
    expect(persisted).toHaveProperty('key');
    expect(typeof persisted.key).toBe('string');
    expect(persisted.name).toBe('Year 10');
    expect(yearGroupsCollection.save).toHaveBeenCalledTimes(1);
    expect(result.key).toBe(persisted.key);
    expect(result.name).toBe('Year 10');
  });

  it('creating year group with invalid name rejected without persistence', () => {
    primeCollectionLookupByKey(yearGroupsCollection, []);

    expect(() => new ReferenceDataController().createYearGroup({ name: '   ' })).toThrow(
      /non-empty string|invalid/i
    );
    expect(yearGroupsCollection.insertOne).not.toHaveBeenCalled();
    expect(yearGroupsCollection.save).not.toHaveBeenCalled();
  });

  it('listing year groups returns { key, name } items sorted by name', () => {
    primeCollectionLookupByKey(yearGroupsCollection, [
      { _id: 'yg-3', key: 'yg-y9', name: 'Year 9' },
      { _id: 'yg-1', key: 'yg-y10', name: 'Year 10' },
      { _id: 'yg-2', key: 'yg-y11', name: 'Year 11' },
    ]);

    const result = new ReferenceDataController().listYearGroups();

    expect(result).toEqual([
      { key: 'yg-y10', name: 'Year 10' },
      { key: 'yg-y11', name: 'Year 11' },
      { key: 'yg-y9', name: 'Year 9' },
    ]);
    expect(result[0]).not.toHaveProperty('_id');
  });

  it('updating year group by key can rename', () => {
    primeCollectionLookupByKey(yearGroupsCollection, [{ key: 'yg-001', name: 'Year 10' }]);

    const result = new ReferenceDataController().updateYearGroup({
      key: 'yg-001',
      record: { name: 'Year 11' },
    });

    expect(yearGroupsCollection.replaceOne).toHaveBeenCalledWith(
      { key: 'yg-001' },
      expect.objectContaining({ key: 'yg-001', name: 'Year 11' })
    );
    expect(yearGroupsCollection.save).toHaveBeenCalledTimes(1);
    expect(result.key).toBe('yg-001');
    expect(result.name).toBe('Year 11');
  });

  it('updating year group preserves key across rename', () => {
    primeCollectionLookupByKey(yearGroupsCollection, [{ key: 'yg-001', name: 'Year 10' }]);

    const result = new ReferenceDataController().updateYearGroup({
      key: 'yg-001',
      record: { name: 'Year 10 Advanced' },
    });

    expect(result.key).toBe('yg-001');
  });

  it('updating missing year group key rejected', () => {
    primeCollectionLookupByKey(yearGroupsCollection, [{ key: 'yg-001', name: 'Year 10' }]);

    expect(() =>
      new ReferenceDataController().updateYearGroup({
        key: 'yg-999',
        record: { name: 'Year 12' },
      })
    ).toThrow(/not found|missing/i);
    expect(yearGroupsCollection.replaceOne).not.toHaveBeenCalled();
  });

  it('updating year group with invalid name rejected without persistence', () => {
    primeCollectionLookupByKey(yearGroupsCollection, [{ key: 'yg-001', name: 'Year 10' }]);

    expect(() =>
      new ReferenceDataController().updateYearGroup({
        key: 'yg-001',
        record: { name: '' },
      })
    ).toThrow(/non-empty string|invalid/i);
    expect(yearGroupsCollection.replaceOne).not.toHaveBeenCalled();
    expect(yearGroupsCollection.save).not.toHaveBeenCalled();
  });

  it('deleting year group by key removes it', () => {
    primeCollectionLookupByKey(yearGroupsCollection, [{ key: 'yg-001', name: 'Year 10' }]);
    partialsCollection.find.mockReturnValue([]);

    new ReferenceDataController().deleteYearGroup('yg-001');

    expect(yearGroupsCollection.deleteOne).toHaveBeenCalledWith({ key: 'yg-001' });
    expect(yearGroupsCollection.save).toHaveBeenCalledTimes(1);
  });

  it('deleting missing year group key rejected', () => {
    primeCollectionLookupByKey(yearGroupsCollection, []);

    expect(() => new ReferenceDataController().deleteYearGroup('yg-999')).toThrow(
      /not found|missing/i
    );
    expect(yearGroupsCollection.deleteOne).not.toHaveBeenCalled();
  });

  it('deleteYearGroup rejects with machine-readable IN_USE reason when year group is referenced by an ABClass', () => {
    primeCollectionLookupByKey(yearGroupsCollection, [{ key: 'yg-001', name: 'Year 10' }]);
    partialsCollection.find.mockReturnValue([{ classId: 'class-001', yearGroupKey: 'yg-001' }]);

    let error;
    try {
      new ReferenceDataController().deleteYearGroup('yg-001');
    } catch (err) {
      error = err;
    }

    expect(error).toBeDefined();
    expect(error.reason ?? error.code ?? error.message).toMatch(/IN_USE|in.use|in_use|referenced/i);
    expect(yearGroupsCollection.deleteOne).not.toHaveBeenCalled();
    expect(yearGroupsCollection.save).not.toHaveBeenCalled();
  });
});

describe('ReferenceDataController – transport-safe responses', () => {
  it('list responses exclude _id and include key', () => {
    primeCollectionLookupByKey(cohortsCollection, [
      {
        _id: 'cohort-1',
        key: 'coh-001',
        name: '2026',
        active: true,
        startYear: 2025,
        startMonth: 9,
      },
    ]);
    primeCollectionLookupByKey(yearGroupsCollection, [
      { _id: 'yg-1', key: 'yg-001', name: 'Year 10' },
    ]);

    const controller = new ReferenceDataController();
    const cohorts = controller.listCohorts();
    const yearGroups = controller.listYearGroups();

    expect(cohorts[0]).toHaveProperty('key', 'coh-001');
    expect(yearGroups[0]).toHaveProperty('key', 'yg-001');
    expect(cohorts[0]).not.toHaveProperty('_id');
    expect(yearGroups[0]).not.toHaveProperty('_id');
  });

  it('create responses exclude _id and include generated key', () => {
    primeCollectionLookupByKey(cohortsCollection, []);
    primeCollectionLookupByKey(yearGroupsCollection, []);

    const controller = new ReferenceDataController();
    const cohort = controller.createCohort({
      name: '2031',
      active: true,
      startYear: 2030,
      startMonth: 9,
    });
    const yearGroup = controller.createYearGroup({ name: 'Year 12' });

    expect(cohort).toHaveProperty('key');
    expect(typeof cohort.key).toBe('string');
    expect(cohort.name).toBe('2031');
    expect(yearGroup).toHaveProperty('key');
    expect(typeof yearGroup.key).toBe('string');
    expect(yearGroup.name).toBe('Year 12');
    expect(cohort).not.toHaveProperty('_id');
    expect(yearGroup).not.toHaveProperty('_id');
  });

  it('update responses exclude _id and preserve key', () => {
    primeCollectionLookupByKey(cohortsCollection, [
      { key: 'coh-001', name: '2026', active: true, startYear: 2025, startMonth: 9 },
    ]);
    primeCollectionLookupByKey(yearGroupsCollection, [{ key: 'yg-001', name: 'Year 10' }]);

    const controller = new ReferenceDataController();
    const cohort = controller.updateCohort({
      key: 'coh-001',
      record: { name: '2027', active: false, startYear: 2026, startMonth: 9 },
    });
    const yearGroup = controller.updateYearGroup({
      key: 'yg-001',
      record: { name: 'Year 11' },
    });

    expect(cohort.key).toBe('coh-001');
    expect(yearGroup.key).toBe('yg-001');
    expect(cohort).not.toHaveProperty('_id');
    expect(yearGroup).not.toHaveProperty('_id');
  });
});
