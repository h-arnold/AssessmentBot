/**
 * Regression test: a legacy class-embedded assignment whose embedded definition
 * carries the full keyed task map must read through the class read path without
 * throwing, keeping its real stored scores instead of placeholder entries.
 *
 * `ABClass.fromJSON` restores both supported embedded definition shapes (the
 * task-summary array and the full keyed task map), and class saves serialise
 * full-definition assignments through `toJSON()`, so a stored class document
 * can legitimately hold a legacy assignment with a keyed task map. Read
 * preparation must validate that shape as full instead of failing the whole
 * class read. Gap found in the PR #345 review.
 */
import { describe, expect, it } from 'vitest';
import { currentAssignmentJson } from './assignmentRehydrationCurrentSupport.js';

const ABClassModule = require('#backend/Models/ABClass.js');
const ABClass = ABClassModule.ABClass || ABClassModule;
const ABClassResponseMapper = require('#backend/y_controllers/ABClassController/ABClassResponseMapper.js');

describe('legacy full-keyed-definition assignment on the class read path', () => {
  it('reads without throwing and keeps the stored marks for the stored submissions', () => {
    const assignment = currentAssignmentJson();
    delete assignment.assessmentContractVersion; // make the record legacy

    const classJson = {
      classId: 'class-probe',
      className: 'Probe Class',
      courseLength: 1,
      yearGroupKey: 'year-group-10',
      teachers: [],
      students: assignment.submissions.map((submission, index) => ({
        studentId: submission.studentId ?? submission.userId,
        studentName: submission.studentName ?? `Student ${index}`,
      })),
      assignments: [assignment],
      active: true,
    };

    const abClass = ABClass.fromJSON(classJson);
    expect(abClass).toBeTruthy();
    const embedded = abClass.assignments[0];
    // The restored record is legacy: its marker is absent rather than 1, and the
    // stored body is kept as ordinary instance state.
    expect(embedded._legacyMarkerPresent).toBe(false);
    expect(embedded.assessmentContractVersion).not.toBe(1);
    expect(embedded.submissions).toEqual(assignment.submissions);
    // The embedded definition was restored in full mode: tasks is a keyed object.
    expect(Array.isArray(embedded.assignmentDefinition.tasks)).toBe(false);

    const mapper = new ABClassResponseMapper();
    const view = mapper._toReadView(abClass);

    expect(view.assignments).toHaveLength(1);
    const readAssignment = view.assignments[0];
    expect(readAssignment.assessmentContractVersion).toBe('legacy');
    expect(readAssignment.assignmentDefinitionKey).toBe(
      embedded.assignmentDefinition.definitionKey
    );
    // Stored submissions only: the roster (mirrored here) never expands them.
    expect(readAssignment.submissions).toHaveLength(assignment.submissions.length);
    const taskIds = Object.keys(embedded.assignmentDefinition.tasks).sort();
    for (const submission of readAssignment.submissions) {
      expect(Object.keys(submission.items).sort()).toEqual(taskIds);
    }
    const scores = readAssignment.submissions.flatMap((submission) =>
      Object.values(submission.items).flatMap((item) => Object.values(item.assessments))
    );
    expect(scores.some((entry) => typeof entry.score === 'number' || entry.score === 'N')).toBe(
      true
    );
    expect(
      scores.some((entry) => entry.score === 'E' && entry.error?.code === 'CORRUPT_RECORD')
    ).toBe(false);

    // The read is detached: the class model keeps its legacy state and its
    // un-rehydrated submissions, and the embedded definition is untouched.
    expect(embedded._legacyMarkerPresent).toBe(false);
    expect(embedded.assessmentContractVersion).not.toBe(1);
    expect(embedded.submissions).toEqual(assignment.submissions);
    expect(Array.isArray(embedded.assignmentDefinition.tasks)).toBe(false);
  });
});
