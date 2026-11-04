/**
 * Regression test: a legacy class-embedded assignment whose embedded definition
 * carries the full keyed task map must read through `getABClass` without
 * throwing, exposing reassessment `E` for every roster/task pair.
 *
 * `ABClass.fromJSON` restores both supported embedded definition shapes (the
 * task-summary array and the full keyed task map), and class saves serialise
 * full-definition assignments through `toJSON()`, so a stored class document
 * can legitimately hold a legacy assignment with a keyed task map. The partial
 * reassessment projection must accept that shape instead of failing the whole
 * class read. Gap found in the PR #345 review.
 */
import { describe, expect, it } from 'vitest';
import { currentAssignmentJson } from './assignmentRehydrationCurrentSupport.js';

const ABClassModule = require('#backend/Models/ABClass.js');
const ABClass = ABClassModule.ABClass || ABClassModule;
const ABClassResponseMapper = require('#backend/y_controllers/ABClassController/ABClassResponseMapper.js');

describe('legacy full-keyed-definition assignment on the class read path', () => {
  it('reads without throwing and exposes reassessment E for every roster/task pair', () => {
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
    expect(embedded._legacyPersistenceSnapshot).toBeTruthy();
    // The embedded definition was restored in full mode: tasks is a keyed object.
    expect(Array.isArray(embedded.assignmentDefinition.tasks)).toBe(false);

    const mapper = new ABClassResponseMapper();
    const view = mapper._toReadView(abClass);

    expect(view.assignments).toHaveLength(1);
    const readAssignment = view.assignments[0];
    expect(readAssignment.assessmentContractVersion).toBeNull();
    expect(readAssignment.assignmentDefinitionKey).toBe(
      embedded.assignmentDefinition.definitionKey
    );
    expect(readAssignment.submissions).toHaveLength(classJson.students.length);

    // Every roster student carries every known task as a detached reassessment
    // placeholder, and the partial E entries keep their reasoning and cause.
    const taskIds = Object.keys(embedded.assignmentDefinition.tasks).sort();
    for (const submission of readAssignment.submissions) {
      expect(Object.keys(submission.items).sort()).toEqual(taskIds);
      for (const item of Object.values(submission.items)) {
        for (const assessment of Object.values(item.assessments)) {
          expect(assessment.score).toBe('E');
          expect(assessment.reasoning).toBe('Reassessment required');
          expect(assessment.error).toEqual({
            stage: 'validation',
            code: 'REASSESSMENT_REQUIRED',
          });
        }
      }
    }

    // The read is detached: the class model keeps its legacy snapshot and its
    // un-rehydrated submissions, and the embedded definition is untouched.
    expect(embedded._legacyPersistenceSnapshot).toBeTruthy();
    expect(embedded.submissions).toEqual([]);
    expect(Array.isArray(embedded.assignmentDefinition.tasks)).toBe(false);
  });
});
