import { describe, expect, it } from 'vitest';
import {
  asParserSchema,
  createMutableRowFixture,
  loadAssignmentDefinitionPartialsSchemas,
  type AssignmentDefinitionPartialFixture,
  validAssignmentDefinitionPartialRow,
} from '@/test/assignmentDefinition/assignmentDefinitionTestFixtures';

const omittedBackendSuccessPayload = new Map<string, never>().get('missing');

// Backend contract: ISO_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})(Z|([+-])(\d{2}):(\d{2}))$/u
// Valid: YYYY-MM-DDTHH:mm:ss.SSSZ or YYYY-MM-DDTHH:mm:ss.SSS±HH:MM

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

    expect(() => {
      return assignmentDefinitionPartialSchema.parse({
        ...validAssignmentDefinitionPartialRow,
        yearGroup: 10,
      });
    }).toThrow();
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
  ])(
    'rejects missing, blank, or non-trimmed definitionKey values: $caseName',
    async ({ mutateRow }) => {
      const schemas = await loadAssignmentDefinitionPartialsSchemas();
      const assignmentDefinitionPartialsResponseSchema = asParserSchema(
        schemas.AssignmentDefinitionPartialsResponseSchema
      );
      const malformedRow = createMutableRowFixture();
      mutateRow(malformedRow);

      expect(() => assignmentDefinitionPartialsResponseSchema.parse([malformedRow])).toThrow();
    }
  );

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
    expect(() => deleteRequestSchema.parse({ definitionKey: 'algebra\u{7}baseline' })).toThrow();
  });

  it('DeleteAssignmentDefinitionResponseSchema accepts only an omitted/undefined backend success payload', async () => {
    const schemas = await loadAssignmentDefinitionPartialsSchemas();
    const deleteResponseSchema = asParserSchema(schemas.DeleteAssignmentDefinitionResponseSchema);

    expect(deleteResponseSchema.parse(omittedBackendSuccessPayload)).toBeUndefined();
    expect(() => deleteResponseSchema.parse({ deleted: true })).toThrow();
  });
});
