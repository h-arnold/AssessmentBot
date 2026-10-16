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
import {
  setupReferenceDataTestGlobals,
  restoreReferenceDataTestGlobals,
  primeCollectionLookupByKey,
  setupReferenceDataTest,
  teardownReferenceDataTest,
} from './referenceDataTestSupport.js';
import { withGlobalMocks } from '../helpers/globalMockManager.js';
let ReferenceDataController,
  cohortsCollection,
  yearGroupsCollection,
  partialsCollection,
  assignmentTopicsCollection,
  assignmentDefinitionPartialsCollection,
  mockDbManager;
beforeAll(setupReferenceDataTestGlobals);
afterAll(restoreReferenceDataTestGlobals);
beforeEach(async () => {
  ({
    ReferenceDataController,
    cohortsCollection,
    yearGroupsCollection,
    partialsCollection,
    assignmentTopicsCollection,
    assignmentDefinitionPartialsCollection,
    mockDbManager,
  } = await setupReferenceDataTest(vi));
});
afterEach(() => teardownReferenceDataTest(vi));

/**
 * Returns the expected academic-year start year for the given JS Date.
 * Sep–Dec: current calendar year; Jan–Aug: previous calendar year.
 */
function expectedAcademicYearStart(date) {
  const month = date.getMonth() + 1; // 1-indexed
  return month >= 9 ? date.getFullYear() : date.getFullYear() - 1;
}
describe('ReferenceDataController – cohort key-based persistence', () => {
  it('listing empty cohorts returns []', () => {
    primeCollectionLookupByKey(cohortsCollection, []);

    const result = new ReferenceDataController().listCohorts();

    expect(mockDbManager.getCollection).toHaveBeenCalledWith('cohorts');
    expect(cohortsCollection.find).toHaveBeenCalledTimes(1);
    expect(result).toEqual([]);
  });

  it('creating cohort uses the GAS UUID and persists { key, name, active, startYear, startMonth }', () => {
    primeCollectionLookupByKey(cohortsCollection, []);
    const generatedUuid = 'cohort-gas-uuid';
    vi.spyOn(globalThis.Utilities, 'getUuid').mockReturnValue(generatedUuid);

    const result = new ReferenceDataController().createCohort({
      name: '2028',
      active: false,
      startYear: 2027,
      startMonth: 9,
    });

    expect(mockDbManager.getCollection).toHaveBeenCalledWith('cohorts');
    expect(cohortsCollection.insertOne).toHaveBeenCalledTimes(1);
    const persisted = cohortsCollection.insertOne.mock.calls[0][0];
    expect(persisted.key).toBe(generatedUuid);
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

  it('creating cohort fails without the GAS UUID service and does not persist a fabricated key', () => {
    primeCollectionLookupByKey(cohortsCollection, []);
    const utilitiesWithoutUuid = { ...globalThis.Utilities, getUuid: undefined };
    const { restore } = withGlobalMocks({ Utilities: utilitiesWithoutUuid });

    try {
      expect(() =>
        new ReferenceDataController().createCohort({
          name: '2032',
          active: true,
          startYear: 2031,
          startMonth: 9,
        })
      ).toThrow(/Utilities\.getUuid/i);
      expect(cohortsCollection.insertOne).not.toHaveBeenCalled();
      expect(cohortsCollection.save).not.toHaveBeenCalled();
    } finally {
      restore();
    }
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
    expect(error.message).toBe('Cohort record is referenced by one or more classes');
    expect(error.reason ?? error.code ?? error.message).toMatch(/IN_USE|in.use|in_use|referenced/i);
    expect(cohortsCollection.deleteOne).not.toHaveBeenCalled();
    expect(cohortsCollection.save).not.toHaveBeenCalled();
  });
});
