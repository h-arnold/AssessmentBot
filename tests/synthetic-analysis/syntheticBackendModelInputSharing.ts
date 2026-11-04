import { expect } from 'vitest';

import { expectNoSharedMutableNodes } from './syntheticBackendModelInputAssertions.js';
import {
  type AdapterContext,
  type CanonicalSources,
  type Inputs,
  type JsonRecord,
  keySet,
} from './syntheticBackendModelInputContext.js';

/**
 * Mutation-isolation helpers shared by the canonical backend model input suite.
 *
 * @remarks
 * The adapter must return independently owned graphs. These helpers select the
 * populated records, mutate the first result, and assert the second result and
 * the canonical sources stayed untouched.
 */

/**
 * Asserts two assignments with the same definition key share no definition
 * nodes.
 *
 * @param left The first assignment.
 * @param right The second assignment.
 */
export function expectDefinitionsUnshared(left: JsonRecord, right: JsonRecord): void {
  const leftDefinition = left.assignmentDefinition;
  const rightDefinition = right.assignmentDefinition;
  if (leftDefinition.definitionKey === rightDefinition.definitionKey) {
    expectNoSharedMutableNodes(leftDefinition, rightDefinition);
  }
}

/**
 * Asserts the class partial and full inputs share no mutable nodes.
 *
 * @param first The adapter result.
 * @param context The adapter context.
 */
export function expectNoSharedNodesAcrossInputs(first: Inputs, context: AdapterContext): void {
  for (const partial of first.classPartials) {
    const canonical = context.partialByClassId.get(partial.classId);
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
      if (!context.fullAssignmentsById.has(embedded.assignmentId)) {
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
      expectDefinitionsUnshared(fullInputs[left], fullInputs[right]);
    }
  }
}

/**
 * Returns the first submission in `submissions` that carries at least one item.
 *
 * @param submissions The submissions to search.
 * @returns The first populated submission, if any.
 */
export function firstPopulatedSubmission(submissions: JsonRecord[]): JsonRecord | undefined {
  return submissions.find((submission: JsonRecord) => Object.keys(submission.items).length);
}

/**
 * Returns the first assignment whose submissions include a populated one.
 *
 * @param assignments The assignments to search.
 * @returns The first populated assignment, if any.
 */
export function firstPopulatedAssignment(assignments: JsonRecord[]): JsonRecord | undefined {
  return assignments.find((assignment: JsonRecord) =>
    firstPopulatedSubmission(assignment.submissions)
  );
}

/**
 * Selects the populated class and full assignment records used to prove the two
 * adapter results share no mutable nodes.
 *
 * @param first The first adapter result.
 * @param second The second adapter result.
 * @param canonicalAssignments The canonical full assignments.
 * @returns The selected records.
 */
export function selectMutationTargets(
  first: Inputs,
  second: Inputs,
  canonicalAssignments: Record<string, JsonRecord>
) {
  const classId =
    keySet(first.classesById).find(
      (candidate) =>
        first.classesById[candidate].metadata !== null &&
        first.classesById[candidate].metadata !== undefined
    ) ?? keySet(first.classesById)[0];
  const classInput = first.classesById[classId];
  const secondClass = second.classesById[classId];
  const classAssignment = firstPopulatedAssignment(classInput.assignments);
  expect(classAssignment).toBeDefined();
  const secondClassAssignment = secondClass.assignments.find(
    (assignment: JsonRecord) => assignment.assignmentId === classAssignment!.assignmentId
  );
  const assignmentKey =
    keySet(first.assignmentsByKey).find((key) =>
      firstPopulatedSubmission(canonicalAssignments[key].submissions)
    ) ?? keySet(first.assignmentsByKey)[0];
  const fullAssignment = first.assignmentsByKey[assignmentKey];
  const secondFullAssignment = second.assignmentsByKey[assignmentKey];
  const populatedSubmission = firstPopulatedSubmission(fullAssignment.submissions);
  expect(populatedSubmission).toBeDefined();
  const item = Object.values(populatedSubmission!.items)[0] as JsonRecord;
  const secondPopulatedSubmission = firstPopulatedSubmission(secondFullAssignment.submissions);
  expect(secondPopulatedSubmission).toBeDefined();
  const secondItem = Object.values(secondPopulatedSubmission!.items)[0] as JsonRecord;
  return {
    classId,
    classInput,
    secondClass,
    classAssignment,
    secondClassAssignment,
    assignmentKey,
    fullAssignment,
    secondFullAssignment,
    item,
    secondItem,
  } as const;
}

/**
 * Mutates the first adapter result so shared nodes would become visible.
 *
 * @param selection The selected mutation targets.
 */
export function mutateFirstResult(selection: ReturnType<typeof selectMutationTargets>): void {
  const { classInput, classAssignment, fullAssignment, item } = selection;
  classInput.classOwner.email = 'changed@example.test';
  classInput.teachers[0].email = 'changed@example.test';
  classInput.students[0].name = 'Changed';
  classAssignment!.submissions[0].items[
    Object.keys(classAssignment!.submissions[0].items)[0]
  ].artifact.content = 'mutated partial content';
  fullAssignment.assignmentDefinition.tasks[
    Object.keys(fullAssignment.assignmentDefinition.tasks)[0]
  ].taskTitle = 'Changed task';
  item.artifact.content = 'mutated full content';
  if (classInput.metadata?.classAverages) classInput.metadata.classAverages.completeness = 99;
}

/**
 * Asserts the second result and the canonical sources stayed untouched.
 *
 * @param selection The selected mutation targets.
 * @param sources The canonical payloads.
 * @param sourceSnapshots Deep copies taken before the adapter ran.
 * @param before Snapshots taken before the first result was mutated.
 */
export function expectNoMutationLeaked(
  selection: ReturnType<typeof selectMutationTargets>,
  sources: CanonicalSources,
  sourceSnapshots: Record<string, unknown>,
  before: { definitions: unknown; secondDefinitions: unknown; classMetadata: unknown }
): void {
  const {
    classId,
    classInput,
    secondClass,
    classAssignment,
    secondClassAssignment,
    assignmentKey,
    fullAssignment,
    secondFullAssignment,
    secondItem,
  } = selection;
  expect(secondClass.classOwner.email).not.toBe('changed@example.test');
  expect(secondClass.teachers[0].email).not.toBe('changed@example.test');
  expect(secondClass.students[0].name).not.toBe('Changed');
  expect(secondClassAssignment).toBeDefined();
  expect(secondClassAssignment.submissions[0].items).not.toEqual(
    classAssignment!.submissions[0].items
  );
  expect(before.secondDefinitions).toEqual(secondFullAssignment.assignmentDefinition);
  expect(before.definitions).not.toEqual(fullAssignment.assignmentDefinition);
  expect(secondItem.artifact.content).not.toBe('mutated full content');
  expect(sources.partials).toEqual(sourceSnapshots.classPartials);
  expect(sources.classes).toEqual(sourceSnapshots.classesById);
  expect(sources.assignments).toEqual(sourceSnapshots.assignmentsByKey);
  expect(sources.definitions).toEqual(sourceSnapshots.editableDefinitions);
  expect(sources.definitionPartials).toEqual(sourceSnapshots.assignmentDefinitionPartials);
  expect(Object.isFrozen(sources.partials[0])).toBe(true);
  expect(Object.isFrozen(sources.classes[classId].students[0])).toBe(true);
  expect(Object.isFrozen(sources.assignments[assignmentKey].submissions[0].items)).toBe(true);
  expect(Object.isFrozen(sources.definitions[Object.keys(sources.definitions)[0]].tasks)).toBe(
    true
  );
  expect(Object.isFrozen(sources.definitionPartials[0])).toBe(true);
  const hadMetadata = classInput.metadata !== null && classInput.metadata !== undefined;
  if (hadMetadata) {
    expect(classInput.metadata).not.toEqual(before.classMetadata);
  } else {
    expect(classInput.metadata).toBe(before.classMetadata);
  }
  expect(before.classMetadata).toEqual(structuredClone(sources.classes[classId].metadata));
}
