import { describe, expect, it } from 'vitest';
import {
  assessmentResultSchema,
  assessmentCauseSchema,
  partialAssessmentResultSchema,
} from './assessmentResult.zod';

describe('assessment result schemas', () => {
  it.each([{ score: 0 }, { score: 0.25 }, { score: 2.5 }, { score: 5 }])(
    'accepts valid score $score',
    ({ score }) => {
      expect(assessmentResultSchema.parse({ score, reasoning: 'Reason' })).toEqual({
        score,
        reasoning: 'Reason',
      });
    }
  );
  it.each([
    { score: -0.01 },
    { score: 5.01 },
    { score: NaN },
    { score: Infinity },
    { score: -Infinity },
    { score: '4' },
    { score: null },
  ])('rejects full result score $score', ({ score }) => {
    expect(assessmentResultSchema.safeParse({ score, reasoning: 'Reason' }).success).toBe(false);
  });

  it('accepts N and structured E with a cause', () => {
    expect(assessmentResultSchema.parse({ score: 'N', reasoning: 'Not attempted' })).toEqual({
      score: 'N',
      reasoning: 'Not attempted',
    });
    expect(
      assessmentResultSchema.safeParse({
        score: 'E',
        reasoning: 'Unavailable',
        error: { stage: 'assessment', code: 'ASSESSMENT_FAILED' },
      })
    ).toMatchObject({
      success: true,
      data: {
        score: 'E',
        reasoning: 'Unavailable',
        error: { stage: 'assessment', code: 'ASSESSMENT_FAILED' },
      },
    });
  });

  it('rejects invalid scores and malformed causes', () => {
    expect(assessmentResultSchema.safeParse({ score: 6, reasoning: 'Invalid' }).success).toBe(
      false
    );
    expect(assessmentCauseSchema.safeParse({ stage: 'unknown', code: 'UNKNOWN' }).success).toBe(
      false
    );
  });

  it('accepts every catalogue cause and rejects whitespace-only E reasoning', () => {
    const causes = [
      ['acquisition', 'SOURCE_UNREADABLE'],
      ['acquisition', 'UNSUPPORTED_DOCUMENT'],
      ['extraction', 'SOURCE_CONTENT_UNAVAILABLE'],
      ['extraction', 'PARSE_FAILED'],
      ['extraction', 'IMAGE_HYDRATION_FAILED'],
      ['assessment', 'LLM_HTTP_FAILED'],
      ['assessment', 'LLM_UNAVAILABLE'],
      ['assessment', 'LLM_INVALID_RESPONSE'],
      ['assessment', 'LLM_RUN_STOPPED'],
      ['assessment', 'ASSESSMENT_FAILED'],
      ['validation', 'CORRUPT_RECORD'],
      ['validation', 'REASSESSMENT_REQUIRED'],
    ] as const;
    for (const [stage, code] of causes) {
      expect(assessmentCauseSchema.safeParse({ stage, code }).success).toBe(true);
    }
    expect(
      assessmentResultSchema.safeParse({
        score: 'E',
        reasoning: '  ',
        error: { stage: 'validation', code: 'CORRUPT_RECORD' },
      }).success
    ).toBe(false);
    expect(
      assessmentResultSchema.safeParse({
        score: 2,
        reasoning: 'Valid',
        error: { stage: 'validation', code: 'CORRUPT_RECORD' },
      }).success
    ).toBe(false);
  });

  it.each([
    { error: { stage: 'extraction', code: 'ASSESSMENT_FAILED' } },
    { error: { stage: 'assessment', code: 'PARSE_FAILED' } },
    { error: undefined },
    { error: null },
    { error: {} },
    { error: { stage: 'assessment' } },
    { error: { stage: 'assessment', code: null } },
    { reasoning: undefined, error: { stage: 'assessment', code: 'ASSESSMENT_FAILED' } },
    { reasoning: null, error: { stage: 'assessment', code: 'ASSESSMENT_FAILED' } },
    { reasoning: 42, error: { stage: 'assessment', code: 'ASSESSMENT_FAILED' } },
    {
      score: 'N',
      reasoning: 'Not attempted',
      error: { stage: 'assessment', code: 'ASSESSMENT_FAILED' },
    },
  ])('rejects incompatible full result $error', (overrides) => {
    const value = {
      score: 'E',
      reasoning: 'Failure',
      ...overrides,
    };
    expect(assessmentResultSchema.safeParse(value).success).toBe(false);
  });

  it.each([
    { score: 2 },
    { score: 2, reasoning: null },
    { score: 2, reasoning: 42 },
    {
      score: 'N',
      reasoning: 'Not attempted',
      error: { stage: 'assessment', code: 'ASSESSMENT_FAILED' },
    },
  ])('rejects malformed full non-error result $score', (value) => {
    expect(assessmentResultSchema.safeParse(value).success).toBe(false);
  });

  it('preserves whitespace in valid full E reasoning', () => {
    const value = {
      score: 'E',
      reasoning: '  unavailable  ',
      error: { stage: 'assessment', code: 'ASSESSMENT_FAILED' },
    };
    expect(assessmentResultSchema.parse(value)).toEqual(value);
  });

  it('validates partial result projections directly', () => {
    expect(partialAssessmentResultSchema.parse({ score: 2.5 })).toEqual({ score: 2.5 });
    expect(partialAssessmentResultSchema.parse({ score: 'N' })).toEqual({ score: 'N' });
    expect(
      partialAssessmentResultSchema.parse({
        score: 'E',
        reasoning: '  failure  ',
        error: { stage: 'assessment', code: 'ASSESSMENT_FAILED' },
      })
    ).toEqual({
      score: 'E',
      reasoning: '  failure  ',
      error: { stage: 'assessment', code: 'ASSESSMENT_FAILED' },
    });
    for (const value of [
      { score: 'E', error: { stage: 'assessment', code: 'ASSESSMENT_FAILED' } },
      { score: 'E', reasoning: '  ', error: { stage: 'assessment', code: 'ASSESSMENT_FAILED' } },
      { score: 'E', reasoning: 'failure' },
      { score: 'E', reasoning: 'failure', error: { stage: 'assessment', code: 'PARSE_FAILED' } },
      { score: 2, error: { stage: 'assessment', code: 'ASSESSMENT_FAILED' } },
      {
        score: 'N',
        reasoning: 'Not attempted',
        error: { stage: 'assessment', code: 'ASSESSMENT_FAILED' },
      },
      { score: NaN },
      { score: Infinity },
      { score: -Infinity },
      { score: -0.01 },
      { score: 5.01 },
    ])
      expect(partialAssessmentResultSchema.safeParse(value).success).toBe(false);
  });
});
