import { describe, expect, it, vi } from 'vitest';

const ABClassResponseMapper = require('#backend/y_controllers/ABClassController/ABClassResponseMapper.js');

function assignment(definition) {
  const payload = {
    courseId: 'course-1',
    assignmentId: 'assignment-1',
    assessmentContractVersion: 1,
    ...(definition === undefined ? {} : { assignmentDefinition: definition }),
  };
  return {
    // Current-format marker: a non-marker-1 record is read as legacy and
    // reassessment-projected, which this definition-key probe does not model.
    assessmentContractVersion: 1,
    toPartialJSON: vi.fn(() => payload),
    // The class read emit routes through toReadJSON('partial'); a marker-1
    // record delegates to the same payload as its toPartialJSON.
    toReadJSON: vi.fn(() => payload),
  };
}

function classModel(item) {
  return {
    classId: 'course-1',
    metadata: null,
    active: true,
    cohortKey: null,
    courseLength: 1,
    yearGroupKey: null,
    serialiseOwner: () => null,
    teachers: [],
    students: [],
    assignments: [item],
  };
}

describe('ABClass read assignment definition key projection', () => {
  it.each([undefined, {}, { definitionKey: null }, { definitionKey: '' }])(
    'rejects absent or invalid embedded definition key %#',
    (definition) => {
      expect(() =>
        new ABClassResponseMapper()._toReadView(classModel(assignment(definition)))
      ).toThrow();
    }
  );

  it('projects a valid required definition key', () => {
    const result = new ABClassResponseMapper()._toReadView(
      classModel(assignment({ definitionKey: 'definition-1' }))
    );
    expect(result.assignments[0].assignmentDefinitionKey).toBe('definition-1');
    expect(result.assignments[0]).not.toHaveProperty('assignmentDefinition');
  });
});
