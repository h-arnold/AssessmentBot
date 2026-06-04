/**
 * Field validation tests for assignmentDefinitionPartials.zod.
 */

import { describe, expect, it } from 'vitest';
import {
  validAssignmentDefinitionPartialRow,
  loadAssignmentDefinitionPartialsSchemas,
  asParserSchema,
} from './fixtures';

describe('assignmentWeighting validation', () => {
  it.each([
    {
      caseName: 'number',
      assignmentWeighting: 12,
    },
    {
      caseName: 'null',
      assignmentWeighting: null,
    },
  ])('accepts assignmentWeighting as $caseName', async ({ assignmentWeighting }) => {
    const schemas = await loadAssignmentDefinitionPartialsSchemas();
    const assignmentDefinitionPartialSchema = asParserSchema(
      schemas.AssignmentDefinitionPartialSchema
    );

    expect(
      assignmentDefinitionPartialSchema.parse({
        ...validAssignmentDefinitionPartialRow,
        assignmentWeighting,
      })
    ).toEqual({
      ...validAssignmentDefinitionPartialRow,
      assignmentWeighting,
    });
  });

  describe('backend contract consistency for assignmentWeighting', () => {
    it('accepts null assignmentWeighting (consistent with backend)', async () => {
      const schemas = await loadAssignmentDefinitionPartialsSchemas();
      const assignmentDefinitionPartialSchema = asParserSchema(
        schemas.AssignmentDefinitionPartialSchema
      );

      expect(
        assignmentDefinitionPartialSchema.parse({
          ...validAssignmentDefinitionPartialRow,
          assignmentWeighting: null,
        })
      ).toEqual({
        ...validAssignmentDefinitionPartialRow,
        assignmentWeighting: null,
      });
    });

    it('accepts numeric assignmentWeighting', async () => {
      const schemas = await loadAssignmentDefinitionPartialsSchemas();
      const assignmentDefinitionPartialSchema = asParserSchema(
        schemas.AssignmentDefinitionPartialSchema
      );

      expect(
        assignmentDefinitionPartialSchema.parse({
          ...validAssignmentDefinitionPartialRow,
          assignmentWeighting: 5,
        })
      ).toEqual({
        ...validAssignmentDefinitionPartialRow,
        assignmentWeighting: 5,
      });
    });

    it('rejects non-numeric non-null assignmentWeighting', async () => {
      const schemas = await loadAssignmentDefinitionPartialsSchemas();
      const assignmentDefinitionPartialSchema = asParserSchema(
        schemas.AssignmentDefinitionPartialSchema
      );

      expect(() =>
        assignmentDefinitionPartialSchema.parse({
          ...validAssignmentDefinitionPartialRow,
          assignmentWeighting: 'five',
        })
      ).toThrow();
    });
  });
});

describe('definitionKey validation', () => {
  it.each([
    {
      caseName: 'definitionKey is missing',
      mutateRow: (row: Record<string, unknown>) => {
        delete row.definitionKey;
      },
    },
    {
      caseName: 'definitionKey is blank',
      mutateRow: (row: Record<string, unknown>) => {
        row.definitionKey = '   ';
      },
    },
    {
      caseName: 'definitionKey is not trimmed',
      mutateRow: (row: Record<string, unknown>) => {
        row.definitionKey = ' algebra-baseline ';
      },
    },
  ])(
    'rejects missing, blank, or non-trimmed definitionKey values: $caseName',
    async ({ mutateRow }) => {
      const schemas = await loadAssignmentDefinitionPartialsSchemas();
      const assignmentDefinitionPartialsResponseSchema = asParserSchema(
        schemas.AssignmentDefinitionPartialsResponseSchema
      );
      const malformedRow = { ...validAssignmentDefinitionPartialRow } as Record<string, unknown>;
      mutateRow(malformedRow);

      expect(() => assignmentDefinitionPartialsResponseSchema.parse([malformedRow])).toThrow();
    }
  );
});

describe('tasks field backend-shape compatibility', () => {
  it.each([
    {
      caseName: 'null',
      tasks: null,
    },
    {
      caseName: 'empty array',
      tasks: [],
    },
    {
      caseName: 'task-map object',
      tasks: {
        task_1: {
          taskTitle: 'Solve equations',
          taskWeighting: 1,
        },
      },
    },
    {
      caseName: 'undefined',
      tasks: undefined,
    },
  ])('normalises tasks as $caseName to null', async ({ tasks }) => {
    const schemas = await loadAssignmentDefinitionPartialsSchemas();
    const assignmentDefinitionPartialSchema = asParserSchema(
      schemas.AssignmentDefinitionPartialSchema
    );

    expect(
      assignmentDefinitionPartialSchema.parse({
        ...validAssignmentDefinitionPartialRow,
        tasks,
      })
    ).toEqual({
      ...validAssignmentDefinitionPartialRow,
      tasks: null,
    });
  });

  it.each([
    {
      caseName: 'string',
      tasks: 'not-valid',
    },
    {
      caseName: 'number',
      tasks: 1,
    },
    {
      caseName: 'boolean',
      tasks: true,
    },
  ])('rejects unsupported tasks type: $caseName', async ({ tasks }) => {
    const schemas = await loadAssignmentDefinitionPartialsSchemas();
    const assignmentDefinitionPartialSchema = asParserSchema(
      schemas.AssignmentDefinitionPartialSchema
    );

    expect(() =>
      assignmentDefinitionPartialSchema.parse({
        ...validAssignmentDefinitionPartialRow,
        tasks,
      })
    ).toThrow();
  });
});
