import { describe, expect, it } from 'vitest';
import {
  asParserSchema,
  loadAssignmentDefinitionSchemas,
  validFullDefinition,
} from '@/test/assignmentDefinition/assignmentDefinitionTestFixtures';

// Backend contract: ISO_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})(Z|([+-])(\d{2}):(\d{2}))$/u
// Valid: YYYY-MM-DDTHH:mm:ss.SSSZ or YYYY-MM-DDTHH:mm:ss.SSS±HH:MM

describe('assignmentDefinition.zod schemas', () => {
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
    ])('accepts timestamp: $caseName', async ({ timestamp }) => {
      const schemas = await loadAssignmentDefinitionSchemas();
      const assignmentDefinitionSchema = asParserSchema(schemas.AssignmentDefinitionSchema);

      const testDefinition = {
        ...validFullDefinition,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      // Schema now uses strict backend-aligned validation
      expect(assignmentDefinitionSchema.parse(testDefinition)).toEqual(testDefinition);
    });

    it.each([
      // These are accepted by loose Date.parse but NOT valid per backend strict pattern
      {
        caseName: 'missing milliseconds (accepted by Date.parse, NOT backend strict)',
        timestamp: '2026-01-05T10:00:00Z',
      },
      {
        caseName: 'missing timezone (accepted by Date.parse, NOT backend strict)',
        timestamp: '2026-01-05T10:00:00.000',
      },
    ])('rejects timestamp: $caseName', async ({ timestamp }) => {
      const schemas = await loadAssignmentDefinitionSchemas();
      const assignmentDefinitionSchema = asParserSchema(schemas.AssignmentDefinitionSchema);

      const testDefinition = {
        ...validFullDefinition,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      // Schema now uses strict backend-aligned validation which rejects these
      expect(() => assignmentDefinitionSchema.parse(testDefinition)).toThrow();
    });

    it.each([
      { caseName: 'invalid date string', timestamp: 'not-a-date' },
      { caseName: 'empty string', timestamp: '' },
    ])('rejects invalid timestamp: $caseName', async ({ timestamp }) => {
      const schemas = await loadAssignmentDefinitionSchemas();
      const assignmentDefinitionSchema = asParserSchema(schemas.AssignmentDefinitionSchema);

      const testDefinition = {
        ...validFullDefinition,
        createdAt: timestamp,
      };

      expect(() => assignmentDefinitionSchema.parse(testDefinition)).toThrow();
    });

    it.each([
      // These are accepted by loose Date.parse but NOT by backend strict pattern
      {
        caseName: 'date with slashes (accepted by Date.parse, NOT backend strict)',
        timestamp: '2026/01/05',
      },
      {
        caseName: 'date with space separator (accepted by Date.parse, NOT backend strict)',
        timestamp: '2026-01-05 10:00:00.000Z',
      },
    ])('rejects timestamp with loose validation: $caseName', async ({ timestamp }) => {
      const schemas = await loadAssignmentDefinitionSchemas();
      const assignmentDefinitionSchema = asParserSchema(schemas.AssignmentDefinitionSchema);

      const testDefinition = {
        ...validFullDefinition,
        createdAt: timestamp,
      };

      // Schema now uses strict backend-aligned validation which rejects these
      expect(() => assignmentDefinitionSchema.parse(testDefinition)).toThrow();
    });

    it('accepts null timestamps for createdAt and updatedAt', async () => {
      const schemas = await loadAssignmentDefinitionSchemas();
      const assignmentDefinitionSchema = asParserSchema(schemas.AssignmentDefinitionSchema);

      const testDefinition = {
        ...validFullDefinition,
        createdAt: null,
        updatedAt: null,
      };

      expect(assignmentDefinitionSchema.parse(testDefinition)).toEqual(testDefinition);
    });
  });

  describe('backend contract consistency for assignmentWeighting', () => {
    it('accepts valid numeric assignmentWeighting in AssignmentDefinitionSchema', async () => {
      const schemas = await loadAssignmentDefinitionSchemas();
      const assignmentDefinitionSchema = asParserSchema(schemas.AssignmentDefinitionSchema);

      const testDefinition = {
        ...validFullDefinition,
        assignmentWeighting: 5,
      };

      expect(assignmentDefinitionSchema.parse(testDefinition)).toEqual(testDefinition);
    });

    it('accepts null assignmentWeighting in AssignmentDefinitionSchema (aligned with backend)', async () => {
      const schemas = await loadAssignmentDefinitionSchemas();
      const assignmentDefinitionSchema = asParserSchema(schemas.AssignmentDefinitionSchema);

      const testDefinition = {
        ...validFullDefinition,
        assignmentWeighting: null,
      };

      // Schema now has nullable assignmentWeighting, aligned with backend
      expect(assignmentDefinitionSchema.parse(testDefinition)).toEqual(testDefinition);
    });

    it('accepts null assignmentWeighting in UpsertAssignmentDefinitionRequestSchema (aligned with backend)', async () => {
      const schemas = await loadAssignmentDefinitionSchemas();
      const upsertRequestSchema = asParserSchema(schemas.UpsertAssignmentDefinitionRequestSchema);

      const validInput = {
        primaryTitle: 'Algebra Baseline',
        primaryTopicKey: 'topic-algebra',
        yearGroupKey: 'year-10',
        referenceDocumentUrl: 'https://docs.google.com/presentation/d/ref-doc-id/edit',
        templateDocumentUrl: 'https://docs.google.com/presentation/d/tpl-doc-id/edit',
        assignmentWeighting: null,
      };

      // Upsert request now has assignmentWeighting.optional().nullable(), aligned with backend
      expect(upsertRequestSchema.parse(validInput)).toEqual(validInput);
    });

    it('accepts undefined assignmentWeighting in UpsertAssignmentDefinitionRequestSchema', async () => {
      const schemas = await loadAssignmentDefinitionSchemas();
      const upsertRequestSchema = asParserSchema(schemas.UpsertAssignmentDefinitionRequestSchema);

      const validInput = {
        primaryTitle: 'Algebra Baseline',
        primaryTopicKey: 'topic-algebra',
        yearGroupKey: 'year-10',
        referenceDocumentUrl: 'https://docs.google.com/presentation/d/ref-doc-id/edit',
        templateDocumentUrl: 'https://docs.google.com/presentation/d/tpl-doc-id/edit',
        // assignmentWeighting is omitted (undefined)
      };

      // Upsert request allows optional assignmentWeighting (can be undefined)
      expect(upsertRequestSchema.parse(validInput)).toEqual(validInput);
    });
  });
});
