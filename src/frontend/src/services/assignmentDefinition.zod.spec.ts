import { describe, expect, it } from 'vitest';

const validFullDefinition = {
  definitionKey: 'algebra-baseline',
  primaryTitle: 'Algebra Baseline',
  primaryTopicKey: 'topic-algebra',
  primaryTopic: 'Algebra',
  yearGroupKey: 'year-10',
  yearGroupLabel: 'Year 10',
  alternateTitles: ['Algebra Starter'],
  alternateTopics: ['Linear Equations'],
  documentType: 'SLIDES',
  referenceDocumentId: 'reference-doc-id',
  templateDocumentId: 'template-doc-id',
  assignmentWeighting: 1,
  tasks: [
    {
      taskId: 'task-001',
      taskTitle: 'Solve equations',
      taskWeighting: 1,
    },
  ],
  createdAt: '2026-01-05T10:00:00.000Z',
  updatedAt: '2026-01-05T10:10:00.000Z',
};

/**
 * Loads the assignment-definition schema module under test.
 *
 * @returns {Promise<Record<string, unknown>>} The imported module.
 */
async function loadAssignmentDefinitionSchemas(): Promise<Record<string, unknown>> {
  return import('./assignmentDefinition.zod');
}

/**
 * Casts an unknown schema export to a parser-compatible facade.
 *
 * @param {unknown} schemaExport Schema export under test.
 * @returns {{ parse: (input: unknown) => unknown }} Parser facade.
 */
function asParserSchema(schemaExport: unknown): { parse: (input: unknown) => unknown } {
  return schemaExport as { parse: (input: unknown) => unknown };
}

describe('assignmentDefinition.zod schemas', () => {
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
    expect(() =>
      upsertRequestSchema.parse({
        ...validInput,
        assignmentWeighting: 11,
      })
    ).toThrow();
    expect(() =>
      upsertRequestSchema.parse({
        ...validInput,
        taskWeightings: [{ taskId: 'task-001', taskWeighting: -1 }],
      })
    ).toThrow();
  });
});
