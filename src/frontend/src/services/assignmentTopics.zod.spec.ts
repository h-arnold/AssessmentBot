import { describe, expect, it } from 'vitest';

const validAssignmentTopics = [
  { key: 'topic-algebra', name: 'Algebra' },
  { key: 'topic-geometry', name: 'Geometry' },
];

/**
 * Loads the assignment-topics schema module under test.
 *
 * @returns {Promise<Record<string, unknown>>} The imported schema module.
 */
async function loadAssignmentTopicsSchemas(): Promise<Record<string, unknown>> {
  return import('./assignmentTopics.zod');
}

/**
 * Casts an unknown export to a parser-compatible schema facade.
 *
 * @param {unknown} schemaExport Schema export under test.
 * @returns {{ parse: (input: unknown) => unknown }} Parser facade.
 */
function asParserSchema(schemaExport: unknown): { parse: (input: unknown) => unknown } {
  return schemaExport as { parse: (input: unknown) => unknown };
}

describe('assignmentTopics.zod schemas', () => {
  it('defines dedicated schemas for assignment-topics transport payloads', async () => {
    const schemas = await loadAssignmentTopicsSchemas();

    expect(schemas).toHaveProperty('AssignmentTopicSchema');
    expect(schemas).toHaveProperty('AssignmentTopicsResponseSchema');
  });

  it('accepts trimmed key/name topic records returned by getAssignmentTopics', async () => {
    const schemas = await loadAssignmentTopicsSchemas();
    const responseSchema = asParserSchema(schemas.AssignmentTopicsResponseSchema);

    expect(responseSchema.parse(validAssignmentTopics)).toEqual(validAssignmentTopics);
  });

  it('rejects malformed topic records to protect startup reference-data trust', async () => {
    const schemas = await loadAssignmentTopicsSchemas();
    const responseSchema = asParserSchema(schemas.AssignmentTopicsResponseSchema);

    expect(() => responseSchema.parse([{ key: 'topic-algebra', name: '' }])).toThrow();
    expect(() => responseSchema.parse([{ key: ' topic-algebra ', name: 'Algebra' }])).toThrow();
    expect(() => responseSchema.parse([{ key: 'topic-algebra' }])).toThrow();
  });
});
