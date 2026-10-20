import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';
import {
  restoreGlobals,
  saveGlobals,
  withTemporaryGlobals,
} from '#test-helpers/globalMockManager.js';
import { cleanupControllerTestMocks, setupControllerTestMocks } from '../helpers/mockFactories.js';

const { ABClass } = require('#backend/Models/ABClass.js');
const { Teacher } = require('#backend/Models/Teacher.js');
const ABClassController = require('#backend/y_controllers/ABClassController/index.js');
const ABClassMetadataValidationError =
  require('#backend/Utils/ErrorTypes/ABClassMetadataValidationError.js').ABClassMetadataValidationError;

const clone = (value) => structuredClone(value);
const canonical = loadBackendModelInputs('small');
const sourceSnapshot = Object.values(loadBackendModelInputs('medium').classesById).find(
  (row) => row.metadata?.recentAssignments.length === 3
);
const replacementSnapshot = Object.values(loadBackendModelInputs('medium').classesById).find(
  (row) => row.metadata?.recentAssignments.length === 1
);

function createCollection(initialRows) {
  let rows = clone(initialRows);
  const collection = {
    findOne: vi.fn((query) =>
      clone(
        rows.find((row) => Object.entries(query).every(([key, value]) => row[key] === value)) ??
          null
      )
    ),
    find: vi.fn(() => clone(rows)),
    insertOne: vi.fn((row) => {
      const inserted = clone(row);
      if (!inserted._id) inserted._id = `generated-${rows.length + 1}`;
      rows.push(inserted);
      return { insertedId: inserted._id, acknowledged: true };
    }),
    replaceOne: vi.fn((query, row) => {
      const index = rows.findIndex((entry) =>
        Object.entries(query).every(([key, value]) => entry[key] === value)
      );
      if (index < 0) return { matchedCount: 0, modifiedCount: 0, acknowledged: true };
      const replacement = clone(row);
      if (rows[index]._id) replacement._id = rows[index]._id;
      rows[index] = replacement;
      return { matchedCount: 1, modifiedCount: 1, acknowledged: true };
    }),
    updateOne: vi.fn((query, update) => {
      const row = rows.find((entry) =>
        Object.entries(query).every(([key, value]) => entry[key] === value)
      );
      if (row) Object.assign(row, clone(update.$set));
      return { matchedCount: row ? 1 : 0, modifiedCount: row ? 1 : 0 };
    }),
    deleteOne: vi.fn((query) => {
      const before = rows.length;
      rows = rows.filter(
        (row) => !Object.entries(query).every(([key, value]) => row[key] === value)
      );
      return { deletedCount: before - rows.length, acknowledged: true };
    }),
    save: vi.fn(() => ({ acknowledged: true })),
    rows: () => clone(rows),
  };
  return collection;
}

function writeMetadataPayload(collection, operation) {
  const calls = [
    ...collection.insertOne.mock.calls.map(([payload]) => ({ operation: 'insertOne', payload })),
    ...collection.replaceOne.mock.calls.map(([, payload]) => ({
      operation: 'replaceOne',
      payload,
    })),
    ...collection.updateOne.mock.calls.map(([, update]) => ({
      operation: 'updateOne',
      payload: update.$set,
    })),
  ];
  const call = calls.find(({ payload }) => Object.hasOwn(payload ?? {}, 'metadata'));
  return call
    ? { found: true, operation: call.operation, value: call.payload.metadata }
    : { found: false, operation: null, value: undefined };
}

function setupController(fullRows, partialRows) {
  const full = createCollection(fullRows);
  const partial = createCollection(partialRows);
  const manager = {
    getCollection: vi.fn((name) => (name === 'abclass_partials' ? partial : full)),
  };
  globalThis.DbManager = { getInstance: () => manager };
  const config = Object.values(canonical.classesById).find(
    (row) => row.cohortKey && row.yearGroupKey
  );
  const classroom = {
    fetchCourse: vi.fn((classId) => ({ id: classId, name: 'Refreshed class', ownerId: null })),
    fetchTeachers: vi.fn(() => []),
    fetchAllStudents: vi.fn(() => []),
  };
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
    config,
    request(classId, metadataField) {
      return {
        classId,
        cohortKey: config.cohortKey,
        yearGroupKey: config.yearGroupKey,
        courseLength: config.courseLength,
        ...metadataField,
      };
    },
  };
}

function expectSnapshotDetached(...values) {
  const nonNull = values.filter(Boolean);
  for (let left = 0; left < nonNull.length; left += 1) {
    for (let right = left + 1; right < nonNull.length; right += 1) {
      expect(nonNull[left]).not.toBe(nonNull[right]);
      expect(nonNull[left].classAverages).not.toBe(nonNull[right].classAverages);
      expect(nonNull[left].recentAssignments).not.toBe(nonNull[right].recentAssignments);
      // Empty snapshots retain root and array identity checks; there are no entries to inspect.
      nonNull[left].recentAssignments.forEach((entry, index) => {
        expect(entry).not.toBe(nonNull[right].recentAssignments[index]);
        expect(entry.averages).not.toBe(nonNull[right].recentAssignments[index].averages);
      });
    }
  }
}

describe('ABClass metadata mutation requests', () => {
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

  it.each([
    ['new class omission', 'new', 'omit', null],
    ['new class null', 'new', 'null', null],
    ['new class replacement', 'new', 'replace', replacementSnapshot.metadata],
    ['existing upsert omission', 'upsert', 'omit', sourceSnapshot.metadata],
    ['existing upsert null', 'upsert', 'null', null],
    ['existing upsert replacement', 'upsert', 'replace', replacementSnapshot.metadata],
    ['update omission', 'update', 'omit', sourceSnapshot.metadata],
    ['update null', 'update', 'null', null],
    ['update replacement', 'update', 'replace', replacementSnapshot.metadata],
  ])('%s persists the specified whole metadata value', (_label, operation, mode, expected) => {
    const classId = sourceSnapshot.classId;
    const existing = operation === 'upsert' || operation === 'update';
    const initial = existing ? clone(sourceSnapshot) : null;
    const initialPartial = initial ? { ...initial } : null;
    if (initialPartial) {
      delete initialPartial.students;
      delete initialPartial.assignments;
    }
    const ctx = setupController(initial ? [initial] : [], initialPartial ? [initialPartial] : []);
    const restoredModels = [];
    const originalFromJSON = ABClass.fromJSON;
    vi.spyOn(ABClass, 'fromJSON').mockImplementation((...args) => {
      const model = originalFromJSON(...args);
      restoredModels.push(model);
      return model;
    });
    const request =
      operation === 'update'
        ? {
            classId,
            ...(mode === 'omit'
              ? {}
              : { metadata: mode === 'null' ? null : clone(replacementSnapshot.metadata) }),
          }
        : {
            ...ctx.request(classId, {}),
            ...(mode === 'omit'
              ? {}
              : { metadata: mode === 'null' ? null : clone(replacementSnapshot.metadata) }),
          };
    const result =
      operation === 'update'
        ? ctx.controller.updateABClass(request)
        : ctx.controller.upsertABClass(request);
    const persistedFull = ctx.full.rows()[0];
    const persistedPartial = ctx.partial.rows()[0];
    const fullPayloadMetadata = writeMetadataPayload(ctx.full, operation);
    const partialPayloadMetadata = writeMetadataPayload(ctx.partial, operation);
    if (operation === 'update' && mode === 'omit' && restoredModels.length > 0) {
      expectSnapshotDetached(result.metadata, restoredModels[0].metadata);
      restoredModels[0].metadata.classAverages.completeness = 0;
      expect(result.metadata).toEqual(expected);
    }

    expect(persistedFull.metadata).toEqual(expected);
    expect(persistedPartial.metadata).toEqual(expected);
    expect(result.metadata).toEqual(expected);
    if (mode === 'replace') expect(request.metadata).toEqual(replacementSnapshot.metadata);
    if (operation !== 'update' || mode !== 'omit') {
      expect.soft(fullPayloadMetadata.found, 'full store metadata write').toBe(true);
      expect.soft(partialPayloadMetadata.found, 'partial store metadata write').toBe(true);
    }
    if (fullPayloadMetadata.found && partialPayloadMetadata.found) {
      const references = [fullPayloadMetadata.value, partialPayloadMetadata.value, result.metadata];
      if (restoredModels.length > 0) references.push(restoredModels[0].metadata);
      expectSnapshotDetached(...references);
      if (mode === 'replace') {
        request.metadata.classAverages.completeness = 0;
        expect(fullPayloadMetadata.value).toEqual(expected);
        expect(partialPayloadMetadata.value).toEqual(expected);
        expect(result.metadata).toEqual(expected);
        if (restoredModels.length > 0) expect(restoredModels[0].metadata).toEqual(expected);
      }
      if (expected !== null) {
        fullPayloadMetadata.value.classAverages.completeness = 0;
        expect(partialPayloadMetadata.value).toEqual(expected);
        expect(result.metadata).toEqual(expected);
        if (restoredModels.length > 0) expect(restoredModels[0].metadata).toEqual(expected);
      }
    }
    if (existing) {
      expect(persistedFull.assignments.map((assignment) => assignment.assignmentId)).toEqual(
        sourceSnapshot.assignments.map((assignment) => assignment.assignmentId)
      );
      expect(persistedFull.assignments.every((assignment) => assignment.courseId === classId)).toBe(
        true
      );
      expect(persistedFull.active).toBe(sourceSnapshot.active);
    }
    expect(ctx.classroom.fetchCourse).toHaveBeenCalledTimes(operation === 'update' ? 0 : 1);
    if (operation === 'update') expect(ctx.classroom.fetchTeachers).not.toHaveBeenCalled();
  });

  it('does not add an omitted metadata property to the caller request', () => {
    const ctx = setupController([], []);
    const request = ctx.request(sourceSnapshot.classId, {});
    ctx.controller.upsertABClass(request);
    expect(request).not.toHaveProperty('metadata');
    expect(ctx.full.rows()[0]).toHaveProperty('metadata', null);
  });

  it.each([
    ['own undefined', (metadata) => ({ metadata: undefined })],
    [
      'string metric',
      (metadata) => ({
        metadata: { ...metadata, classAverages: { ...metadata.classAverages, overall: '4' } },
      }),
    ],
    [
      'NaN metric',
      (metadata) => ({
        metadata: { ...metadata, classAverages: { ...metadata.classAverages, overall: NaN } },
      }),
    ],
    ['extra key', (metadata) => ({ metadata: { ...metadata, unexpected: true } })],
    [
      'sparse entries',
      (metadata) => {
        const recentAssignments = [...metadata.recentAssignments];
        delete recentAssignments[1];
        return { metadata: { ...metadata, recentAssignments } };
      },
    ],
    [
      'too many entries',
      (metadata) => ({
        metadata: {
          ...metadata,
          recentAssignments: [...metadata.recentAssignments, clone(metadata.recentAssignments[0])],
        },
      }),
    ],
    [
      'noncanonical timestamp',
      (metadata) => ({
        metadata: {
          ...metadata,
          classAverages: { ...metadata.classAverages, updatedAt: '2026-10-17T08:38:23Z' },
        },
      }),
    ],
    [
      'partial nested average',
      (metadata) => ({
        metadata: {
          ...metadata,
          recentAssignments: [{ ...metadata.recentAssignments[0], averages: { completeness: 2 } }],
        },
      }),
    ],
  ])(
    'rejects %s before every read, roster call or write in each mutation',
    (_name, invalidFields) => {
      const operations = ['upsert-new', 'upsert-existing', 'update-existing'];
      for (const operation of operations) {
        const existing = operation !== 'upsert-new';
        const classId = sourceSnapshot.classId;
        const initial = existing ? clone(sourceSnapshot) : null;
        const initialPartial = initial ? { ...initial } : null;
        if (initialPartial) {
          delete initialPartial.students;
          delete initialPartial.assignments;
        }
        const ctx = setupController(
          initial ? [initial] : [],
          initialPartial ? [initialPartial] : []
        );
        const request =
          operation === 'update-existing'
            ? { classId, ...invalidFields(clone(sourceSnapshot.metadata)) }
            : { ...ctx.request(classId, {}), ...invalidFields(clone(sourceSnapshot.metadata)) };
        const caught = (() => {
          try {
            return operation === 'update-existing'
              ? ctx.controller.updateABClass(request)
              : ctx.controller.upsertABClass(request);
          } catch (error) {
            return error;
          }
        })();
        expect.soft(caught, operation).toBeInstanceOf(ABClassMetadataValidationError);
        expect.soft(caught?.fieldPath, operation).toMatch(/^metadata/);
        expect.soft(caught?.inputSource, operation).toBe('request');
        expect.soft(ctx.manager.getCollection, operation).not.toHaveBeenCalled();
        expect.soft(ctx.classroom.fetchCourse, operation).not.toHaveBeenCalled();
        expect.soft(ctx.classroom.fetchTeachers, operation).not.toHaveBeenCalled();
        expect.soft(ctx.classroom.fetchAllStudents, operation).not.toHaveBeenCalled();
        for (const store of [ctx.full, ctx.partial]) {
          for (const method of ['insertOne', 'replaceOne', 'updateOne', 'deleteOne', 'save']) {
            expect.soft(store[method], `${operation}.${method}`).not.toHaveBeenCalled();
          }
        }
      }
    }
  );

  it('rejects invalid metadata before a corrupt or unreadable stored class is reached', () => {
    const ctx = setupController([], []);
    ctx.full.findOne.mockImplementation(() => {
      throw new Error('stored class read reached');
    });
    const request = {
      ...ctx.request(sourceSnapshot.classId, {}),
      metadata: { classAverages: {}, recentAssignments: [] },
    };
    let caught;
    try {
      ctx.controller.upsertABClass(request);
    } catch (error) {
      caught = error;
    }
    expect.soft(caught).toBeInstanceOf(ABClassMetadataValidationError);
    expect.soft(caught?.inputSource).toBe('request');
    expect.soft(ctx.full.findOne).not.toHaveBeenCalled();
  });

  it('validates the actual shared domain rule without tagging model-boundary failures as requests', () => {
    const invalid = clone(sourceSnapshot.metadata);
    invalid.classAverages.overall = 9;
    let caught;
    try {
      withTemporaryGlobals({ Teacher: () => Teacher }, () =>
        ABClass.fromJSON({ ...clone(sourceSnapshot), metadata: invalid })
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ABClassMetadataValidationError);
    expect(caught.fieldPath).toBe('metadata.classAverages.overall');
    expect(caught.inputSource).not.toBe('request');
  });

  it('rejects an invalid mixed update without applying valid configuration fields', () => {
    const classId = sourceSnapshot.classId;
    const document = clone(sourceSnapshot);
    const partialDocument = { ...document };
    delete partialDocument.assignments;
    delete partialDocument.students;
    const ctx = setupController([document], [partialDocument]);
    const invalid = clone(sourceSnapshot.metadata);
    invalid.classAverages.accuracy = 7;
    const caught = (() => {
      try {
        ctx.controller.updateABClass({ classId, active: false, metadata: invalid });
      } catch (error) {
        return error;
      }
      return undefined;
    })();
    expect.soft(caught).toBeInstanceOf(ABClassMetadataValidationError);
    expect.soft(ctx.full.rows()[0].active).toBe(document.active);
    expect.soft(ctx.full.rows()[0].metadata).toEqual(document.metadata);
    expect.soft(ctx.partial.rows()[0].metadata).toEqual(partialDocument.metadata);
    const methodCalls = (store) => ({
      insertOne: store.insertOne.mock.calls.length,
      replaceOne: store.replaceOne.mock.calls.length,
      updateOne: store.updateOne.mock.calls.length,
      deleteOne: store.deleteOne.mock.calls.length,
      save: store.save.mock.calls.length,
    });
    expect
      .soft(
        {
          collectionAccess: ctx.manager.getCollection.mock.calls.length,
          roster: {
            fetchCourse: ctx.classroom.fetchCourse.mock.calls.length,
            fetchTeachers: ctx.classroom.fetchTeachers.mock.calls.length,
            fetchAllStudents: ctx.classroom.fetchAllStudents.mock.calls.length,
          },
          fullWrites: methodCalls(ctx.full),
          partialWrites: methodCalls(ctx.partial),
        },
        'invalid mixed update has no collection access, roster calls or store writes'
      )
      .toEqual({
        collectionAccess: 0,
        roster: { fetchCourse: 0, fetchTeachers: 0, fetchAllStudents: 0 },
        fullWrites: { insertOne: 0, replaceOne: 0, updateOne: 0, deleteOne: 0, save: 0 },
        partialWrites: { insertOne: 0, replaceOne: 0, updateOne: 0, deleteOne: 0, save: 0 },
      });
  });
});
