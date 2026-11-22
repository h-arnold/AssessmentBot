import { describe, expect, it } from 'vitest';
import {
  asParserSchema,
  loadAssignmentDefinitionSchemas,
  validFullDefinition,
} from '@/test/assignmentDefinition/assignmentDefinitionTestFixtures';

describe('assignmentDefinition.zod schemas', () => {
  it('extracts the shape validation to a standalone helper', async () => {
    const schemas = await loadAssignmentDefinitionSchemas();
    expect(schemas).toHaveProperty('validateUpsertShape');
  });

  it('defines request and response schemas for upsertAssignmentDefinition and getAssignmentDefinition', async () => {
    const schemas = await loadAssignmentDefinitionSchemas();

    expect(schemas).toHaveProperty('UpsertAssignmentDefinitionRequestSchema');
    expect(schemas).toHaveProperty('UpsertAssignmentDefinitionResponseSchema');
    expect(schemas).toHaveProperty('GetAssignmentDefinitionRequestSchema');
    expect(schemas).toHaveProperty('GetAssignmentDefinitionResponseSchema');
  });

  it('accepts canonical full-definition payloads for upsert and full-definition reads', async () => {
    const schemas = await loadAssignmentDefinitionSchemas();
    const upsertResponseSchema = asParserSchema(schemas.UpsertAssignmentDefinitionResponseSchema);
    const getResponseSchema = asParserSchema(schemas.GetAssignmentDefinitionResponseSchema);

    expect(upsertResponseSchema.parse(validFullDefinition)).toEqual(validFullDefinition);
    expect(getResponseSchema.parse(validFullDefinition)).toEqual(validFullDefinition);
  });

  it('requires strict getAssignmentDefinition request payloads keyed by definitionKey', async () => {
    const schemas = await loadAssignmentDefinitionSchemas();
    const getRequestSchema = asParserSchema(schemas.GetAssignmentDefinitionRequestSchema);

    expect(getRequestSchema.parse({ definitionKey: 'algebra-baseline' })).toEqual({
      definitionKey: 'algebra-baseline',
    });
    expect(() => getRequestSchema.parse({ definitionKey: ' algebra-baseline ' })).toThrow();
    expect(() => getRequestSchema.parse({})).toThrow();
  });

  it('enforces assignment and task weighting boundaries from 0 to 10 inclusive', async () => {
    const schemas = await loadAssignmentDefinitionSchemas();
    const upsertRequestSchema = asParserSchema(schemas.UpsertAssignmentDefinitionRequestSchema);

    const validInput = {
      primaryTitle: 'Algebra Baseline',
      primaryTopicKey: 'topic-algebra',
      yearGroupKey: 'year-10',
      referenceDocumentUrl: 'https://docs.google.com/presentation/d/ref-doc-id/edit',
      templateDocumentUrl: 'https://docs.google.com/presentation/d/tpl-doc-id/edit',
      assignmentWeighting: 10,
      taskWeightings: [
        {
          taskId: 'task-001',
          taskWeighting: 0,
        },
      ],
    };

    expect(upsertRequestSchema.parse(validInput)).toEqual(validInput);
    expect(() => {
      return upsertRequestSchema.parse({
        ...validInput,
        assignmentWeighting: 11,
      });
    }).toThrow();
    expect(() => {
      return upsertRequestSchema.parse({
        ...validInput,
        taskWeightings: [{ taskId: 'task-001', taskWeighting: -1 }],
      });
    }).toThrow();
  });

  describe('assignmentWeighting range validation for AssignmentDefinitionSchema', () => {
    it('rejects assignmentWeighting values less than 0', async () => {
      const schemas = await loadAssignmentDefinitionSchemas();
      const assignmentDefinitionSchema = asParserSchema(schemas.AssignmentDefinitionSchema);

      expect(() => {
        return assignmentDefinitionSchema.parse({
          ...validFullDefinition,
          assignmentWeighting: -1,
        });
      }).toThrow();
    });

    it('rejects assignmentWeighting values greater than 10', async () => {
      const schemas = await loadAssignmentDefinitionSchemas();
      const assignmentDefinitionSchema = asParserSchema(schemas.AssignmentDefinitionSchema);

      expect(() => {
        return assignmentDefinitionSchema.parse({
          ...validFullDefinition,
          assignmentWeighting: 11,
        });
      }).toThrow();
    });

    it('accepts assignmentWeighting at boundary values 0 and 10', async () => {
      const schemas = await loadAssignmentDefinitionSchemas();
      const assignmentDefinitionSchema = asParserSchema(schemas.AssignmentDefinitionSchema);

      expect(
        assignmentDefinitionSchema.parse({
          ...validFullDefinition,
          assignmentWeighting: 0,
        })
      ).toEqual({
        ...validFullDefinition,
        assignmentWeighting: 0,
      });

      expect(
        assignmentDefinitionSchema.parse({
          ...validFullDefinition,
          assignmentWeighting: 10,
        })
      ).toEqual({
        ...validFullDefinition,
        assignmentWeighting: 10,
      });
    });
  });
});
