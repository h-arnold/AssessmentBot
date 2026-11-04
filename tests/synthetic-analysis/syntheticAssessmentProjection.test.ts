import { describe, expect, it } from 'vitest';

import { toTransportViews } from '#synthetic-data/toTransportViews.js';

import {
  ASSESSMENT_FAILED_REASONING,
  CRITERIA,
  embeddedPartialsOf,
  graphFor,
  isHydratableDefinition,
  readItemMap,
  recordsOf,
  requireDefined,
  requireRecord,
} from './syntheticAssessmentContractSupport.js';

type TransportInput = Parameters<typeof toTransportViews>[0];
type Views = {
  assignmentsByKey: Record<string, unknown>;
  classesById: Record<string, unknown>;
};

/**
 * Projects a persistence graph into the class/full transport views.
 *
 * @remarks
 * The projection callable requires its own typed input root, so the known graph
 * fields pass through one explicit seam cast; everything beyond that boundary
 * stays raw and is narrowed with the shared record guards.
 */
function project(graph: Record<string, unknown>): Views {
  const persistence = requireRecord(graph.persistence, 'graph.persistence');
  const input = {
    referenceData: graph.referenceData,
    classes: persistence.classes,
    assignmentDefinitions: persistence.assignmentDefinitions,
    assignments: persistence.assignments,
  } as TransportInput;
  const views = toTransportViews(input);
  return {
    assignmentsByKey: requireRecord(views.assignmentsByKey, 'assignmentsByKey'),
    classesById: requireRecord(views.classesById, 'classesById'),
  };
}

interface RosterIndexOneObservation {
  assignment: Record<string, unknown>;
  studentId: unknown;
  taskId: string;
  assessments: Record<string, unknown>;
}

function rosterIndexOneObservations(graph: Record<string, unknown>): RosterIndexOneObservation[] {
  const persistence = requireRecord(graph.persistence, 'graph.persistence');
  const rosterByClassId = new Map(
    recordsOf(persistence.classes, 'classes').map((classDocument) => [
      classDocument.classId,
      recordsOf(classDocument.students, 'students'),
    ])
  );
  return recordsOf(persistence.assignments, 'assignments').flatMap((assignment) =>
    recordsOf(assignment.submissions, 'submissions')
      .filter(
        (submission) =>
          requireDefined(rosterByClassId.get(assignment.courseId), 'class roster').at(1)?.id ===
          submission.studentId
      )
      .flatMap((submission) =>
        Object.entries(readItemMap(submission.items)).map(([taskId, item]) => ({
          taskId,
          studentId: submission.studentId,
          assessments: requireRecord(item.assessments, `item ${taskId} assessments`),
        }))
      )
      .map((entry) => ({ assignment, ...entry }))
  );
}

describe('synthetic assessment projection', () => {
  it.each([
    ['null', null],
    ['non-default value', 777],
    ['absence', undefined],
  ])('preserves raw assignment marker %s in full and partial projections', (_label, marker) => {
    const graph = graphFor('small');
    const assignment = requireDefined(
      recordsOf(
        requireRecord(graph.persistence, 'graph.persistence').assignments,
        'assignments'
      ).at(0),
      'first assignment'
    );
    if (marker === undefined) delete assignment.assessmentContractVersion;
    else assignment.assessmentContractVersion = marker;

    const views = project(graph);
    const full = requireRecord(
      requireRecord(views.assignmentsByKey, 'assignmentsByKey')[String(assignment.assignmentId)],
      'full view'
    );
    const partial = requireDefined(
      embeddedPartialsOf({ classesById: views.classesById }).find(
        (entry) => entry.assignmentId === assignment.assignmentId
      ),
      'embedded partial assignment'
    );
    if (marker === undefined) {
      expect(Object.hasOwn(full, 'assessmentContractVersion')).toBe(false);
      expect(Object.hasOwn(partial, 'assessmentContractVersion')).toBe(false);
    } else {
      expect(full.assessmentContractVersion).toBe(marker);
      expect(partial.assessmentContractVersion).toBe(marker);
    }
  });

  it('projects roster-index-one ASSESSMENT_FAILED E with the exact catalogue copy in both views', () => {
    const graph = graphFor('small');
    const observations = rosterIndexOneObservations(graph);
    expect(observations.length).toBeGreaterThan(0);

    // The generated variant replaces the old empty result map with all-three
    // explicit E entries carrying the exact catalogue reasoning and cause.
    for (const { taskId, assessments } of observations) {
      expect(Object.keys(assessments).sort()).toEqual([...CRITERIA].sort());
      for (const criterion of CRITERIA) {
        const entry = requireRecord(assessments[criterion], `${taskId}.${criterion}`);
        expect(entry.score).toBe('E');
        expect(entry.reasoning).toBe(ASSESSMENT_FAILED_REASONING);
        expect(entry.error).toMatchObject({ stage: 'assessment', code: 'ASSESSMENT_FAILED' });
      }
    }

    const views = project(graph);
    const persistence = requireRecord(graph.persistence, 'graph.persistence');
    const definitionsByKey = new Map(
      recordsOf(persistence.assignmentDefinitions, 'assignmentDefinitions').map((definition) => [
        definition.definitionKey,
        definition,
      ])
    );
    for (const { assignment, studentId, taskId, assessments } of observations) {
      const partial = requireDefined(
        embeddedPartialsOf({ classesById: views.classesById }).find(
          (entry) => entry.assignmentId === assignment.assignmentId
        ),
        'embedded partial assignment'
      );
      const partialSubmission = requireDefined(
        recordsOf(partial.submissions, 'partial submissions').find(
          (candidate) => candidate.studentId === studentId
        ),
        'partial projected submission'
      );
      const partialItem = requireDefined(
        readItemMap(partialSubmission.items)[taskId],
        `partial item ${taskId}`
      );
      expect(partialItem.assessments).toStrictEqual(assessments);

      const definition = requireDefined(
        definitionsByKey.get(assignment.assignmentDefinitionKey),
        'referenced definition'
      );
      if (isHydratableDefinition(definition)) {
        const fullView = requireRecord(
          requireRecord(views.assignmentsByKey, 'assignmentsByKey')[
            String(assignment.assignmentId)
          ],
          'full assignment view'
        );
        const fullSubmission = requireDefined(
          recordsOf(fullView.submissions, 'full submissions').find(
            (candidate) => candidate.studentId === studentId
          ),
          'full projected submission'
        );
        const fullItem = requireDefined(
          readItemMap(fullSubmission.items)[taskId],
          `full item ${taskId}`
        );
        expect(fullItem.assessments).toStrictEqual(assessments);
      } else {
        expect(
          Object.hasOwn(
            requireRecord(views.assignmentsByKey, 'assignmentsByKey'),
            String(assignment.assignmentId)
          )
        ).toBe(false);
      }
    }
  });
});
