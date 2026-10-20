/** ReferenceDataController – transport-safe response tests */
import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import {
  setupReferenceDataTestGlobals,
  restoreReferenceDataTestGlobals,
  primeCollectionLookupByKey,
  setupReferenceDataTest,
  teardownReferenceDataTest,
} from './referenceDataTestSupport.js';
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
