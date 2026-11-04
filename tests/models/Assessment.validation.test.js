import { describe, expect, it } from 'vitest';
import { Assessment } from '#backend/Models/Assessment.js';

const malformedCauses = [
  null,
  [],
  { stage: ['assessment'], code: ['LLM_UNAVAILABLE'] },
  { stage: {}, code: 'LLM_UNAVAILABLE' },
  { stage: 'assessment', code: {} },
  { stage: 'assessment', code: 'LLM_UNAVAILABLE', detail: 'unexpected' },
];

describe('Assessment error cause validation', () => {
  it.each(malformedCauses)('returns false for malformed cause %j', (cause) => {
    expect(Assessment.isValidCause(cause)).toBe(false);
  });

  it.each(malformedCauses)('rejects malformed cause in constructor %j', (cause) => {
    expect(() => new Assessment('E', 'Failure', cause)).toThrow('Invalid assessment result');
  });

  it.each(malformedCauses)('rejects malformed cause from JSON %j', (error) => {
    expect(() => Assessment.fromJSON({ score: 'E', reasoning: 'Failure', error })).toThrow(
      'Invalid assessment result'
    );
  });

  it('accepts catalogue causes and preserves their reasoning', () => {
    const cause = { stage: 'assessment', code: 'LLM_UNAVAILABLE' };
    expect(Assessment.isValidCause(cause)).toBe(true);
    expect(new Assessment('E', '  verbatim  ', cause).reasoning).toBe('  verbatim  ');
  });

  it('creates catalogue failures and rejects unknown error codes', () => {
    const failure = Assessment.createError('extraction', 'PARSE_FAILED');
    expect(failure.toJSON()).toEqual({
      score: 'E',
      reasoning: 'The submitted work could not be parsed for this task.',
      error: { stage: 'extraction', code: 'PARSE_FAILED' },
    });
    expect(() => Assessment.createError('extraction', 'UNKNOWN')).toThrow(
      'Invalid assessment error: extraction/UNKNOWN'
    );
    expect(() => Assessment.createError('unknown', 'UNKNOWN')).toThrow(
      'Invalid assessment error: unknown/UNKNOWN'
    );
  });

  it('rejects inherited stage and code with unrelated own properties', () => {
    const cause = Object.assign(Object.create({ stage: 'assessment', code: 'LLM_UNAVAILABLE' }), {
      unexpectedA: true,
      unexpectedB: true,
    });

    expect(Assessment.isValidCause(cause)).toBe(false);
    expect(() => new Assessment('E', 'Failure', cause)).toThrow('Invalid assessment result');
    expect(() => Assessment.fromJSON({ score: 'E', reasoning: 'Failure', error: cause })).toThrow(
      'Invalid assessment result'
    );
  });
});
