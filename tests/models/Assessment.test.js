import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Assessment } from '../../src/backend/Models/Assessment.js';

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

    it('should create an Assessment with undefined score', () => {
      const assessment = new Assessment(undefined, 'test');
      expect(assessment.score).toBeUndefined();
      expect(assessment.reasoning).toBe('test');
    });

    it('should create an Assessment with null reasoning', () => {
      const assessment = new Assessment(2, null);
      expect(assessment.score).toBe(2);
      expect(assessment.reasoning).toBeNull();
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

    it('should serialize Assessment with undefined values', () => {
      const assessment = new Assessment(undefined, undefined);
      const json = assessment.toJSON();

      expect(json).toEqual({
        score: undefined,
        reasoning: undefined,
      });
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

    it('should deserialize with missing reasoning field', () => {
      const json = { score: 2 };
      const assessment = Assessment.fromJSON(json);

      expect(assessment).toBeInstanceOf(Assessment);
      expect(assessment.score).toBe(2);
      expect(assessment.reasoning).toBeUndefined();
    });

    it('should deserialize with missing score field', () => {
      const json = { reasoning: 'test reasoning' };
      const assessment = Assessment.fromJSON(json);

      expect(assessment).toBeInstanceOf(Assessment);
      expect(assessment.score).toBeUndefined();
      expect(assessment.reasoning).toBe('test reasoning');
    });

    it('should deserialize with null values', () => {
      const json = { score: null, reasoning: null };
      const assessment = Assessment.fromJSON(json);

      expect(assessment).toBeInstanceOf(Assessment);
      expect(assessment.score).toBeNull();
      expect(assessment.reasoning).toBeNull();
    });
  });

  describe('round-trip serialization', () => {
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
    it('should create Assessment with negative score', () => {
      const assessment = new Assessment(-1, 'Invalid but allowed');
      expect(assessment.score).toBe(-1);
      expect(assessment.reasoning).toBe('Invalid but allowed');
    });

    it('should create Assessment with score greater than 5', () => {
      const assessment = new Assessment(10, 'Above maximum');
      expect(assessment.score).toBe(10);
      expect(assessment.reasoning).toBe('Above maximum');
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

    it('should handle fromJSON with empty object', () => {
      const json = {};
      const assessment = Assessment.fromJSON(json);

      expect(assessment).toBeInstanceOf(Assessment);
      expect(assessment.score).toBeUndefined();
      expect(assessment.reasoning).toBeUndefined();
    });
  });
});
