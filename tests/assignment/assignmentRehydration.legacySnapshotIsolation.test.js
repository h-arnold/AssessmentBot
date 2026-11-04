/** Historical reassessment timestamps and ownership boundaries. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { currentAssignmentJson, restoreAssignment } from './assignmentRehydrationCurrentSupport.js';

const AssignmentRehydration = require('#backend/AssignmentProcessor/Assignment/02_AssignmentRehydration.js');

function historicalRecord() {
  const record = currentAssignmentJson();
  delete record.assessmentContractVersion;
  record.createdAt = '2020-02-03T04:05:06.000Z';
  record.updatedAt = '2021-03-04T05:06:07.000Z';
  record.submissions = record.submissions.slice(0, 1);
  return record;
}

function roster(record) {
  return record.submissions.map((submission) => ({
    studentId: submission.studentId ?? submission.userId,
    studentName: 'Canonical student',
  }));
}

function project(record, students) {
  expect(AssignmentRehydration.projectReassessmentSubmissions).toEqual(expect.any(Function));
  return AssignmentRehydration.projectReassessmentSubmissions(record, students, 'full');
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('legacy reassessment timestamp snapshots', () => {
  it('preserves valid stored creation and update timestamps independently', () => {
    const record = historicalRecord();
    const [submission] = project(record, roster(record));
    const serialised = submission.toJSON();
    expect(serialised.createdAt).toBe(record.submissions[0].createdAt);
    expect(serialised.updatedAt).toBe(record.submissions[0].updatedAt);
  });

  it.each([
    ['missing', undefined],
    ['null', null],
    ['malformed', 'not-a-date'],
  ])('falls back independently for %s submission timestamps', (_label, invalid) => {
    const record = historicalRecord();
    const stored = record.submissions[0];
    stored.createdAt = invalid;
    stored.updatedAt = invalid;
    const [submission] = project(record, roster(record));
    const serialised = submission.toJSON();
    expect(serialised.createdAt).toBe(record.createdAt);
    expect(serialised.updatedAt).toBe(record.updatedAt);
  });

  it('uses assignment creation time when both submission and assignment update times are unavailable', () => {
    const record = historicalRecord();
    delete record.updatedAt;
    record.submissions[0].createdAt = null;
    record.submissions[0].updatedAt = 'malformed';
    const [submission] = project(record, roster(record));
    expect(submission.toJSON().updatedAt).toBe(record.createdAt);
  });

  it('keeps exact historical timestamps when the fake clock changes between projections', () => {
    const record = historicalRecord();
    const students = roster(record);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T00:00:00.000Z'));
    const first = project(record, students).map((value) => value.toJSON());
    vi.setSystemTime(new Date('2040-01-01T00:00:00.000Z'));
    const second = project(record, students).map((value) => value.toJSON());
    expect(first).toEqual(second);
    expect(first[0].createdAt).toBe(record.submissions[0].createdAt);
    expect(first[0].updatedAt).toBe(record.submissions[0].updatedAt);
  });
});

describe('legacy reassessment deep detachment', () => {
  it('does not mutate assignment or roster inputs and detaches nested projected values and serialisation', () => {
    const record = historicalRecord();
    const students = roster(record);
    const beforeRecord = structuredClone(record);
    const beforeStudents = structuredClone(students);
    const restored = restoreAssignment(record);
    const persistedBefore = restored.toJSON();
    const first = project(record, students);
    const second = project(record, students);
    expect(first).toHaveLength(students.length);
    expect(Object.keys(first[0].items)).toHaveLength(
      Object.keys(record.assignmentDefinition.tasks).length
    );
    expect(record).toEqual(beforeRecord);
    expect(students).toEqual(beforeStudents);

    const firstJSON = first[0].toJSON();
    const secondJSON = second[0].toJSON();
    const taskId = Object.keys(firstJSON.items)[0];
    const siblingTaskId = Object.keys(firstJSON.items).find((id) => id !== taskId);
    const criterion = Object.keys(firstJSON.items[taskId].assessments)[0];
    const otherCriteria = structuredClone(firstJSON.items[taskId].assessments);
    delete otherCriteria[criterion];
    const secondProjectionItem = structuredClone(secondJSON.items[taskId]);
    const siblingItem = structuredClone(secondJSON.items[siblingTaskId]);
    const sourceRecord = structuredClone(record);
    const sourceStudents = structuredClone(students);
    const assessment = firstJSON.items[taskId].assessments[criterion];
    assessment.error.stage = 'changed';
    assessment.error.code = 'changed';
    assessment.reasoning = 'changed';
    firstJSON.items[taskId].feedback.changed = { nested: true };
    firstJSON.items[taskId].artifact.metadata.changed = true;
    expect(second[0].toJSON().items[taskId]).toEqual(secondProjectionItem);
    expect(second[0].toJSON().items[taskId].assessments).toEqual(
      expect.objectContaining(otherCriteria)
    );
    expect(second[0].toJSON().items[siblingTaskId]).toEqual(siblingItem);
    expect(restored.toJSON()).toEqual(persistedBefore);
    expect(record).toEqual(sourceRecord);
    expect(students).toEqual(sourceStudents);
    expect(beforeRecord).toEqual(sourceRecord);
    expect(beforeStudents).toEqual(sourceStudents);
  });

  it('retains an owned opaque persistence snapshot and isolates returned persistence JSON', () => {
    const record = historicalRecord();
    record.submissions[0].historicalEnvelope = { nested: { value: 'stored' } };
    const captured = structuredClone(record);
    const restored = restoreAssignment(record);
    const initial = restored.toJSON();
    expect(initial.submissions[0]).toHaveProperty('historicalEnvelope');
    expect(initial.submissions[0].historicalEnvelope).toEqual(
      captured.submissions[0].historicalEnvelope
    );
    const expectedSubmission = structuredClone(initial.submissions[0]);
    const expectedMarker = Object.hasOwn(initial, 'assessmentContractVersion')
      ? { present: true, value: initial.assessmentContractVersion }
      : { present: false };
    record.submissions[0].historicalEnvelope.nested.value = 'caller mutation';
    expect(restored.toJSON().submissions[0].historicalEnvelope.nested.value).toBe('stored');
    const returned = restored.toJSON();
    returned.submissions[0].historicalEnvelope.nested.value = 'returned mutation';
    const later = restored.toJSON();
    expect(later.submissions[0]).toEqual(expectedSubmission);
    expect(Object.hasOwn(later, 'assessmentContractVersion')).toBe(expectedMarker.present);
    if (expectedMarker.present) {
      expect(later.assessmentContractVersion).toBe(expectedMarker.value);
    }
  });
});
