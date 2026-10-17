import { afterEach, describe, expect, it, vi } from 'vitest';
import ABClassController from '#backend/y_controllers/ABClassController/index.js';
import { ABClass } from '#backend/Models/ABClass.js';
import { Teacher } from '#backend/Models/Teacher.js';
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';
import {
  saveGlobals,
  restoreGlobals,
  withTemporaryGlobals,
} from '#test-helpers/globalMockManager.js';

const clone = (value) => structuredClone(value);
const teacherGlobal = { Teacher: () => Teacher };
let saved;

afterEach(() => {
  if (saved) restoreGlobals(saved);
  saved = undefined;
});

describe('persistAssignmentRun with canonical embedded partials', () => {
  it.each([
    { classId: 'class-0', metadataKind: 'null' },
    { classId: 'class-1', metadataKind: 'non-null' },
  ])(
    'persists the full assignment first and retains $metadataKind metadata with embedded partials for $classId',
    ({ classId, metadataKind }) => {
      const inputs = loadBackendModelInputs('small');
      const classInput = inputs.classesById[classId];
      expect(classInput).toBeDefined();
      expect(classInput.assignments.length).toBeGreaterThan(0);
      expect(classInput.metadata === null ? 'null' : 'non-null').toBe(metadataKind);
      const expectedMetadata = clone(classInput.metadata);
      const fullInput = Object.values(inputs.assignmentsByKey).find(
        (row) => row.courseId === classInput.classId
      );
      expect(fullInput).toBeDefined();
      const abClass = withTemporaryGlobals(teacherGlobal, () =>
        ABClass.fromJSON(clone(classInput))
      );
      const assignment = globalThis.Assignment.fromJSON(clone(fullInput));
      const fullCollection = {
        findOne: vi.fn(() => null),
        insertOne: vi.fn(),
        replaceOne: vi.fn(),
        save: vi.fn(),
      };
      const classCollection = {
        findOne: vi.fn(() => ({ classId: abClass.classId })),
        insertOne: vi.fn(),
        replaceOne: vi.fn(),
        save: vi.fn(),
      };
      const storedPartial = { _id: 'registry-row', classId: abClass.classId };
      const partialCollection = {
        findOne: vi.fn(() => storedPartial),
        insertOne: vi.fn(),
        replaceOne: vi.fn(),
        save: vi.fn(),
      };
      const dbManager = {
        getInstance: () => dbManager,
        getCollection: vi.fn((name) => {
          if (name === 'abclass_partials') return partialCollection;
          if (name.startsWith('assign_full_')) return fullCollection;
          return classCollection;
        }),
      };
      const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
      saved = saveGlobals(['DbManager', 'ABLogger']);
      globalThis.DbManager = { getInstance: () => dbManager };
      globalThis.ABLogger = { getInstance: () => logger };
      const controller = new ABClassController();

      controller.persistAssignmentRun(abClass, assignment);

      expect(fullCollection.insertOne).toHaveBeenCalledTimes(1);
      expect(fullCollection.insertOne.mock.calls[0][0].assignmentId).toBe(fullInput.assignmentId);
      expect(classCollection.replaceOne).toHaveBeenCalledTimes(1);
      const storedClass = classCollection.replaceOne.mock.calls[0][1];
      expect(storedClass.assignments).toHaveLength(classInput.assignments.length);
      expect(storedClass.assignments.map((row) => row.assignmentId)).toEqual(
        classInput.assignments.map((row) => row.assignmentId)
      );
      const storedPartialPayload = partialCollection.replaceOne.mock.calls[0][1];
      expect(storedClass.metadata).toStrictEqual(expectedMetadata);
      expect(storedPartialPayload.metadata).toStrictEqual(expectedMetadata);
      expect(storedClass.metadata).toStrictEqual(storedPartialPayload.metadata);
      expect(classInput.metadata).toStrictEqual(expectedMetadata);
      if (expectedMetadata !== null) {
        expect(storedClass.metadata).not.toBe(expectedMetadata);
        expect(storedPartialPayload.metadata).not.toBe(expectedMetadata);
        expect(storedClass.metadata).not.toBe(storedPartialPayload.metadata);
        expect(storedClass.metadata.classAverages).not.toBe(
          storedPartialPayload.metadata.classAverages
        );
        expect(storedClass.metadata.recentAssignments).not.toBe(
          storedPartialPayload.metadata.recentAssignments
        );
        for (const [index, entry] of storedClass.metadata.recentAssignments.entries()) {
          expect(entry).not.toBe(storedPartialPayload.metadata.recentAssignments[index]);
          expect(entry.averages).not.toBe(
            storedPartialPayload.metadata.recentAssignments[index].averages
          );
        }
      }
      expect(storedPartial.classId).toBe(abClass.classId);
      expect(assignment._hydrationLevel).toBe('full');
      expect(abClass.assignments.every((entry) => entry._hydrationLevel === 'partial')).toBe(true);
    }
  );
});
