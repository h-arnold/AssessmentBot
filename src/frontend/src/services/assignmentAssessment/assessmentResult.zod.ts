import { z } from 'zod';

const stageCodes = {
  acquisition: ['SOURCE_UNREADABLE', 'UNSUPPORTED_DOCUMENT'],
  extraction: ['SOURCE_CONTENT_UNAVAILABLE', 'PARSE_FAILED', 'IMAGE_HYDRATION_FAILED'],
  assessment: [
    'LLM_HTTP_FAILED',
    'LLM_UNAVAILABLE',
    'LLM_INVALID_RESPONSE',
    'LLM_RUN_STOPPED',
    'ASSESSMENT_FAILED',
  ],
  validation: ['CORRUPT_RECORD', 'REASSESSMENT_REQUIRED'],
} as const;

export const assessmentCauseSchema = z.discriminatedUnion('stage', [
  z.object({ stage: z.literal('acquisition'), code: z.enum(stageCodes.acquisition) }).strict(),
  z.object({ stage: z.literal('extraction'), code: z.enum(stageCodes.extraction) }).strict(),
  z.object({ stage: z.literal('assessment'), code: z.enum(stageCodes.assessment) }).strict(),
  z.object({ stage: z.literal('validation'), code: z.enum(stageCodes.validation) }).strict(),
]);

const MAX_SCORE = 5;
const numericScore = z.number().min(0).max(MAX_SCORE);
export const assessmentScoreSchema = z.union([numericScore, z.literal('N')]);
const errorResult = z
  .object({
    score: z.literal('E'),
    reasoning: z.string().refine((value) => value.trim().length > 0),
    error: assessmentCauseSchema,
  })
  .strict();

export const assessmentResultSchema = z.union([
  z.object({ score: assessmentScoreSchema, reasoning: z.string() }).strict(),
  errorResult,
]);

export const partialAssessmentResultSchema = z.union([
  z.object({ score: assessmentScoreSchema }).strict(),
  errorResult,
]);
