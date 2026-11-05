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

  it('re-emits a stored legacy body without snapshot ownership and converts live Dates to ISO strings', () => {
    const record = historicalRecord();
    record.submissions[0].historicalEnvelope = { nested: { value: 'stored' } };
    record.submissions[0].createdAt = new Date('2020-02-03T04:05:06.000Z');
    record.submissions[0].updatedAt = new Date('2021-03-04T05:06:07.000Z');
    const restored = restoreAssignment(record);
    expect(restored._legacyMarkerPresent).toBe(false);
    expect(restored.submissions).toBe(record.submissions);

    const initial = restored.toJSON();
    expect(initial.submissions[0]).toHaveProperty('historicalEnvelope');
    expect(initial.submissions[0].historicalEnvelope).toEqual({ nested: { value: 'stored' } });
    // A Date has no own enumerable keys, so the plain-object fallback must
    // delegate to date conversion rather than emitting `{}`.
    expect(initial.submissions[0].createdAt).toBe('2020-02-03T04:05:06.000Z');
    expect(initial.submissions[0].updatedAt).toBe('2021-03-04T05:06:07.000Z');
    expect(restored.toPartialJSON().submissions[0].createdAt).toBe('2020-02-03T04:05:06.000Z');

    // The instance keeps the caller's stored body by reference, so a caller
    // mutation is visible through it; serialisation never returns that body.
    record.submissions[0].historicalEnvelope.nested.value = 'caller mutation';
    expect(restored.toJSON().submissions[0].historicalEnvelope.nested.value).toBe(
      'caller mutation'
    );
    expect(restored.toJSON().submissions[0]).not.toBe(record.submissions[0]);

    // Mutating a returned payload never reaches the instance state or a later payload.
    const returned = restored.toJSON();
    returned.submissions[0].historicalEnvelope.nested.value = 'returned mutation';
    expect(restored.toJSON().submissions[0].historicalEnvelope.nested.value).toBe(
      'caller mutation'
    );
    expect(Object.hasOwn(restored.toJSON(), 'assessmentContractVersion')).toBe(false);
  });
});

describe('legacy submission entries that are not plain records', () => {
  const ENTRY_DATE = new Date('2022-05-06T07:08:09.000Z');
  const ARRAY_DATE = new Date('2023-06-07T08:09:10.000Z');

  /**
   * Restores a legacy record whose stored submissions hold a bare `Date` entry
   * and an array-valued entry containing a `Date`.
   *
   * @returns {{record: object, restored: object}} Stored record and restored instance.
   */
  function restoredRecordWithNonPlainEntries() {
    const record = historicalRecord();
    record.submissions = [ENTRY_DATE, [ARRAY_DATE]];
    const restored = restoreAssignment(record);
    expect(restored._legacyMarkerPresent).toBe(false);
    return { record, restored };
  }

  it.each([
    ['toJSON', (restored) => restored.toJSON()],
    ['toPartialJSON', (restored) => restored.toPartialJSON()],
  ])('emits ISO strings rather than `{}` for Date entries through %s', (_method, emit) => {
    const { restored } = restoredRecordWithNonPlainEntries();
    const emitted = emit(restored).submissions;
    expect(emitted).toHaveLength(2);
    expect(emitted[0]).toBe(ENTRY_DATE.toISOString());
    expect(emitted[1]).toEqual([ARRAY_DATE.toISOString()]);
    expect(emitted[0]).not.toEqual({});
    expect(emitted[1]).not.toEqual([{}]);
  });

  it.each([
    ['toJSON', (restored) => restored.toJSON()],
    ['toPartialJSON', (restored) => restored.toPartialJSON()],
  ])('emits an independently owned array for array entries through %s', (_method, emit) => {
    const { record, restored } = restoredRecordWithNonPlainEntries();
    const storedArray = record.submissions[1];
    const emitted = emit(restored).submissions;
    expect(emitted[1]).not.toBe(storedArray);
    expect(emitted[1][0]).not.toBe(ARRAY_DATE);

    emitted[1].push('returned mutation');
    emitted[1][0] = 'returned mutation';
    expect(storedArray).toEqual([ARRAY_DATE]);
    expect(record.submissions[1][0]).toBe(ARRAY_DATE);
    expect(emit(restored).submissions[1]).toEqual([ARRAY_DATE.toISOString()]);
  });
});
