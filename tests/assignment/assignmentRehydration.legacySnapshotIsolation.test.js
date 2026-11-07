/** Legacy read timestamps and the read/persistence separation boundary. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { currentAssignmentJson, restoreAssignment } from './assignmentRehydrationCurrentSupport.js';
import { loadSyntheticAnalysisProfile } from '#synthetic-data/loadSyntheticAnalysisProfile.js';
import { deriveLegacyAssignmentScenario } from '#synthetic-data/deriveLegacyAssignmentScenario.js';

/** Canonical `small` selection shared with the legacy restoration suite. */
const LEGACY_ASSIGNMENT_ID = 'assignment-0-1';

/**
 * Clones the derived stored legacy full record with a local `submissions` override.
 * The marker is removed on the linked assignment and its embedded form.
 * @param {object|null} submissions Stored submissions value.
 * @returns {object} Derived stored full record carrying the override.
 */
function storedLegacyRecord(submissions) {
  const sources = {
    classesById: loadSyntheticAnalysisProfile('small', 'classesById'),
    assignmentsByKey: loadSyntheticAnalysisProfile('small', 'assignmentsByKey'),
  };
  const { full } = deriveLegacyAssignmentScenario({
    profileName: 'small',
    assignmentId: LEGACY_ASSIGNMENT_ID,
    variant: 'stored',
    sources,
  });
  return { ...structuredClone(full), submissions };
}

const Rehydration = require('#backend/AssignmentProcessor/Assignment/02_AssignmentRehydration.js');

function historicalRecord() {
  const record = currentAssignmentJson();
  delete record.assessmentContractVersion;
  record.createdAt = '2020-02-03T04:05:06.000Z';
  record.updatedAt = '2021-03-04T05:06:07.000Z';
  record.submissions = record.submissions.slice(0, 1);
  return record;
}

/** Prepares the record's read result through the facade after restoration. */
function prepare(record) {
  return Rehydration.prepareLegacyReadSubmissions(restoreAssignment(record), 'full');
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('legacy read preparation timestamp fallbacks', () => {
  it('preserves valid stored creation and update timestamps independently', () => {
    const record = historicalRecord();
    const [prepared] = prepare(record);
    expect(prepared.createdAt).toBe(record.submissions[0].createdAt);
    expect(prepared.updatedAt).toBe(record.submissions[0].updatedAt);
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
    const [prepared] = prepare(record);
    expect(prepared.createdAt).toBe(record.createdAt);
    expect(prepared.updatedAt).toBe(record.updatedAt);
  });

  it('uses assignment creation time when both submission and assignment update times are unavailable', () => {
    const record = historicalRecord();
    delete record.updatedAt;
    record.submissions[0].createdAt = null;
    record.submissions[0].updatedAt = 'malformed';
    const [prepared] = prepare(record);
    expect(prepared.updatedAt).toBe(record.createdAt);
  });

  it('keeps exact historical timestamps when the fake clock changes between preparations', () => {
    const record = historicalRecord();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T00:00:00.000Z'));
    const first = prepare(record);
    vi.setSystemTime(new Date('2040-01-01T00:00:00.000Z'));
    const second = prepare(record);
    expect(first).toEqual(second);
    expect(first[0].createdAt).toBe(record.submissions[0].createdAt);
    expect(first[0].updatedAt).toBe(record.submissions[0].updatedAt);
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

describe('legacy non-array submission payloads are independent of saved state', () => {
  /** Legacy object submission body used by the object-payload independence cases. */
  const OBJECT_BODY = {
    legacyStudent: { studentId: 'legacy-student', marks: [{ taskId: 'task-1-0', score: 2 }] },
  };

  it.each([
    ['toJSON', (restored) => restored.toJSON()],
    ['toPartialJSON', (restored) => restored.toPartialJSON()],
  ])('does not let a returned object payload mutate saved state through %s', (_method, emit) => {
    const record = storedLegacyRecord(structuredClone(OBJECT_BODY));
    const restored = restoreAssignment(record);
    const before = structuredClone(restored.submissions);

    const returned = emit(restored);
    returned.submissions.legacyStudent.marks[0].score = 9;
    returned.submissions.legacyStudent.marks.push({ taskId: 'task-1-1', score: 1 });
    returned.submissions.injected = true;

    expect(restored.submissions).toEqual(before);
    expect(emit(restored).submissions).toEqual(OBJECT_BODY);
  });

  it.each([
    ['toJSON', (restored) => restored.toJSON()],
    ['toPartialJSON', (restored) => restored.toPartialJSON()],
  ])('serialises the same preserved value on repeated calls through %s', (_method, emit) => {
    const record = storedLegacyRecord(structuredClone(OBJECT_BODY));
    const restored = restoreAssignment(record);
    const first = emit(restored).submissions;
    const second = emit(restored).submissions;
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.legacyStudent).not.toBe(second.legacyStudent);
  });

  it('keeps a returned null submissions payload independent of the restored null state', () => {
    const restored = restoreAssignment(storedLegacyRecord(null));
    const returned = restored.toJSON();
    expect(returned.submissions).toBeNull();
    returned.submissions = ['caller mutation'];
    expect(restored.submissions).toBeNull();
    expect(restored.toJSON().submissions).toBeNull();
  });
});
