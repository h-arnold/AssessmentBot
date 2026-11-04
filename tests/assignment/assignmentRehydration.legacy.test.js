import { afterEach, describe, expect, it, vi } from 'vitest';
import { currentAssignmentJson, restoreAssignment } from './assignmentRehydrationCurrentSupport.js';

const { StudentSubmission } = require('#backend/Models/StudentSubmission/index.js');
const {
  StudentSubmissionItem,
} = require('#backend/Models/StudentSubmission/00_StudentSubmissionItem.js');

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
    record.submissions[0].historicalEnvelope.marks[0].opaque = false;
    const firstSnapshot = restored.toJSON();
    firstSnapshot.submissions[0].historicalEnvelope.marks[0].opaque = false;
    expectOpaqueRoundTrip(captured, restored);
    expect(record.submissions[0].historicalEnvelope.marks[0].opaque).toBe(false);
    expect(captured.submissions[0].historicalEnvelope.marks[0].opaque).toBe(true);
  });

  it.each([
    ['missing', 'missing'],
    ['null', null],
    ['unsupported', 77],
  ])(
    'restores legacy %s marker from an actual partial definition without interpreting bodies',
    (_label, marker) => {
      const record = historicalAssignment(marker, true);
      const captured = structuredClone(record);
      expect(Array.isArray(record.assignmentDefinition.tasks)).toBe(true);
      expect(record.assignmentDefinition.tasks).toHaveLength(2);
      expect(typeof StudentSubmission.fromJSON).toBe('function');
      expect(typeof StudentSubmissionItem.fromJSON).toBe('function');
      const submissionRestore = vi.spyOn(StudentSubmission, 'fromJSON');
      const itemRestore = vi.spyOn(StudentSubmissionItem, 'fromJSON');

      const restored = restoreAssignment(record, 'partial');

      expect(submissionRestore).not.toHaveBeenCalled();
      expect(itemRestore).not.toHaveBeenCalled();
      expectOpaqueRoundTrip(captured, restored);
    }
  );

  it('exposes the missing read projection seam independently of persistence', () => {
    const restored = restoreAssignment(currentAssignmentJson());
    expect(typeof restored.toReadJSON).toBe('function');
  });
});
