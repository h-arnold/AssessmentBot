import { describe, expect, it } from 'vitest';

import {
  NULL_DOCUMENT_ROSTER_INDEX,
  SOURCE_UNREADABLE_REASONING,
  assertVariantProjection,
  expectAllThreeFailures,
  graphFor,
  isHydratableDefinition,
  readItemMap,
  recordsOf,
  requireDefined,
  requireRecord,
  resolveTaskIds,
} from './syntheticAssessmentContractSupport.js';

describe('canonical null-document submission projection', () => {
  it.each(['small', 'medium'])(
    'represents the roster-index-two null-document variant as base SOURCE_UNREADABLE failures for %s',
    (profile) => {
      const graph = graphFor(profile);
      const persistence = requireRecord(graph.persistence, 'graph.persistence');
      const transport = requireRecord(graph.transport, 'graph.transport');
      const classesById = requireRecord(transport.classesById, 'classesById');
      const assignmentsByKey = requireRecord(transport.assignmentsByKey, 'assignmentsByKey');
      const rosterByClassId = new Map(
        recordsOf(persistence.classes, 'classes').map((classDocument) => [
          classDocument.classId,
          recordsOf(classDocument.students, 'students'),
        ])
      );
      const definitionsByKey = new Map(
        recordsOf(persistence.assignmentDefinitions, 'definitions').map((definition) => [
          definition.definitionKey,
          definition,
        ])
      );
      const eligibleAssignments = recordsOf(persistence.assignments, 'assignments').filter(
        (assignment) =>
          recordsOf(assignment.submissions, 'submissions').length > NULL_DOCUMENT_ROSTER_INDEX
      );
      expect(eligibleAssignments.length).toBeGreaterThan(0);

      for (const assignment of eligibleAssignments) {
        const submissions = recordsOf(assignment.submissions, 'submissions');
        const submission = requireDefined(
          submissions.at(NULL_DOCUMENT_ROSTER_INDEX),
          'variant submission'
        );
        expect(submission.studentId).toBe(
          requireDefined(
            requireDefined(rosterByClassId.get(assignment.courseId), 'class roster').at(
              NULL_DOCUMENT_ROSTER_INDEX
            )?.id,
            'roster student'
          )
        );
        expect(submission.documentId).toBeNull();
        const nullDocumentIndexes: number[] = [];
        submissions.forEach((entry, index) => {
          if (entry.documentId === null) nullDocumentIndexes.push(index);
        });
        expect(nullDocumentIndexes).toEqual([NULL_DOCUMENT_ROSTER_INDEX]);

        const definition = requireDefined(
          definitionsByKey.get(assignment.assignmentDefinitionKey),
          'referenced definition'
        );
        const expectedTaskIds = resolveTaskIds(definition);
        const items = readItemMap(submission.items);
        expect(Object.keys(items).sort()).toEqual([...expectedTaskIds].sort());
        for (const taskId of expectedTaskIds) {
          const item = requireDefined(items[taskId], `variant item ${taskId}`);
          const artefact = requireRecord(item.artifact, 'variant artefact');
          expect(artefact).toMatchObject({
            role: 'submission',
            type: 'base',
            pageId: null,
            documentId: null,
            content: null,
            contentHash: null,
            metadata: {},
          });
          expect(artefact.uid).toEqual(expect.any(String));
          expect(item.feedback).toStrictEqual({});
          expectAllThreeFailures(
            item.assessments,
            `${taskId} assessments`,
            'acquisition',
            'SOURCE_UNREADABLE',
            SOURCE_UNREADABLE_REASONING
          );
        }

        assertVariantProjection(
          requireDefined(
            recordsOf(
              requireRecord(classesById[String(assignment.courseId)], 'class view').assignments,
              'assignments'
            ).find((entry) => entry.assignmentId === assignment.assignmentId),
            'embedded partial assignment'
          ),
          submission,
          expectedTaskIds,
          items
        );
        if (isHydratableDefinition(definition)) {
          assertVariantProjection(
            requireDefined(
              assignmentsByKey[String(assignment.assignmentId)],
              'projected full assignment'
            ),
            submission,
            expectedTaskIds,
            items
          );
        } else {
          expect(Object.hasOwn(assignmentsByKey, String(assignment.assignmentId))).toBe(false);
        }
      }
    }
  );
});
