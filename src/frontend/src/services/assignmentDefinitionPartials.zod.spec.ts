import { describe, expect, it } from 'vitest';

type AssignmentDefinitionPartialFixture = {
  primaryTitle: string;
  primaryTopicKey: string;
  primaryTopic: string;
  yearGroupKey: string;
  yearGroupLabel: string;
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
  primaryTopicKey: 'topic-algebra',
  primaryTopic: 'Algebra',
  yearGroupKey: 'year-group-10',
  yearGroupLabel: 'Year 10',
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

// Backend contract: ISO_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})(Z|([+-])(\d{2}):(\d{2}))$/u
// Valid: YYYY-MM-DDTHH:mm:ss.SSSZ or YYYY-MM-DDTHH:mm:ss.SSS±HH:MM

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
    expect(() => deleteRequestSchema.parse({ definitionKey: 'algebra\u0007baseline' })).toThrow();
  });

  it('DeleteAssignmentDefinitionResponseSchema accepts only an omitted/undefined backend success payload', async () => {
    const schemas = await loadAssignmentDefinitionPartialsSchemas();
    const deleteResponseSchema = asParserSchema(schemas.DeleteAssignmentDefinitionResponseSchema);

    expect(deleteResponseSchema.parse(omittedBackendSuccessPayload)).toBeUndefined();
    expect(() => deleteResponseSchema.parse({ deleted: true })).toThrow();
  });

  describe('backend contract consistency for timestamps', () => {
    it.each([
      // Valid backend strict pattern: YYYY-MM-DDTHH:mm:ss.SSSZ
      { caseName: 'strict pattern with Z timezone', timestamp: '2026-01-05T10:00:00.000Z' },
      // Valid backend strict pattern: YYYY-MM-DDTHH:mm:ss.SSS±HH:MM
      {
        caseName: 'strict pattern with positive offset',
        timestamp: '2026-01-05T10:00:00.000+11:00',
      },
      {
        caseName: 'strict pattern with negative offset',
        timestamp: '2026-01-05T10:00:00.000-05:00',
      },
      { caseName: 'strict pattern with zero offset', timestamp: '2026-01-05T10:00:00.000+00:00' },
    ])('accepts valid strict backend pattern timestamp: $caseName', async ({ timestamp }) => {
      const schemas = await loadAssignmentDefinitionPartialsSchemas();
      const assignmentDefinitionPartialSchema = asParserSchema(
        schemas.AssignmentDefinitionPartialSchema
      );

      expect(
        assignmentDefinitionPartialSchema.parse({
          ...validAssignmentDefinitionPartialRow,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
      ).toEqual({
        ...validAssignmentDefinitionPartialRow,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    });

    it.each([
      // These do NOT match backend strict pattern
      { caseName: 'missing milliseconds', timestamp: '2026-01-05T10:00:00Z' },
      { caseName: 'missing timezone', timestamp: '2026-01-05T10:00:00.000' },
      { caseName: 'too many decimal places', timestamp: '2026-01-05T10:00:00.123456Z' },
      { caseName: 'space instead of T', timestamp: '2026-01-05 10:00:00.000Z' },
      { caseName: 'missing seconds', timestamp: '2026-01-05T10:00.000Z' },
      { caseName: 'single digit month', timestamp: '2026-1-05T10:00:00.000Z' },
      { caseName: 'offset without colon', timestamp: '2026-01-05T10:00:00.000+1100' },
      { caseName: 'offset with minutes only', timestamp: '2026-01-05T10:00:00.000+11' },
      { caseName: '24-hour format', timestamp: '2026-01-05T24:00:00.000Z' },
      { caseName: '60 seconds', timestamp: '2026-01-05T10:00:60.000Z' },
    ])(
      'rejects timestamp not matching strict backend pattern: $caseName',
      async ({ timestamp }) => {
        const schemas = await loadAssignmentDefinitionPartialsSchemas();
        const assignmentDefinitionPartialSchema = asParserSchema(
          schemas.AssignmentDefinitionPartialSchema
        );

        expect(() =>
          assignmentDefinitionPartialSchema.parse({
            ...validAssignmentDefinitionPartialRow,
            createdAt: timestamp,
          })
        ).toThrow();
      }
    );

    it('accepts null timestamps for createdAt and updatedAt', async () => {
      const schemas = await loadAssignmentDefinitionPartialsSchemas();
      const assignmentDefinitionPartialSchema = asParserSchema(
        schemas.AssignmentDefinitionPartialSchema
      );

      expect(
        assignmentDefinitionPartialSchema.parse({
          ...validAssignmentDefinitionPartialRow,
          createdAt: null,
          updatedAt: null,
        })
      ).toEqual({
        ...validAssignmentDefinitionPartialRow,
        createdAt: null,
        updatedAt: null,
      });
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

  describe('timezone offset edge cases', () => {
    it.each([
      {
        caseName: 'maximum valid positive offset (+23:59)',
        timestamp: '2026-01-05T10:00:00.000+23:59',
        shouldPass: true,
      },
      {
        caseName: 'minimum valid negative offset (-23:59)',
        timestamp: '2026-01-05T10:00:00.000-23:59',
        shouldPass: true,
      },
      {
        caseName: 'exceeds maximum positive offset (+24:00)',
        timestamp: '2026-01-05T10:00:00.000+24:00',
        shouldPass: false,
      },
      {
        caseName: 'exceeds maximum negative offset (-24:00)',
        timestamp: '2026-01-05T10:00:00.000-24:00',
        shouldPass: false,
      },
    ])('validates timezone offset: $caseName', async ({ timestamp, shouldPass }) => {
      const schemas = await loadAssignmentDefinitionPartialsSchemas();
      const assignmentDefinitionPartialSchema = asParserSchema(
        schemas.AssignmentDefinitionPartialSchema
      );

      if (shouldPass) {
        expect(
          assignmentDefinitionPartialSchema.parse({
            ...validAssignmentDefinitionPartialRow,
            createdAt: timestamp,
            updatedAt: timestamp,
          })
        ).toEqual({
          ...validAssignmentDefinitionPartialRow,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      } else {
        expect(() =>
          assignmentDefinitionPartialSchema.parse({
            ...validAssignmentDefinitionPartialRow,
            createdAt: timestamp,
          })
        ).toThrow();
      }
    });
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
