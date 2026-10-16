/** ReferenceDataController – assignment-topic key-based persistence tests */
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

describe('ReferenceDataController – assignment-topic key-based persistence', () => {
  it('listing assignment topics returns { key, name, yearGroupKeys } items sorted by name', () => {
    primeCollectionLookupByKey(assignmentTopicsCollection, [
      { _id: 'topic-2', key: 'topic-z', name: 'Trigonometry', yearGroupKeys: ['yg-math'] },
      { _id: 'topic-1', key: 'topic-a', name: 'Algebra', yearGroupKeys: ['yg-math'] },
      { _id: 'topic-3', key: 'topic-l', name: 'Linear Equations', yearGroupKeys: ['yg-math'] },
    ]);

    const result = new ReferenceDataController().listAssignmentTopics();

    expect(result).toEqual([
      { key: 'topic-a', name: 'Algebra', yearGroupKeys: ['yg-math'] },
      { key: 'topic-l', name: 'Linear Equations', yearGroupKeys: ['yg-math'] },
      { key: 'topic-z', name: 'Trigonometry', yearGroupKeys: ['yg-math'] },
    ]);
    expect(result[0]).not.toHaveProperty('_id');
  });

  it('creating assignment topic with yearGroupKeys generates a stable key and rejects duplicates', () => {
    primeCollectionLookupByKey(assignmentTopicsCollection, []);

    const created = new ReferenceDataController().createAssignmentTopic({
      name: 'Algebra',
      yearGroupKeys: ['yg-math'],
    });

    expect(assignmentTopicsCollection.insertOne).toHaveBeenCalledTimes(1);
    const persisted = assignmentTopicsCollection.insertOne.mock.calls[0][0];
    expect(created).toEqual({ key: persisted.key, name: 'Algebra', yearGroupKeys: ['yg-math'] });
    expect(typeof created.key).toBe('string');
    expect(created.key.length).toBeGreaterThan(0);

    primeCollectionLookupByKey(assignmentTopicsCollection, [persisted]);
    expect(() =>
      new ReferenceDataController().createAssignmentTopic({
        name: ' algebra ',
        yearGroupKeys: ['yg-math'],
      })
    ).toThrow(/duplicate/i);
    expect(assignmentTopicsCollection.insertOne).toHaveBeenCalledTimes(1);
  });

  it('updating assignment topic with yearGroupKeys preserves key and rejects duplicate replacement names', () => {
    primeCollectionLookupByKey(assignmentTopicsCollection, [
      { key: 'topic-algebra', name: 'Algebra', yearGroupKeys: ['yg-math'] },
      { key: 'topic-geometry', name: 'Geometry', yearGroupKeys: ['yg-math'] },
    ]);

    const updated = new ReferenceDataController().updateAssignmentTopic({
      key: 'topic-algebra',
      record: { name: 'Advanced Algebra', yearGroupKeys: ['yg-math', 'yg-advanced'] },
    });

    expect(updated).toEqual({
      key: 'topic-algebra',
      name: 'Advanced Algebra',
      yearGroupKeys: ['yg-math', 'yg-advanced'],
    });
    expect(assignmentTopicsCollection.replaceOne).toHaveBeenCalledWith(
      { key: 'topic-algebra' },
      expect.objectContaining({
        key: 'topic-algebra',
        name: 'Advanced Algebra',
        yearGroupKeys: ['yg-math', 'yg-advanced'],
      })
    );

    expect(() =>
      new ReferenceDataController().updateAssignmentTopic({
        key: 'topic-algebra',
        record: { name: ' geometry ', yearGroupKeys: ['yg-math'] },
      })
    ).toThrow(/duplicate/i);
  });

  it('deleting assignment topic removes keyed record when unused', () => {
    primeCollectionLookupByKey(assignmentTopicsCollection, [
      { key: 'topic-algebra', name: 'Algebra', yearGroupKeys: [] },
    ]);
    assignmentDefinitionPartialsCollection.find.mockReturnValue([]);

    new ReferenceDataController().deleteAssignmentTopic('topic-algebra');

    expect(assignmentTopicsCollection.deleteOne).toHaveBeenCalledWith({ key: 'topic-algebra' });
    expect(assignmentTopicsCollection.save).toHaveBeenCalledTimes(1);
  });

  it('deleteAssignmentTopic rejects with machine-readable IN_USE when one or more definitions reference the topic key', () => {
    primeCollectionLookupByKey(assignmentTopicsCollection, [
      { key: 'topic-algebra', name: 'Algebra' },
    ]);
    assignmentDefinitionPartialsCollection.find.mockReturnValue([
      { definitionKey: 'def-001', primaryTopicKey: 'topic-algebra' },
      { definitionKey: 'def-002', primaryTopicKey: 'topic-geometry' },
    ]);

    let error;
    try {
      new ReferenceDataController().deleteAssignmentTopic('topic-algebra');
    } catch (err) {
      error = err;
    }

    expect(error).toBeDefined();
    expect(error.message).toBe(
      'Assignment topic record is referenced by one or more assignment definitions'
    );
    expect(error.reason === 'IN_USE' || error.code === 'IN_USE').toBe(true);
    expect(assignmentTopicsCollection.deleteOne).not.toHaveBeenCalled();
    expect(assignmentTopicsCollection.save).not.toHaveBeenCalled();
  });
});
