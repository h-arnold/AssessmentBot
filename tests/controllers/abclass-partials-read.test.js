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

describe('ABClassController – getAllClassPartials() read path', () => {
  it('getAllClassPartials() returns all documents from abclass_partials without label fields', () => {
    const docs = [
      {
        _id: 'doc-1',
        classId: 'class-001',
        className: 'Alpha',
        cohortKey: 'coh-uuid-001',
        yearGroupKey: 'yg-uuid-010',
        courseLength: 2,
        classOwner: { userId: 'owner-1' },
        teachers: [{ userId: 'teacher-1' }],
        students: [{ userId: 'student-1' }],
        assignments: [{ assignmentId: 'assignment-1' }],
        active: true,
        metadataVersion: 3,
      },
      {
        _id: 'doc-2',
        classId: 'class-002',
        className: 'Beta',
        cohortKey: 'coh-uuid-002',
        cohortLabel: '2024-2025',
        yearGroupKey: 'yg-uuid-009',
        yearGroupLabel: 'Year 9',
        courseLength: 1,
        classOwner: null,
        teachers: [],
        active: false,
      },
    ];
    partialsCollection.find.mockReturnValue(docs);

    const controller = new ABClassController();

    const result = controller.getAllClassPartials();

    expect(partialsCollection.find).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      {
        classId: 'class-001',
        className: 'Alpha',
        cohortKey: 'coh-uuid-001',
        yearGroupKey: 'yg-uuid-010',
        courseLength: 2,
        classOwner: { userId: 'owner-1' },
        teachers: [{ userId: 'teacher-1' }],
        active: true,
      },
      {
        classId: 'class-002',
        className: 'Beta',
        cohortKey: 'coh-uuid-002',
        yearGroupKey: 'yg-uuid-009',
        courseLength: 1,
        classOwner: null,
        teachers: [],
        active: false,
      },
    ]);
    expect(result[0]).not.toHaveProperty('_id');
    expect(result[0]).not.toHaveProperty('students');
    expect(result[0]).not.toHaveProperty('assignments');
    expect(result[0]).not.toHaveProperty('metadataVersion');
    expect(result[0]).not.toHaveProperty('cohort');
    expect(result[0]).not.toHaveProperty('yearGroup');
    expect(result[0]).not.toHaveProperty('cohortLabel');
    expect(result[0]).not.toHaveProperty('yearGroupLabel');
  });

  it('getAllClassPartials() returns [] when the collection has no documents', () => {
    partialsCollection.find.mockReturnValue([]);

    const result = new ABClassController().getAllClassPartials();

    expect(result).toEqual([]);
    expect(Array.isArray(result)).toBe(true);
  });

  it('getAllClassPartials() throws when the abclass_partials collection read fails', () => {
    partialsCollection.find.mockImplementation(() => {
      throw new Error('abclass_partials read failure');
    });

    expect(() => new ABClassController().getAllClassPartials()).toThrow(
      'abclass_partials read failure'
    );
    expect(partialsCollection.find).toHaveBeenCalledTimes(1);
  });

  it('getAllClassPartials() return value is an Array', () => {
    const docs = [
      {
        classId: 'class-003',
        className: 'Gamma',
        cohortKey: 'coh-uuid-003',
        yearGroupKey: 'yg-uuid-008',
        courseLength: 1,
        classOwner: null,
        teachers: [],
        active: true,
      },
    ];
    partialsCollection.find.mockReturnValue(docs);

    expect(Array.isArray(new ABClassController().getAllClassPartials())).toBe(true);
  });

  it('_normaliseClassPartial: stored partial missing cohortLabel/yearGroupLabel omits them from transport', () => {
    // Simulate a document persisted before label fields were added (fields simply absent).
    const docs = [
      {
        classId: 'class-no-labels',
        className: 'NoLabels',
        cohortKey: 'coh-uuid-004',
        // cohortLabel intentionally absent
        yearGroupKey: 'yg-uuid-007',
        // yearGroupLabel intentionally absent
        courseLength: 1,
        classOwner: null,
        teachers: [],
        active: true,
      },
    ];
    partialsCollection.find.mockReturnValue(docs);

    const [result] = new ABClassController().getAllClassPartials();

    expect(result).not.toHaveProperty('cohortLabel');
    expect(result).not.toHaveProperty('yearGroupLabel');
    // Sanity: other fields are still correct
    expect(result.cohortKey).toBe('coh-uuid-004');
    expect(result.yearGroupKey).toBe('yg-uuid-007');
  });

  it('normalises the live persisted class-partials row shape into the frontend transport contract', () => {
    const docs = [
      {
        _id: '9494597d-e565-4498-b1d5-cf4cc6d9ef51',
        classId: 'class-201',
        className: 'Class 201',
        cohortKey: 'cohort-2025',
        courseLength: 1,
        yearGroupKey: 'year-07',
        classOwner: {
          email: 'owner@example.invalid',
          userId: 'google-user-001',
          teacherName: 'Ms Example',
        },
        teachers: [],
        active: null,
      },
    ];
    partialsCollection.find.mockReturnValue(docs);

    const [result] = new ABClassController().getAllClassPartials();

    expect(result).toEqual({
      classId: 'class-201',
      className: 'Class 201',
      cohortKey: 'cohort-2025',
      courseLength: 1,
      yearGroupKey: 'year-07',
      classOwner: {
        email: 'owner@example.invalid',
        userId: 'google-user-001',
        teacherName: 'Ms Example',
      },
      teachers: [],
      active: null,
    });
    expect(result).not.toHaveProperty('cohortLabel');
    expect(result).not.toHaveProperty('yearGroupLabel');
    expect(result).not.toHaveProperty('_id');
  });
});
