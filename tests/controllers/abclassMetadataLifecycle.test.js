import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';
import {
  restoreGlobals,
  saveGlobals,
  withTemporaryGlobals,
} from '#test-helpers/globalMockManager.js';
import { cleanupControllerTestMocks, setupControllerTestMocks } from '../helpers/mockFactories.js';

const { ABClass } = require('#backend/Models/ABClass.js');
const Teacher = require('#backend/Models/Teacher.js').Teacher;
const ABClassController = require('#backend/y_controllers/ABClassController/index.js');
const MetadataError =
  require('#backend/Utils/ErrorTypes/ABClassMetadataValidationError.js').ABClassMetadataValidationError;
const clone = (value) => structuredClone(value);
const inputs = loadBackendModelInputs('small');
const medium = loadBackendModelInputs('medium');
const classWithMetadata = Object.values(inputs.classesById).find((row) => row.metadata !== null);
const classConfiguration = Object.values(inputs.classesById).find(
  (row) => row.cohortKey && row.yearGroupKey
);
const fullAssignment = Object.values(inputs.assignmentsByKey).find(
  (row) => row.courseId === classWithMetadata.classId
);

function collection(name, initial) {
  let rows = clone(initial);
  return {
    name,
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
      rows[index] = { ...clone(row), _id: rows[index]._id };
      return { matchedCount: 1, modifiedCount: 1, acknowledged: true };
    }),
    updateOne: vi.fn((query, update) => {
      const row = rows.find((entry) =>
        Object.entries(query).every(([key, value]) => entry[key] === value)
      );
      if (!row) return { matchedCount: 0, modifiedCount: 0, acknowledged: true };
      Object.assign(row, clone(update.$set));
      return { matchedCount: 1, modifiedCount: 1, acknowledged: true };
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
}

function harness(classInput, partialInput) {
  const classId = classInput.classId;
  const full = collection(classId, [{ ...clone(classInput), _id: 'full-db-id' }]);
  const partial = collection('abclass_partials', [
    { ...clone(partialInput), _id: 'partial-db-id' },
  ]);
  const fullAssignmentCollection = collection(
    `assign_full_${classId}_${fullAssignment.assignmentId}`,
    []
  );
  const manager = {
    getCollection: vi.fn((name) => {
      if (name === classId) return full;
      if (name === 'abclass_partials') return partial;
      if (name === `assign_full_${classId}_${fullAssignment.assignmentId}`)
        return fullAssignmentCollection;
      throw new Error(`Unexpected collection access: ${name}`);
    }),
    getDb: () => ({ dropCollection: vi.fn(() => true) }),
  };
  globalThis.DbManager = { getInstance: () => manager };
  globalThis.ABClass = ABClass;
  globalThis.Teacher = Teacher;
  globalThis.Assignment = require('#backend/AssignmentProcessor/Assignment/index.js');
  const classroom = {
    fetchCourse: vi.fn((id) => ({ id, name: 'Refreshed canonical class', ownerId: null })),
    fetchTeachers: vi.fn(() => []),
    fetchAllStudents: vi.fn(() => []),
  };
  globalThis.ClassroomApiClient = classroom;
  const controller = new ABClassController();
  return { classId, full, partial, manager, classroom, controller, fullAssignmentCollection };
}

function configRequest(classId, metadataField) {
  return {
    classId,
    cohortKey: classConfiguration.cohortKey,
    yearGroupKey: classConfiguration.yearGroupKey,
    courseLength: classConfiguration.courseLength,
    ...metadataField,
  };
}

function expectCanonicalAssignments(classRecord) {
  expect(classRecord.assignments.map((assignment) => assignment.assignmentId)).toEqual(
    classWithMetadata.assignments.map((assignment) => assignment.assignmentId)
  );
  expect(
    classRecord.assignments.every((assignment) => assignment.courseId === classWithMetadata.classId)
  ).toBe(true);
}

function expectOwnedSnapshots(left, right) {
  expect(left).not.toBe(right);
  expect(left.classAverages).not.toBe(right.classAverages);
  expect(left.recentAssignments).not.toBe(right.recentAssignments);
  for (let index = 0; index < left.recentAssignments.length; index += 1) {
    expect(left.recentAssignments[index]).not.toBe(right.recentAssignments[index]);
    expect(left.recentAssignments[index].averages).not.toBe(
      right.recentAssignments[index].averages
    );
  }
}

describe('ABClass metadata storage lifecycle and compatibility', () => {
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

  it.each(['upsert replacement', 'upsert null', 'update replacement', 'update null'])(
    'does not repair corrupt stored metadata during %s',
    (scenario) => {
      const source = clone(classWithMetadata);
      const invalid = clone(source.metadata);
      invalid.classAverages.overall = 8;
      source.metadata = invalid;
      const ctx = harness(source, source);
      const validReplacement = clone(
        Object.values(medium.classesById).find((row) => row.metadata)?.metadata
      );
      const isUpdate = scenario.startsWith('update');
      const supplied = scenario.endsWith('null') ? null : validReplacement;
      let error;
      try {
        ctx.controller[isUpdate ? 'updateABClass' : 'upsertABClass'](
          isUpdate
            ? { classId: ctx.classId, active: false, metadata: supplied }
            : configRequest(ctx.classId, { metadata: supplied })
        );
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(MetadataError);
      expect(error.fieldPath).toBe('metadata.classAverages.overall');
      expect(error.inputSource).not.toBe('request');
      expect(ctx.full.findOne).toHaveBeenCalledTimes(1);
      expect(ctx.classroom.fetchCourse).not.toHaveBeenCalled();
      for (const store of [ctx.full, ctx.partial]) {
        for (const method of ['insertOne', 'replaceOne', 'updateOne', 'save'])
          expect(store[method]).not.toHaveBeenCalled();
      }
    }
  );

  it('keeps mutable-model serialization and persistence failures outside request provenance', () => {
    const abClass = withTemporaryGlobals({ Teacher: () => Teacher }, () =>
      ABClass.fromJSON(clone(classWithMetadata))
    );
    abClass.metadata.classAverages.overall = 9;
    let serializationError;
    try {
      abClass.toJSON();
    } catch (error) {
      serializationError = error;
    }
    expect(serializationError).toBeInstanceOf(MetadataError);
    expect(serializationError.fieldPath).toBe('metadata.classAverages.overall');
    expect(serializationError.inputSource).not.toBe('request');

    const ctx = harness(classWithMetadata, classWithMetadata);
    const integrityError = new MetadataError(
      'local integrity failure',
      'metadata.classAverages.accuracy'
    );
    ctx.full.updateOne.mockImplementation(() => {
      throw integrityError;
    });
    let caught;
    try {
      ctx.controller.updateABClass({ classId: ctx.classId, active: false });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(integrityError);
    expect(caught.inputSource).toBe('model');
  });

  it('propagates Classroom exceptions unchanged without request provenance', () => {
    const ctx = harness(classWithMetadata, classWithMetadata);
    const upstreamError = new Error('Classroom unavailable');
    ctx.classroom.fetchCourse.mockImplementation(() => {
      throw upstreamError;
    });
    let caught;
    try {
      ctx.controller.upsertABClass(configRequest(ctx.classId, {}));
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(upstreamError);
    expect(caught).not.toHaveProperty('inputSource');
    expect(ctx.full.replaceOne).not.toHaveBeenCalled();
    expect(ctx.partial.replaceOne).not.toHaveBeenCalled();
  });

  it('preserves metadata through an unrelated editable update in actual full and registry records', () => {
    const ctx = harness(classWithMetadata, classWithMetadata);
    const before = clone(ctx.full.rows()[0].metadata);
    const result = ctx.controller.updateABClass({ classId: ctx.classId, active: false });
    const fullPatch = ctx.full.updateOne.mock.calls[0][1].$set;
    const partialPayload = ctx.partial.replaceOne.mock.calls[0][1];
    expect(ctx.full.rows()[0].metadata).toEqual(before);
    expect(ctx.partial.rows()[0].metadata).toEqual(before);
    expect(result.metadata).toEqual(before);
    expectCanonicalAssignments(ctx.full.rows()[0]);
    expect(fullPatch).not.toHaveProperty('metadata');
    expectOwnedSnapshots(partialPayload.metadata, result.metadata);
    partialPayload.metadata.classAverages.completeness = 0;
    expect(result.metadata).toEqual(before);
    expect(ctx.classroom.fetchCourse).not.toHaveBeenCalled();
  });

  it('retains the loaded snapshot through loadClass roster refresh and subsequent whole-class upsert', () => {
    const distinct = clone(classWithMetadata);
    distinct.metadata.classAverages.accuracy = 1.25;
    const ctx = harness(classWithMetadata, distinct);
    const before = clone(ctx.full.rows()[0].metadata);
    // The registry may own a distinct snapshot during the roster-only patch.
    const registryBefore = clone(ctx.partial.rows()[0].metadata);
    const loaded = ctx.controller.loadClass(ctx.classId);
    const rosterFullPatch = ctx.full.updateOne.mock.calls[0][1].$set;
    const rosterPartialPatch = ctx.partial.updateOne.mock.calls[0][1].$set;
    expect(Object.keys(rosterFullPatch).sort()).toEqual(
      ['className', 'classOwner', 'students', 'teachers'].sort()
    );
    expect(Object.keys(rosterPartialPatch).sort()).toEqual(
      ['className', 'classOwner', 'teachers'].sort()
    );
    expect(rosterFullPatch).not.toHaveProperty('metadata');
    expect(rosterPartialPatch).not.toHaveProperty('metadata');
    expect(ctx.full.rows()[0].metadata).toEqual(before);
    expect(ctx.partial.rows()[0].metadata).toEqual(registryBefore);
    expect(loaded.assignments.map((assignment) => assignment.assignmentId)).toEqual(
      classWithMetadata.assignments.map((assignment) => assignment.assignmentId)
    );
    expect(loaded.assignments.every((assignment) => assignment.courseId === ctx.classId)).toBe(
      true
    );
    expect(ctx.classroom.fetchCourse).toHaveBeenCalledTimes(1);

    const summary = ctx.controller.upsertABClass(configRequest(ctx.classId, {}));
    const wholeFullPayload = ctx.full.replaceOne.mock.calls.at(-1)[1];
    const wholePartialPayload = ctx.partial.replaceOne.mock.calls.at(-1)[1];
    expect(ctx.classroom.fetchCourse).toHaveBeenCalledTimes(2);
    expect(ctx.full.rows()[0].metadata).toEqual(before);
    expect(ctx.partial.rows()[0].metadata).toEqual(before);
    expect(summary.metadata).toEqual(before);
    expectCanonicalAssignments(ctx.full.rows()[0]);
    expectOwnedSnapshots(wholeFullPayload.metadata, wholePartialPayload.metadata);
    expectOwnedSnapshots(wholeFullPayload.metadata, summary.metadata);
    wholeFullPayload.metadata.classAverages.accuracy = 0;
    expect(wholePartialPayload.metadata).toEqual(before);
    expect(summary.metadata).toEqual(before);
  });

  it('persists assessment assignment separately and retains metadata plus embedded redaction', () => {
    const ctx = harness(classWithMetadata, classWithMetadata);
    const before = clone(ctx.full.rows()[0].metadata);
    const abClass = withTemporaryGlobals({ Teacher: () => Teacher }, () =>
      ABClass.fromJSON(clone(classWithMetadata))
    );
    const assignment = globalThis.Assignment.fromJSON(clone(fullAssignment));
    ctx.controller.persistAssignmentRun(abClass, assignment);
    const storedClassPayload = ctx.full.replaceOne.mock.calls[0][1];
    const storedPartialPayload = ctx.partial.replaceOne.mock.calls[0][1];
    expectOwnedSnapshots(storedClassPayload.metadata, storedPartialPayload.metadata);
    expectOwnedSnapshots(storedClassPayload.metadata, abClass.metadata);
    storedClassPayload.metadata.classAverages.completeness = 0;
    expect(storedPartialPayload.metadata).toEqual(before);
    expect(abClass.metadata).toEqual(before);
    expect(ctx.fullAssignmentCollection.insertOne).toHaveBeenCalledTimes(1);
    expect(ctx.fullAssignmentCollection.rows()[0].assignmentId).toBe(fullAssignment.assignmentId);
    expect(ctx.full.rows()[0].metadata).toEqual(before);
    expect(ctx.partial.rows()[0].metadata).toEqual(before);
    expectCanonicalAssignments(ctx.full.rows()[0]);
    expect(
      ctx.full.rows()[0].assignments.every((row) => Array.isArray(row.assignmentDefinition?.tasks))
    ).toBe(true);
    expect(
      ctx.full
        .rows()[0]
        .assignments.find((row) => row.assignmentId === fullAssignment.assignmentId)
        .submissions.every(
          (submission) => submission.artifact === undefined || submission.artifact?.content === null
        )
    ).toBe(true);
  });

  it('keeps the existing missing-update error, protected fields and metadata-free delete flags', () => {
    const ctx = harness(classWithMetadata, classWithMetadata);
    const missing = collection(ctx.classId, []);
    const originalGet = ctx.manager.getCollection;
    ctx.manager.getCollection = vi.fn((name) =>
      name === ctx.classId ? missing : originalGet(name)
    );
    expect(() => ctx.controller.updateABClass({ classId: ctx.classId, metadata: null })).toThrow(
      new RangeError(`updateABClass: class '${ctx.classId}' does not exist`)
    );
    const current = harness(classWithMetadata, classWithMetadata);
    expect(() =>
      current.controller.updateABClass({ classId: current.classId, teachers: [] })
    ).not.toThrow();
    const result = current.controller.deleteABClass({ classId: current.classId });
    expect(result).toEqual({
      classId: current.classId,
      hasDeletedFullClass: true,
      hasDeletedClassPartial: true,
    });
    expect(result).not.toHaveProperty('metadata');
  });

  it('characterises the vendor false-return deletion flag without applying the deferred fix', () => {
    const partial = collection('abclass_partials', []);
    const manager = {
      getDb: () => ({ dropCollection: vi.fn(() => false) }),
      getCollection: vi.fn((name) => {
        if (name === 'abclass_partials') return partial;
        throw new Error(`Unexpected collection access: ${name}`);
      }),
    };
    globalThis.DbManager = { getInstance: () => manager };
    expect(new ABClassController().deleteABClass({ classId: 'absent-class' })).toEqual({
      classId: 'absent-class',
      hasDeletedFullClass: true,
      hasDeletedClassPartial: false,
    });
  });
});
