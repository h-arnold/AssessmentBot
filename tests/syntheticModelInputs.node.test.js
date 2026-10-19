import { describe, expect, it } from 'vitest';
import { ABClass } from '#backend/Models/ABClass.js';
import { Teacher } from '#backend/Models/Teacher.js';
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';
import { loadSyntheticAnalysisProfile } from '#synthetic-data/loadSyntheticAnalysisProfile.js';
import { withTemporaryGlobals } from '#test-helpers/globalMockManager.js';

describe('Node synthetic-data ESM import path', () => {
  it('loads adapter and profile loader under backend setupGlobals', async () => {
    const source = loadSyntheticAnalysisProfile('small', 'classesById');
    const partials = loadSyntheticAnalysisProfile('small', 'classPartials');
    const adapted = loadBackendModelInputs('small');
    const secondAdaptation = loadBackendModelInputs('small');
    expect(Object.isFrozen(source)).toBe(true);
    expect(Object.keys(adapted.classesById).sort()).toEqual(Object.keys(source).sort());
    expect(adapted.classPartials.map(({ classId }) => classId).sort()).toEqual(
      partials.map(({ classId }) => classId).sort()
    );

    const [classId] = Object.keys(source);
    const canonicalClass = source[classId];
    const modelInput = adapted.classesById[classId];
    expect(modelInput.classOwner).toEqual(canonicalClass.classOwner);
    expect(modelInput.teachers).toEqual(canonicalClass.teachers);
    expect(modelInput.students).toEqual(canonicalClass.students);
    expect(Object.hasOwn(modelInput, 'metadata')).toBe(Object.hasOwn(canonicalClass, 'metadata'));
    if (Object.hasOwn(canonicalClass, 'metadata')) {
      expect(modelInput.metadata).toStrictEqual(canonicalClass.metadata);
    }

    const restored = withTemporaryGlobals({ Teacher: () => Teacher }, () =>
      ABClass.fromJSON(modelInput)
    );
    expect(restored.classId).toBe(classId);
    const partial = restored.toPartialJSON();
    expect(partial.classOwner).toEqual(canonicalClass.classOwner);
    expect(partial.teachers).toEqual(canonicalClass.teachers);
    expect(restored.students).toEqual(canonicalClass.students);
    expect(restored.assignments).toHaveLength(canonicalClass.assignments.length);
    for (const [index, assignment] of restored.assignments.entries()) {
      const canonicalAssignment = canonicalClass.assignments[index];
      expect(assignment.assignmentId).toBe(canonicalAssignment.assignmentId);
      expect(assignment.assignmentDefinition.definitionKey).toBe(
        canonicalAssignment.assignmentDefinitionKey
      );
    }

    modelInput.teachers[0].email = 'changed@example.test';
    modelInput.students[0].name = 'Changed';
    expect(secondAdaptation.classesById[classId].teachers[0].email).not.toBe(
      'changed@example.test'
    );
    expect(secondAdaptation.classesById[classId].students[0].name).not.toBe('Changed');
    expect(canonicalClass.teachers[0].email).not.toBe('changed@example.test');
    expect(canonicalClass.students[0].name).not.toBe('Changed');
  });
});
