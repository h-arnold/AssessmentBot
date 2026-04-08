/**
 * ABClassController – Class Partials Persistence Tests (RED Phase)
 *
 * Behaviour under test: saveClass() writes through to the class partials registry
 *
 * Tests validating the write-through persistence contract:
 * - saveClass() writes to the class collection AND upserts a partial doc in abclass_partials
 * - _persistClassAndPartial() is the single internal write-through path
 * - Upsert filter uses classId
 * - Errors from the partials collection surface loudly
 * - Full class writes happen before partial upserts
 *
 * These tests MUST FAIL until _persistClassAndPartial() is implemented and saveClass()
 * is updated to call it.
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
 * setupControllerTestMocks() has already set up ABLogger, ProgressTracker,
 * ConfigurationManager, and AssignmentDefinitionController.
 *
 * @param {object} classCollection - mock for the class-named collection
 * @param {object} partialsCollection - mock for the 'abclass_partials' collection
 * @returns {{ mockDbManager }}
 */
function setupMocks(classCollection, partialsCollection) {
  const mockDbManager = {
    getCollection: vi.fn((name) => {
      if (name === 'abclass_partials') return partialsCollection;
      return classCollection;
    }),
  };

  globalThis.DbManager = { getInstance: () => mockDbManager };

  return { mockDbManager };
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

  // Dynamic require after globals are set (CommonJS modules read globals at call time)
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

describe('ABClassController – class partials persistence', () => {
  // -------------------------------------------------------------------------
  // Test 1: saveClass inserts partial doc when none exists
  // -------------------------------------------------------------------------
  it('saveClass() inserts partial doc in abclass_partials when none exists for that classId', () => {
    const controller = new ABClassController();
    const abClass = new ABClass({ classId: 'class-001', className: 'Test Class Alpha' });

    // No existing partial for this classId
    partialsCollection.findOne.mockReturnValue(null);

    controller.saveClass(abClass);

    // RED: saveClass does not touch abclass_partials yet — this assertion will fail
    expect(partialsCollection.insertOne).toHaveBeenCalledTimes(1);

    const insertedDoc = partialsCollection.insertOne.mock.calls[0][0];
    expect(insertedDoc).toBeDefined();
    expect(insertedDoc.classId).toBe('class-001');
  });

  // -------------------------------------------------------------------------
  // Test 2: saveClass replaces partial doc when one already exists
  // -------------------------------------------------------------------------
  it('saveClass() replaces partial doc in abclass_partials when one already exists for classId', () => {
    const controller = new ABClassController();
    const abClass = new ABClass({ classId: 'class-002', className: 'Test Class Beta' });

    // Simulate an existing partial doc
    partialsCollection.findOne.mockReturnValue({ classId: 'class-002', className: 'Old Name' });

    controller.saveClass(abClass);

    // RED: saveClass does not touch abclass_partials yet — this assertion will fail
    expect(partialsCollection.replaceOne).toHaveBeenCalledTimes(1);

    // insertOne should NOT have been called (replace path, not insert)
    expect(partialsCollection.insertOne).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Test 3: Upsert filter uses classId
  // -------------------------------------------------------------------------
  it('partial upsert filter uses classId (not index or position)', () => {
    const controller = new ABClassController();
    const abClass = new ABClass({ classId: 'class-filter-check', className: 'Filter Check Class' });

    // Return an existing doc so the replace branch is taken
    partialsCollection.findOne.mockReturnValue({ classId: 'class-filter-check' });

    controller.saveClass(abClass);

    // RED: replaceOne not called on partialsCollection at all yet
    expect(partialsCollection.replaceOne).toHaveBeenCalledTimes(1);

    const [filter] = partialsCollection.replaceOne.mock.calls[0];
    expect(filter).toEqual(expect.objectContaining({ classId: 'class-filter-check' }));

    // Filter must NOT rely on numeric index or array position
    expect(filter).not.toHaveProperty('index');
    expect(filter).not.toHaveProperty('position');
    expect(Object.keys(filter)).not.toContain('_index');
  });

  // -------------------------------------------------------------------------
  // Test 4: Partial registry write failure throws and is logged
  // -------------------------------------------------------------------------
  it('throws and logs error when partial registry write fails', () => {
    const controller = new ABClassController();
    const abClass = new ABClass({ classId: 'class-003', className: 'Test Class Gamma' });

    // Simulate failure on the partials collection insert
    partialsCollection.findOne.mockReturnValue(null);
    partialsCollection.insertOne.mockImplementation(() => {
      throw new Error('abclass_partials write failure');
    });

    expect(() => controller.saveClass(abClass)).toThrow();

    expect(classCollection.insertOne).toHaveBeenCalledTimes(1);
    expect(classCollection.save).toHaveBeenCalledTimes(1);
    expect(mockABLogger.error).toHaveBeenCalled();

    const [, loggedContext] = mockABLogger.error.mock.calls[0];
    expect(loggedContext?.err?.message ?? loggedContext?.message ?? '').toMatch(/partial/i);
  });

  // -------------------------------------------------------------------------
  // Test 5: Full class collection write succeeds alongside partial upsert
  // -------------------------------------------------------------------------
  it('full class document is still persisted to its own collection when partial upsert succeeds', () => {
    const controller = new ABClassController();
    const abClass = new ABClass({ classId: 'class-004', className: 'Test Class Delta' });

    // Both collections: no existing docs
    classCollection.findOne.mockReturnValue(null);
    partialsCollection.findOne.mockReturnValue(null);

    controller.saveClass(abClass);

    expect(classCollection.insertOne).toHaveBeenCalledTimes(1);
    expect(classCollection.save).toHaveBeenCalledTimes(1);

    expect(partialsCollection.insertOne).toHaveBeenCalledTimes(1);
    expect(partialsCollection.save).toHaveBeenCalledTimes(1);

    const fullDoc = classCollection.insertOne.mock.calls[0][0];
    expect(fullDoc.classId).toBe('class-004');
  });

  // -------------------------------------------------------------------------
  // Test 6: saveClass delegates to _persistClassAndPartial (write-through pattern)
  // -------------------------------------------------------------------------
  it('saveClass() calls _persistClassAndPartial() internally (write-through pattern)', () => {
    const controller = new ABClassController();
    const abClass = new ABClass({ classId: 'class-005', className: 'Test Class Epsilon' });

    expect(typeof controller._persistClassAndPartial).toBe('function');

    const spy = vi.spyOn(controller, '_persistClassAndPartial');

    controller.saveClass(abClass);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(abClass);
  });

  it('does not write a partial when the full class write fails', () => {
    const controller = new ABClassController();
    const abClass = new ABClass({ classId: 'class-006', className: 'Broken Full Write' });

    classCollection.findOne.mockReturnValue(null);
    classCollection.insertOne.mockImplementation(() => {
      throw new Error('class collection write failure');
    });

    expect(() => controller.saveClass(abClass)).toThrow('class collection write failure');

    expect(partialsCollection.findOne).not.toHaveBeenCalled();
    expect(partialsCollection.insertOne).not.toHaveBeenCalled();
    expect(partialsCollection.replaceOne).not.toHaveBeenCalled();
    expect(partialsCollection.save).not.toHaveBeenCalled();
    expect(mockABLogger.error).toHaveBeenCalled();
  });
});
