/**
 * Legacy read wire-version matrix for the two read serialisers.
 *
 * Full reads (`Assignment.toReadJSON()`) and class reads
 * (`ABClassResponseMapper._toReadView()`) must emit the required read marker:
 * stored `1` stays `1`, and a missing, `null` or unsupported stored marker reads
 * as `'legacy'`. Valid stored legacy data is retained and malformed assessment
 * data becomes per-task CORRUPT_RECORD E, prepared from the stored task list
 * before a class read replaces the embedded definition with its key. The
 * non-array submissions root passthrough convention has its own focused
 * companion suite.
 */
import { describe, expect, it } from 'vitest';
import {
  classRead,
  classView,
  healthyFullRecord,
  isCorruptItem,
  LEGACY_MARKER_CASES,
  partialSnapshot,
  restoreLegacy,
} from './assignmentLegacyReadPreparationSupport.js';

const ABClassResponseMapper = require('#backend/y_controllers/ABClassController/ABClassResponseMapper.js');
const Assignment = require('#backend/AssignmentProcessor/Assignment/index.js');

/** Restores a stored legacy record after applying one marker mutation. */
function restoreWithMarker(record, applyMarker) {
  const copy = structuredClone(record);
  applyMarker(copy);
  return restoreLegacy(copy);
}

/** Applies one stored explicit reassessment error to the first item of `record`. */
function withStoredReassessment(record) {
  const taskId = Object.keys(record.submissions[0].items)[0];
  const reassessment = {
    score: 'E',
    reasoning: 'Reassessment required',
    error: { stage: 'validation', code: 'REASSESSMENT_REQUIRED' },
  };
  record.submissions[0].items[taskId].assessments = {
    completeness: reassessment,
    accuracy: reassessment,
    spag: reassessment,
  };
  return taskId;
}

describe('legacy full read wire version matrix', () => {
  it('emits marker 1 for a stored marker-1 record and keeps its serialised submissions', () => {
    const record = healthyFullRecord();
    record.assessmentContractVersion = 1;
    const restored = Assignment.fromJSON(record);

    const read = restored.toReadJSON();

    expect(read.assessmentContractVersion).toBe(1);
    expect(read.submissions).toEqual(restored.toJSON().submissions);
  });

  it.each(LEGACY_MARKER_CASES)(
    'emits the legacy read marker for a %s stored marker',
    (_label, applyMarker) => {
      const read = restoreWithMarker(healthyFullRecord(), applyMarker).toReadJSON();
      expect(read.assessmentContractVersion).toBe('legacy');
    }
  );

  it('retains real legacy scores, reasoning and archived content on a full read', () => {
    const record = healthyFullRecord();
    const stored = structuredClone(record.submissions);
    const restored = restoreWithMarker(record, LEGACY_MARKER_CASES[0][1]);

    const read = restored.toReadJSON();

    expect(read.assessmentContractVersion).toBe('legacy');
    expect(read.submissions).toHaveLength(stored.length);
    const items = read.submissions.flatMap((submission) => Object.values(submission.items));
    const assessments = items.flatMap((item) => Object.values(item.assessments));
    expect(
      assessments.some((entry) => typeof entry.score === 'number' || entry.score === 'N')
    ).toBe(true);
    const numeric = assessments.find((entry) => typeof entry.score === 'number');
    expect(numeric.reasoning).toEqual(expect.any(String));
    expect(items.some((item) => item.artifact.content !== null)).toBe(true);
  });

  it('isolates a malformed assessment item as CORRUPT_RECORD E without dropping healthy neighbours', () => {
    const record = healthyFullRecord();
    const target = record.submissions[0];
    const taskId = Object.keys(target.items)[0];
    const siblingId = Object.keys(target.items)[1];
    const healthySibling = structuredClone(target.items[siblingId]);
    target.items[taskId].assessments = { completeness: { score: 'not-a-score' } };
    const read = restoreWithMarker(record, LEGACY_MARKER_CASES[0][1]).toReadJSON();
    const submission = read.submissions[0];

    expect(isCorruptItem(submission.items[taskId])).toBe(true);
    expect(Object.keys(submission.items).sort()).toEqual(Object.keys(target.items).sort());
    expect(submission.items[siblingId].assessments).toEqual(healthySibling.assessments);
    expect(read.submissions).toHaveLength(record.submissions.length);
  });

  it('keeps a stored explicit reassessment error working on a full read', () => {
    const record = healthyFullRecord();
    const taskId = withStoredReassessment(record);
    const restored = restoreWithMarker(record, LEGACY_MARKER_CASES[0][1]);

    const item = restored.toReadJSON().submissions[0].items[taskId];

    expect(item.assessments.completeness.error.code).toBe('REASSESSMENT_REQUIRED');
    expect(item.assessments.completeness.score).toBe('E');
    expect(restored.toReadJSON().assessmentContractVersion).toBe('legacy');
  });
});

describe('legacy class read wire version matrix', () => {
  it('emits marker 1 for a stored marker-1 partial record', () => {
    const partial = partialSnapshot(healthyFullRecord());
    partial.assessmentContractVersion = 1;
    const assignment = Assignment.fromJSON(partial, 'partial');
    const students = (assignment.submissions ?? []).map((submission) => ({
      studentId: submission.studentId,
      studentName: submission.studentName ?? null,
    }));
    const view = new ABClassResponseMapper()._toReadView(classView(assignment, students))
      .assignments[0];

    expect(view.assessmentContractVersion).toBe(1);
  });

  it.each(LEGACY_MARKER_CASES)(
    'emits the legacy read marker for a %s stored marker',
    (_label, applyMarker) => {
      const view = classRead(healthyFullRecord(), { applyMarker });
      expect(view.assessmentContractVersion).toBe('legacy');
    }
  );

  it('replaces the embedded definition with the definition key after preparation', () => {
    const partial = partialSnapshot(healthyFullRecord());
    const definitionKey = partial.assignmentDefinition.definitionKey;
    const storedTaskIds = partial.assignmentDefinition.tasks.map((task) => task.taskId).sort();
    const view = classRead(partial);

    expect(view.assessmentContractVersion).toBe('legacy');
    expect(view.assignmentDefinitionKey).toBe(definitionKey);
    expect(view).not.toHaveProperty('assignmentDefinition');
    expect(Object.keys(view.submissions[0].items).sort()).toEqual(storedTaskIds);
  });

  it('retains redacted legacy content and numeric scores on a class read', () => {
    const partial = partialSnapshot(healthyFullRecord());
    const view = classRead(partial);

    const items = view.submissions.flatMap((submission) => Object.values(submission.items));
    expect(items.every((item) => item.artifact.content === null)).toBe(true);
    const scores = items.flatMap((item) => Object.values(item.assessments));
    expect(scores.some((entry) => typeof entry.score === 'number' || entry.score === 'N')).toBe(
      true
    );
  });

  it('isolates a malformed item map as per-task CORRUPT_RECORD E without blocking healthy submissions', () => {
    const partial = partialSnapshot(healthyFullRecord());
    const broken = partial.submissions[0];
    const taskIds = partial.assignmentDefinition.tasks.map((task) => task.taskId);
    broken.items = null;
    const healthyBefore = structuredClone(partial.submissions[1]);
    const view = classRead(partial);

    for (const taskId of taskIds)
      expect(isCorruptItem(view.submissions[0].items[taskId])).toBe(true);
    expect(Object.keys(view.submissions[0].items).sort()).toEqual([...taskIds].sort());
    expect(view.submissions[1].items).toEqual(healthyBefore.items);
  });

  it('keeps a stored explicit reassessment error working on a class read', () => {
    const partial = partialSnapshot(healthyFullRecord());
    const taskId = withStoredReassessment(partial);
    const view = classRead(partial);

    expect(view.submissions[0].items[taskId].assessments.completeness.error.code).toBe(
      'REASSESSMENT_REQUIRED'
    );
    expect(view.assessmentContractVersion).toBe('legacy');
  });
});

describe('class read preparation order', () => {
  it('prepares the stored submissions without roster expansion while the embedded task list is available', () => {
    const partial = partialSnapshot(healthyFullRecord());
    const storedTaskIds = partial.assignmentDefinition.tasks.map((task) => task.taskId).sort();
    const storedIds = partial.submissions.map((submission) => submission.studentId).sort();
    const assignment = restoreWithMarker(partial, LEGACY_MARKER_CASES[0][1]);
    // The embedded definition is the only task source at preparation time; the
    // roster deliberately carries one student with no stored submission.
    expect(Array.isArray(assignment.assignmentDefinition.tasks)).toBe(true);
    const students = [
      ...assignment.submissions.map((submission) => ({
        studentId: submission.studentId,
        studentName: submission.studentName ?? null,
      })),
      { studentId: 'roster-extra', studentName: 'No stored submission' },
    ];
    const view = new ABClassResponseMapper()._toReadView(classView(assignment, students))
      .assignments[0];

    expect(view).not.toHaveProperty('assignmentDefinition');
    expect(view.assignmentDefinitionKey).toEqual(expect.any(String));
    expect(view.submissions.map((submission) => submission.studentId).sort()).toEqual(storedIds);
    expect(view.submissions).toHaveLength(assignment.submissions.length);
    expect(Object.keys(view.submissions[0].items).sort()).toEqual(storedTaskIds);
    const scores = view.submissions.flatMap((submission) =>
      Object.values(submission.items).flatMap((item) => Object.values(item.assessments))
    );
    expect(scores.some((entry) => typeof entry.score === 'number' || entry.score === 'N')).toBe(
      true
    );
  });
});
