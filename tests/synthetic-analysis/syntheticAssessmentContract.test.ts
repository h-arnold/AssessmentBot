import { describe, expect, it } from 'vitest';

import { validateSyntheticAnalysisGraph } from '#synthetic-data/validateSyntheticAnalysisGraph.js';

import {
  ARTEFACT_TYPES,
  CRITERIA,
  NULL_DOCUMENT_ROSTER_INDEX,
  artefactsOfTask,
  embeddedPartialsOf,
  expectUsableArtefactBody,
  graphFor,
  isRecord,
  itemsOfAssignments,
  readItemMap,
  recordsOf,
  requireDefined,
  requireRecord,
} from './syntheticAssessmentContractSupport.js';

describe('canonical synthetic assessment contract', () => {
  it.each(['small', 'medium'])(
    'emits the version marker, complete criteria and usable artefacts for %s',
    (profile) => {
      const graph = graphFor(profile);
      const persistence = requireRecord(graph.persistence, 'graph.persistence');
      const transport = requireRecord(graph.transport, 'graph.transport');
      const definitions = recordsOf(persistence.assignmentDefinitions, 'definitions');
      const assignments = recordsOf(persistence.assignments, 'assignments');
      const representedAssignments = [
        ...assignments,
        ...embeddedPartialsOf(transport),
        ...Object.entries(requireRecord(transport.assignmentsByKey, 'assignmentsByKey')).map(
          ([key, view]) => requireRecord(view, `full assignment view ${key}`)
        ),
      ];
      const representedItems = itemsOfAssignments(representedAssignments);
      const sourcesById = new Map(
        assignments.map((assignment) => [assignment.assignmentId, assignment])
      );
      const definitionsByKey = new Map(
        definitions.map((definition) => [definition.definitionKey, definition])
      );

      // The version marker is stamped once on persistence and copied through both wire views.
      for (const assignment of representedAssignments) {
        expect(assignment.assessmentContractVersion).toBe(1);
      }
      for (const item of representedItems) {
        const assessments = requireRecord(item.assessments, 'assessments');
        expect(Object.keys(assessments).sort()).toEqual([...CRITERIA].sort());
        expect(assessments).not.toHaveProperty('formulaComparison');
      }
      const persistedItems = itemsOfAssignments(assignments);
      const errorItems = persistedItems.filter((item) =>
        CRITERIA.some(
          (criterion) =>
            requireRecord(requireRecord(item.assessments, 'assessments')[criterion], criterion)
              .score === 'E'
        )
      );
      expect(errorItems.length).toBeGreaterThan(0);
      for (const item of errorItems) {
        const assessments = requireRecord(item.assessments, 'assessments');
        for (const criterion of CRITERIA) {
          const entry = requireRecord(assessments[criterion], criterion);
          expect(entry.score).toBe('E');
          expect(typeof entry.reasoning === 'string' && entry.reasoning.trim().length > 0).toBe(
            true
          );
          expect(isRecord(entry.error)).toBe(true);
        }
      }

      // Full definitions generate usable IMAGE and SPREADSHEET bodies beside TEXT in their raw shapes.
      const definitionArtefacts = definitions
        .filter((definition) => !Array.isArray(definition.tasks))
        .flatMap((definition) =>
          Object.values(requireRecord(definition.tasks, 'tasks')).flatMap((task) =>
            artefactsOfTask(task)
          )
        );
      expect(new Set(definitionArtefacts.map((artefact) => artefact.type))).toEqual(
        new Set(ARTEFACT_TYPES)
      );
      definitionArtefacts.forEach((artefact) =>
        expectUsableArtefactBody(artefact, 'definition artefact')
      );
      const submissionItems = itemsOfAssignments(assignments);
      expect(
        new Set(submissionItems.map((item) => requireRecord(item.artifact, 'artefact').type))
      ).toEqual(new Set([...ARTEFACT_TYPES, 'base']));
      for (const item of submissionItems) {
        const artefact = requireRecord(item.artifact, 'artefact');
        if (artefact.type !== 'base') expectUsableArtefactBody(artefact, 'submission artefact');
      }

      // Full projections retain the persistence source exactly, scoped by assignment/student/task.
      const assignmentsByKey = requireRecord(transport.assignmentsByKey, 'assignmentsByKey');
      for (const [assignmentKey, fullView] of Object.entries(assignmentsByKey)) {
        const source = requireDefined(sourcesById.get(assignmentKey), 'persistence assignment');
        const view = requireRecord(fullView, 'full view');
        expect(view.assignmentDefinition).toStrictEqual(
          requireDefined(
            definitionsByKey.get(source.assignmentDefinitionKey),
            'persistence definition'
          )
        );
        for (const projectedSubmission of recordsOf(view.submissions, 'projected submissions')) {
          const sourceSubmission = requireDefined(
            recordsOf(source.submissions, 'submissions').find(
              (candidate) => candidate.studentId === projectedSubmission.studentId
            ),
            'persistence submission'
          );
          expect(projectedSubmission).toStrictEqual(sourceSubmission);
        }
      }

      // Class-partial projections redact bodies/hash only; an E entry keeps its explanation.
      for (const item of itemsOfAssignments(embeddedPartialsOf(transport))) {
        const artefact = requireRecord(item.artifact, 'artefact');
        expect(artefact.content).toBeNull();
        expect(artefact.contentHash).toBeNull();
        const assessments = requireRecord(item.assessments, 'assessments');
        for (const criterion of CRITERIA) {
          const entry = requireRecord(assessments[criterion], criterion);
          if (entry.score === 'E') {
            expect(Object.hasOwn(entry, 'reasoning')).toBe(true);
            expect(isRecord(entry.error)).toBe(true);
          } else {
            expect(Object.hasOwn(entry, 'reasoning')).toBe(false);
          }
        }
      }
    }
  );

  it('rejects local null-document/populated-source corruption instead of converting it on read', () => {
    const graph = structuredClone(graphFor('small'));
    const assignment = requireDefined(
      recordsOf(
        requireRecord(graph.persistence, 'graph.persistence').assignments,
        'assignments'
      ).find(
        (entry) => recordsOf(entry.submissions, 'submissions').length > NULL_DOCUMENT_ROSTER_INDEX
      ),
      'assignment with a roster-index-two row'
    );
    const variant = requireDefined(
      recordsOf(assignment.submissions, 'variant submissions').at(NULL_DOCUMENT_ROSTER_INDEX),
      'variant submission'
    );
    const item = requireDefined(Object.values(readItemMap(variant.items)).at(0), 'variant item');
    const artefact = requireRecord(item.artifact, 'corrupted artefact');
    artefact.content = 'corrupt populated source';
    artefact.contentHash = 'corrupt-hash';
    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow();
  });

  it('preserves deterministic linkage and byte-identical generation for fixed seeds', () => {
    const graph = graphFor('small');
    const repeated = graphFor('small');
    expect(JSON.stringify(repeated)).toBe(JSON.stringify(graph));
    for (const assignment of recordsOf(
      requireRecord(graph.persistence, 'graph.persistence').assignments,
      'assignments'
    )) {
      for (const submission of recordsOf(assignment.submissions, 'submissions')) {
        for (const [taskId, item] of Object.entries(readItemMap(submission.items))) {
          const identity = `${String(assignment.assignmentId)}-${String(submission.studentId)}-${taskId}`;
          expect(item.taskId).toBe(taskId);
          expect(item.id).toContain(identity);
          expect(requireRecord(item.artifact, 'artefact').uid).toContain(identity);
        }
      }
    }
  });
});
