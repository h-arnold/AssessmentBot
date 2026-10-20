/**
 * ABClassController – Roster Sync / Partial Upsert Tests (RED Phase)
 *
 * Behaviour under test: roster persistence writes through to class partials
 *
 * Tests validating roster write-through to the abclass_partials registry.
 *
 * Existing registry rows are updated in place; missing rows are inserted.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  cleanupControllerTestMocks,
  createMockCollection,
  createDualCollectionDbManager,
  setupControllerTestMocks,
} from '../helpers/mockFactories.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Override globalThis.DbManager with a dual-collection router after
 * setupControllerTestMocks() has set up ABLogger, ProgressTracker,
 * ConfigurationManager, and AssignmentDefinitionController.
 *
 * @param {object} classCollection - mock for the class-named collection
 * @param {object} partialsCollection - mock for the 'abclass_partials' collection
 */
function setupMocks(classCollection, partialsCollection) {
  const mockDbManager = createDualCollectionDbManager(vi, classCollection, partialsCollection);
  globalThis.DbManager = { getInstance: () => mockDbManager };
}

// ---------------------------------------------------------------------------
// Module-level variables re-assigned in beforeEach
// ---------------------------------------------------------------------------

let ABClassController, ABClass;
let classCollection, partialsCollection, mockABLogger;

beforeEach(async () => {
  classCollection = createMockCollection(vi);
  partialsCollection = createMockCollection(vi);

  const mocks = setupControllerTestMocks(vi);
  mockABLogger = mocks.mockABLogger;

  setupMocks(classCollection, partialsCollection);

  // Dynamic import after globals are set to ensure globals are in place before module evaluation
  const abClassModule = await import('#backend/Models/ABClass.js');
  const controllerModule = await import('#backend/y_controllers/ABClassController/index.js');

  ABClass = abClassModule.ABClass;
  ABClassController = controllerModule.default ?? controllerModule;
});

afterEach(() => {
  cleanupControllerTestMocks();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('ABClassController – roster sync to abclass_partials', () => {
  // -------------------------------------------------------------------------
  // Test 1: _persistRoster() triggers partial upsert after persisting roster
  // -------------------------------------------------------------------------
  it('_persistRoster() upserts a partial doc in abclass_partials after persisting the roster', () => {
    const controller = new ABClassController();
    const abClass = new ABClass({ classId: 'class-r01', className: 'Roster Sync Class' });

    const existingDoc = { _id: 'doc-1', classId: 'class-r01' };

    // No existing partial yet
    partialsCollection.findOne.mockReturnValue(null);

    controller._persistRoster(classCollection, existingDoc, abClass);

    // RED: _persistRoster currently never touches abclass_partials
    expect(partialsCollection.insertOne).toHaveBeenCalledTimes(1);

    const insertedPartial = partialsCollection.insertOne.mock.calls[0][0];
    expect(insertedPartial).toBeDefined();
    expect(insertedPartial.classId).toBe('class-r01');
  });

  // -------------------------------------------------------------------------
  // Test 2: Existing registry rows use a scoped patch, not replacement
  // -------------------------------------------------------------------------
  it('second _persistRoster() call patches the existing row by its stored id', () => {
    const controller = new ABClassController();
    const abClass = new ABClass({ classId: 'class-r02', className: 'No Duplicate Class' });

    const existingDoc = { _id: 'doc-2', classId: 'class-r02' };

    // First call: no existing partial
    partialsCollection.findOne.mockReturnValueOnce(null);
    // Second call: partial already exists
    partialsCollection.findOne.mockReturnValueOnce({
      classId: 'class-r02',
      _id: 'partial-r02',
      className: 'No Duplicate Class',
    });
    partialsCollection.updateOne.mockReturnValue({
      matchedCount: 1,
      modifiedCount: 0,
      acknowledged: true,
    });

    controller._persistRoster(classCollection, existingDoc, abClass);
    controller._persistRoster(classCollection, existingDoc, abClass);

    expect(partialsCollection.insertOne).toHaveBeenCalledTimes(1);
    expect(partialsCollection.updateOne).toHaveBeenCalledTimes(1);
    expect(partialsCollection.updateOne).toHaveBeenCalledWith(
      { _id: 'partial-r02' },
      { $set: { className: 'No Duplicate Class', classOwner: null, teachers: [] } }
    );
    expect(partialsCollection.replaceOne).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Test 3: Partial doc reflects updated className after roster save cycle
  // -------------------------------------------------------------------------
  it('partial doc written by _persistRoster() contains the current className', () => {
    const controller = new ABClassController();
    const abClass = new ABClass({ classId: 'class-r03', className: 'Original Name' });

    // Simulate metadata update applied before persisting roster
    abClass.setClassName('Updated Roster Name');

    const existingDoc = { _id: 'doc-3', classId: 'class-r03' };

    // No existing partial
    partialsCollection.findOne.mockReturnValue(null);

    controller._persistRoster(classCollection, existingDoc, abClass);

    expect(partialsCollection.insertOne).toHaveBeenCalledTimes(1);

    const writtenPartial = partialsCollection.insertOne.mock.calls[0][0];
    expect(writtenPartial.classId).toBe('class-r03');
    expect(writtenPartial.className).toBe('Updated Roster Name');
  });

  // -------------------------------------------------------------------------
  // Test 4: If roster persistence fails, partial upsert is NOT called
  // -------------------------------------------------------------------------
  it('does not call partial upsert when roster collection write throws', () => {
    const controller = new ABClassController();
    const abClass = new ABClass({ classId: 'class-r04', className: 'Error Case Class' });

    const existingDoc = { _id: 'doc-4', classId: 'class-r04' };

    // Simulate failure on the class collection write
    classCollection.updateOne.mockImplementation(() => {
      throw new Error('roster write failure');
    });

    expect(() => controller._persistRoster(classCollection, existingDoc, abClass)).toThrow(
      'roster write failure'
    );

    // Partial upsert must never be reached when roster write fails
    // The registry must not be touched after the full roster write fails.
    expect(partialsCollection.insertOne).not.toHaveBeenCalled();
    expect(partialsCollection.replaceOne).not.toHaveBeenCalled();

    // Error must also be logged
    expect(mockABLogger.error).toHaveBeenCalled();
  });
});
