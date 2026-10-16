/** ReferenceDataController – year-group key-based persistence tests */
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

describe('ReferenceDataController – year-group key-based persistence', () => {
  it('listing empty year_groups returns []', () => {
    primeCollectionLookupByKey(yearGroupsCollection, []);

    const result = new ReferenceDataController().listYearGroups();

    expect(mockDbManager.getCollection).toHaveBeenCalledWith('year_groups');
    expect(yearGroupsCollection.find).toHaveBeenCalledTimes(1);
    expect(result).toEqual([]);
  });

  it('creating year group uses the GAS UUID and persists { key, name }', () => {
    primeCollectionLookupByKey(yearGroupsCollection, []);
    const generatedUuid = 'year-group-gas-uuid';
    vi.spyOn(globalThis.Utilities, 'getUuid').mockReturnValue(generatedUuid);

    const result = new ReferenceDataController().createYearGroup({ name: 'Year 10' });

    expect(mockDbManager.getCollection).toHaveBeenCalledWith('year_groups');
    expect(yearGroupsCollection.insertOne).toHaveBeenCalledTimes(1);
    const persisted = yearGroupsCollection.insertOne.mock.calls[0][0];
    expect(persisted.key).toBe(generatedUuid);
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
    expect(error.message).toBe('Year group record is referenced by one or more classes');
    expect(error.reason ?? error.code ?? error.message).toMatch(/IN_USE|in.use|in_use|referenced/i);
    expect(yearGroupsCollection.deleteOne).not.toHaveBeenCalled();
    expect(yearGroupsCollection.save).not.toHaveBeenCalled();
  });
});
