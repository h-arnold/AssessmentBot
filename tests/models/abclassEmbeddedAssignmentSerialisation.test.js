import { describe, expect, it, vi } from 'vitest';
import { ABClass } from '#backend/Models/ABClass.js';
import { AssignmentDefinition } from '#backend/Models/AssignmentDefinition.js';
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';
import { withTemporaryGlobals } from '#test-helpers/globalMockManager.js';
import { Teacher } from '#backend/Models/Teacher.js';
import {
  expectPartialSubmissionMatchesRedactedSource,
  expectFullSubmissionPreserved,
} from '../synthetic-analysis/backendModelInputAssertions.js';

const clone = (value) => structuredClone(value);
const teacherGlobal = { Teacher: () => Teacher };

function restoredClass(profile, predicate) {
  const input = Object.values(loadBackendModelInputs(profile).classesById).find(predicate);
  return {
    input,
    model: withTemporaryGlobals(teacherGlobal, () => ABClass.fromJSON(clone(input))),
  };
}

describe('ABClass embedded assignment serialization', () => {
  it.each(['small', 'medium'])(
    'serializes and JSON-round-trips populated %s classes',
    (profile) => {
      const classes = Object.values(loadBackendModelInputs(profile).classesById);
      const expectedAssignments = classes.flatMap((row) => row.assignments);
      const expectedSubmissions = expectedAssignments.flatMap((row) => row.submissions);
      const expectedItems = expectedSubmissions.flatMap((row) => Object.values(row.items));
      expect(expectedAssignments.length).toBeGreaterThan(0);
      expect(expectedSubmissions.length).toBeGreaterThan(0);
      expect(expectedItems.length).toBeGreaterThan(0);
      let assignmentCount = 0;
      let submissionCount = 0;
      let itemCount = 0;
      for (const input of classes) {
        expect(input.assignments.length).toBeGreaterThan(0);
        const { model } = restoredClass(profile, (row) => row.classId === input.classId);
        expect(model.assignments).toHaveLength(input.assignments.length);
        assignmentCount += input.assignments.length;
        const output = model.toJSON();
        expect(output.classId).toBe(input.classId);
        expect(output.assignments.map((row) => row.assignmentId)).toEqual(
          input.assignments.map((row) => row.assignmentId)
        );
        for (const [index, assignment] of output.assignments.entries()) {
          const source = input.assignments[index];
          expect(assignment.assignmentDefinition.definitionKey).toBe(
            source.assignmentDefinition.definitionKey
          );
          expect(assignment.assignmentName).toBe(source.assignmentName);
          expect(assignment.createdAt).toBe(source.createdAt);
          expect(assignment.updatedAt).toBe(source.updatedAt);
          expect(assignment.assignmentDefinition.tasks).toEqual(source.assignmentDefinition.tasks);
          submissionCount += assignment.submissions.length;
          itemCount += expectPartialSubmissionMatchesRedactedSource(
            assignment.submissions,
            source.submissions
          );
        }
        const roundTrip = withTemporaryGlobals(teacherGlobal, () =>
          ABClass.fromJSON(JSON.parse(JSON.stringify(output)))
        );
        expect(roundTrip.toJSON()).toStrictEqual(output);
        expect(roundTrip.toPartialJSON().metadata).toStrictEqual(input.metadata);
      }
      expect(assignmentCount).toBeGreaterThan(0);
      expect(submissionCount).toBeGreaterThan(0);
      expect(itemCount).toBeGreaterThan(0);
    }
  );

  it('preserves full keyed assignment data alongside partial embedded assignments', () => {
    const inputs = loadBackendModelInputs('small');
    const source = Object.values(inputs.classesById).find((row) => row.assignments.length > 0);
    const fullSource = Object.values(inputs.assignmentsByKey).find(
      (row) => row.courseId === source.classId
    );
    expect(fullSource).toBeDefined();
    expect(Object.keys(fullSource.assignmentDefinition.tasks).length).toBeGreaterThan(0);
    const model = withTemporaryGlobals(teacherGlobal, () => ABClass.fromJSON(clone(source)));
    const fullAssignment = globalThis.Assignment.fromJSON(clone(fullSource));
    const partialIndex = model.assignments.findIndex(
      (entry) => entry.assignmentId === fullSource.assignmentId
    );
    expect(partialIndex).toBeGreaterThanOrEqual(0);
    const originalIds = model.assignments.map((entry) => entry.assignmentId);
    model.assignments[partialIndex] = fullAssignment;
    const before = model.assignments.map((assignment) => ({
      definition: assignment.assignmentDefinition,
      hydration: assignment._hydrationLevel,
    }));

    const output = model.toJSON();
    const serializedFull = output.assignments.find(
      (row) => row.assignmentId === fullSource.assignmentId
    );
    expect(serializedFull).toStrictEqual(fullAssignment.toJSON());
    expectFullSubmissionPreserved(serializedFull.submissions, fullSource.submissions);
    expect(output.assignments).toHaveLength(source.assignments.length);
    expect(output.assignments.map((row) => row.assignmentId)).toEqual(originalIds);
    expect(new Set(output.assignments.map((row) => row.assignmentId)).size).toBe(
      output.assignments.length
    );
    expect(output.assignments.some((row) => Array.isArray(row.assignmentDefinition.tasks))).toBe(
      true
    );
    expect(output.assignments).toHaveLength(source.assignments.length);
    for (const [index, assignment] of output.assignments.entries()) {
      if (index === partialIndex) continue;
      const sourcePartial = source.assignments[index];
      expect(assignment.assignmentId).toBe(sourcePartial.assignmentId);
      expect(assignment.assignmentDefinition.definitionKey).toBe(
        sourcePartial.assignmentDefinition.definitionKey
      );
      expect(assignment.assignmentDefinition.tasks).toEqual(
        sourcePartial.assignmentDefinition.tasks
      );
      expectPartialSubmissionMatchesRedactedSource(
        assignment.submissions,
        sourcePartial.submissions
      );
    }
    expect(
      model.assignments.map((assignment, index) => ({
        definition: assignment.assignmentDefinition,
        hydration: assignment._hydrationLevel,
      }))
    ).toEqual(before);
  });

  it('keeps standalone partial assignment serializers strict', () => {
    const source = Object.values(loadBackendModelInputs('small').classesById).find(
      (row) => row.assignments.length > 0
    );
    const definition = AssignmentDefinition.fromJSON(
      clone(source.assignments[0].assignmentDefinition)
    );
    expect(Array.isArray(definition.tasks)).toBe(true);
    expect(() => definition.toJSON()).toThrow(/partial AssignmentDefinition/u);
    expect(() => globalThis.Assignment.fromJSON(clone(source.assignments[0])).toJSON()).toThrow(
      /partial AssignmentDefinition/u
    );
  });

  it('propagates a genuine full definition serializer error', () => {
    const inputs = loadBackendModelInputs('small');
    const fullSource = Object.values(inputs.assignmentsByKey)[0];
    const model = new ABClass({ classId: fullSource.courseId });
    const assignment = globalThis.Assignment.fromJSON(clone(fullSource));
    const error = new Error('full serializer failure');
    vi.spyOn(assignment, 'toJSON').mockImplementation(() => {
      throw error;
    });
    model.assignments.push(assignment);
    expect(() => model.toJSON()).toThrow(error);
  });
});
