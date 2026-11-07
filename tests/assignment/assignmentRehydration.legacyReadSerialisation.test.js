/** Model-level read wiring and purity for legacy assignments. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { classView } from './assignmentLegacyReadPreparationSupport.js';
import {
  currentAssignmentJson,
  rawPartialEmbeddedSnapshot,
  restoreAssignment,
} from './assignmentRehydrationCurrentSupport.js';

const Assignment = require('#backend/AssignmentProcessor/Assignment/index.js');
const Rehydration = require('#backend/AssignmentProcessor/Assignment/02_AssignmentRehydration.js');
const ABClassResponseMapper = require('#backend/y_controllers/ABClassController/ABClassResponseMapper.js');

function legacyRecord() {
  const record = currentAssignmentJson();
  Reflect.deleteProperty(record, 'assessmentContractVersion');
  record.assignmentName = 'Legacy assignment name';
  record.createdAt = '2020-01-02T03:04:05.000Z';
  record.submissions = record.submissions.slice(0, 1);
  record.submissions[0].historicalEnvelope = { opaque: [null, { body: 'unchanged' }] };
  return record;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('legacy model read serialisation', () => {
  it('prepares an actual restored assignment on the full read without changing its opaque snapshot', () => {
    const record = legacyRecord();
    const before = structuredClone(record);
    const restored = restoreAssignment(record);
    expect(restored).toBeInstanceOf(Assignment);
    expect(typeof restored.toReadJSON).toBe('function');
    const prepareSpy = vi.spyOn(Rehydration, 'prepareLegacyReadSubmissions');

    const collectionAccess = vi.fn(() => {
      throw new Error('Legacy model read must not access storage');
    });
    const classroomList = vi.fn(() => {
      throw new Error('Legacy model read must not retrieve a roster');
    });
    vi.stubGlobal('DbManager', { getInstance: collectionAccess });
    vi.stubGlobal('Classroom', {
      Courses: { Students: { list: classroomList } },
    });

    const read = restored.toReadJSON();

    expect(prepareSpy).toHaveBeenCalledTimes(1);
    expect(prepareSpy).toHaveBeenCalledWith(restored, 'full');
    expect(collectionAccess).not.toHaveBeenCalled();
    expect(classroomList).not.toHaveBeenCalled();
    expect(read.assessmentContractVersion).toBe('legacy');
    expect(read.submissions).toHaveLength(1);
    expect(Object.keys(read.submissions[0].items).sort()).toEqual(
      Object.keys(record.assignmentDefinition.tasks).sort()
    );
    // Prepared output carries the stored marks, not detached placeholders.
    expect(read.submissions[0].items['task-1-0'].assessments).toEqual(
      before.submissions[0].items['task-1-0'].assessments
    );
    const persisted = restored.toJSON();
    expect(persisted.submissions).toEqual(before.submissions);
    expect(persisted.submissions[0].historicalEnvelope).toEqual(
      before.submissions[0].historicalEnvelope
    );
    expect(Object.hasOwn(persisted, 'assessmentContractVersion')).toBe(false);
    expect(record).toEqual(before);
  });

  it('prepares partial submissions for a class read before definition-key replacement', () => {
    const source = legacyRecord();
    const partial = rawPartialEmbeddedSnapshot(source);
    Reflect.deleteProperty(partial, 'assessmentContractVersion');
    partial.assignmentDefinition.tasks = Object.values(partial.assignmentDefinition.tasks);
    const originalSubmissions = structuredClone(partial.submissions);
    const roster = [
      { studentId: 'roster-a', studentName: null },
      { studentId: 'roster-b', studentName: 'Bee' },
    ];
    const assignment = restoreAssignment(partial, 'partial');
    const mapper = new ABClassResponseMapper();
    expect(typeof assignment.toReadJSON).toBe('function');
    const prepareSpy = vi.spyOn(Rehydration, 'prepareLegacyReadSubmissions');

    const output = mapper._toReadView(classView(assignment, roster));

    expect(output.assignments[0].assessmentContractVersion).toBe('legacy');
    expect(prepareSpy).toHaveBeenCalledTimes(1);
    expect(prepareSpy.mock.calls[0]).toHaveLength(2);
    const [owner, form] = prepareSpy.mock.calls[0];
    expect(owner).toBe(assignment);
    expect(form).toBe('partial');
    expect(output.assignments[0].assignmentDefinitionKey).toBe(
      partial.assignmentDefinition.definitionKey
    );
    expect(output.assignments[0]).not.toHaveProperty('assignmentDefinition');
    // Stored submissions only: the roster never expands the read result.
    expect(output.assignments[0].submissions.map((s) => s.studentId)).toEqual(
      originalSubmissions.map((s) => s.studentId)
    );
    const persistedPartial = assignment.toPartialJSON();
    expect(persistedPartial.submissions).toEqual(originalSubmissions);
    expect(Object.hasOwn(persistedPartial, 'assessmentContractVersion')).toBe(false);
  });

  it('preserves current serialisation and read behaviour without legacy preparation', () => {
    const current = currentAssignmentJson();
    const restored = restoreAssignment(current);
    expect(typeof restored.toReadJSON).toBe('function');
    const prepareSpy = vi.spyOn(Rehydration, 'prepareLegacyReadSubmissions');

    const output = restored.toReadJSON();

    expect(output.assessmentContractVersion).toBe(1);
    expect(output.submissions).toEqual(restored.toJSON().submissions);
    expect(prepareSpy).not.toHaveBeenCalled();
    expect(restored.submissions[0].studentId).toBe(current.submissions[0].studentId);
  });

  it('keeps read output detached from later persistence and reads, and propagates preparation faults', () => {
    const source = legacyRecord();
    const expectedPersisted = structuredClone(source);
    const restored = restoreAssignment(source);
    expect(typeof restored.toReadJSON).toBe('function');

    const first = restored.toReadJSON();
    const persisted = restored.toJSON();
    expect(persisted.submissions).toEqual(expectedPersisted.submissions);
    expect(Object.hasOwn(persisted, 'assessmentContractVersion')).toBe(false);
    expect(first.assessmentContractVersion).toBe('legacy');
    // Mutating nested read output never reaches the instance or a later read.
    const headItem = first.submissions[0].items['task-1-0'];
    headItem.feedback.changed = true;
    headItem.assessments.completeness.score = 99;
    headItem.artifact.metadata.changed = true;
    expect(restored.toJSON()).toEqual(persisted);
    const second = restored.toReadJSON();
    expect(second).not.toBe(first);
    expect(second.submissions[0].items['task-1-0'].feedback).toEqual(
      expectedPersisted.submissions[0].items['task-1-0'].feedback
    );
    expect(second.submissions[0].items['task-1-0'].assessments.completeness).toEqual(
      expectedPersisted.submissions[0].items['task-1-0'].assessments.completeness
    );

    const sentinel = new Error('sentinel preparation failure');
    const prepareSpy = vi
      .spyOn(Rehydration, 'prepareLegacyReadSubmissions')
      .mockImplementation(() => {
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
