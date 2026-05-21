import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupFeedbackModules } from '../helpers/feedbackTestHelpers.js';

/**
 * Feedback Base Class Tests
 * Tests for the base feedback class used in student task responses
 */
describe('Feedback', () => {
  let Feedback;
  let CellReferenceFeedback;

  beforeEach(() => {
    // Use shared helper to setup Feedback modules
    const modules = setupFeedbackModules();
    Feedback = modules.Feedback;
    CellReferenceFeedback = modules.CellReferenceFeedback;
  });

  afterEach(() => {
    delete globalThis.Feedback;
    delete globalThis.CellReferenceFeedback;
  });

  describe('Constructor', () => {
    it('should create instance with provided type', () => {
      const feedback = new Feedback('testType');
      expect(feedback.type).toBe('testType');
      expect(feedback.createdAt).toBeInstanceOf(Date);
    });

    it('should set createdAt to current date', () => {
      const before = new Date();
      const feedback = new Feedback('testType');
      const after = new Date();
      expect(feedback.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(feedback.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should handle different type strings', () => {
      const types = ['cellReference', 'text', 'overall', 'custom'];
      types.forEach((type) => {
        const feedback = new Feedback(type);
        expect(feedback.type).toBe(type);
      });
    });
  });

  describe('getType', () => {
    it('should return the feedback type', () => {
      const feedback = new Feedback('myType');
      expect(feedback.getType()).toBe('myType');
    });

    it('should return type set in constructor', () => {
      const expectedType = 'specificType';
      const feedback = new Feedback(expectedType);
      expect(feedback.getType()).toBe(expectedType);
    });
  });

  describe('toJSON', () => {
    it('should serialize type and createdAt', () => {
      const feedback = new Feedback('testType');
      const json = feedback.toJSON();
      expect(json.type).toBe('testType');
      expect(json.createdAt).toBeDefined();
    });

    it('should serialize createdAt as ISO string', () => {
      const feedback = new Feedback('testType');
      const json = feedback.toJSON();
      expect(typeof json.createdAt).toBe('string');
      expect(json.createdAt).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
    });

    it('should handle Date instance for createdAt', () => {
      const feedback = new Feedback('testType');
      feedback.createdAt = new Date('2024-01-15T10:30:00.000Z');
      const json = feedback.toJSON();
      expect(json.createdAt).toBe('2024-01-15T10:30:00.000Z');
    });

    it('should handle non-Date createdAt', () => {
      const feedback = new Feedback('testType');
      feedback.createdAt = '2024-01-15T10:30:00.000Z';
      const json = feedback.toJSON();
      expect(json.createdAt).toBe('2024-01-15T10:30:00.000Z');
    });

    it('should return object with expected structure', () => {
      const feedback = new Feedback('testType');
      const json = feedback.toJSON();
      expect(json).toHaveProperty('type');
      expect(json).toHaveProperty('createdAt');
      expect(Object.keys(json).sort()).toEqual(['createdAt', 'type'].sort());
    });
  });

  describe('fromJSON', () => {
    it('should deserialize cellReference type to CellReferenceFeedback', () => {
      const json = {
        type: 'cellReference',
        createdAt: '2024-01-15T10:30:00.000Z',
        items: [
          { location: [0, 0], status: 'correct' },
          { location: [1, 1], status: 'incorrect' },
        ],
      };
      const feedback = Feedback.fromJSON(json);
      expect(feedback).toBeInstanceOf(CellReferenceFeedback);
      expect(feedback.type).toBe('cellReference');
      expect(feedback.getItems()).toEqual(json.items);
    });

    it('should throw error for unknown feedback type', () => {
      const json = {
        type: 'unknownType',
        createdAt: '2024-01-15T10:30:00.000Z',
      };
      expect(() => Feedback.fromJSON(json)).toThrow('Unknown feedback type: unknownType');
    });

    it('should preserve createdAt from JSON', () => {
      const createdAt = '2024-01-15T10:30:00.000Z';
      const json = {
        type: 'cellReference',
        createdAt,
        items: [],
      };
      const feedback = Feedback.fromJSON(json);
      expect(feedback.createdAt).toBeInstanceOf(Date);
      expect(feedback.createdAt.toISOString()).toBe(createdAt);
    });

    it('should handle empty items array', () => {
      const json = {
        type: 'cellReference',
        createdAt: '2024-01-15T10:30:00.000Z',
        items: [],
      };
      const feedback = Feedback.fromJSON(json);
      expect(feedback).toBeInstanceOf(CellReferenceFeedback);
      expect(feedback.getItems()).toEqual([]);
    });
  });

  describe('Round-trip serialization', () => {
    it('should round-trip through toJSON and fromJSON for cellReference', () => {
      const original = new CellReferenceFeedback([
        { location: [0, 0], status: 'correct' },
        { location: [1, 1], status: 'incorrect' },
      ]);
      const json = original.toJSON();
      const restored = Feedback.fromJSON(json);
      expect(restored).toBeInstanceOf(CellReferenceFeedback);
      expect(restored.getItems()).toEqual(original.getItems());
      expect(restored.getType()).toBe(original.getType());
    });

    it('should preserve type through serialization', () => {
      const original = new Feedback('customType');
      const json = original.toJSON();
      expect(json.type).toBe('customType');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty type string', () => {
      const feedback = new Feedback('');
      expect(feedback.type).toBe('');
      expect(feedback.getType()).toBe('');
    });

    it('should handle type with special characters', () => {
      const specialType = 'type-with-dashes_and_underscores';
      const feedback = new Feedback(specialType);
      expect(feedback.getType()).toBe(specialType);
    });

    it('should handle numeric type (coerced to string)', () => {
      const feedback = new Feedback(123);
      expect(feedback.type).toBe(123);
      expect(feedback.getType()).toBe(123);
    });

    it('toJSON should handle missing createdAt', () => {
      const feedback = new Feedback('testType');
      delete feedback.createdAt;
      const json = feedback.toJSON();
      expect(json.type).toBe('testType');
      expect(json.createdAt).toBeUndefined();
    });
  });
});
