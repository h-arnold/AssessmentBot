import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * CellReferenceFeedback Tests
 * Tests for feedback specific to cell references in spreadsheet tasks
 */
describe('CellReferenceFeedback', () => {
  let CellReferenceFeedback;
  let Feedback;

  beforeEach(() => {
    // Load Feedback base class first (dependency)
    delete require.cache[require.resolve('../../src/backend/Models/Feedback/0_Feedback.js')];
    Feedback = require('../../src/backend/Models/Feedback/0_Feedback.js');
    globalThis.Feedback = Feedback;

    // Load CellReferenceFeedback
    delete require.cache[
      require.resolve('../../src/backend/Models/Feedback/1_CellReferenceFeedback.js')
    ];
    CellReferenceFeedback = require('../../src/backend/Models/Feedback/1_CellReferenceFeedback.js');
    globalThis.CellReferenceFeedback = CellReferenceFeedback;
  });

  afterEach(() => {
    delete globalThis.Feedback;
    delete globalThis.CellReferenceFeedback;
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should create instance with type cellReference', () => {
      const feedback = new CellReferenceFeedback();
      expect(feedback.type).toBe('cellReference');
      expect(feedback.items).toEqual([]);
      expect(feedback.createdAt).toBeInstanceOf(Date);
    });

    it('should create instance with initial items', () => {
      const initialItems = [
        { location: [0, 0], status: 'correct' },
        { location: [1, 1], status: 'incorrect' },
      ];
      const feedback = new CellReferenceFeedback(initialItems);
      expect(feedback.type).toBe('cellReference');
      expect(feedback.items).toEqual(initialItems);
    });

    it('should handle empty array as initial items', () => {
      const feedback = new CellReferenceFeedback([]);
      expect(feedback.items).toEqual([]);
    });

    it('should handle null initial items', () => {
      const feedback = new CellReferenceFeedback(null);
      // When null is passed explicitly, it overrides the default parameter
      expect(feedback.items).toBe(null);
    });

    it('should handle undefined initial items', () => {
      const feedback = new CellReferenceFeedback(undefined);
      // When undefined is passed explicitly, the default parameter [] is used
      expect(feedback.items).toEqual([]);
    });
  });

  describe('Inheritance', () => {
    it('should be instance of Feedback', () => {
      const feedback = new CellReferenceFeedback();
      expect(feedback).toBeInstanceOf(Feedback);
    });

    it('should inherit getType from Feedback', () => {
      const feedback = new CellReferenceFeedback();
      expect(feedback.getType()).toBe('cellReference');
    });

    it('should inherit createdAt from Feedback', () => {
      const feedback = new CellReferenceFeedback();
      expect(feedback.createdAt).toBeDefined();
      expect(feedback.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('addItem', () => {
    it('should add feedback item to items array', () => {
      const feedback = new CellReferenceFeedback();
      expect(feedback.items).toHaveLength(0);
      feedback.addItem([0, 0], 'correct');
      expect(feedback.items).toHaveLength(1);
      expect(feedback.items[0]).toEqual({ location: [0, 0], status: 'correct' });
    });

    it('should add multiple items', () => {
      const feedback = new CellReferenceFeedback();
      feedback.addItem([0, 0], 'correct');
      feedback.addItem([1, 1], 'incorrect');
      feedback.addItem([2, 2], 'notAttempted');
      expect(feedback.items).toHaveLength(3);
    });

    it('should add items with different locations', () => {
      const feedback = new CellReferenceFeedback();
      feedback.addItem([0, 0], 'correct');
      feedback.addItem([0, 1], 'correct');
      feedback.addItem([1, 0], 'incorrect');
      expect(feedback.items).toEqual([
        { location: [0, 0], status: 'correct' },
        { location: [0, 1], status: 'correct' },
        { location: [1, 0], status: 'incorrect' },
      ]);
    });

    it('should handle all valid status values', () => {
      const feedback = new CellReferenceFeedback();
      ['correct', 'incorrect', 'notAttempted'].forEach((status) => {
        feedback.addItem([0, 0], status);
      });
      expect(feedback.items).toHaveLength(3);
      expect(feedback.items.map((i) => i.status)).toEqual(['correct', 'incorrect', 'notAttempted']);
    });
  });

  describe('getItems', () => {
    it('should return the items array', () => {
      const initialItems = [
        { location: [0, 0], status: 'correct' },
        { location: [1, 1], status: 'incorrect' },
      ];
      const feedback = new CellReferenceFeedback(initialItems);
      expect(feedback.getItems()).toEqual(initialItems);
    });

    it('should return empty array when no items', () => {
      const feedback = new CellReferenceFeedback();
      expect(feedback.getItems()).toEqual([]);
    });

    it('should return reference to items array', () => {
      const feedback = new CellReferenceFeedback();
      const items = feedback.getItems();
      items.push({ location: [0, 0], status: 'correct' });
      expect(feedback.items).toHaveLength(1);
    });
  });

  describe('getItemsByStatus', () => {
    it('should return items filtered by status', () => {
      const feedback = new CellReferenceFeedback();
      feedback.addItem([0, 0], 'correct');
      feedback.addItem([1, 1], 'incorrect');
      feedback.addItem([2, 2], 'correct');
      feedback.addItem([3, 3], 'notAttempted');

      const correctItems = feedback.getItemsByStatus('correct');
      expect(correctItems).toHaveLength(2);
      expect(correctItems).toEqual([
        { location: [0, 0], status: 'correct' },
        { location: [2, 2], status: 'correct' },
      ]);
    });

    it('should return empty array when no items match status', () => {
      const feedback = new CellReferenceFeedback();
      feedback.addItem([0, 0], 'correct');
      const incorrectItems = feedback.getItemsByStatus('incorrect');
      expect(incorrectItems).toEqual([]);
    });

    it('should return empty array when items is empty', () => {
      const feedback = new CellReferenceFeedback();
      const correctItems = feedback.getItemsByStatus('correct');
      expect(correctItems).toEqual([]);
    });

    it('should handle case-sensitive status matching', () => {
      const feedback = new CellReferenceFeedback();
      feedback.addItem([0, 0], 'correct');
      expect(feedback.getItemsByStatus('Correct')).toHaveLength(0);
      expect(feedback.getItemsByStatus('correct')).toHaveLength(1);
    });
  });

  describe('getCountByStatus', () => {
    it('should return count of items with specified status', () => {
      const feedback = new CellReferenceFeedback();
      feedback.addItem([0, 0], 'correct');
      feedback.addItem([1, 1], 'correct');
      feedback.addItem([2, 2], 'incorrect');
      expect(feedback.getCountByStatus('correct')).toBe(2);
      expect(feedback.getCountByStatus('incorrect')).toBe(1);
    });

    it('should return 0 when no items match status', () => {
      const feedback = new CellReferenceFeedback();
      feedback.addItem([0, 0], 'correct');
      expect(feedback.getCountByStatus('incorrect')).toBe(0);
    });

    it('should return 0 when items is empty', () => {
      const feedback = new CellReferenceFeedback();
      expect(feedback.getCountByStatus('correct')).toBe(0);
    });

    it('should use getItemsByStatus internally', () => {
      const feedback = new CellReferenceFeedback();
      feedback.addItem([0, 0], 'correct');
      feedback.addItem([1, 1], 'correct');
      const spy = vi.spyOn(feedback, 'getItemsByStatus');
      const count = feedback.getCountByStatus('correct');
      expect(count).toBe(2);
      expect(spy).toHaveBeenCalledWith('correct');
      spy.mockRestore();
    });
  });

  describe('toJSON', () => {
    it('should serialize all properties including items', () => {
      const feedback = new CellReferenceFeedback([
        { location: [0, 0], status: 'correct' },
        { location: [1, 1], status: 'incorrect' },
      ]);
      const json = feedback.toJSON();
      expect(json.type).toBe('cellReference');
      expect(json.createdAt).toBeDefined();
      expect(json.items).toEqual([
        { location: [0, 0], status: 'correct' },
        { location: [1, 1], status: 'incorrect' },
      ]);
    });

    it('should serialize empty items array', () => {
      const feedback = new CellReferenceFeedback();
      const json = feedback.toJSON();
      expect(json.items).toEqual([]);
    });

    it('should include all parent properties', () => {
      const feedback = new CellReferenceFeedback();
      const json = feedback.toJSON();
      expect(json).toHaveProperty('type');
      expect(json).toHaveProperty('createdAt');
      expect(json).toHaveProperty('items');
    });

    it('should handle complex location arrays', () => {
      const feedback = new CellReferenceFeedback();
      feedback.addItem([100, 200], 'correct');
      const json = feedback.toJSON();
      expect(json.items[0].location).toEqual([100, 200]);
    });
  });

  describe('fromJSON', () => {
    it('should create instance from JSON with items', () => {
      const json = {
        type: 'cellReference',
        createdAt: '2024-01-15T10:30:00.000Z',
        items: [
          { location: [0, 0], status: 'correct' },
          { location: [1, 1], status: 'incorrect' },
        ],
      };
      const feedback = CellReferenceFeedback.fromJSON(json);
      expect(feedback).toBeInstanceOf(CellReferenceFeedback);
      expect(feedback.getItems()).toEqual(json.items);
      expect(feedback.getType()).toBe('cellReference');
    });

    it('should create instance from JSON without createdAt', () => {
      const json = {
        type: 'cellReference',
        items: [{ location: [0, 0], status: 'correct' }],
      };
      const feedback = CellReferenceFeedback.fromJSON(json);
      expect(feedback).toBeInstanceOf(CellReferenceFeedback);
      expect(feedback.getItems()).toEqual(json.items);
    });

    it('should restore createdAt as Date object when present', () => {
      const createdAt = '2024-01-15T10:30:00.000Z';
      const json = {
        type: 'cellReference',
        createdAt,
        items: [],
      };
      const feedback = CellReferenceFeedback.fromJSON(json);
      expect(feedback.createdAt).toBeInstanceOf(Date);
      expect(feedback.createdAt.toISOString()).toBe(createdAt);
    });

    it('should handle empty items array', () => {
      const json = {
        type: 'cellReference',
        createdAt: '2024-01-15T10:30:00.000Z',
        items: [],
      };
      const feedback = CellReferenceFeedback.fromJSON(json);
      expect(feedback.getItems()).toEqual([]);
    });

    it('should handle undefined items', () => {
      const json = {
        type: 'cellReference',
        createdAt: '2024-01-15T10:30:00.000Z',
      };
      const feedback = CellReferenceFeedback.fromJSON(json);
      expect(feedback.getItems()).toEqual([]);
    });
  });

  describe('Round-trip serialization', () => {
    it('should round-trip through toJSON and fromJSON', () => {
      const original = new CellReferenceFeedback([
        { location: [0, 0], status: 'correct' },
        { location: [1, 1], status: 'incorrect' },
        { location: [2, 2], status: 'notAttempted' },
      ]);
      const originalCreatedAt = original.createdAt;

      const json = original.toJSON();
      const restored = CellReferenceFeedback.fromJSON(json);

      expect(restored).toBeInstanceOf(CellReferenceFeedback);
      expect(restored.getItems()).toEqual(original.getItems());
      expect(restored.getType()).toBe(original.getType());
      expect(restored.createdAt.getTime()).toBe(originalCreatedAt.getTime());
    });

    it('should round-trip empty feedback', () => {
      const original = new CellReferenceFeedback();
      const json = original.toJSON();
      const restored = CellReferenceFeedback.fromJSON(json);

      expect(restored).toBeInstanceOf(CellReferenceFeedback);
      expect(restored.getItems()).toEqual([]);
      expect(restored.getType()).toBe('cellReference');
    });

    it('should preserve item order through serialization', () => {
      const original = new CellReferenceFeedback();
      original.addItem([0, 0], 'correct');
      original.addItem([1, 1], 'incorrect');
      original.addItem([2, 2], 'notAttempted');
      original.addItem([3, 3], 'correct');

      const json = original.toJSON();
      const restored = CellReferenceFeedback.fromJSON(json);

      expect(restored.getItems()).toEqual(original.getItems());
    });
  });

  describe('Edge cases', () => {
    it('should handle items with different location formats', () => {
      const feedback = new CellReferenceFeedback([
        { location: [0, 0], status: 'correct' },
        { location: [10, 20], status: 'incorrect' },
        { location: [100, 200, 300], status: 'notAttempted' }, // 3D location
      ]);
      const json = feedback.toJSON();
      const restored = CellReferenceFeedback.fromJSON(json);
      expect(restored.getItems()).toEqual(feedback.getItems());
    });

    it('should handle items with custom status values', () => {
      const feedback = new CellReferenceFeedback();
      feedback.addItem([0, 0], 'customStatus');
      feedback.addItem([1, 1], 'anotherStatus');
      expect(feedback.getItemsByStatus('customStatus')).toHaveLength(1);
      expect(feedback.getCountByStatus('anotherStatus')).toBe(1);
    });

    it('should handle location as null or undefined', () => {
      const feedback = new CellReferenceFeedback([
        { location: null, status: 'correct' },
        { location: undefined, status: 'incorrect' },
      ]);
      expect(feedback.getItems()).toHaveLength(2);
    });

    it('should handle negative location indices', () => {
      const feedback = new CellReferenceFeedback();
      feedback.addItem([-1, -1], 'correct');
      feedback.addItem([0, -5], 'incorrect');
      expect(feedback.getItems()).toHaveLength(2);
    });

    it('should handle very large location indices', () => {
      const feedback = new CellReferenceFeedback();
      feedback.addItem([999999, 999999], 'correct');
      expect(feedback.getItems()).toHaveLength(1);
      expect(feedback.getItems()[0].location).toEqual([999999, 999999]);
    });
  });

  describe('Filtering and counting', () => {
    it('should correctly filter and count multiple status types', () => {
      const feedback = new CellReferenceFeedback();
      feedback.addItem([0, 0], 'correct');
      feedback.addItem([1, 1], 'correct');
      feedback.addItem([2, 2], 'correct');
      feedback.addItem([3, 3], 'incorrect');
      feedback.addItem([4, 4], 'incorrect');
      feedback.addItem([5, 5], 'notAttempted');

      expect(feedback.getCountByStatus('correct')).toBe(3);
      expect(feedback.getCountByStatus('incorrect')).toBe(2);
      expect(feedback.getCountByStatus('notAttempted')).toBe(1);
    });

    it('should return correct filtered arrays', () => {
      const feedback = new CellReferenceFeedback();
      feedback.addItem([0, 0], 'correct');
      feedback.addItem([1, 1], 'incorrect');
      feedback.addItem([2, 2], 'correct');

      const correct = feedback.getItemsByStatus('correct');
      const incorrect = feedback.getItemsByStatus('incorrect');

      expect(correct).toHaveLength(2);
      expect(incorrect).toHaveLength(1);
      expect(correct.every((item) => item.status === 'correct')).toBe(true);
      expect(incorrect.every((item) => item.status === 'incorrect')).toBe(true);
    });
  });
});
