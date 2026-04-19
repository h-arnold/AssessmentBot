import { describe, expect, it } from 'vitest';

type AssignmentDefinitionPartialFixture = {
  primaryTitle: string;
  primaryTopic: string;
  courseId: string;
  yearGroup: number | null;
  alternateTitles: string[];
  alternateTopics: string[];
  documentType: string;
  referenceDocumentId: string;
  templateDocumentId: string;
  assignmentWeighting: number | null;
  definitionKey: string;
  tasks: null;
  createdAt: string | null;
  updatedAt: string | null;
};

const omittedBackendSuccessPayload = new Map<string, never>().get('missing');

const validAssignmentDefinitionPartialRow: AssignmentDefinitionPartialFixture = {
  primaryTitle: 'Algebra Baseline',
  primaryTopic: 'Algebra',
  courseId: 'course-001',
  yearGroup: 10,
  alternateTitles: ['Algebra Starter'],
  alternateTopics: ['Linear Equations'],
  documentType: 'SLIDES',
  referenceDocumentId: 'ref-doc-001',
  templateDocumentId: 'tpl-doc-001',
  assignmentWeighting: null,
  definitionKey: 'algebra-baseline',
  tasks: null,
  createdAt: '2026-01-05T10:00:00.000Z',
  updatedAt: null,
};

/**
 * Loads the assignment-definition partial schemas under test.
 *
 * @returns {Promise<Record<string, unknown>>} The imported schema module.
 */
async function loadAssignmentDefinitionPartialsSchemas(): Promise<Record<string, unknown>> {
  return import('./assignmentDefinitionPartials.zod');
}

/**
 * Creates a mutable row fixture for malformed-payload cases.
 *
 * @returns {AssignmentDefinitionPartialFixture} A cloned valid row fixture.
 */
function createMutableRowFixture(): AssignmentDefinitionPartialFixture {
  return { ...validAssignmentDefinitionPartialRow };
}

/**
 * Casts an unknown schema export to a parser shape.
 *
 * @param {unknown} schemaExport - Schema export under test.
 * @returns {{ parse: (input: unknown) => unknown }} Parser-compatible schema facade.
 */
function asParserSchema(schemaExport: unknown): { parse: (input: unknown) => unknown } {
  return schemaExport as { parse: (input: unknown) => unknown };
}

describe('assignmentDefinitionPartials.zod schemas', () => {
  it('accepts valid assignment-definition partial rows', async () => {
    const schemas = await loadAssignmentDefinitionPartialsSchemas();
    const assignmentDefinitionPartialSchema = asParserSchema(schemas.AssignmentDefinitionPartialSchema);

    expect(assignmentDefinitionPartialSchema.parse(validAssignmentDefinitionPartialRow)).toEqual(
      validAssignmentDefinitionPartialRow
    );
  });

  it('accepts yearGroup when explicitly null', async () => {
    const schemas = await loadAssignmentDefinitionPartialsSchemas();
    const assignmentDefinitionPartialSchema = asParserSchema(schemas.AssignmentDefinitionPartialSchema);

    expect(
      assignmentDefinitionPartialSchema.parse({
        ...validAssignmentDefinitionPartialRow,
        yearGroup: null,
      })
    ).toEqual({
      ...validAssignmentDefinitionPartialRow,
      yearGroup: null,
    });
  });

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
    const assignmentDefinitionPartialSchema = asParserSchema(schemas.AssignmentDefinitionPartialSchema);

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
    delete (malformedRow as Partial<AssignmentDefinitionPartialFixture>).primaryTopic;

    expect(() => assignmentDefinitionPartialsResponseSchema.parse([malformedRow])).toThrow();
  });

  it.each([
    {
      caseName: 'createdAt is missing',
      mutateRow: (row: AssignmentDefinitionPartialFixture) => {
        delete (row as Partial<AssignmentDefinitionPartialFixture>).createdAt;
      },
    },
    {
      caseName: 'updatedAt is missing',
      mutateRow: (row: AssignmentDefinitionPartialFixture) => {
        delete (row as Partial<AssignmentDefinitionPartialFixture>).updatedAt;
      },
    },
    {
      caseName: 'createdAt is not an ISO string',
      mutateRow: (row: AssignmentDefinitionPartialFixture) => {
        row.createdAt = 'not-an-iso-date';
      },
    },
    {
      caseName: 'updatedAt is not an ISO string',
      mutateRow: (row: AssignmentDefinitionPartialFixture) => {
        row.updatedAt = 'not-an-iso-date';
      },
    },
    {
      caseName: 'createdAt is a non-existent calendar date',
      mutateRow: (row: AssignmentDefinitionPartialFixture) => {
        row.createdAt = '2026-02-30T00:00:00.000Z';
      },
    },
  ])('rejects invalid or missing timestamp fields: $caseName', async ({ mutateRow }) => {
    const schemas = await loadAssignmentDefinitionPartialsSchemas();
    const assignmentDefinitionPartialsResponseSchema = asParserSchema(
      schemas.AssignmentDefinitionPartialsResponseSchema
    );
    const malformedRow = createMutableRowFixture();
    mutateRow(malformedRow);

    expect(() => assignmentDefinitionPartialsResponseSchema.parse([malformedRow])).toThrow();
  });

  it.each([
    {
      caseName: 'definitionKey is missing',
      mutateRow: (row: AssignmentDefinitionPartialFixture) => {
        delete (row as Partial<AssignmentDefinitionPartialFixture>).definitionKey;
      },
    },
    {
      caseName: 'definitionKey is blank',
      mutateRow: (row: AssignmentDefinitionPartialFixture) => {
        row.definitionKey = '   ';
      },
    },
    {
      caseName: 'definitionKey is not trimmed',
      mutateRow: (row: AssignmentDefinitionPartialFixture) => {
        row.definitionKey = ' algebra-baseline ';
      },
    },
  ])('rejects missing, blank, or non-trimmed definitionKey values: $caseName', async ({ mutateRow }) => {
    const schemas = await loadAssignmentDefinitionPartialsSchemas();
    const assignmentDefinitionPartialsResponseSchema = asParserSchema(
      schemas.AssignmentDefinitionPartialsResponseSchema
    );
    const malformedRow = createMutableRowFixture();
    mutateRow(malformedRow);

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
    expect(() => deleteRequestSchema.parse({ definitionKey: String.raw`algebra\baseline` })).toThrow();
    expect(() => deleteRequestSchema.parse({ definitionKey: 'algebra..baseline' })).toThrow();
    expect(() => deleteRequestSchema.parse({ definitionKey: 'algebra\u0007baseline' })).toThrow();
  });

  it('DeleteAssignmentDefinitionResponseSchema accepts only an omitted/undefined backend success payload', async () => {
    const schemas = await loadAssignmentDefinitionPartialsSchemas();
    const deleteResponseSchema = asParserSchema(schemas.DeleteAssignmentDefinitionResponseSchema);

    expect(deleteResponseSchema.parse(omittedBackendSuccessPayload)).toBeUndefined();
    expect(() => deleteResponseSchema.parse({ deleted: true })).toThrow();
  });
});
