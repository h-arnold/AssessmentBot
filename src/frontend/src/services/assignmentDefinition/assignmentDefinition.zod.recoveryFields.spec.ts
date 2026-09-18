import { describe, expect, it } from 'vitest';

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

describe('UpsertAssignmentDefinitionRequestSchema stale recovery fields', () => {
  const recoveryBase = {
    primaryTitle: 'Algebra Baseline',
    primaryTopicKey: 'topic-algebra',
    yearGroupKey: 'year-10',
    definitionKey: 'algebra-baseline',
    referenceDocumentId: 'reference-doc-id',
    templateDocumentId: 'template-doc-id',
    documentType: 'SLIDES',
  } as const;

  const REVIEW_BASELINE_TIMESTAMP = '2026-01-05T10:10:00.000Z';

  it('accepts forceReparse alone on an ID-shape payload', async () => {
    const schemas = await loadAssignmentDefinitionSchemas();
    const upsertRequestSchema = asParserSchema(schemas.UpsertAssignmentDefinitionRequestSchema);

    const input = { ...recoveryBase, forceReparse: true };

    // Recovery reparses omit weighting patches; the flag alone must pass.
    expect(upsertRequestSchema.parse(input)).toEqual(input);
  });

  it('accepts forceReparse together with expectedDefinitionUpdatedAt', async () => {
    const schemas = await loadAssignmentDefinitionSchemas();
    const upsertRequestSchema = asParserSchema(schemas.UpsertAssignmentDefinitionRequestSchema);

    const input = {
      ...recoveryBase,
      forceReparse: true,
      expectedDefinitionUpdatedAt: REVIEW_BASELINE_TIMESTAMP,
    };

    expect(upsertRequestSchema.parse(input)).toEqual(input);
  });

  it('rejects forceReparse combined with taskWeightings through a schema-level rule', async () => {
    const schemas = await loadAssignmentDefinitionSchemas();
    const upsertRequestSchema = asParserSchema(schemas.UpsertAssignmentDefinitionRequestSchema);

    // Ambiguous patch precedence: explicit reparse requests must omit weighting
    // patches. The schema-level superRefine reports this as a custom issue, not
    // merely as an unrecognised key.
    let thrownIssues: Array<{ code: string }> = [];
    try {
      upsertRequestSchema.parse({
        ...recoveryBase,
        forceReparse: true,
        taskWeightings: [{ taskId: 'task-001', taskWeighting: 1 }],
      });
    } catch (error) {
      thrownIssues = (error as { issues?: Array<{ code: string }> }).issues ?? [];
    }

    expect(thrownIssues.some((issue) => issue.code === 'custom')).toBe(true);
  });

  it('rejects unknown fields alongside recovery fields to preserve strictness', async () => {
    const schemas = await loadAssignmentDefinitionSchemas();
    const upsertRequestSchema = asParserSchema(schemas.UpsertAssignmentDefinitionRequestSchema);

    // The request schema stays strict after extension; unexpected keys must still fail.
    expect(() =>
      upsertRequestSchema.parse({
        ...recoveryBase,
        forceReparse: true,
        unexpectedField: 'should be rejected',
      })
    ).toThrow();
  });
});
