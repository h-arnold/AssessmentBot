import { describe, expect, it } from 'vitest';
import { ABClass } from '#backend/Models/ABClass.js';
import {
  currentAssignmentJson,
  rawPartialEmbeddedSnapshot,
  restoreAssignment,
} from '../assignment/assignmentRehydrationCurrentSupport.js';
const ABClassResponseMapper = require('#backend/y_controllers/ABClassController/ABClassResponseMapper.js');

describe('ABClass legacy assessment read projection', () => {
  it.each([
    ['missing', (record) => delete record.assessmentContractVersion],
    ['null', (record) => (record.assessmentContractVersion = null)],
    ['unsupported', (record) => (record.assessmentContractVersion = 77)],
  ])(
    'round-trips mixed legacy and current assignments (%s marker) without interpreting history',
    (_label, markLegacy) => {
      const legacy = currentAssignmentJson();
      markLegacy(legacy);
      legacy.submissions[0].items['task-1-0'].historicalContent = { untouched: ['old', null, 8] };
      const original = structuredClone(legacy);
      const current = currentAssignmentJson();
      const classRecord = {
        classId: 'legacy-roundtrip',
        className: 'History',
        classOwner: null,
        teachers: [],
        students: [],
        assignments: [legacy, current],
        active: true,
        metadata: null,
      };
      const restored = ABClass.fromJSON(classRecord);
      restored.assignments[0]._hydrationLevel = 'read-only-runtime-state';

      const full = restored.toJSON().assignments;
      const partial = restored.assignments.map((assignment) => assignment.toPartialJSON());
      expect(full[0].submissions).toEqual(original.submissions);
      expect(partial[0].submissions).toEqual(original.submissions);
      expect(Object.hasOwn(full[0], 'assessmentContractVersion')).toBe(
        Object.hasOwn(original, 'assessmentContractVersion')
      );
      if (Object.hasOwn(original, 'assessmentContractVersion')) {
        expect(full[0].assessmentContractVersion).toBe(original.assessmentContractVersion);
      }
      expect(full[0]).not.toHaveProperty('_hydrationLevel');
      expect(full[1].assessmentContractVersion).toBe(1);
      expect(full[1].submissions[0].items['task-1-0'].assessments).toEqual(
        current.submissions[0].items['task-1-0'].assessments
      );
      expect(legacy).toEqual(original);
    }
  );

  it('retains supplied class metadata and roster snapshots alongside a legacy assignment snapshot', () => {
    const legacy = currentAssignmentJson();
    const partial = rawPartialEmbeddedSnapshot(legacy);
    delete partial.assessmentContractVersion;
    const storedTasks = [{ taskId: 'stored-task', taskTitle: 'Stored summary' }];
    partial.assignmentDefinition.tasks = storedTasks;
    const suppliedMetadata = null;
    const classRecord = {
      classId: 'authority',
      className: 'Stored class',
      classOwner: null,
      teachers: [],
      students: [{ studentId: 'stored-roster', studentName: 'Stored learner' }],
      assignments: [partial],
      active: true,
      metadata: suppliedMetadata,
    };
    const before = structuredClone(classRecord);
    const restored = ABClass.fromJSON(classRecord);
    expect(restored.assignments[0].assignmentDefinition.tasks).toEqual(storedTasks);
    expect(restored.students).toEqual(before.students);
    expect(restored.metadata).toEqual(before.metadata);
    expect(classRecord).toEqual(before);
  });

  it('integration: projects canonical legacy submissions before replacing its embedded definition', () => {
    const mapper = new ABClassResponseMapper();
    const rawLegacy = currentAssignmentJson();
    delete rawLegacy.assessmentContractVersion;
    rawLegacy.submissions = [
      { ...structuredClone(rawLegacy.submissions[0]), studentId: 'stored-student' },
    ];
    rawLegacy.assignmentDefinition.tasks = Object.fromEntries(
      Object.entries(rawLegacy.assignmentDefinition.tasks).map(([key, task]) => [
        key,
        { ...task, taskId: key },
      ])
    );
    const partial = rawPartialEmbeddedSnapshot(rawLegacy);
    delete partial.assessmentContractVersion;
    partial.assignmentDefinition.definitionKey = 'embedded-key';
    const original = structuredClone(partial);
    const assignment = restoreAssignment(partial);
    expect(assignment.assessmentContractVersion).toBeUndefined();
    const storedTaskIds = partial.assignmentDefinition.tasks.map((task) => task.taskId).sort();
    expect(partial).toMatchObject({
      courseId: expect.any(String),
      assignmentId: expect.any(String),
      createdAt: expect.anything(),
      updatedAt: expect.anything(),
    });
    expect(partial.submissions[0].studentId).toBe('stored-student');
    const readClass = ABClass.fromJSON({
      classId: 'class-a',
      className: 'Class A',
      cohortKey: null,
      courseLength: 1,
      yearGroupKey: null,
      classOwner: null,
      serialiseOwner: (owner) => owner,
      teachers: [],
      students: [{ studentId: 'roster-student', studentName: 'Roster' }],
      active: true,
      metadata: null,
      assignments: [assignment],
    });
    const beforePersist = assignment.toPartialJSON();
    const mapped = mapper._toReadView(readClass).assignments[0];
    expect(mapped.submissions.map((submission) => submission.studentId)).toEqual([
      'roster-student',
    ]);
    expect(Object.keys(mapped.submissions[0].items).sort()).toEqual(storedTaskIds);
    const reassessmentRequired = {
      score: 'E',
      reasoning: 'Reassessment required',
      error: { stage: 'validation', code: 'REASSESSMENT_REQUIRED' },
    };
    for (const item of Object.values(mapped.submissions[0].items)) {
      expect(Object.keys(item.assessments).sort()).toEqual(['accuracy', 'completeness', 'spag']);
      expect(item.assessments).toEqual({
        accuracy: reassessmentRequired,
        completeness: reassessmentRequired,
        spag: reassessmentRequired,
      });
      expect(item.feedback).toEqual({});
    }
    expect(mapped.assessmentContractVersion).toBeNull();
    expect(mapped.assignmentDefinitionKey).toBe('embedded-key');
    expect(mapped).not.toHaveProperty('assignmentDefinition');
    const afterPersist = assignment.toPartialJSON();
    expect(afterPersist.submissions).toEqual(beforePersist.submissions);
    expect(Object.hasOwn(afterPersist, 'assessmentContractVersion')).toBe(
      Object.hasOwn(beforePersist, 'assessmentContractVersion')
    );
    if (Object.hasOwn(beforePersist, 'assessmentContractVersion')) {
      expect(afterPersist.assessmentContractVersion).toBe(beforePersist.assessmentContractVersion);
    }
    expect(beforePersist.submissions).toEqual(original.submissions);
    expect(Object.hasOwn(beforePersist, 'assessmentContractVersion')).toBe(
      Object.hasOwn(original, 'assessmentContractVersion')
    );
  });
});
