import { expect } from 'vitest';

import { ABClass } from '#backend/Models/ABClass.js';
import { Teacher } from '#backend/Models/Teacher.js';
import { withTemporaryGlobals } from '#test-helpers/globalMockManager.js';

import {
  expectFullSubmissionPreserved,
  expectPartialSubmissionMatchesRedactedSource,
  expectPartialSubmissionRedacted,
} from './backendModelInputAssertions.js';
import {
  definitionFor,
  type AdapterContext,
  type JsonRecord,
} from './syntheticBackendModelInputContext.js';

/**
 * Assertion helpers shared by the canonical backend model input suite.
 *
 * @remarks
 * Each helper asserts one coherent slice of the adapter contract and returns
 * whatever the next slice needs, so the suite body reads as a sequence of
 * named checks rather than one deeply nested test.
 */

/**
 * Asserts each named field is strictly equal in both records.
 *
 * @param actual The record under test.
 * @param expected The canonical record.
 * @param fields The field names to compare.
 */
export function expectFieldsMatch(
  actual: JsonRecord,
  expected: JsonRecord,
  fields: string[]
): void {
  for (const field of fields) {
    expect(actual[field]).toBe(expected[field]);
  }
}

/**
 * Asserts each named field is deeply equal in both records.
 *
 * @param actual The record under test.
 * @param expected The canonical record.
 * @param fields The field names to compare.
 */
export function expectFieldsDeepEqual(
  actual: JsonRecord,
  expected: JsonRecord,
  fields: string[]
): void {
  for (const field of fields) {
    expect(actual[field]).toEqual(expected[field]);
  }
}

/**
 * Asserts a serialised definition resolves to the canonical definition.
 *
 * @param actual The serialised definition under test.
 * @param expected The canonical definition.
 * @param expectedWeighting The weighting the serialised definition must carry.
 */
export function expectDefinitionResolution(
  actual: JsonRecord,
  expected: JsonRecord,
  expectedWeighting = expected.assignmentWeighting
): void {
  expectFieldsMatch(actual, expected, [
    'definitionKey',
    'primaryTitle',
    'primaryTopic',
    'primaryTopicKey',
    'yearGroupKey',
    'documentType',
    'referenceDocumentId',
    'templateDocumentId',
  ]);
  expect(actual.assignmentWeighting).toBe(expectedWeighting);
  const summaries = (tasks: JsonRecord[] | Record<string, JsonRecord>) =>
    (Array.isArray(tasks) ? tasks : Object.values(tasks)).map((task) => ({
      taskId: task.taskId ?? task.id,
      taskTitle: task.taskTitle,
      taskWeighting: task.taskWeighting,
    }));
  expect(summaries(actual.tasks)).toEqual(summaries(expected.tasks));
}

/**
 * Asserts two value graphs share no mutable nodes.
 *
 * @param left The first value graph.
 * @param right The second value graph.
 */
export function expectNoSharedMutableNodes(left: unknown, right: unknown): void {
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

/**
 * Asserts one embedded class assignment and its redacted submissions match the
 * canonical partial counterpart.
 *
 * @param embedded The embedded assignment from the adapter output.
 * @param sourcePartial The canonical partial assignment.
 */
export function expectEmbeddedAssignmentMatches(
  embedded: JsonRecord,
  sourcePartial: JsonRecord
): void {
  expect(embedded.courseId).toBe(sourcePartial.courseId);
  expect(embedded.assignmentName).toBe(sourcePartial.assignmentName);
  expect(embedded.createdAt).toBe(sourcePartial.createdAt);
  expect(embedded.updatedAt).toBe(sourcePartial.updatedAt);
  expect(embedded.assignmentDefinitionKey).toBe(sourcePartial.assignmentDefinitionKey);
  expect(embedded.submissions).toEqual(expect.any(Array));
  expect(embedded.submissions).toHaveLength(sourcePartial.submissions.length);
  for (const submission of embedded.submissions) {
    const original = sourcePartial.submissions.find(
      (row: JsonRecord) => row.studentId === submission.studentId
    );
    expect(original).toBeDefined();
    expect(submission.documentId).toBe(original.documentId);
    expect(submission.createdAt).toBe(original.createdAt);
    expect(submission.updatedAt).toBe(original.updatedAt);
    expect(submission.items).toEqual(original.items);
    for (const [taskId, item] of Object.entries(submission.items as JsonRecord)) {
      const originalItem = original.items[taskId];
      expect((item as JsonRecord).artifact.content).toBeNull();
      expect((item as JsonRecord).artifact.contentHash).toBe(originalItem.artifact.contentHash);
      expect((item as JsonRecord).assessments).toEqual(originalItem.assessments);
      expect((item as JsonRecord).feedback).toEqual(originalItem.feedback);
    }
  }
}

/**
 * Asserts one restored class assignment round-trips through the partial
 * serializer.
 *
 * @param restored The restored backend assignment.
 * @param source The canonical partial assignment.
 * @param context The adapter context.
 * @returns The redacted item count reported by the shared assertion helper.
 */
export function expectRestoredAssignmentMatches(
  restored: JsonRecord,
  source: JsonRecord,
  context: AdapterContext
): number {
  const definition = definitionFor(source.assignmentDefinitionKey, context.definitions);
  const encoded = restored.toPartialJSON();
  expect(encoded.courseId).toBe(source.courseId);
  expect(encoded.assignmentId).toBe(source.assignmentId);
  expect(encoded.createdAt).toBe(source.createdAt);
  expect(restored.createdAt).toEqual(expect.any(Date));
  expect(restored.createdAt.toISOString()).toBe(source.createdAt);
  const restoredWeighting = definition.assignmentWeighting ?? 1;
  expectDefinitionResolution(encoded.assignmentDefinition, definition, restoredWeighting);
  expect(Array.isArray(definition.tasks)).toBe(true);
  expect(encoded.assignmentDefinition.tasks).toEqual(definition.tasks);
  const fullCounterpart = context.fullAssignmentsById.get(source.assignmentId);
  if (!fullCounterpart) {
    const partialSerialized = restored.toPartialJSON();
    expect(partialSerialized.submissions).toEqual(source.submissions);
    expect(partialSerialized.assessmentContractVersion).toBe(source.assessmentContractVersion);
  }
  return expectPartialSubmissionMatchesRedactedSource(encoded.submissions, source.submissions);
}

/**
 * Asserts one adapter class input's own fields match the canonical views.
 *
 * @param classId The class identifier.
 * @param modelInput The adapter class input.
 * @param context The adapter context.
 * @param canonicalClasses The canonical class views.
 * @returns The canonical class assignments.
 */
export function expectClassFieldsMatch(
  classId: string,
  modelInput: JsonRecord,
  context: AdapterContext,
  canonicalClasses: Record<string, JsonRecord>
): JsonRecord[] {
  const canonical = canonicalClasses[classId];
  const partial = context.partialByClassId.get(classId);
  expect(canonical).toBeDefined();
  expect(partial).toBeDefined();
  expect(modelInput.classId).toBe(classId);
  expect(modelInput.classId).toBe(canonical.classId);
  expectFieldsMatch(modelInput, canonical, [
    'className',
    'cohortKey',
    'courseLength',
    'yearGroupKey',
    'active',
  ]);
  expectFieldsDeepEqual(modelInput, canonical, ['classOwner', 'teachers', 'students']);
  expect(modelInput.metadata).toStrictEqual(canonical.metadata);
  expect(modelInput.metadata).toStrictEqual(partial!.metadata);
  expect(modelInput.teachers).not.toBe(canonical.teachers);
  expect(modelInput.students).not.toBe(canonical.students);
  expect(
    modelInput.teachers.every(
      (teacher: unknown) => Object.getPrototypeOf(teacher) === Object.prototype
    )
  ).toBe(true);

  const expectedAssignments = context.assignmentsByClassId.get(classId) ?? [];
  expect(expectedAssignments.length).toBeGreaterThan(0);
  expect(modelInput.assignments).toHaveLength(expectedAssignments.length);
  const byId = new Map<string, JsonRecord>(
    modelInput.assignments.map((row: JsonRecord) => [row.assignmentId, row])
  );
  for (const source of expectedAssignments) {
    const embedded = byId.get(source.assignmentId);
    const sourcePartial = context.partialAssignmentsById.get(source.assignmentId);
    expect(embedded).toBeDefined();
    expect(sourcePartial).toBeDefined();
    expectEmbeddedAssignmentMatches(embedded!, sourcePartial!);
  }
  return expectedAssignments;
}

/**
 * Asserts the class restored from one adapter input matches the canonical views.
 *
 * @param classId The class identifier.
 * @param modelInput The adapter class input.
 * @param expectedAssignments The canonical class assignments.
 * @param context The adapter context.
 * @param canonicalClasses The canonical class views.
 * @returns The restored class item count.
 */
export function expectRestoredClassMatches(
  classId: string,
  modelInput: JsonRecord,
  expectedAssignments: JsonRecord[],
  context: AdapterContext,
  canonicalClasses: Record<string, JsonRecord>
): number {
  const canonical = canonicalClasses[classId];
  const restoredClass = withTemporaryGlobals({ Teacher: () => Teacher }, () =>
    ABClass.fromJSON(modelInput)
  );
  expect(restoredClass.classId).toBe(classId);
  expectFieldsMatch(restoredClass, canonical, [
    'className',
    'cohortKey',
    'courseLength',
    'yearGroupKey',
    'active',
  ]);
  if (canonical.classOwner === null) {
    expect(restoredClass.classOwner).toBeNull();
  } else {
    expect(restoredClass.classOwner).toBeInstanceOf(Teacher);
    expect(restoredClass.classOwner.toJSON()).toEqual(canonical.classOwner);
    context.found.restoredClassOwner = true;
  }
  expect(restoredClass.teachers).toEqual(canonical.teachers);
  expect(restoredClass.students).toEqual(canonical.students);
  expect(restoredClass.assignments).toHaveLength(expectedAssignments.length);
  let restoredClassItemCount = 0;
  for (const restored of restoredClass.assignments) {
    const source = expectedAssignments.find((row) => row.assignmentId === restored.assignmentId);
    expect(source).toBeDefined();
    restoredClassItemCount += expectRestoredAssignmentMatches(restored, source!, context);
  }
  return restoredClassItemCount;
}

/**
 * Asserts one full assignment input's fields match the canonical assignment.
 *
 * @param input The adapter full assignment input.
 * @param canonical The canonical full assignment.
 * @param canonicalDefinitions The canonical definition documents.
 * @param context The adapter context.
 * @returns The resolved definition.
 */
export function expectFullAssignmentFieldsMatch(
  input: JsonRecord,
  canonical: JsonRecord,
  canonicalDefinitions: Record<string, JsonRecord>,
  context: AdapterContext
): JsonRecord {
  const definition = definitionFor(
    canonical.assignmentDefinition.definitionKey,
    canonicalDefinitions
  );
  expect(canonical).toBeDefined();
  expect(input.assignmentId).toBe(canonical.assignmentId);
  expectFieldsMatch(input, canonical, ['courseId', 'createdAt', 'updatedAt', 'assignmentName']);
  expect(input.assignmentDefinition.definitionKey).toBe(definition.definitionKey);
  expectDefinitionResolution(input.assignmentDefinition, definition);
  expect(Object.keys(definition.tasks).length).toBeGreaterThan(0);
  expect(input.tasks).toEqual(canonical.tasks);
  expect(input.submissions).toEqual(canonical.submissions);
  for (const submission of input.submissions) {
    expect(Object.keys(submission.items).length).toBeGreaterThan(0);
    context.found.populatedFullSubmission = true;
    for (const item of Object.values(submission.items) as JsonRecord[]) {
      const acquisitionError = Object.values(item.assessments as JsonRecord).some(
        (assessment) => assessment.score === 'E' && assessment.error?.stage === 'acquisition'
      );
      if (acquisitionError) {
        expect(item.artifact.content).toBeNull();
        expect(item.artifact.contentHash).toBeNull();
      } else {
        expect(
          typeof item.artifact.content === 'string' || Array.isArray(item.artifact.content)
        ).toBe(true);
        expect(item.artifact.contentHash).toEqual(expect.any(String));
      }
      expect(item.assessments).toEqual(expect.any(Object));
      expect(item.feedback).toEqual(expect.any(Object));
    }
  }
  return definition;
}

/**
 * Asserts one full assignment input round-trips through both serialisers.
 *
 * @param input The adapter full assignment input.
 * @param canonical The canonical full assignment.
 * @param definition The resolved definition.
 */
export function expectFullAssignmentRoundTrip(
  input: JsonRecord,
  canonical: JsonRecord,
  definition: JsonRecord
): void {
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
  if (Object.hasOwn(input, 'assessmentContractVersion')) {
    expectPartialSubmissionRedacted(partial.submissions, canonical.submissions);
  } else {
    // Legacy persistence is opaque even through the partial serializer; read
    // redaction belongs to the detached read projection, not ordinary saves.
    expect(partial.submissions).toEqual(canonical.submissions);
  }
}
