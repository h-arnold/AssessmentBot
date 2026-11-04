/** Model-level read projection wiring and purity for legacy assignments. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  currentAssignmentJson,
  rawPartialEmbeddedSnapshot,
  restoreAssignment,
} from './assignmentRehydrationCurrentSupport.js';

const Assignment = require('#backend/AssignmentProcessor/Assignment/index.js');
const Rehydration = require('#backend/AssignmentProcessor/Assignment/02_AssignmentRehydration.js');
const ABClassResponseMapper = require('#backend/y_controllers/ABClassController/ABClassResponseMapper.js');
const { Assessment } = require('#backend/Models/Assessment.js');

function legacyRecord() {
  const record = currentAssignmentJson();
  delete record.assessmentContractVersion;
  record.assignmentName = 'Legacy assignment name';
  record.createdAt = '2020-01-02T03:04:05.000Z';
  record.submissions = record.submissions.slice(0, 1);
  record.submissions[0].historicalEnvelope = { opaque: [null, { body: 'unchanged' }] };
  record.submissions[0].items['task-1-0'].assessments = { ancient: { opaque: true } };
  return record;
}

function expectedError() {
  return Assessment.createError('validation', 'REASSESSMENT_REQUIRED').toJSON();
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('legacy model read serialisation', () => {
  it('projects an actual restored assignment without changing its opaque persisted snapshot', () => {
    const record = legacyRecord();
    const before = structuredClone(record);
    const restored = restoreAssignment(record);
    expect(restored).toBeInstanceOf(Assignment);
    expect(typeof restored.toReadJSON).toBe('function');
    expect(typeof Rehydration.projectReassessmentSubmissions).toBe('function');
    const projector = vi.spyOn(Rehydration, 'projectReassessmentSubmissions');

    const collectionAccess = vi.fn(() => {
      throw new Error('Legacy model read must not access storage');
    });
    const dbManager = vi.fn(() => ({ getCollection: collectionAccess }));
    const classroomList = vi.fn(() => {
      throw new Error('Legacy model read must not retrieve a roster');
    });
    vi.stubGlobal('DbManager', { getInstance: dbManager });
    vi.stubGlobal('Classroom', {
      Courses: { Students: { list: classroomList } },
    });

    const read = restored.toReadJSON();

    expect(projector).toHaveBeenCalledTimes(1);
    expect(projector).toHaveBeenCalledWith(
      expect.objectContaining({
        courseId: record.courseId,
        assignmentId: record.assignmentId,
        assignmentDefinition: expect.objectContaining({
          definitionKey: record.assignmentDefinition.definitionKey,
        }),
      }),
      expect.any(Array),
      'full'
    );
    expect(dbManager).not.toHaveBeenCalled();
    expect(collectionAccess).not.toHaveBeenCalled();
    expect(classroomList).not.toHaveBeenCalled();
    expect(read.assessmentContractVersion).toBeNull();
    expect(read.submissions).toHaveLength(1);
    expect(Object.keys(read.submissions[0].items).sort()).toEqual(
      Object.keys(record.assignmentDefinition.tasks).sort()
    );
    for (const item of Object.values(read.submissions[0].items)) {
      expect(Object.keys(item.assessments).sort()).toEqual(['accuracy', 'completeness', 'spag']);
      for (const entry of Object.values(item.assessments)) expect(entry).toEqual(expectedError());
    }
    expect(restored.toJSON().submissions[0].historicalEnvelope).toEqual(
      before.submissions[0].historicalEnvelope
    );
    expect(restored.toJSON().submissions[0].items['task-1-0'].assessments).toEqual(
      before.submissions[0].items['task-1-0'].assessments
    );
    const persisted = restored.toJSON();
    expect(persisted.submissions).toEqual(before.submissions);
    expect(Object.hasOwn(persisted, 'assessmentContractVersion')).toBe(false);
    expect(record).toEqual(before);
  });

  it('uses the same projector in partial form for a class read before definition-key replacement', () => {
    const source = legacyRecord();
    const partial = rawPartialEmbeddedSnapshot(source);
    delete partial.assessmentContractVersion;
    partial.assignmentDefinition.tasks = Object.values(partial.assignmentDefinition.tasks);
    const originalSubmissions = structuredClone(partial.submissions);
    const roster = [
      { studentId: 'roster-a', studentName: null },
      { studentId: 'roster-b', studentName: 'Bee' },
    ];
    const assignment = restoreAssignment(partial, 'partial');
    const mapper = new ABClassResponseMapper();
    const abClass = {
      classId: 'class-read',
      className: null,
      cohortKey: null,
      courseLength: 1,
      yearGroupKey: null,
      classOwner: null,
      teachers: [],
      students: roster,
      active: true,
      metadata: null,
      assignments: [assignment],
      serialiseOwner: (owner) => owner,
    };
    expect(typeof assignment.toReadJSON).toBe('function');
    expect(typeof Rehydration.projectReassessmentSubmissions).toBe('function');
    const projector = vi.spyOn(Rehydration, 'projectReassessmentSubmissions');
    const output = mapper._toReadView(abClass);
    expect(output.assignments[0].assessmentContractVersion).toBeNull();
    expect(projector).toHaveBeenCalledTimes(1);
    expect(projector.mock.calls[0]).toHaveLength(3);
    const [ownerRecord, suppliedRoster, mode] = projector.mock.calls[0];
    expect(ownerRecord).toEqual(
      expect.objectContaining({
        courseId: partial.courseId,
        assignmentId: partial.assignmentId,
        assignmentDefinition: expect.objectContaining({
          tasks: partial.assignmentDefinition.tasks,
        }),
      })
    );
    expect(suppliedRoster).toEqual(roster);
    expect(mode).toBe('partial');
    expect(output.assignments[0].assignmentDefinitionKey).toBe(
      partial.assignmentDefinition.definitionKey
    );
    expect(output.assignments[0]).not.toHaveProperty('assignmentDefinition');
    expect(output.assignments[0].submissions).toHaveLength(roster.length);
    expect(output.assignments[0].submissions.map((s) => s.studentId).sort()).toEqual([
      'roster-a',
      'roster-b',
    ]);
    const persistedPartial = assignment.toPartialJSON();
    expect(persistedPartial.submissions).toEqual(originalSubmissions);
    expect(Object.hasOwn(persistedPartial, 'assessmentContractVersion')).toBe(false);
  });

  it('preserves current serialisation and primitive read behaviour without legacy synthesis', () => {
    const current = currentAssignmentJson();
    const restored = restoreAssignment(current);
    expect(typeof restored.toReadJSON).toBe('function');
    expect(typeof Rehydration.projectReassessmentSubmissions).toBe('function');
    const projector = vi.spyOn(Rehydration, 'projectReassessmentSubmissions');
    const output = restored.toReadJSON();
    expect(output.assessmentContractVersion).toBe(1);
    expect(output.submissions).toEqual(restored.toJSON().submissions);
    expect(projector).not.toHaveBeenCalled();
    expect(restored.submissions[0].studentId).toBe(current.submissions[0].studentId);
  });

  it('keeps read output detached from subsequent persistence and reads', () => {
    const source = legacyRecord();
    const taskIds = Object.keys(source.assignmentDefinition.tasks);
    const expectedPersisted = structuredClone(source);
    const restored = restoreAssignment(source);
    expect(typeof restored.toReadJSON).toBe('function');
    const first = restored.toReadJSON();
    const persisted = restored.toJSON();
    expect(persisted.submissions[0].historicalEnvelope).toEqual(
      expectedPersisted.submissions[0].historicalEnvelope
    );
    expect(Object.hasOwn(persisted, 'assessmentContractVersion')).toBe(false);
    expect(persisted.submissions).toEqual(expectedPersisted.submissions);
    expect(first.assessmentContractVersion).toBeNull();
    expect(Object.keys(first.submissions[0].items).sort()).toEqual(taskIds.sort());
    first.submissions[0].items['task-1-0'].feedback.changed = true;
    first.submissions[0].items['task-1-0'].assessments.completeness.error.code = 'changed';
    expect(restored.toJSON()).toEqual(persisted);
    expect(restored.toReadJSON().submissions[0].items['task-1-0'].assessments.completeness).toEqual(
      expectedError()
    );

    const projector = vi.spyOn(Rehydration, 'projectReassessmentSubmissions');
    const sentinel = new Error('sentinel projector failure');
    projector.mockImplementation(() => {
      throw sentinel;
    });
    let thrown;
    try {
      restored.toReadJSON();
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBe(sentinel);
  });
});
