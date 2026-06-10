import { describe, expect, it } from 'vitest';
import {
  StartAssessmentRunRequestSchema,
  StartAssessmentRunResponseSchema,
} from './assignmentAssessment.zod';

const validStartAssessmentRunRequest = {
  definitionKey: 'algebra-baseline',
  assignmentId: 'assign-123',
  courseId: 'course-456',
};

describe('assignmentAssessment.zod schemas', () => {
  describe('StartAssessmentRunRequestSchema', () => {
    it('accepts a valid request with definitionKey, assignmentId, and courseId', () => {
      expect(StartAssessmentRunRequestSchema.parse(validStartAssessmentRunRequest)).toEqual(
        validStartAssessmentRunRequest
      );
    });

    it('rejects a request with missing definitionKey', () => {
      expect(() =>
        StartAssessmentRunRequestSchema.parse({
          assignmentId: 'assign-123',
          courseId: 'course-456',
        })
      ).toThrow();
    });

    it('rejects a request with non-string assignmentId', () => {
      expect(() =>
        StartAssessmentRunRequestSchema.parse({
          definitionKey: 'algebra-baseline',
          assignmentId: 123,
          courseId: 'course-456',
        })
      ).toThrow();
    });
  });

  describe('StartAssessmentRunResponseSchema', () => {
    it('accepts null data', () => {
      expect(StartAssessmentRunResponseSchema.parse(null)).toBeNull();
    });

    it('rejects non-null data', () => {
      expect(() => StartAssessmentRunResponseSchema.parse({ success: true })).toThrow();
      expect(() => StartAssessmentRunResponseSchema.parse('string')).toThrow();
      // eslint-disable-next-line @typescript-eslint/no-magic-numbers
      expect(() => StartAssessmentRunResponseSchema.parse(42)).toThrow();
    });
  });
});
