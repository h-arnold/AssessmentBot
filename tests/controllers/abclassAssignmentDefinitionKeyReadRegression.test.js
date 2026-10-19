import { describe, expect, it, vi } from 'vitest';

const ABClassResponseMapper = require('#backend/y_controllers/ABClassController/ABClassResponseMapper.js');

function assignment(definition) {
  return {
    toPartialJSON: vi.fn(() => ({
      courseId: 'course-1',
      assignmentId: 'assignment-1',
      ...(definition === undefined ? {} : { assignmentDefinition: definition }),
    })),
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
