import { describe, expect, it } from 'vitest';
import { ABClass } from '#backend/Models/ABClass.js';
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';
import { withTemporaryGlobals } from '#test-helpers/globalMockManager.js';
import { Teacher } from '#backend/Models/Teacher.js';
import { expectPartialSubmissionMatchesRedactedSource } from '../synthetic-analysis/backendModelInputAssertions.js';

const clone = (value) => structuredClone(value);
const canonicalClasses = (profile) => loadBackendModelInputs(profile).classesById;
const teacherGlobal = { Teacher: () => Teacher };

function expectMetadataNodesDistinct(left, right) {
  expect(left).not.toBe(right);
  expect(left.classAverages).not.toBe(right.classAverages);
  expect(left.recentAssignments).not.toBe(right.recentAssignments);
  for (let index = 0; index < left.recentAssignments.length; index += 1) {
    expect(left.recentAssignments[index]).not.toBe(right.recentAssignments[index]);
    expect(left.recentAssignments[index].averages).not.toBe(
      right.recentAssignments[index].averages
    );
  }
}

function invalidMetadata(canonicalMetadata) {
  const invalid = clone(canonicalMetadata);
  invalid.classAverages.accuracy = 6;
  return invalid;
}

describe('ABClass metadata construction and serialization boundaries', () => {
  it.each(['small', 'medium'])(
    'accepts canonical %s variants through construction, restoration, and JSON round trips',
    (profile) => {
      for (const input of Object.values(canonicalClasses(profile))) {
        const constructed = new ABClass({
          classId: input.classId,
          metadata: clone(input.metadata),
        });
        expect(constructed.toJSON().metadata).toStrictEqual(input.metadata);
        expect(constructed.toPartialJSON().metadata).toStrictEqual(input.metadata);

        const restored = withTemporaryGlobals(teacherGlobal, () => ABClass.fromJSON(clone(input)));
        expect(Object.hasOwn(restored, 'metadata')).toBe(true);
        expect(restored.metadata).toStrictEqual(input.metadata);
        expect(restored.toPartialJSON().metadata).toStrictEqual(input.metadata);

        // Isolate metadata full serialisation: all class-embedded definitions are
        // partial array-shaped summaries; full population is tested separately.
        const fullModel = withTemporaryGlobals(teacherGlobal, () =>
          ABClass.fromJSON({ ...clone(input), assignments: [] })
        );
        const fullJson = fullModel.toJSON();
        const jsonRoundTrip = withTemporaryGlobals(teacherGlobal, () =>
          ABClass.fromJSON(JSON.parse(JSON.stringify(fullJson)))
        );
        expect(jsonRoundTrip.toJSON().metadata).toStrictEqual(input.metadata);
        expect(jsonRoundTrip.toPartialJSON().metadata).toStrictEqual(input.metadata);

        const partialJson = restored.toPartialJSON();
        const partialRoundTrip = withTemporaryGlobals(teacherGlobal, () =>
          ABClass.fromJSON(JSON.parse(JSON.stringify(partialJson)))
        );
        expect(partialRoundTrip.toPartialJSON().metadata).toStrictEqual(input.metadata);
      }
    }
  );

  it('normalises actual metadata omission to owned null on construction and restoration', () => {
    const instance = new ABClass({ classId: 'legacy-class' });
    const restored = ABClass.fromJSON({ classId: 'legacy-class' });
    expect(Object.hasOwn(instance, 'metadata')).toBe(true);
    expect(Object.hasOwn(restored, 'metadata')).toBe(true);
    expect(instance.metadata).toBeNull();
    expect(restored.metadata).toBeNull();
    expect(instance.toJSON().metadata).toBeNull();
    expect(instance.toPartialJSON().metadata).toBeNull();
    expect(ABClass.fromJSON({ classId: 'legacy-null', metadata: null }).metadata).toBeNull();
  });

  it('rejects invalid present metadata at construction and restoration with its domain path', () => {
    const canonical = Object.values(canonicalClasses('medium')).find((row) => row.metadata);
    const invalid = invalidMetadata(canonical.metadata);
    expect(() => globalThis.ABClassMetadata.validateMetadata(invalid, 'metadata')).toThrow(
      expect.objectContaining({ fieldPath: 'metadata.classAverages.accuracy' })
    );
    expect(() => new ABClass({ classId: 'undefined-class', metadata: undefined })).toThrow(
      globalThis.ABClassMetadataValidationError
    );
    expect(() => ABClass.fromJSON({ classId: 'undefined-class', metadata: undefined })).toThrow(
      globalThis.ABClassMetadataValidationError
    );
    expect(() => new ABClass({ classId: 'invalid-class', metadata: invalid })).toThrow(
      globalThis.ABClassMetadataValidationError
    );
    expect(() => new ABClass({ classId: 'empty-class', metadata: {} })).toThrow(
      globalThis.ABClassMetadataValidationError
    );
    expect(() => ABClass.fromJSON({ classId: 'invalid-class', metadata: invalid })).toThrow(
      expect.objectContaining({ fieldPath: 'metadata.classAverages.accuracy' })
    );
    expect(() => ABClass.fromJSON({ classId: 'empty-class', metadata: {} })).toThrow(
      globalThis.ABClassMetadataValidationError
    );
  });

  it('replaces metadata as a whole and leaves the model unchanged after invalid replacement', () => {
    const canonical = Object.values(canonicalClasses('medium')).find((input) => input.metadata);
    const instance = new ABClass({
      classId: canonical.classId,
      metadata: clone(canonical.metadata),
    });
    const previous = clone(instance.metadata);
    expect(() => instance.setMetadata(invalidMetadata(canonical.metadata))).toThrow(
      globalThis.ABClassMetadataValidationError
    );
    expect(instance.metadata).toStrictEqual(previous);

    const variants = ['small', 'medium'].flatMap((profile) =>
      Object.values(canonicalClasses(profile)).map((row) => row.metadata)
    );
    for (const replacement of [null, ...variants.filter(Boolean)]) {
      instance.setMetadata(clone(replacement));
      expect(instance.metadata).toStrictEqual(replacement);
      expect(instance.toJSON().metadata).toStrictEqual(replacement);
      expect(instance.toPartialJSON().metadata).toStrictEqual(replacement);
    }
    expect(() => instance.setMetadata(undefined)).toThrow(
      globalThis.ABClassMetadataValidationError
    );
    expect(() => instance.setMetadata({})).toThrow(globalThis.ABClassMetadataValidationError);
  });

  it('deeply owns constructor, restoration, and replacement inputs', () => {
    const canonical = Object.values(canonicalClasses('medium')).find(
      (input) => input.metadata?.recentAssignments.length === 2
    );
    for (const create of [
      (metadata) => new ABClass({ classId: canonical.classId, metadata }),
      (metadata) =>
        withTemporaryGlobals(teacherGlobal, () =>
          ABClass.fromJSON({ ...clone(canonical), metadata })
        ),
    ]) {
      const inputMetadata = clone(canonical.metadata);
      const model = create(inputMetadata);
      inputMetadata.classAverages.completeness = 99;
      inputMetadata.recentAssignments.push(clone(inputMetadata.recentAssignments[0]));
      inputMetadata.recentAssignments[0].assignmentId = 'mutated';
      inputMetadata.recentAssignments[0].averages.accuracy = 99;
      expect(model.metadata).toStrictEqual(canonical.metadata);
    }

    const instance = new ABClass({ classId: canonical.classId });
    const replacement = clone(canonical.metadata);
    instance.setMetadata(replacement);
    replacement.classAverages.completeness = 99;
    replacement.recentAssignments.push(clone(replacement.recentAssignments[0]));
    replacement.recentAssignments[0].assignmentId = 'replacement-input-mutated';
    replacement.recentAssignments[1].averages.spag = 99;
    expect(instance.metadata).toStrictEqual(canonical.metadata);
  });

  it('returns independent full, partial, repeated, and restored snapshots at every nested node', () => {
    const canonical = Object.values(canonicalClasses('medium')).find(
      (input) => input.metadata?.recentAssignments.length === 2
    );
    // Isolate metadata output ownership from unsupported full serialization of
    // class-embedded partial definitions; the full population has its own characterization.
    const model = withTemporaryGlobals(teacherGlobal, () =>
      ABClass.fromJSON({ ...clone(canonical), assignments: [] })
    );
    const full = model.toJSON();
    const partial = model.toPartialJSON();
    const repeatedFull = model.toJSON();
    const repeatedPartial = model.toPartialJSON();
    for (const output of [full, partial, repeatedFull, repeatedPartial]) {
      expectMetadataNodesDistinct(output.metadata, model.metadata);
    }
    expectMetadataNodesDistinct(full.metadata, partial.metadata);
    expectMetadataNodesDistinct(full.metadata, repeatedFull.metadata);
    expectMetadataNodesDistinct(partial.metadata, repeatedPartial.metadata);

    const fullRoundTrip = withTemporaryGlobals(teacherGlobal, () =>
      ABClass.fromJSON(JSON.parse(JSON.stringify(full)))
    );
    const partialRoundTrip = withTemporaryGlobals(teacherGlobal, () =>
      ABClass.fromJSON(JSON.parse(JSON.stringify(partial)))
    );
    full.metadata.classAverages.accuracy = 1;
    full.metadata.recentAssignments[0].assignmentId = 'full-output-mutated';
    full.metadata.recentAssignments[0].averages.completeness = 1;
    full.metadata.recentAssignments.pop();
    partial.metadata.classAverages.spag = 1;
    partial.metadata.recentAssignments[1].assignmentDefinitionKey = 'partial-output-mutated';
    partial.metadata.recentAssignments[1].averages.overall = 1;
    expect(model.metadata).toStrictEqual(canonical.metadata);
    expect(repeatedFull.metadata).toStrictEqual(canonical.metadata);
    expect(repeatedPartial.metadata).toStrictEqual(canonical.metadata);
    expect(repeatedFull.metadata.recentAssignments).toHaveLength(2);
    expect(repeatedPartial.metadata.recentAssignments).toHaveLength(2);
    expect(fullRoundTrip.metadata).toStrictEqual(canonical.metadata);
    expect(partialRoundTrip.metadata).toStrictEqual(canonical.metadata);
  });

  it('revalidates direct mutations on both serializers and preserves valid supplied ordering', () => {
    const canonical = Object.values(canonicalClasses('medium')).find(
      (input) => input.metadata?.recentAssignments.length === 2
    );
    const instance = new ABClass({
      classId: canonical.classId,
      metadata: clone(canonical.metadata),
    });
    const validMutation = clone(canonical.metadata);
    validMutation.classAverages.completeness = 0.25;
    validMutation.recentAssignments[0].updatedAt = validMutation.recentAssignments[1].updatedAt;
    validMutation.recentAssignments[1].assignmentDefinitionKey =
      validMutation.recentAssignments[0].assignmentDefinitionKey;
    instance.metadata = validMutation;
    expect(instance.toJSON().metadata).toStrictEqual(validMutation);
    expect(instance.toPartialJSON().metadata).toStrictEqual(validMutation);
    expect(instance.toJSON().metadata.recentAssignments.map((entry) => entry.assignmentId)).toEqual(
      validMutation.recentAssignments.map((entry) => entry.assignmentId)
    );

    instance.metadata = invalidMetadata(canonical.metadata);
    expect(() => instance.toJSON()).toThrow(globalThis.ABClassMetadataValidationError);
    expect(() => instance.toPartialJSON()).toThrow(globalThis.ABClassMetadataValidationError);
    delete instance.metadata;
    expect(() => instance.toJSON()).toThrow(globalThis.ABClassMetadataValidationError);
    expect(() => instance.toPartialJSON()).toThrow(globalThis.ABClassMetadataValidationError);
  });

  it('preserves canonical configuration, owner, roster, active state, and assignment redaction', () => {
    let sawOwner = false;
    let sawNullOwner = false;
    let assignmentCount = 0;
    let submissionCount = 0;
    let itemCount = 0;
    for (const input of Object.values(canonicalClasses('small'))) {
      const model = withTemporaryGlobals(teacherGlobal, () => ABClass.fromJSON(clone(input)));
      expect(model.classId).toBe(input.classId);
      expect(model.className).toBe(input.className);
      expect(model.cohortKey).toBe(input.cohortKey);
      expect(model.yearGroupKey).toBe(input.yearGroupKey);
      expect(model.courseLength).toBe(input.courseLength);
      expect(model.active).toBe(input.active);
      expect(model.teachers).toStrictEqual(input.teachers);
      expect(model.students).toStrictEqual(input.students);
      if (input.classOwner === null) {
        sawNullOwner = true;
        expect(model.classOwner).toBeNull();
      } else {
        sawOwner = true;
        expect(model.classOwner).toBeInstanceOf(Teacher);
        expect(
          new ABClass({ classId: input.classId, classOwner: model.classOwner }).toJSON().classOwner
        ).toStrictEqual(input.classOwner);
      }
      expect(model.assignments).toHaveLength(input.assignments.length);
      assignmentCount += model.assignments.length;
      expect(
        model.assignments.every((assignment) => assignment._hydrationLevel === 'partial')
      ).toBe(true);
      const serializedAssignments = model.assignments.map((assignment) =>
        assignment.toPartialJSON()
      );
      for (const [index, assignment] of serializedAssignments.entries()) {
        const sourceAssignment = input.assignments[index];
        expect(assignment.assignmentId).toBe(sourceAssignment.assignmentId);
        submissionCount += assignment.submissions.length;
        itemCount += expectPartialSubmissionMatchesRedactedSource(
          assignment.submissions,
          sourceAssignment.submissions
        );
      }
      expect(model.toPartialJSON()).not.toHaveProperty('students');
      expect(model.toPartialJSON()).not.toHaveProperty('assignments');
    }
    expect(sawOwner).toBe(true);
    expect(sawNullOwner).toBe(true);
    expect(assignmentCount).toBe(12);
    expect(submissionCount).toBe(42);
    expect(itemCount).toBe(66);
    for (const active of [true, false, null]) {
      const source = Object.values(canonicalClasses('small'))[1];
      const model = withTemporaryGlobals(teacherGlobal, () =>
        ABClass.fromJSON({ ...clone(source), assignments: [], active })
      );
      expect(model.active).toBe(active);
      expect(model.toJSON().active).toBe(active);
      expect(model.toPartialJSON().active).toBe(active);
    }
  });
});
