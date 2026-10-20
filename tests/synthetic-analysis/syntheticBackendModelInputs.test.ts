import { describe, expect, it } from 'vitest';

import { ABClass } from '#backend/Models/ABClass.js';
import { Teacher } from '#backend/Models/Teacher.js';
import { withTemporaryGlobals } from '#test-helpers/globalMockManager.js';
import {
  expectFullSubmissionPreserved,
  expectPartialSubmissionMatchesRedactedSource,
  expectPartialSubmissionRedacted,
} from './backendModelInputAssertions.js';

import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';
import { loadSyntheticAnalysisProfile } from '#synthetic-data/loadSyntheticAnalysisProfile.js';

type JsonRecord = Record<string, any>;
type Inputs = {
  classPartials: JsonRecord[];
  classesById: Record<string, JsonRecord>;
  assignmentsByKey: Record<string, JsonRecord>;
};

function keySet(value: Record<string, unknown>): string[] {
  return Object.keys(value).sort();
}

function definitionFor(definitionKey: string, definitions: Record<string, JsonRecord>): JsonRecord {
  expect(typeof definitionKey).toBe('string');
  expect(definitions[definitionKey]).toBeDefined();
  return definitions[definitionKey];
}

function expectDefinitionResolution(
  actual: JsonRecord,
  expected: JsonRecord,
  expectedWeighting = expected.assignmentWeighting
): void {
  expect(actual.definitionKey).toBe(expected.definitionKey);
  expect(actual.primaryTitle).toBe(expected.primaryTitle);
  expect(actual.primaryTopic).toBe(expected.primaryTopic);
  expect(actual.primaryTopicKey).toBe(expected.primaryTopicKey);
  expect(actual.yearGroupKey).toBe(expected.yearGroupKey);
  expect(actual.documentType).toBe(expected.documentType);
  expect(actual.referenceDocumentId).toBe(expected.referenceDocumentId);
  expect(actual.templateDocumentId).toBe(expected.templateDocumentId);
  expect(actual.assignmentWeighting).toBe(expectedWeighting);
  const summaries = (tasks: JsonRecord[] | Record<string, JsonRecord>) =>
    (Array.isArray(tasks) ? tasks : Object.values(tasks)).map((task) => ({
      taskId: task.taskId ?? task.id,
      taskTitle: task.taskTitle,
      taskWeighting: task.taskWeighting,
    }));
  expect(summaries(actual.tasks)).toEqual(summaries(expected.tasks));
}

function expectNoSharedMutableNodes(left: unknown, right: unknown): void {
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') {
    return;
  }
  expect(left).not.toBe(right);
  for (const key of Object.keys(left)) {
    if (Object.hasOwn(right, key)) {
      expectNoSharedMutableNodes((left as JsonRecord)[key], (right as JsonRecord)[key]);
    }
  }
}

describe('canonical backend model inputs', () => {
  it.each(['small', 'medium'])(
    'adapts %s into complete, independently owned backend model inputs',
    async (profile) => {
      const load = loadBackendModelInputs;

      const canonicalPartials = loadSyntheticAnalysisProfile(
        profile,
        'classPartials'
      ) as JsonRecord[];
      const canonicalClasses = loadSyntheticAnalysisProfile(profile, 'classesById') as Record<
        string,
        JsonRecord
      >;
      const canonicalAssignments = loadSyntheticAnalysisProfile(
        profile,
        'assignmentsByKey'
      ) as Record<string, JsonRecord>;
      const canonicalDefinitions = loadSyntheticAnalysisProfile(
        profile,
        'editableDefinitions'
      ) as Record<string, JsonRecord>;
      const canonicalDefinitionPartials = loadSyntheticAnalysisProfile(
        profile,
        'assignmentDefinitionPartials'
      ) as JsonRecord[];
      const definitions = Object.fromEntries([
        ...Object.entries(canonicalDefinitions),
        ...canonicalDefinitionPartials.map((definition) => [definition.definitionKey, definition]),
      ]);
      const sourceSnapshots = structuredClone({
        classPartials: canonicalPartials,
        classesById: canonicalClasses,
        assignmentsByKey: canonicalAssignments,
        editableDefinitions: canonicalDefinitions,
        assignmentDefinitionPartials: canonicalDefinitionPartials,
      });
      const first = load(profile) as Inputs;
      const second = load(profile) as Inputs;

      expect(first).toEqual({
        classPartials: expect.any(Array),
        classesById: expect.any(Object),
        assignmentsByKey: expect.any(Object),
      });
      expect(first.classPartials).not.toBe(canonicalPartials);
      expect(first.classesById).not.toBe(canonicalClasses);
      expect(first.assignmentsByKey).not.toBe(canonicalAssignments);
      expect(keySet(first.classesById)).toEqual(keySet(canonicalClasses));
      expect(keySet(first.assignmentsByKey)).toEqual(keySet(canonicalAssignments));
      expect(first.classPartials.map((row) => row.classId).sort()).toEqual(
        canonicalPartials.map((row) => row.classId).sort()
      );

      const partialByClassId = new Map(canonicalPartials.map((row) => [row.classId, row]));
      const assignmentsByClassId = new Map<string, JsonRecord[]>();
      const partialAssignmentsById = new Map<string, JsonRecord>();
      const fullAssignmentsById = new Map(
        Object.values(canonicalAssignments).map((assignment) => [
          assignment.assignmentId,
          assignment,
        ])
      );
      let foundPopulatedFullSubmission = false;
      let foundRestoredClassOwner = false;
      for (const classView of Object.values(canonicalClasses)) {
        for (const assignment of classView.assignments) {
          partialAssignmentsById.set(assignment.assignmentId, assignment);
        }
      }
      for (const [classId, classView] of Object.entries(canonicalClasses)) {
        assignmentsByClassId.set(classId, classView.assignments);
      }

      for (const [classId, modelInput] of Object.entries(first.classesById)) {
        let restoredClassItemCount = 0;
        const canonical = canonicalClasses[classId];
        const partial = partialByClassId.get(classId);
        expect(canonical).toBeDefined();
        expect(partial).toBeDefined();
        expect(modelInput.classId).toBe(classId);
        expect(modelInput.classId).toBe(canonical.classId);
        expect(modelInput.className).toBe(canonical.className);
        expect(modelInput.classOwner).toEqual(canonical.classOwner);
        expect(modelInput.teachers).toEqual(canonical.teachers);
        expect(modelInput.students).toEqual(canonical.students);
        expect(modelInput.cohortKey).toBe(canonical.cohortKey);
        expect(modelInput.courseLength).toBe(canonical.courseLength);
        expect(modelInput.yearGroupKey).toBe(canonical.yearGroupKey);
        expect(modelInput.active).toBe(canonical.active);
        expect(modelInput.metadata).toStrictEqual(canonical.metadata);
        expect(modelInput.metadata).toStrictEqual(partial!.metadata);
        expect(modelInput.teachers).not.toBe(canonical.teachers);
        expect(modelInput.students).not.toBe(canonical.students);
        expect(
          modelInput.teachers.every(
            (teacher: unknown) => Object.getPrototypeOf(teacher) === Object.prototype
          )
        ).toBe(true);

        const expectedAssignments = assignmentsByClassId.get(classId) ?? [];
        expect(expectedAssignments.length).toBeGreaterThan(0);
        expect(modelInput.assignments).toHaveLength(expectedAssignments.length);
        const byId = new Map<string, JsonRecord>(
          modelInput.assignments.map((row: JsonRecord) => [row.assignmentId, row])
        );
        for (const source of expectedAssignments) {
          const embedded = byId.get(source.assignmentId);
          const sourcePartial = partialAssignmentsById.get(source.assignmentId);
          expect(embedded).toBeDefined();
          expect(sourcePartial).toBeDefined();
          expect(embedded!.courseId).toBe(source.courseId);
          expect(embedded!.assignmentName).toBe(source.assignmentName);
          expect(embedded!.createdAt).toBe(source.createdAt);
          expect(embedded!.updatedAt).toBe(source.updatedAt);
          expect(embedded!.assignmentDefinitionKey).toBe(sourcePartial!.assignmentDefinitionKey);
          expect(embedded!.submissions).toEqual(expect.any(Array));
          expect(embedded!.submissions).toHaveLength(sourcePartial!.submissions.length);
          for (const submission of embedded!.submissions) {
            const original = sourcePartial!.submissions.find(
              (row: JsonRecord) => row.studentId === submission.studentId
            );
            expect(original).toBeDefined();
            expect(submission.documentId).toBe(original!.documentId);
            expect(submission.createdAt).toBe(original!.createdAt);
            expect(submission.updatedAt).toBe(original!.updatedAt);
            expect(submission.items).toEqual(original!.items);
            for (const [taskId, item] of Object.entries(submission.items as JsonRecord)) {
              const originalItem = original!.items[taskId];
              expect((item as JsonRecord).artifact.content).toBeNull();
              expect((item as JsonRecord).artifact.contentHash).toBe(
                originalItem.artifact.contentHash
              );
              expect((item as JsonRecord).assessments).toEqual(originalItem.assessments);
              expect((item as JsonRecord).feedback).toEqual(originalItem.feedback);
            }
          }
        }

        const restoredClass = withTemporaryGlobals({ Teacher: () => Teacher }, () =>
          ABClass.fromJSON(modelInput)
        );
        expect(restoredClass.classId).toBe(classId);
        expect(restoredClass.className).toBe(canonical.className);
        if (canonical.classOwner === null) {
          expect(restoredClass.classOwner).toBeNull();
        } else {
          expect(restoredClass.classOwner).toBeInstanceOf(Teacher);
          expect(restoredClass.classOwner.toJSON()).toEqual(canonical.classOwner);
          foundRestoredClassOwner = true;
        }
        expect(restoredClass.teachers).toEqual(canonical.teachers);
        expect(restoredClass.students).toEqual(canonical.students);
        expect(restoredClass.active).toBe(canonical.active);
        expect(restoredClass.cohortKey).toBe(canonical.cohortKey);
        expect(restoredClass.courseLength).toBe(canonical.courseLength);
        expect(restoredClass.yearGroupKey).toBe(canonical.yearGroupKey);
        expect(restoredClass.assignments).toHaveLength(expectedAssignments.length);
        for (const restored of restoredClass.assignments) {
          const source = expectedAssignments.find(
            (row) => row.assignmentId === restored.assignmentId
          );
          expect(source).toBeDefined();
          const definition = definitionFor(source!.assignmentDefinitionKey, definitions);
          const encoded = restored.toPartialJSON();
          expect(encoded.courseId).toBe(source!.courseId);
          expect(encoded.assignmentId).toBe(source!.assignmentId);
          expect(encoded.createdAt).toBe(source!.createdAt);
          expect(restored.createdAt).toEqual(expect.any(Date));
          expect(restored.createdAt.toISOString()).toBe(source!.createdAt);
          const restoredWeighting =
            definition.assignmentWeighting === null || definition.assignmentWeighting === undefined
              ? 1
              : definition.assignmentWeighting;
          expectDefinitionResolution(encoded.assignmentDefinition, definition, restoredWeighting);
          expect(Array.isArray(definition.tasks)).toBe(true);
          expect(encoded.assignmentDefinition.tasks).toEqual(definition.tasks);
          const fullCounterpart = fullAssignmentsById.get(source!.assignmentId);
          if (!fullCounterpart) {
            expect(() => restored.toJSON()).toThrow(/partial AssignmentDefinition/u);
          }
          restoredClassItemCount += expectPartialSubmissionMatchesRedactedSource(
            encoded.submissions,
            source!.submissions
          );
        }
        expect(restoredClassItemCount).toBeGreaterThan(0);
      }

      for (const [key, input] of Object.entries(first.assignmentsByKey)) {
        const canonical = canonicalAssignments[key];
        const definition = definitionFor(
          canonical.assignmentDefinition.definitionKey,
          canonicalDefinitions
        );
        expect(canonical).toBeDefined();
        expect(input.assignmentId).toBe(canonical.assignmentId);
        expect(input.courseId).toBe(canonical.courseId);
        expect(input.createdAt).toBe(canonical.createdAt);
        expect(input.updatedAt).toBe(canonical.updatedAt);
        expect(input.assignmentName).toBe(canonical.assignmentName);
        expect(input.assignmentDefinition.definitionKey).toBe(definition.definitionKey);
        expectDefinitionResolution(input.assignmentDefinition, definition);
        expect(Object.keys(definition.tasks).length).toBeGreaterThan(0);
        expect(input.tasks).toEqual(canonical.tasks);
        expect(input.submissions).toEqual(canonical.submissions);
        for (const submission of input.submissions) {
          expect(Object.keys(submission.items).length).toBeGreaterThan(0);
          foundPopulatedFullSubmission = true;
          for (const item of Object.values(submission.items) as JsonRecord[]) {
            expect(item.artifact.content).toEqual(expect.any(String));
            expect(item.artifact.contentHash).toEqual(expect.any(String));
            expect(item.assessments).toEqual(expect.any(Object));
            expect(item.feedback).toEqual(expect.any(Object));
          }
        }

        const restored = (globalThis as any).Assignment.fromJSON(input);
        const roundTrip = restored.toJSON();
        expect(roundTrip.assignmentId).toBe(input.assignmentId);
        expect(roundTrip.courseId).toBe(input.courseId);
        expect(restored.createdAt).toEqual(expect.any(Date));
        expect(restored.createdAt.toISOString()).toBe(canonical.createdAt);
        expect(roundTrip.createdAt).toBe(canonical.createdAt);
        expect(roundTrip.updatedAt).toBe(canonical.updatedAt);
        expectDefinitionResolution(roundTrip.assignmentDefinition, definition);
        expect(roundTrip.tasks).toEqual(canonical.tasks);
        expectFullSubmissionPreserved(roundTrip.submissions, canonical.submissions);

        const partial = restored.toPartialJSON();
        expect(partial.assignmentId).toBe(input.assignmentId);
        expect(partial.createdAt).toBe(canonical.createdAt);
        expect(partial.assignmentDefinition.definitionKey).toBe(definition.definitionKey);
        expect(partial.assignmentDefinition.tasks).toEqual(
          (Object.values(definition.tasks) as JsonRecord[]).map((task) => ({
            taskId: task.taskId ?? task.id,
            taskWeighting: task.taskWeighting,
            taskTitle: task.taskTitle,
          }))
        );
        expectPartialSubmissionRedacted(partial.submissions, canonical.submissions);
      }
      expect(foundPopulatedFullSubmission).toBe(true);
      expect(foundRestoredClassOwner).toBe(true);

      for (const partial of first.classPartials) {
        const canonical = partialByClassId.get(partial.classId);
        expect(canonical).toBeDefined();
        expect(partial).toEqual(canonical);
        expect(partial.teachers).not.toBe(canonical!.teachers);
        expect(partial.metadata).toStrictEqual(canonical!.metadata);
        const fullInput = first.classesById[partial.classId];
        expectNoSharedMutableNodes(partial.classOwner, fullInput.classOwner);
        expectNoSharedMutableNodes(partial.teachers, fullInput.teachers);
        expectNoSharedMutableNodes(partial.metadata, fullInput.metadata);
      }

      for (const classInput of Object.values(first.classesById)) {
        for (const embedded of classInput.assignments) {
          const full = Object.values(first.assignmentsByKey).find(
            (assignment) => assignment.assignmentId === embedded.assignmentId
          );
          if (!fullAssignmentsById.has(embedded.assignmentId)) {
            expect(full).toBeUndefined();
            continue;
          }
          expect(full).toBeDefined();
          expectNoSharedMutableNodes(embedded, full);
          expectNoSharedMutableNodes(embedded.submissions, full!.submissions);
        }
      }
      const fullInputs = Object.values(first.assignmentsByKey);
      for (let left = 0; left < fullInputs.length; left += 1) {
        for (let right = left + 1; right < fullInputs.length; right += 1) {
          const leftDefinition = fullInputs[left].assignmentDefinition;
          const rightDefinition = fullInputs[right].assignmentDefinition;
          if (leftDefinition.definitionKey === rightDefinition.definitionKey) {
            expectNoSharedMutableNodes(leftDefinition, rightDefinition);
          }
        }
      }

      expectNoSharedMutableNodes(first, second);
      const classId =
        keySet(first.classesById).find(
          (candidate) =>
            first.classesById[candidate].metadata !== null &&
            first.classesById[candidate].metadata !== undefined
        ) ?? keySet(first.classesById)[0];
      const classInput = first.classesById[classId];
      const secondClass = second.classesById[classId];
      const classAssignment = classInput.assignments.find((assignment: JsonRecord) =>
        assignment.submissions.some(
          (submission: JsonRecord) => Object.keys(submission.items).length
        )
      );
      expect(classAssignment).toBeDefined();
      const secondClassAssignment = secondClass.assignments.find(
        (assignment: JsonRecord) => assignment.assignmentId === classAssignment.assignmentId
      );
      const assignmentKey =
        keySet(first.assignmentsByKey).find((key) =>
          canonicalAssignments[key].submissions.some(
            (submission: JsonRecord) => Object.keys(submission.items).length
          )
        ) ?? keySet(first.assignmentsByKey)[0];
      const fullAssignment = first.assignmentsByKey[assignmentKey];
      const secondFullAssignment = second.assignmentsByKey[assignmentKey];
      const populatedSubmission = fullAssignment.submissions.find(
        (submission: JsonRecord) => Object.keys(submission.items).length
      );
      expect(populatedSubmission).toBeDefined();
      const item = Object.values(populatedSubmission.items)[0] as JsonRecord;
      const secondPopulatedSubmission = secondFullAssignment.submissions.find(
        (submission: JsonRecord) => Object.keys(submission.items).length
      );
      expect(secondPopulatedSubmission).toBeDefined();
      const secondItem = Object.values(secondPopulatedSubmission.items)[0] as JsonRecord;
      const definitionsBefore = structuredClone(fullAssignment.assignmentDefinition);
      const secondDefinitionsBefore = structuredClone(secondFullAssignment.assignmentDefinition);
      const classMetadataBefore = structuredClone(classInput.metadata);
      const sourceMetadata = structuredClone(canonicalClasses[classId].metadata);
      const hadMetadata = classInput.metadata !== null && classInput.metadata !== undefined;

      classInput.classOwner.email = 'changed@example.test';
      classInput.teachers[0].email = 'changed@example.test';
      classInput.students[0].name = 'Changed';
      classAssignment.submissions[0].items[
        Object.keys(classAssignment.submissions[0].items)[0]
      ].artifact.content = 'mutated partial content';
      fullAssignment.assignmentDefinition.tasks[
        Object.keys(fullAssignment.assignmentDefinition.tasks)[0]
      ].taskTitle = 'Changed task';
      item.artifact.content = 'mutated full content';
      if (classInput.metadata?.classAverages) classInput.metadata.classAverages.completeness = 99;

      expect(secondClass.classOwner.email).not.toBe('changed@example.test');
      expect(secondClass.teachers[0].email).not.toBe('changed@example.test');
      expect(secondClass.students[0].name).not.toBe('Changed');
      expect(secondClassAssignment).toBeDefined();
      expect(secondClassAssignment.submissions[0].items).not.toEqual(
        classAssignment.submissions[0].items
      );
      expect(secondDefinitionsBefore).toEqual(secondFullAssignment.assignmentDefinition);
      expect(definitionsBefore).not.toEqual(fullAssignment.assignmentDefinition);
      expect(secondItem.artifact.content).not.toBe('mutated full content');
      expect(canonicalPartials).toEqual(sourceSnapshots.classPartials);
      expect(canonicalClasses).toEqual(sourceSnapshots.classesById);
      expect(canonicalAssignments).toEqual(sourceSnapshots.assignmentsByKey);
      expect(canonicalDefinitions).toEqual(sourceSnapshots.editableDefinitions);
      expect(canonicalDefinitionPartials).toEqual(sourceSnapshots.assignmentDefinitionPartials);
      expect(Object.isFrozen(canonicalPartials[0])).toBe(true);
      expect(Object.isFrozen(canonicalClasses[classId].students[0])).toBe(true);
      expect(Object.isFrozen(canonicalAssignments[assignmentKey].submissions[0].items)).toBe(true);
      expect(
        Object.isFrozen(canonicalDefinitions[Object.keys(canonicalDefinitions)[0]].tasks)
      ).toBe(true);
      expect(Object.isFrozen(canonicalDefinitionPartials[0])).toBe(true);
      if (hadMetadata) {
        expect(classInput.metadata).not.toEqual(classMetadataBefore);
      } else {
        expect(classInput.metadata).toBe(classMetadataBefore);
      }
      expect(classMetadataBefore).toEqual(sourceMetadata);
    }
  );
});
