/**
 * ABClassController – Class Partials Read Tests (RED Phase)
 *
 * Section 4 of ACTION_PLAN.md: "Implement read path for all class partials"
 *
 * Tests validating the read contract for getAllClassPartials():
 * - Reads from the abclass_partials collection via DbManager
 * - Returns all documents as a plain array
 * - Returns [] when no documents exist
 * - Throws on collection read failure
 *
 * These tests MUST FAIL until getAllClassPartials() is implemented on ABClassController.
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

let ABClassController;
let classCollection, partialsCollection;

beforeEach(async () => {
  classCollection = createMockCollection(vi);
  partialsCollection = createMockCollection(vi);

  setupControllerTestMocks(vi);
  setupMocks(classCollection, partialsCollection);

  const controllerModule = await import('../../src/backend/y_controllers/ABClassController.js');
  ABClassController = controllerModule.default ?? controllerModule;
});

afterEach(() => {
  cleanupControllerTestMocks();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('ABClassController – getAllClassPartials() read path (Section 4)', () => {
  // -------------------------------------------------------------------------
  // Test 1: returns all documents from abclass_partials
  // -------------------------------------------------------------------------
  it('getAllClassPartials() returns all documents from abclass_partials', () => {
    const docs = [
      { classId: 'class-001', className: 'Alpha' },
      { classId: 'class-002', className: 'Beta' },
    ];
    partialsCollection.find.mockReturnValue(docs);

    const controller = new ABClassController();

    // RED: getAllClassPartials does not exist yet — this will throw or fail
    const result = controller.getAllClassPartials();

    expect(partialsCollection.find).toHaveBeenCalledTimes(1);
    expect(result).toEqual(docs);
  });

  // -------------------------------------------------------------------------
  // Test 2: returns [] when the collection has no documents
  // -------------------------------------------------------------------------
  it('getAllClassPartials() returns [] when the collection has no documents', () => {
    partialsCollection.find.mockReturnValue([]);

    const controller = new ABClassController();

    // RED: getAllClassPartials does not exist yet
    const result = controller.getAllClassPartials();

    expect(result).toEqual([]);
    expect(Array.isArray(result)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Test 3: throws on collection read failure
  // -------------------------------------------------------------------------
  it('getAllClassPartials() throws when the abclass_partials collection read fails', () => {
    partialsCollection.find.mockImplementation(() => {
      throw new Error('abclass_partials read failure');
    });

    const controller = new ABClassController();

    // RED: getAllClassPartials does not exist yet.
    // The additional assertion on find ensures the test fails until the method
    // actually delegates to the collection (rather than passing because any
    // call to a missing method throws a TypeError).
    expect(() => controller.getAllClassPartials()).toThrow('abclass_partials read failure');
    expect(partialsCollection.find).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Test 4: return value is a plain array (suitable for transport)
  // -------------------------------------------------------------------------
  it('getAllClassPartials() return value is an Array', () => {
    const docs = [{ classId: 'class-003', className: 'Gamma' }];
    partialsCollection.find.mockReturnValue(docs);

    const controller = new ABClassController();

    // RED: getAllClassPartials does not exist yet
    const result = controller.getAllClassPartials();

    expect(Array.isArray(result)).toBe(true);
  });
});
