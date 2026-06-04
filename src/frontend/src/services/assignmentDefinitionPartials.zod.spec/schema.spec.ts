/**
 * Schema tests for assignmentDefinitionPartials.zod.
 */

import { describe, expect, it } from 'vitest';
import {
  validAssignmentDefinitionPartialRow,
  omittedBackendSuccessPayload,
  loadAssignmentDefinitionPartialsSchemas,
  createMutableRowFixture,
  asParserSchema,
} from './fixtures';

describe('assignmentDefinitionPartials.zod schemas', () => {
  it('accepts assignment-definition partial rows keyed by yearGroupKey/yearGroupLabel', async () => {
    const schemas = await loadAssignmentDefinitionPartialsSchemas();
    const assignmentDefinitionPartialSchema = asParserSchema(
      schemas.AssignmentDefinitionPartialSchema
    );

    expect(assignmentDefinitionPartialSchema.parse(validAssignmentDefinitionPartialRow)).toEqual(
      validAssignmentDefinitionPartialRow
    );
  });

  it('rejects legacy yearGroup list rows once the migrated contract is active', async () => {
    const schemas = await loadAssignmentDefinitionPartialsSchemas();
    const assignmentDefinitionPartialSchema = asParserSchema(
      schemas.AssignmentDefinitionPartialSchema
    );

    expect(() =>
      assignmentDefinitionPartialSchema.parse({
        ...validAssignmentDefinitionPartialRow,
        yearGroup: 10,
      })
    ).toThrow();
  });

  it('accepts timezone-offset timestamps and explicit null createdAt values', async () => {
    const schemas = await loadAssignmentDefinitionPartialsSchemas();
    const assignmentDefinitionPartialsResponseSchema = asParserSchema(
      schemas.AssignmentDefinitionPartialsResponseSchema
    );

    expect(
      assignmentDefinitionPartialsResponseSchema.parse([
        {
          ...validAssignmentDefinitionPartialRow,
          createdAt: null,
          updatedAt: '2026-01-05T10:00:00.000+11:00',
        },
      ])
    ).toEqual([
      {
        ...validAssignmentDefinitionPartialRow,
        createdAt: null,
        updatedAt: '2026-01-05T10:00:00.000+11:00',
      },
    ]);
  });

  it('rejects rows missing required non-timestamp fields', async () => {
    const schemas = await loadAssignmentDefinitionPartialsSchemas();
    const assignmentDefinitionPartialsResponseSchema = asParserSchema(
      schemas.AssignmentDefinitionPartialsResponseSchema
    );
    const malformedRow = createMutableRowFixture();
    delete (malformedRow as Partial<typeof validAssignmentDefinitionPartialRow>).primaryTopic;

    expect(() => assignmentDefinitionPartialsResponseSchema.parse([malformedRow])).toThrow();
  });

  it('defines delete request and response schema exports for assignment-definition transport', async () => {
    const schemas = await loadAssignmentDefinitionPartialsSchemas();

    expect(schemas).toHaveProperty('DeleteAssignmentDefinitionRequestSchema');
    expect(schemas).toHaveProperty('DeleteAssignmentDefinitionResponseSchema');
  });

  it('DeleteAssignmentDefinitionRequestSchema accepts only safe, trimmed non-empty definitionKey values', async () => {
    const schemas = await loadAssignmentDefinitionPartialsSchemas();
    const deleteRequestSchema = asParserSchema(schemas.DeleteAssignmentDefinitionRequestSchema);

    expect(deleteRequestSchema.parse({ definitionKey: 'algebra-baseline' })).toEqual({
      definitionKey: 'algebra-baseline',
    });
    expect(() => deleteRequestSchema.parse({})).toThrow();
    expect(() => deleteRequestSchema.parse({ definitionKey: '' })).toThrow();
    expect(() => deleteRequestSchema.parse({ definitionKey: '  ' })).toThrow();
    expect(() => deleteRequestSchema.parse({ definitionKey: ' algebra-baseline ' })).toThrow();
    expect(() => deleteRequestSchema.parse({ definitionKey: 'algebra/baseline' })).toThrow();
    expect(() =>
      deleteRequestSchema.parse({ definitionKey: String.raw`algebra\baseline` })
    ).toThrow();
    expect(() => deleteRequestSchema.parse({ definitionKey: 'algebra..baseline' })).toThrow();
    expect(() => deleteRequestSchema.parse({ definitionKey: 'algebra\u0007baseline' })).toThrow();
  });

  it('DeleteAssignmentDefinitionResponseSchema accepts only an omitted/undefined backend success payload', async () => {
    const schemas = await loadAssignmentDefinitionPartialsSchemas();
    const deleteResponseSchema = asParserSchema(schemas.DeleteAssignmentDefinitionResponseSchema);

    expect(deleteResponseSchema.parse(omittedBackendSuccessPayload)).toBeUndefined();
    expect(() => deleteResponseSchema.parse({ deleted: true })).toThrow();
  });

  describe('schema parity between assignmentDefinition and assignmentDefinitionPartials', () => {
    it('AssignmentDefinitionPartialSchema has nullable assignmentWeighting matching backend', async () => {
      const schemas = await loadAssignmentDefinitionPartialsSchemas();
      const assignmentDefinitionPartialSchema = asParserSchema(
        schemas.AssignmentDefinitionPartialSchema
      );

      // This schema correctly allows null for assignmentWeighting
      expect(
        assignmentDefinitionPartialSchema.parse({
          ...validAssignmentDefinitionPartialRow,
          assignmentWeighting: null,
        })
      ).toBeTruthy();
    });

    it('AssignmentDefinitionPartialSchema uses strict timestamp validation matching backend', async () => {
      const schemas = await loadAssignmentDefinitionPartialsSchemas();
      const assignmentDefinitionPartialSchema = asParserSchema(
        schemas.AssignmentDefinitionPartialSchema
      );

      // Valid strict backend pattern should pass
      expect(
        assignmentDefinitionPartialSchema.parse({
          ...validAssignmentDefinitionPartialRow,
          createdAt: '2026-01-05T10:00:00.000Z',
        })
      ).toBeTruthy();

      // Invalid pattern (missing milliseconds) should fail
      expect(() =>
        assignmentDefinitionPartialSchema.parse({
          ...validAssignmentDefinitionPartialRow,
          createdAt: '2026-01-05T10:00:00Z',
        })
      ).toThrow();
    });
  });
});
