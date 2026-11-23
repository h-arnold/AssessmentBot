import { describe, expect, it } from 'vitest';
import {
  asParserSchema,
  loadAssignmentDefinitionPartialsSchemas,
  validAssignmentDefinitionPartialRow,
} from '@/test/assignmentDefinition/assignmentDefinitionTestFixtures';

// Backend contract: ISO_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})(Z|([+-])(\d{2}):(\d{2}))$/u
// Valid: YYYY-MM-DDTHH:mm:ss.SSSZ or YYYY-MM-DDTHH:mm:ss.SSS±HH:MM

describe('assignmentDefinitionPartials.zod schemas', () => {
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

        expect(() => {
          return assignmentDefinitionPartialSchema.parse({
            ...validAssignmentDefinitionPartialRow,
            createdAt: timestamp,
          });
        }).toThrow();
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

      expect(() => {
        return assignmentDefinitionPartialSchema.parse({
          ...validAssignmentDefinitionPartialRow,
          assignmentWeighting: 'five',
        });
      }).toThrow();
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
        expect(() => {
          return assignmentDefinitionPartialSchema.parse({
            ...validAssignmentDefinitionPartialRow,
            createdAt: timestamp,
          });
        }).toThrow();
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
      expect(() => {
        return assignmentDefinitionPartialSchema.parse({
          ...validAssignmentDefinitionPartialRow,
          createdAt: '2026-01-05T10:00:00Z',
        });
      }).toThrow();
    });
  });
});
