/**
 * ABClassController – Roster Sync / Partial Upsert Tests (RED Phase)
 *
 * Behaviour under test: roster persistence writes through to class partials
 *
 * Tests validating that _persistRoster() also upserts the abclass_partials doc
 * after successfully writing the roster to the class collection.
 *
 * All tests MUST FAIL until _persistRoster() is updated to call the partial
 * upsert (e.g. by delegating to _persistClassAndPartial or writing to
 * abclass_partials directly).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  cleanupControllerTestMocks,
  createMockCollection,
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
  const mockDbManager = {
    getCollection: vi.fn((name) => {
      if (name === 'abclass_partials') return partialsCollection;
      return classCollection;
    }),
  };

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
  const abClassModule = await import('../../src/backend/Models/ABClass.js');
  const controllerModule = await import('../../src/backend/y_controllers/ABClassController.js');

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
  // Test 2: Two consecutive _persistRoster() calls do not duplicate partials
  // -------------------------------------------------------------------------
  it('second _persistRoster() call uses replaceOne (not insertOne) on abclass_partials', () => {
    const controller = new ABClassController();
    const abClass = new ABClass({ classId: 'class-r02', className: 'No Duplicate Class' });

    const existingDoc = { _id: 'doc-2', classId: 'class-r02' };

    // First call: no existing partial
    partialsCollection.findOne.mockReturnValueOnce(null);
    // Second call: partial already exists
    partialsCollection.findOne.mockReturnValueOnce({
      classId: 'class-r02',
      className: 'No Duplicate Class',
    });

    controller._persistRoster(classCollection, existingDoc, abClass);
    controller._persistRoster(classCollection, existingDoc, abClass);

    // RED: _persistRoster currently never touches abclass_partials,
    // so neither insertOne nor replaceOne will be called at all
    expect(partialsCollection.insertOne).toHaveBeenCalledTimes(1);
    expect(partialsCollection.replaceOne).toHaveBeenCalledTimes(1);

    // insertOne must not be called on the second save
    expect(partialsCollection.insertOne).not.toHaveBeenCalledTimes(2);
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

    // RED: _persistRoster does not write to abclass_partials yet
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
    // RED: this assertion passes trivially today (partials never touched),
    // but will correctly guard the ordering once roster partial write-through is implemented —
    // at that point the test ensures the write sequence is roster-first, partial-second.
    expect(partialsCollection.insertOne).not.toHaveBeenCalled();
    expect(partialsCollection.replaceOne).not.toHaveBeenCalled();

    // Error must also be logged
    expect(mockABLogger.error).toHaveBeenCalled();
  });
});
