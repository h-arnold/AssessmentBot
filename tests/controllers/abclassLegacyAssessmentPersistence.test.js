import { describe, expect, it, vi } from 'vitest';
import { ABClass } from '#backend/Models/ABClass.js';
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';
import ABClassPersistence from '#backend/y_controllers/ABClassController/ABClassPersistence.js';
import ABClassResponseMapper from '#backend/y_controllers/ABClassController/ABClassResponseMapper.js';
import { withTemporaryGlobals } from '#test-helpers/globalMockManager.js';
import { currentAssignmentJson } from '../assignment/assignmentRehydrationCurrentSupport.js';

const clone = (value) => structuredClone(value);
const assignmentGlobal = { Assignment: () => globalThis.Assignment };
const teacherGlobal = { Teacher: () => globalThis.Teacher };

function canonicalClass() {
  const inputs = loadBackendModelInputs('small');
  const source = clone(inputs.classesById['class-0']);
  expect(source.assignments.length).toBeGreaterThan(1);
  const distinctIds = source.assignments.map((entry) => entry.assignmentId);
  expect(new Set(distinctIds).size).toBe(distinctIds.length);
  return source;
}

function storageHarness(classId) {
  const full = {
    findOne: vi.fn(() => null),
    insertOne: vi.fn(),
    replaceOne: vi.fn(),
    save: vi.fn(),
  };
  const partial = {
    findOne: vi.fn(() => null),
    insertOne: vi.fn(),
    replaceOne: vi.fn(),
    save: vi.fn(),
  };
  const assignmentCollection = {
    findOne: vi.fn(() => null),
    insertOne: vi.fn(),
    replaceOne: vi.fn(),
    save: vi.fn(),
  };
  const dbManager = {
    getCollection: vi.fn((name) =>
      name === 'abclass_partials' ? partial : name === classId ? full : assignmentCollection
    ),
  };
  const persistence = new ABClassPersistence({ dbManager, validation: {} });
  return { full, partial, assignmentCollection, persistence, dbManager, classId };
}

describe('legacy ABClass assessment persistence lifecycle', () => {
  it.each([
    ['full-shaped', (assignment) => globalThis.Assignment.fromJSON(assignment)],
    ['partial-shaped', (assignment) => globalThis.Assignment.fromJSON(assignment)],
  ])('keeps opaque legacy %s bodies across read and ordinary save', (shape, adapt) => {
    const source = canonicalClass();
    const studentId = source.students[0].id;
    expect(typeof studentId).toBe('string');
    expect(studentId.trim()).not.toBe('');
    const legacy = source.assignments[0];
    const sibling = source.assignments[1];
    const canonicalInputs = loadBackendModelInputs('small');
    const fullInput = clone(
      canonicalInputs.assignmentsByKey[Object.keys(canonicalInputs.assignmentsByKey)[0]]
    );
    const partialInput = clone(legacy);
    const assignmentInput = shape === 'full-shaped' ? fullInput : partialInput;
    assignmentInput.assignmentId = legacy.assignmentId;
    assignmentInput.courseId = legacy.courseId;
    assignmentInput.submissions = clone(legacy.submissions);
    assignmentInput.submissions.forEach((submission) => {
      submission.assignmentId = assignmentInput.assignmentId;
    });
    if (shape === 'partial-shaped') {
      assignmentInput.assignmentDefinition.tasks = assignmentInput.assignmentDefinition.tasks.map(
        ({ taskId, taskTitle, taskWeighting }) => ({ taskId, taskTitle, taskWeighting })
      );
      delete assignmentInput.submissions[0]?.items;
      assignmentInput.submissions = [];
    }
    const converted = adapt(assignmentInput);
    const raw = shape === 'partial-shaped' ? converted.toPartialJSON() : converted.toJSON();
    expect(Array.isArray(raw.assignmentDefinition.tasks)).toBe(shape === 'partial-shaped');
    expect(Object.keys(raw.assignmentDefinition.tasks).length).toBeGreaterThan(0);
    raw.assessmentContractVersion = 0;
    raw.submissions = [
      {
        studentId,
        assignmentId: raw.assignmentId,
        opaqueHistoricalBody: { cause: 'retain-me', raw: [1, 2] },
        opaqueHistoricalArtefacts: ['retain-me'],
      },
    ];
    const opaqueSubmissions = clone(raw.submissions);
    source.assignments[0] = raw;
    const currentSibling = currentAssignmentJson();
    currentSibling.courseId = sibling.courseId;
    currentSibling.assignmentId = sibling.assignmentId;
    currentSibling.submissions.forEach((submission) => {
      submission.assignmentId = sibling.assignmentId;
    });
    source.assignments[1] = currentSibling;
    const originals = clone(source.assignments);
    const abClass = withTemporaryGlobals({ ...teacherGlobal, ...assignmentGlobal }, () =>
      ABClass.fromJSON(source)
    );
    const read =
      shape === 'partial-shaped'
        ? new ABClassResponseMapper()._toReadView(abClass).assignments[0]
        : abClass.assignments[0].toReadJSON();
    const projected = read.submissions.find((submission) => submission.studentId === studentId);
    expect(projected).toBeDefined();
    const projectedItem = Object.values(projected.items ?? {})[0];
    expect(projectedItem).toBeDefined();
    projectedItem.feedback = { changed: 'detached mutation' };
    expect(abClass.assignments[0].toJSON().submissions).toStrictEqual(opaqueSubmissions);

    const storage = storageHarness(abClass.classId);
    withTemporaryGlobals(
      { ABLogger: { getInstance: () => ({ info: vi.fn(), error: vi.fn() }) } },
      () => {
        storage.persistence.persistClassAndPartial(abClass);
        expect(storage.full.insertOne).toHaveBeenCalledOnce();
        expect(storage.partial.insertOne).toHaveBeenCalledOnce();
      }
    );
    const payload = storage.full.insertOne.mock.calls[0][0];
    expect(payload.assignments.map((entry) => entry.assignmentId)).toContain(legacy.assignmentId);
    expect(payload.assignments[0].submissions).toStrictEqual(originals[0].submissions);
    expect(Object.hasOwn(payload.assignments[0], 'assessmentContractVersion')).toBe(true);
    expect(payload.assignments[0].assessmentContractVersion).toBe(0);
    expect(payload.assignments[0]).not.toHaveProperty('_hydrationLevel');
    expect(source.assignments).toStrictEqual(originals);
    expect(storage.partial.insertOne.mock.calls[0][0]).not.toHaveProperty('assignments');
    const savedSibling = payload.assignments.find(
      (entry) => entry.assignmentId === sibling.assignmentId
    );
    expect(savedSibling.assessmentContractVersion).toBe(1);
    expect(savedSibling.submissions).toEqual(originals[1].submissions);
    expect(savedSibling.submissions.length).toBeGreaterThan(0);
    const siblingBaseline = globalThis.Assignment.fromJSON(currentSibling).toJSON();
    expect(savedSibling).toEqual(siblingBaseline);
  });

  it('replaces a legacy assignment with current reassessed output without restoring old history', () => {
    const source = canonicalClass();
    const studentId = source.students[0].id;
    expect(typeof studentId).toBe('string');
    expect(studentId.trim()).not.toBe('');
    const legacyIndex = 1;
    const siblingIndex = 0;
    const legacyId = source.assignments[legacyIndex].assignmentId;
    source.assignments[legacyIndex].assessmentContractVersion = 0;
    const siblingId = source.assignments[siblingIndex].assignmentId;
    const siblingSubmissions = clone(source.assignments[siblingIndex].submissions);
    const taskIds = source.assignments[legacyIndex].assignmentDefinition.tasks.map(
      (task) => task.taskId
    );
    source.assignments[legacyIndex].submissions.forEach((submission) => {
      submission.assignmentId = legacyId;
    });
    const abClass = withTemporaryGlobals({ ...teacherGlobal, ...assignmentGlobal }, () =>
      ABClass.fromJSON(source)
    );
    const detached = new ABClassResponseMapper()._toReadView(abClass).assignments[legacyIndex];
    const projected = detached.submissions.find((submission) => submission.studentId === studentId);
    expect(projected).toBeDefined();
    expect(Object.keys(projected.items ?? {})).toEqual(taskIds);
    projected.items[Object.keys(projected.items)[0]].feedback = {
      changed: true,
    };
    const fullJson = currentAssignmentJson();
    fullJson.courseId = source.assignments[0].courseId;
    fullJson.assignmentId = legacyId;
    fullJson.submissions.forEach((submission) => {
      submission.assignmentId = legacyId;
    });
    const fullAssignment = globalThis.Assignment.fromJSON(fullJson);
    const fullBaseline = fullAssignment.toJSON();
    const partialBaseline = fullAssignment.toPartialJSON();
    const fullCollection = {
      findOne: vi.fn(() => null),
      insertOne: vi.fn(),
      replaceOne: vi.fn(),
      save: vi.fn(),
    };
    const classStorage = storageHarness(abClass.classId);
    const dbManager = {
      getCollection: vi.fn((name) =>
        name.startsWith('assign_full_')
          ? fullCollection
          : classStorage.dbManager.getCollection(name)
      ),
    };
    const ops = new globalThis.ABClassAssignmentOps({
      dbManager,
      validation: {},
      persistence: classStorage.persistence,
    });
    expect(typeof ops.persistAssignmentRun).toBe('function');
    withTemporaryGlobals(
      { ABLogger: { getInstance: () => ({ info: vi.fn(), error: vi.fn() }) } },
      () => {
        ops.persistAssignmentRun(abClass, fullAssignment);
        classStorage.persistence.persistClassAndPartial(abClass);
        const written = classStorage.full.insertOne.mock.calls[0][0];
        const fullSavedAssignment = written.assignments.find(
          (entry) => entry.assignmentId === legacyId
        );
        expect(fullSavedAssignment.assessmentContractVersion).toBe(1);
        const embeddedSavedAssignment = written.assignments.find(
          (entry) => entry.assignmentId === legacyId
        );
        expect(embeddedSavedAssignment).toEqual(partialBaseline);
        expect(
          written.assignments.find((entry) => entry.assignmentId === siblingId).submissions
        ).toEqual(siblingSubmissions);
        expect(JSON.stringify(written)).not.toContain('opaqueHistoricalBody');
        const beforeRepeat = clone(
          written.assignments.find((entry) => entry.assignmentId === legacyId).submissions
        );
        const restored = withTemporaryGlobals({ ...teacherGlobal, ...assignmentGlobal }, () =>
          ABClass.fromJSON(written)
        );
        classStorage.persistence.persistClassAndPartial(restored);
        const secondWrite = classStorage.full.insertOne.mock.calls[1][0];
        expect(
          secondWrite.assignments.find((entry) => entry.assignmentId === legacyId).submissions
        ).toEqual(beforeRepeat);
        expect(
          secondWrite.assignments.find((entry) => entry.assignmentId === siblingId).submissions
        ).toEqual(siblingSubmissions);
      }
    );
    expect(fullCollection.insertOne.mock.calls[0][0]).toEqual(fullBaseline);
    expect(fullCollection.insertOne.mock.calls[0][0].submissions).toEqual(fullBaseline.submissions);
  });
});
