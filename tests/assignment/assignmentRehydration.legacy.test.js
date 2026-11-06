import { afterEach, describe, expect, it, vi } from 'vitest';
import { currentAssignmentJson, restoreAssignment } from './assignmentRehydrationCurrentSupport.js';
import { loadSyntheticAnalysisProfile } from '#synthetic-data/loadSyntheticAnalysisProfile.js';
import { deriveLegacyAssignmentScenario } from '#synthetic-data/deriveLegacyAssignmentScenario.js';

const { StudentSubmission } = require('#backend/Models/StudentSubmission/index.js');
const {
  StudentSubmissionItem,
} = require('#backend/Models/StudentSubmission/00_StudentSubmissionItem.js');

/** Canonical `small` selection for the realistic healthy legacy record. */
const LEGACY_ASSIGNMENT_ID = 'assignment-0-1';

/**
 * Derives the stored legacy scenario (marker removed) from the canonical views.
 * @returns {object} Derived stored scenario with standalone and class-embedded records.
 */
function storedLegacyScenario() {
  const sources = {
    classesById: loadSyntheticAnalysisProfile('small', 'classesById'),
    assignmentsByKey: loadSyntheticAnalysisProfile('small', 'assignmentsByKey'),
  };
  return deriveLegacyAssignmentScenario({
    profileName: 'small',
    assignmentId: LEGACY_ASSIGNMENT_ID,
    variant: 'stored',
    sources,
  });
}

/**
 * Clones the derived stored full record and applies a local `submissions` override.
 * @param {object|null|undefined} submissions Stored value; `undefined` leaves the property absent.
 * @returns {object} Clone of the canonical full record with the override applied.
 */
function storedLegacyRecord(submissions) {
  const record = structuredClone(storedLegacyScenario().full);
  if (submissions === undefined) {
    Reflect.deleteProperty(record, 'submissions');
  } else {
    record.submissions = submissions;
  }
  return record;
}

function historicalAssignment(marker, partial) {
  const record = currentAssignmentJson();
  const submission = record.submissions[0];
  submission.items['task-1-0'].assessments = { ancientRubric: { verdict: ['unmapped', null, 9] } };
  submission.items['task-1-0'].artifact = { antiquePayload: { bytes: [0, 255], nested: null } };
  submission.historicalEnvelope = { marks: [{ opaque: true }] };
  record.submissions = [submission];
  if (partial) {
    const definition = record.assignmentDefinition;
    definition.tasks = Object.values(definition.tasks).map((task) => ({
      taskId: task.taskId ?? task.id,
      taskWeighting: task.taskWeighting,
      taskTitle: task.taskTitle,
    }));
    for (const key of ['tasks', 'referenceDocumentId', 'templateDocumentId']) delete record[key];
  }
  delete record.assessmentContractVersion;
  if (marker !== 'missing') record.assessmentContractVersion = marker;
  return record;
}

function expectOpaqueRoundTrip(record, restored) {
  expect(restored).toBeInstanceOf(require('#backend/AssignmentProcessor/Assignment/index.js'));
  for (const snapshot of [restored.toJSON(), restored.toPartialJSON()]) {
    expect(snapshot.submissions).toEqual(record.submissions);
    expect(Object.hasOwn(snapshot, 'assessmentContractVersion')).toBe(
      Object.hasOwn(record, 'assessmentContractVersion')
    );
    if (Object.hasOwn(record, 'assessmentContractVersion')) {
      expect(snapshot.assessmentContractVersion).toBe(record.assessmentContractVersion);
    }
    expect(Object.keys(snapshot)).not.toContain('_hydrationLevel');
    expect(Object.keys(snapshot)).not.toContain('_opaqueSubmissionSnapshot');
  }
}

/** Asserts the restored instance exposes the stored legacy body and marker as ordinary state. */
function expectLegacyInstanceState(record, restored) {
  expect(restored.submissions).toEqual(record.submissions);
  expect(restored.assessmentContractVersion).toEqual(record.assessmentContractVersion);
  expect(restored._legacyMarkerPresent).toBe(Object.hasOwn(record, 'assessmentContractVersion'));
}

/** Asserts the restored instance's stored body is the same reference the caller supplied. */
function expectRestoredBodyIsStoredBody(record, restored) {
  expect(restored.submissions).toBe(record.submissions);
  expect(restored.submissions[0]).toBe(record.submissions[0]);
}

afterEach(() => vi.restoreAllMocks());

describe('legacy assignment restoration and persistence', () => {
  it.each([
    ['missing', 'missing'],
    ['null', null],
    ['unsupported', 77],
  ])('keeps %s marker and historical payload opaque through full restoration', (_label, marker) => {
    const record = historicalAssignment(marker, false);
    const captured = structuredClone(record);
    expect(record.courseId).toBeTruthy();
    expect(record.assignmentId).toBeTruthy();
    expect(record.submissions[0].studentId).toBeTruthy();
    expect(record.submissions[0].items['task-1-0'].assessments.ancientRubric).toBeDefined();
    expect(typeof StudentSubmission.fromJSON).toBe('function');
    expect(typeof StudentSubmissionItem.fromJSON).toBe('function');
    const submissionRestore = vi.spyOn(StudentSubmission, 'fromJSON');
    const itemRestore = vi.spyOn(StudentSubmissionItem, 'fromJSON');

    const restored = restoreAssignment(record);

    expect(submissionRestore).not.toHaveBeenCalled();
    expect(itemRestore).not.toHaveBeenCalled();
    expectLegacyInstanceState(record, restored);
    expectRestoredBodyIsStoredBody(record, restored);
    // The restored instance keeps the caller's stored body by reference, so a
    // caller mutation is visible through the instance until it is re-serialised.
    record.submissions[0].historicalEnvelope.marks[0].opaque = false;
    const firstSnapshot = restored.toJSON();
    expect(firstSnapshot.submissions[0].historicalEnvelope.marks[0].opaque).toBe(false);
    // Serialisation emits an independently owned copy: mutating one payload
    // never reaches the instance state or a later payload.
    firstSnapshot.submissions[0].historicalEnvelope.marks[0].opaque = true;
    expect(restored.submissions[0].historicalEnvelope.marks[0].opaque).toBe(false);
    expect(restored.toJSON().submissions[0].historicalEnvelope.marks[0].opaque).toBe(false);
    expect(captured.submissions[0].historicalEnvelope.marks[0].opaque).toBe(true);
    expectOpaqueRoundTrip(record, restored);
  });

  it.each([
    ['missing', 'missing'],
    ['null', null],
    ['unsupported', 77],
  ])(
    'restores legacy %s marker from an actual partial definition without interpreting bodies',
    (_label, marker) => {
      const record = historicalAssignment(marker, true);
      expect(Array.isArray(record.assignmentDefinition.tasks)).toBe(true);
      expect(record.assignmentDefinition.tasks).toHaveLength(2);
      expect(typeof StudentSubmission.fromJSON).toBe('function');
      expect(typeof StudentSubmissionItem.fromJSON).toBe('function');
      const submissionRestore = vi.spyOn(StudentSubmission, 'fromJSON');
      const itemRestore = vi.spyOn(StudentSubmissionItem, 'fromJSON');

      const restored = restoreAssignment(record, 'partial');

      expect(submissionRestore).not.toHaveBeenCalled();
      expect(itemRestore).not.toHaveBeenCalled();
      expectLegacyInstanceState(record, restored);
      expectOpaqueRoundTrip(record, restored);
    }
  );

  it('exposes the missing read projection seam independently of persistence', () => {
    const restored = restoreAssignment(currentAssignmentJson());
    expect(typeof restored.toReadJSON).toBe('function');
  });

  it('keeps the stored legacy marker value and presence distinct from the current marker', () => {
    const markerless = restoreAssignment(historicalAssignment('missing', false));
    expect(markerless._legacyMarkerPresent).toBe(false);
    expect(markerless.assessmentContractVersion).toBeUndefined();
    expect(Object.hasOwn(markerless.toJSON(), 'assessmentContractVersion')).toBe(false);

    const nullMarked = restoreAssignment(historicalAssignment(null, false));
    expect(nullMarked._legacyMarkerPresent).toBe(true);
    expect(nullMarked.assessmentContractVersion).toBeNull();
    expect(nullMarked.toJSON().assessmentContractVersion).toBeNull();

    const unsupported = restoreAssignment(historicalAssignment(77, false));
    expect(unsupported._legacyMarkerPresent).toBe(true);
    expect(unsupported.assessmentContractVersion).toBe(77);
    expect(unsupported.toJSON().assessmentContractVersion).toBe(77);
  });
});

/** Serialises the assignment through both persistence paths. */
function emitBothForms(restored) {
  return { full: restored.toJSON(), partial: restored.toPartialJSON() };
}

describe('legacy submissions preservation through restoration and persistence', () => {
  it('uses the constructor empty-array state when the property is absent', () => {
    const restored = restoreAssignment(storedLegacyRecord(undefined));
    expect(restored.submissions).toBeInstanceOf(Array);
    expect(restored.submissions).toHaveLength(0);
    const { full, partial } = emitBothForms(restored);
    expect(full.submissions).toEqual([]);
    expect(partial.submissions).toEqual([]);
  });

  it('preserves a present array submission body without substitution or reordering', () => {
    const { full } = storedLegacyScenario();
    const stored = structuredClone(full);
    const restored = restoreAssignment(stored);
    expect(restored.submissions).toHaveLength(stored.submissions.length);
    expect(restored.submissions).toEqual(stored.submissions);
    const emitted = emitBothForms(restored);
    expect(emitted.full.submissions).toEqual(stored.submissions);
    expect(emitted.partial.submissions).toEqual(stored.submissions);
  });
  it('preserves an explicit null submissions value and never emits an empty array', () => {
    const stored = storedLegacyRecord(null);
    const restored = restoreAssignment(stored);
    expect(restored.submissions).toBeNull();
    const { full, partial } = emitBothForms(restored);
    expect(full.submissions).toBeNull();
    expect(partial.submissions).toBeNull();
  });

  it('preserves a present object submissions value and never emits an empty array', () => {
    const stored = storedLegacyRecord({
      legacyStudent: { studentId: 'legacy-student', createdAt: '2019-01-02T03:04:05.000Z' },
    });
    const restored = restoreAssignment(stored);
    expect(restored.submissions).toEqual(stored.submissions);
    const { full, partial } = emitBothForms(restored);
    expect(full.submissions).toEqual(stored.submissions);
    expect(partial.submissions).toEqual(stored.submissions);
  });

  it('serialises a present non-array submissions value already held by the instance without throwing', () => {
    const restored = restoreAssignment(storedLegacyRecord(null));
    const heldObject = { legacyStudent: { studentId: 'legacy-student' } };
    restored.submissions = heldObject;
    expect(() => restored.toJSON()).not.toThrow();
    expect(restored.toJSON().submissions).toEqual(heldObject);
    expect(restored.toPartialJSON().submissions).toEqual(heldObject);
  });

  it('restores an absent submissions property while keeping the stored marker state independent', () => {
    const restored = restoreAssignment(storedLegacyRecord(undefined));
    expect(restored._legacyMarkerPresent).toBe(false);
    expect(restored.assessmentContractVersion).toBeUndefined();
    expect(Object.hasOwn(restored.toJSON(), 'assessmentContractVersion')).toBe(false);
  });
});

describe('legacy submissions with live Date values', () => {
  const ENTRY_CREATED = new Date('2020-02-03T04:05:06.000Z');
  const ENTRY_UPDATED = new Date('2021-03-04T05:06:07.000Z');
  const ARRAY_DATE = new Date('2022-05-06T07:08:09.000Z');
  const NESTED_DATE = new Date('2023-06-07T08:09:10.000Z');

  it.each([
    ['toJSON', (restored) => restored.toJSON()],
    ['toPartialJSON', (restored) => restored.toPartialJSON()],
  ])('emits ISO strings for live Dates in an array submission body through %s', (_method, emit) => {
    const stored = storedLegacyRecord([
      { studentId: 'legacy-student', createdAt: ENTRY_CREATED, updatedAt: ENTRY_UPDATED },
    ]);
    const restored = restoreAssignment(stored);
    const emitted = emit(restored).submissions;
    expect(emitted).toEqual([
      {
        studentId: 'legacy-student',
        createdAt: ENTRY_CREATED.toISOString(),
        updatedAt: ENTRY_UPDATED.toISOString(),
      },
    ]);
  });

  it.each([
    ['toJSON', (restored) => restored.toJSON()],
    ['toPartialJSON', (restored) => restored.toPartialJSON()],
  ])(
    'emits ISO strings for Dates nested in array and object fields through %s',
    (_method, emit) => {
      const stored = storedLegacyRecord({
        legacyStudent: {
          studentId: 'legacy-student',
          timeline: [ARRAY_DATE],
          provenance: { recordedAt: NESTED_DATE },
        },
      });
      const restored = restoreAssignment(stored);
      const emitted = emit(restored).submissions;
      expect(emitted.legacyStudent.timeline).toEqual([ARRAY_DATE.toISOString()]);
      expect(emitted.legacyStudent.provenance.recordedAt).toBe(NESTED_DATE.toISOString());
      expect(emitted.legacyStudent.timeline[0]).not.toEqual({});
      expect(emitted.legacyStudent.provenance.recordedAt).not.toEqual({});
    }
  );
});

describe('marker-1 restoration and serialisation guards', () => {
  it('still rejects an invalid marker-1 root', () => {
    const record = currentAssignmentJson();
    record.submissions = null;
    expect(() => restoreAssignment(record)).toThrow('Current assignment root is untrustworthy');
  });

  it('round trips a valid marker-1 record through restoration and both serialisers', () => {
    const record = currentAssignmentJson();
    const restored = restoreAssignment(record);
    expect(restored.assessmentContractVersion).toBe(1);
    const { full, partial } = emitBothForms(restored);
    expect(full.assessmentContractVersion).toBe(1);
    expect(partial.assessmentContractVersion).toBe(1);
    expect(full.submissions).toHaveLength(record.submissions.length);
    expect(partial.submissions).toHaveLength(record.submissions.length);
    expect(full.submissions.map((submission) => submission.studentId)).toEqual(
      record.submissions.map((submission) => submission.studentId)
    );
  });
});
