import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Assessment } from '#backend/Models/Assessment.js';

describe('Assessment', () => {
  beforeEach(() => {
    // Ensure Assessment is loaded fresh
    delete require.cache[require.resolve('../../src/backend/Models/Assessment.js')];
  });

  afterEach(() => {
    delete require.cache[require.resolve('../../src/backend/Models/Assessment.js')];
  });

  describe('constructor', () => {
    it('should create an Assessment with score and reasoning', () => {
      const assessment = new Assessment(4, 'This is well done');
      expect(assessment.score).toBe(4);
      expect(assessment.reasoning).toBe('This is well done');
    });

    it('should create an Assessment with score of 0', () => {
      const assessment = new Assessment(0, 'Needs improvement');
      expect(assessment.score).toBe(0);
      expect(assessment.reasoning).toBe('Needs improvement');
    });

    it('should create an Assessment with score of 5', () => {
      const assessment = new Assessment(5, 'Perfect work');
      expect(assessment.score).toBe(5);
      expect(assessment.reasoning).toBe('Perfect work');
    });

    it('should create an Assessment with empty reasoning', () => {
      const assessment = new Assessment(3, '');
      expect(assessment.score).toBe(3);
      expect(assessment.reasoning).toBe('');
    });

    it.each([
      ['acquisition', 'PARSE_FAILED'],
      [undefined, 'test'],
      [2, null],
    ])('rejects invalid constructor values %j', (score, reasoning) => {
      expect(() => new Assessment(score, reasoning)).toThrow();
    });
  });

  describe('toJSON', () => {
    it('should serialize Assessment to JSON object', () => {
      const assessment = new Assessment(4, 'This is well done');
      const json = assessment.toJSON();

      expect(json).toEqual({
        score: 4,
        reasoning: 'This is well done',
      });
    });

    it('should serialize Assessment with score of 0', () => {
      const assessment = new Assessment(0, 'Needs improvement');
      const json = assessment.toJSON();

      expect(json).toEqual({
        score: 0,
        reasoning: 'Needs improvement',
      });
    });

    it('should serialize Assessment with empty reasoning', () => {
      const assessment = new Assessment(3, '');
      const json = assessment.toJSON();

      expect(json).toEqual({
        score: 3,
        reasoning: '',
      });
    });

    it('rejects invalid serialized values', () => {
      expect(() => new Assessment(undefined, undefined).toJSON()).toThrow();
    });
  });

  describe('fromJSON', () => {
    it('should deserialize JSON object to Assessment instance', () => {
      const json = { score: 4, reasoning: 'This is well done' };
      const assessment = Assessment.fromJSON(json);

      expect(assessment).toBeInstanceOf(Assessment);
      expect(assessment.score).toBe(4);
      expect(assessment.reasoning).toBe('This is well done');
    });

    it('should deserialize with score of 0', () => {
      const json = { score: 0, reasoning: 'Needs improvement' };
      const assessment = Assessment.fromJSON(json);

      expect(assessment).toBeInstanceOf(Assessment);
      expect(assessment.score).toBe(0);
      expect(assessment.reasoning).toBe('Needs improvement');
    });

    it('should deserialize with score of 5', () => {
      const json = { score: 5, reasoning: 'Perfect' };
      const assessment = Assessment.fromJSON(json);

      expect(assessment).toBeInstanceOf(Assessment);
      expect(assessment.score).toBe(5);
      expect(assessment.reasoning).toBe('Perfect');
    });

    it('should deserialize with empty reasoning', () => {
      const json = { score: 3, reasoning: '' };
      const assessment = Assessment.fromJSON(json);

      expect(assessment).toBeInstanceOf(Assessment);
      expect(assessment.score).toBe(3);
      expect(assessment.reasoning).toBe('');
    });

    it.each([{ score: 2 }, { reasoning: 'test reasoning' }, { score: null, reasoning: null }, {}])(
      'rejects incomplete or null JSON %j',
      (json) => expect(() => Assessment.fromJSON(json)).toThrow()
    );
  });

  describe('round-trip serialization', () => {
    it.each([0.25, 2.75, 5])('round-trips finite fractional score %s', (score) => {
      const assessment = new Assessment(score, ' Preserved reasoning ');
      expect(Assessment.fromJSON(assessment.toJSON())).toMatchObject({
        score,
        reasoning: ' Preserved reasoning ',
      });
    });

    it('should preserve data through toJSON/fromJSON round-trip', () => {
      const original = new Assessment(4, 'This is well done');
      const json = original.toJSON();
      const restored = Assessment.fromJSON(json);

      expect(restored).toBeInstanceOf(Assessment);
      expect(restored.score).toBe(original.score);
      expect(restored.reasoning).toBe(original.reasoning);
      expect(restored).not.toBe(original);
    });

    it('should preserve score of 0 through round-trip', () => {
      const original = new Assessment(0, 'Needs improvement');
      const json = original.toJSON();
      const restored = Assessment.fromJSON(json);

      expect(restored.score).toBe(0);
      expect(restored.reasoning).toBe('Needs improvement');
    });

    it('should preserve score of 5 through round-trip', () => {
      const original = new Assessment(5, 'Perfect work');
      const json = original.toJSON();
      const restored = Assessment.fromJSON(json);

      expect(restored.score).toBe(5);
      expect(restored.reasoning).toBe('Perfect work');
    });

    it('should preserve empty reasoning through round-trip', () => {
      const original = new Assessment(3, '');
      const json = original.toJSON();
      const restored = Assessment.fromJSON(json);

      expect(restored.score).toBe(3);
      expect(restored.reasoning).toBe('');
    });

    it.each([0, 2.75, 5, 'N'])('round-trips valid result score %s', (score) => {
      const assessment = new Assessment(score, ' Preserved reasoning ');
      expect(Assessment.fromJSON(assessment.toJSON())).toMatchObject({
        score,
        reasoning: ' Preserved reasoning ',
      });
    });

    it('round-trips an error result with its cause', () => {
      const error = { stage: 'extraction', code: 'PARSE_FAILED' };
      const assessment = new Assessment(
        'E',
        'The submitted work could not be parsed for this task.',
        error
      );
      expect(Assessment.fromJSON(assessment.toJSON())).toMatchObject({
        score: 'E',
        reasoning: 'The submitted work could not be parsed for this task.',
        error,
      });
    });

    it('should handle multiple round-trips', () => {
      const original = new Assessment(4, 'Well done');
      let current = original;

      for (let i = 0; i < 5; i++) {
        const json = current.toJSON();
        current = Assessment.fromJSON(json);
        expect(current.score).toBe(4);
        expect(current.reasoning).toBe('Well done');
      }
    });
  });

  describe('edge cases and validation', () => {
    it.each([NaN, Infinity, -Infinity, -0.01, 5.01, '4', null, undefined])(
      'rejects invalid score %s',
      (score) => expect(() => Assessment.fromJSON({ score, reasoning: 'Reason' })).toThrow()
    );

    it.each(['', '   ', '\t\n', undefined])('rejects E with blank reasoning %j', (reasoning) =>
      expect(() =>
        Assessment.fromJSON({
          score: 'E',
          reasoning,
          error: { stage: 'assessment', code: 'LLM_UNAVAILABLE' },
        })
      ).toThrow()
    );

    it('requires reasoning for E and preserves nonblank whitespace', () => {
      const assessment = Assessment.fromJSON({
        score: 'E',
        reasoning: '  unavailable  ',
        error: { stage: 'assessment', code: 'LLM_UNAVAILABLE' },
      });
      expect(assessment.reasoning).toBe('  unavailable  ');
    });

    it.each([
      ['acquisition', 'PARSE_FAILED'],
      ['extraction', 'SOURCE_UNREADABLE'],
      ['assessment', 'CORRUPT_RECORD'],
      ['validation', 'LLM_HTTP_FAILED'],
      ['other', 'LLM_UNAVAILABLE'],
      ['assessment', 'UNKNOWN'],
    ])('rejects invalid error cause pair %s/%s', (stage, code) => {
      expect(() =>
        Assessment.fromJSON({ score: 'E', reasoning: 'Failure', error: { stage, code } })
      ).toThrow();
    });

    it.each([
      undefined,
      null,
      {},
      { stage: 'assessment' },
      { stage: 'assessment', code: null },
      { stage: 'assessment', code: '' },
      { stage: 42, code: 'LLM_UNAVAILABLE' },
    ])('rejects malformed E cause %j', (error) => {
      expect(() => Assessment.fromJSON({ score: 'E', reasoning: 'Failure', error })).toThrow();
    });

    it.each([undefined, null, 42])('rejects malformed E reasoning %j', (reasoning) => {
      expect(() =>
        Assessment.fromJSON({
          score: 'E',
          reasoning,
          error: { stage: 'assessment', code: 'LLM_UNAVAILABLE' },
        })
      ).toThrow();
    });

    it('rejects error metadata on numeric and N results', () => {
      for (const score of [0, 2.5, 5, 'N']) {
        expect(() =>
          Assessment.fromJSON({
            score,
            reasoning: 'Reason',
            error: { stage: 'assessment', code: 'LLM_UNAVAILABLE' },
          })
        ).toThrow();
      }
    });

    it.each([
      { score: 'E', reasoning: 'Failure' },
      { score: 'E', reasoning: 'Failure', error: null },
      { score: 'E', reasoning: 'Failure', error: {} },
      { score: 'E', reasoning: 'Failure', error: { stage: 'assessment' } },
      { score: 'E', reasoning: undefined, error: { stage: 'assessment', code: 'LLM_UNAVAILABLE' } },
      { score: 'E', reasoning: null, error: { stage: 'assessment', code: 'LLM_UNAVAILABLE' } },
      { score: 'E', reasoning: 42, error: { stage: 'assessment', code: 'LLM_UNAVAILABLE' } },
      { score: 2, reasoning: 'Reason', error: { stage: 'assessment', code: 'LLM_UNAVAILABLE' } },
      {
        score: 'N',
        reasoning: 'Not attempted',
        error: { stage: 'assessment', code: 'LLM_UNAVAILABLE' },
      },
    ])('rejects malformed public constructor input %j', (input) => {
      expect(() => new Assessment(input.score, input.reasoning, input.error)).toThrow();
    });

    it('creates each catalogue error with its canonical reasoning', () => {
      const cases = [
        ['acquisition', 'SOURCE_UNREADABLE', 'The submitted document could not be accessed.'],
        [
          'acquisition',
          'UNSUPPORTED_DOCUMENT',
          'The submitted attachment is not a supported document for this assignment.',
        ],
        [
          'extraction',
          'SOURCE_CONTENT_UNAVAILABLE',
          'No source content could be extracted for this task.',
        ],
        ['extraction', 'PARSE_FAILED', 'The submitted work could not be parsed for this task.'],
        ['extraction', 'IMAGE_HYDRATION_FAILED', 'The submitted slide image could not be loaded.'],
        ['assessment', 'LLM_HTTP_FAILED', 'The assessment service rejected the request.'],
        [
          'assessment',
          'LLM_UNAVAILABLE',
          'The assessment service could not complete the request after retries.',
        ],
        [
          'assessment',
          'LLM_INVALID_RESPONSE',
          'The assessment service returned an invalid result.',
        ],
        [
          'assessment',
          'LLM_RUN_STOPPED',
          'Assessment stopped because the service credentials or endpoint were rejected.',
        ],
        ['assessment', 'ASSESSMENT_FAILED', 'The extracted work could not be assessed.'],
        [
          'validation',
          'CORRUPT_RECORD',
          'The stored assessment data for this task is invalid. Reassess the assignment.',
        ],
        ['validation', 'REASSESSMENT_REQUIRED', 'Reassessment required'],
      ];
      for (const [stage, code, reasoning] of cases) {
        expect(Assessment.createError(stage, code)).toMatchObject({
          score: 'E',
          reasoning,
          error: { stage, code },
        });
      }
    });

    it.each([
      ['acquisition', 'PARSE_FAILED'],
      ['other', 'UNKNOWN'],
    ])('rejects invalid error creator pair %s/%s', (stage, code) =>
      expect(() => Assessment.createError(stage, code)).toThrow()
    );

    it.each([-1, 10])('rejects out-of-range constructor score %s', (score) => {
      expect(() => new Assessment(score, 'Invalid')).toThrow();
    });

    it('should create Assessment with floating point score', () => {
      const assessment = new Assessment(4.5, 'Half mark');
      expect(assessment.score).toBe(4.5);
      expect(assessment.reasoning).toBe('Half mark');
    });

    it('should serialize and deserialize floating point score', () => {
      const original = new Assessment(4.5, 'Half mark');
      const json = original.toJSON();
      const restored = Assessment.fromJSON(json);

      expect(restored.score).toBe(4.5);
      expect(restored.reasoning).toBe('Half mark');
    });

    it('should create Assessment with very long reasoning', () => {
      const longReasoning = 'a'.repeat(10000);
      const assessment = new Assessment(4, longReasoning);
      expect(assessment.reasoning).toBe(longReasoning);
      expect(assessment.reasoning.length).toBe(10000);
    });

    it('should serialize and deserialize Assessment with very long reasoning', () => {
      const longReasoning = 'b'.repeat(5000);
      const original = new Assessment(3, longReasoning);
      const json = original.toJSON();
      const restored = Assessment.fromJSON(json);

      expect(restored.reasoning).toBe(longReasoning);
      expect(restored.reasoning.length).toBe(5000);
    });

    it('should handle special characters in reasoning', () => {
      const specialReasoning = 'Test with \n newlines \t tabs and "quotes"';
      const assessment = new Assessment(2, specialReasoning);
      const json = assessment.toJSON();
      const restored = Assessment.fromJSON(json);

      expect(restored.reasoning).toBe(specialReasoning);
    });

    it('should handle unicode in reasoning', () => {
      const unicodeReasoning = 'Excellent work! 🎉 📝';
      const assessment = new Assessment(5, unicodeReasoning);
      const json = assessment.toJSON();
      const restored = Assessment.fromJSON(json);

      expect(restored.reasoning).toBe(unicodeReasoning);
    });

    it('should handle fromJSON with extra fields (ignores them)', () => {
      const json = { score: 4, reasoning: 'Good', extraField: 'ignored', another: 'also ignored' };
      const assessment = Assessment.fromJSON(json);

      expect(assessment.score).toBe(4);
      expect(assessment.reasoning).toBe('Good');
      expect(assessment.extraField).toBeUndefined();
    });
  });
});
