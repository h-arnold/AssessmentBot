/**
 * Timestamp validation tests for assignmentDefinitionPartials.zod.
 */

import { describe, expect, it } from 'vitest';
import {
  validAssignmentDefinitionPartialRow,
  loadAssignmentDefinitionPartialsSchemas,
  asParserSchema,
} from './fixtures';

describe('timestamp validation', () => {
  it.each([
    {
      caseName: 'createdAt is missing',
      mutateRow: (row: Record<string, unknown>) => {
        delete row.createdAt;
      },
    },
    {
      caseName: 'updatedAt is missing',
      mutateRow: (row: Record<string, unknown>) => {
        delete row.updatedAt;
      },
    },
    {
      caseName: 'createdAt is not an ISO string',
      mutateRow: (row: Record<string, unknown>) => {
        row.createdAt = 'not-an-iso-date';
      },
    },
    {
      caseName: 'updatedAt is not an ISO string',
      mutateRow: (row: Record<string, unknown>) => {
        row.updatedAt = 'not-an-iso-date';
      },
    },
    {
      caseName: 'createdAt is a non-existent calendar date',
      mutateRow: (row: Record<string, unknown>) => {
        row.createdAt = '2026-02-30T00:00:00.000Z';
      },
    },
  ])('rejects invalid or missing timestamp fields: $caseName', async ({ mutateRow }) => {
    const schemas = await loadAssignmentDefinitionPartialsSchemas();
    const assignmentDefinitionPartialsResponseSchema = asParserSchema(
      schemas.AssignmentDefinitionPartialsResponseSchema
    );
    const malformedRow = { ...validAssignmentDefinitionPartialRow } as Record<string, unknown>;
    mutateRow(malformedRow);

    expect(() => assignmentDefinitionPartialsResponseSchema.parse([malformedRow])).toThrow();
  });

  describe('backend contract consistency for timestamps', () => {
    it.each([
      // Valid backend strict pattern: YYYY-MM-DDTHH:mm:ss.SSSZ
      { caseName: 'strict pattern with Z timezone', timestamp: '2026-01-05T10:00:00.000Z' },
      // Valid backend strict pattern: YYYY-MM-DDTHH:mm:ss.SSS+HH:MM
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
});
