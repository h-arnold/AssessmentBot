import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';
import { restoreGlobals, saveGlobals } from '#test-helpers/globalMockManager.js';
import { cleanupControllerTestMocks, setupControllerTestMocks } from '../helpers/mockFactories.js';

const ABClassValidation = require('#backend/y_controllers/ABClassController/ABClassValidation.js');
const ABClassController = require('#backend/y_controllers/ABClassController/index.js');
const { ABClass } = require('#backend/Models/ABClass.js');
const { Teacher } = require('#backend/Models/Teacher.js');

const sourceClass = Object.values(loadBackendModelInputs('small').classesById).find(
  (row) => row.cohortKey && row.yearGroupKey
);

function clone(value) {
  return structuredClone(value);
}

function createCollection(rows) {
  const storedRows = clone(rows);
  return {
    findOne: vi.fn((query) =>
      clone(
        storedRows.find((row) =>
          Object.entries(query).every(([key, value]) => row[key] === value)
        ) ?? null
      )
    ),
    updateOne: vi.fn(),
    insertOne: vi.fn(),
    replaceOne: vi.fn(),
    deleteOne: vi.fn(),
    save: vi.fn(),
    rows: () => clone(storedRows),
  };
}

function createControllerContext() {
  const fullDocument = clone(sourceClass);
  const partialDocument = { ...fullDocument };
  delete partialDocument.assignments;
  delete partialDocument.students;
  const full = createCollection([fullDocument]);
  const partial = createCollection([partialDocument]);
  const manager = {
    getCollection: vi.fn((name) => (name === 'abclass_partials' ? partial : full)),
  };
  const classroom = {
    fetchCourse: vi.fn(() => ({ id: sourceClass.classId, name: 'Updated class', ownerId: null })),
    fetchTeachers: vi.fn(() => []),
    fetchAllStudents: vi.fn(() => []),
  };
  globalThis.DbManager = { getInstance: () => manager };
  globalThis.ClassroomApiClient = classroom;
  globalThis.ABClass = ABClass;
  globalThis.Teacher = Teacher;
  globalThis.Assignment = require('#backend/AssignmentProcessor/Assignment/index.js');
  return {
    controller: new ABClassController(),
    full,
    partial,
    manager,
    classroom,
    fullDocument,
    partialDocument,
  };
}

describe('ABClass update reference keys', () => {
  it.each(['cohortKey', 'yearGroupKey'])(
    'does not coerce an own undefined %s into a patch value',
    (key) => {
      const validation = new ABClassValidation();
      expect(() => validation._buildUpdatePatch({ [key]: undefined })).toThrow();
    }
  );

  it.each([
    ['omitted', {}, {}],
    ['null', { cohortKey: null, yearGroupKey: null }, { cohortKey: null, yearGroupKey: null }],
    [
      'valid',
      { cohortKey: 'cohort-2026', yearGroupKey: 'year-10' },
      { cohortKey: 'cohort-2026', yearGroupKey: 'year-10' },
    ],
  ])('builds the expected patch when reference keys are %s', (_label, input, expected) => {
    expect(new ABClassValidation()._buildUpdatePatch(input)).toEqual(expected);
  });

  describe('controller persistence boundary', () => {
    let savedGlobals;

    beforeEach(() => {
      savedGlobals = saveGlobals(['ABClass', 'Teacher', 'Assignment', 'ClassroomApiClient']);
      setupControllerTestMocks(vi);
    });

    afterEach(() => {
      cleanupControllerTestMocks();
      restoreGlobals(savedGlobals);
      vi.restoreAllMocks();
    });

    it.each(['cohortKey', 'yearGroupKey'])(
      'rejects own undefined %s without writing either store or refreshing the roster',
      (key) => {
        const context = createControllerContext();
        const request = { classId: sourceClass.classId, [key]: undefined };

        expect(() => context.controller.updateABClass(request)).toThrow(TypeError);

        // The zero-write scope includes full-store patch/insert/replace/delete/save and
        // registry patch/insert/replace/delete/save; existing reference keys remain intact.
        for (const store of [context.full, context.partial]) {
          for (const method of ['updateOne', 'insertOne', 'replaceOne', 'deleteOne', 'save']) {
            expect(store[method]).not.toHaveBeenCalled();
          }
        }
        expect(context.full.rows()[0].cohortKey).toBe(context.fullDocument.cohortKey);
        expect(context.full.rows()[0].yearGroupKey).toBe(context.fullDocument.yearGroupKey);
        expect(context.partial.rows()[0].cohortKey).toBe(context.partialDocument.cohortKey);
        expect(context.partial.rows()[0].yearGroupKey).toBe(context.partialDocument.yearGroupKey);
        expect(context.classroom.fetchCourse).not.toHaveBeenCalled();
        expect(context.classroom.fetchTeachers).not.toHaveBeenCalled();
        expect(context.classroom.fetchAllStudents).not.toHaveBeenCalled();
      }
    );
  });
});
