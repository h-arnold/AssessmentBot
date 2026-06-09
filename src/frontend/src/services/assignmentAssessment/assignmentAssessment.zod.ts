import { z } from 'zod';

export const StartAssessmentRunRequestSchema = z
  .object({
    definitionKey: z.string(),
    assignmentId: z.string(),
    courseId: z.string(),
  })
  .strict();

export type StartAssessmentRunRequest = z.infer<typeof StartAssessmentRunRequestSchema>;

export const StartAssessmentRunResponseSchema = z.void().nullable();

export type StartAssessmentRunResponse = z.infer<typeof StartAssessmentRunResponseSchema>;
