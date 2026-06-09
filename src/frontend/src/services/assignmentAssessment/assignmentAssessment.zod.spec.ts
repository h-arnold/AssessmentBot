import { describe, expect, it } from 'vitest';

/**
 * Loads the assignment-assessment schema module under test.
 *
 * @returns {Promise<Record<string, unknown>>} The imported schema module.
 */
async function loadAssignmentAssessmentSchemas(): Promise<Record<string, unknown>> {
  return import('./assignmentAssessment.zod');
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

const NON_NULL_NUMERIC_VALUE = 42;

const validStartAssessmentRunRequest = {
  definitionKey: 'algebra-baseline',
  assignmentId: 'assign-123',
  courseId: 'course-456',
};

describe('assignmentAssessment.zod schemas', () => {
  describe('StartAssessmentRunRequestSchema', () => {
    it('accepts a valid request with definitionKey, assignmentId, and courseId', async () => {
      const schemas = await loadAssignmentAssessmentSchemas();
      const requestSchema = asParserSchema(schemas.StartAssessmentRunRequestSchema);

      expect(requestSchema.parse(validStartAssessmentRunRequest)).toEqual(
        validStartAssessmentRunRequest
      );
    });

    it('rejects a request with missing definitionKey', async () => {
      const schemas = await loadAssignmentAssessmentSchemas();
      const requestSchema = asParserSchema(schemas.StartAssessmentRunRequestSchema);

      expect(() =>
        requestSchema.parse({
          assignmentId: 'assign-123',
          courseId: 'course-456',
        })
      ).toThrow();
    });

    it('rejects a request with non-string assignmentId', async () => {
      const schemas = await loadAssignmentAssessmentSchemas();
      const requestSchema = asParserSchema(schemas.StartAssessmentRunRequestSchema);

      expect(() =>
        requestSchema.parse({
          definitionKey: 'algebra-baseline',
          assignmentId: 123,
          courseId: 'course-456',
        })
      ).toThrow();
    });
  });

  describe('StartAssessmentRunResponseSchema', () => {
    it('accepts null data', async () => {
      const schemas = await loadAssignmentAssessmentSchemas();
      const responseSchema = asParserSchema(schemas.StartAssessmentRunResponseSchema);

      expect(responseSchema.parse(null)).toBeNull();
    });

    it('rejects non-null data', async () => {
      const schemas = await loadAssignmentAssessmentSchemas();
      const responseSchema = asParserSchema(schemas.StartAssessmentRunResponseSchema);

      expect(() => responseSchema.parse({ success: true })).toThrow();
      expect(() => responseSchema.parse('string')).toThrow();
      expect(() => responseSchema.parse(NON_NULL_NUMERIC_VALUE)).toThrow();
    });
  });
});
