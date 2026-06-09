import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { withGlobalMocks } from '../helpers/globalMockManager.js';

/**
 * Tests for DateUtils module.
 *
 * DateUtils.js exists and is fully implemented. These tests validate
 * all exported methods: getFormattedDate, getFutureDate,
 * definitionNeedsRefresh, isNewer, and normaliseDateFields.
 */

describe('DateUtils', () => {
  let DateUtils;
  let restoreGlobals;

  beforeEach(() => {
    // Freeze time at a fixed reference date to avoid race conditions
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));

    // Use globalMockManager to save/restore GAS globals and prevent test pollution
    const mockContext = withGlobalMocks({
      Session: () => ({
        getScriptTimeZone: () => 'Australia/Sydney',
      }),
      Utilities: () => ({
        formatDate: (date) => {
          const day = String(date.getDate()).padStart(2, '0');
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const year = date.getFullYear();
          return `${day}/${month}/${year}`;
        },
      }),
      ProgressTracker: () => ({
        getInstance: () => ({
          logAndThrowError: (msg) => {
            throw new Error(msg);
          },
        }),
      }),
    });
    restoreGlobals = mockContext.restore;

    // Load the DateUtils module (already exists in production)
    delete require.cache[require.resolve('../../src/backend/Utils/DateUtils.js')];
    DateUtils = require('../../src/backend/Utils/DateUtils.js');
  });

  afterEach(() => {
    restoreGlobals();
    delete require.cache[require.resolve('../../src/backend/Utils/DateUtils.js')];
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // getFormattedDate
  // ---------------------------------------------------------------------------
  describe('getFormattedDate', () => {
    it("should return today's date in DD/MM/YYYY format", () => {
      // System time is frozen at 2025-06-15T12:00:00Z, so formatted date is 15/06/2025
      const result = DateUtils.getFormattedDate();
      expect(result).toBe('15/06/2025');
    });
  });

  // ---------------------------------------------------------------------------
  // getFutureDate
  // ---------------------------------------------------------------------------
  describe('getFutureDate', () => {
    it('should return a Date object for a valid number of days', () => {
      const result = DateUtils.getFutureDate(7);
      expect(result).toBeInstanceOf(Date);
      const expected = new Date();
      expected.setDate(expected.getDate() + 7);
      // Compare date portion (ignoring time precision differences)
      expect(result.toISOString().slice(0, 10)).toBe(expected.toISOString().slice(0, 10));
    });

    it('should return a Date object for zero days (today)', () => {
      const result = DateUtils.getFutureDate(0);
      expect(result).toBeInstanceOf(Date);
      const today = new Date();
      expect(result.toISOString().slice(0, 10)).toBe(today.toISOString().slice(0, 10));
    });

    it('should throw for a negative number of days', () => {
      expect(() => DateUtils.getFutureDate(-1)).toThrow();
    });

    it('should throw for a non-number value', () => {
      expect(() => DateUtils.getFutureDate('7')).toThrow();
      expect(() => DateUtils.getFutureDate(null)).toThrow();
      expect(() => DateUtils.getFutureDate(undefined)).toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // definitionNeedsRefresh
  // ---------------------------------------------------------------------------
  describe('definitionNeedsRefresh', () => {
    /**
     * Create a definition object with sensible defaults for testing.
     * Pass overrides to customise fields; set a field to undefined to omit it
     * from the returned object entirely (e.g. to test missing-key behaviour).
     */
    function createDefinition(overrides = {}) {
      const def = {
        tasks: { t1: { taskTitle: 'Task 1' } },
        referenceLastModified: '2025-01-01T00:00:00Z',
        templateLastModified: '2025-01-01T00:00:00Z',
        ...overrides,
      };
      // Remove keys explicitly set to undefined so they behave as missing keys
      Object.keys(def).forEach((key) => {
        if (def[key] === undefined) {
          delete def[key];
        }
      });
      return def;
    }

    it('should return true when definition has no tasks key', () => {
      const definition = {};
      const result = DateUtils.definitionNeedsRefresh(definition, null, null);
      expect(result).toBe(true);
    });

    it('should return true when definition has empty tasks object', () => {
      const definition = { tasks: {} };
      const result = DateUtils.definitionNeedsRefresh(definition, null, null);
      expect(result).toBe(true);
    });

    it('should return true when referenceLastModified is missing', () => {
      const definition = createDefinition({ referenceLastModified: undefined });
      const result = DateUtils.definitionNeedsRefresh(
        definition,
        '2025-06-01T00:00:00Z',
        '2025-06-01T00:00:00Z'
      );
      expect(result).toBe(true);
    });

    it('should return true when templateLastModified is missing', () => {
      const definition = createDefinition({ templateLastModified: undefined });
      const result = DateUtils.definitionNeedsRefresh(
        definition,
        '2025-06-01T00:00:00Z',
        '2025-06-01T00:00:00Z'
      );
      expect(result).toBe(true);
    });

    it('should return true when reference document is newer', () => {
      const definition = createDefinition();
      const result = DateUtils.definitionNeedsRefresh(
        definition,
        '2025-06-01T00:00:00Z',
        '2025-01-01T00:00:00Z'
      );
      expect(result).toBe(true);
    });

    it('should return true when template document is newer', () => {
      const definition = createDefinition();
      const result = DateUtils.definitionNeedsRefresh(
        definition,
        '2025-01-01T00:00:00Z',
        '2025-06-01T00:00:00Z'
      );
      expect(result).toBe(true);
    });

    it('should return false when both documents are not newer than stored', () => {
      const definition = createDefinition({
        referenceLastModified: '2025-06-01T00:00:00Z',
        templateLastModified: '2025-06-01T00:00:00Z',
      });
      const result = DateUtils.definitionNeedsRefresh(
        definition,
        '2025-01-01T00:00:00Z',
        '2025-01-01T00:00:00Z'
      );
      expect(result).toBe(false);
    });

    it('should return false when both documents have the same timestamp', () => {
      const definition = createDefinition({
        referenceLastModified: '2025-06-01T00:00:00Z',
        templateLastModified: '2025-06-01T00:00:00Z',
      });
      const result = DateUtils.definitionNeedsRefresh(
        definition,
        '2025-06-01T00:00:00Z',
        '2025-06-01T00:00:00Z'
      );
      expect(result).toBe(false);
    });

    it('should handle Date objects as timestamps', () => {
      const definition = createDefinition({
        referenceLastModified: new Date('2025-06-01T00:00:00Z'),
        templateLastModified: new Date('2025-06-01T00:00:00Z'),
      });
      const result = DateUtils.definitionNeedsRefresh(
        definition,
        new Date('2025-06-15T00:00:00Z'),
        new Date('2025-01-01T00:00:00Z')
      );
      expect(result).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // isNewer
  // ---------------------------------------------------------------------------
  describe('isNewer', () => {
    it('should return true when candidate is newer than baseline', () => {
      const result = DateUtils.isNewer('2025-06-15T00:00:00Z', '2025-01-01T00:00:00Z');
      expect(result).toBe(true);
    });

    it('should return false when candidate is older than baseline', () => {
      const result = DateUtils.isNewer('2025-01-01T00:00:00Z', '2025-06-15T00:00:00Z');
      expect(result).toBe(false);
    });

    it('should return false when candidate and baseline are equal', () => {
      const result = DateUtils.isNewer('2025-06-15T00:00:00Z', '2025-06-15T00:00:00Z');
      expect(result).toBe(false);
    });

    it('should return false when candidate is null', () => {
      const result = DateUtils.isNewer(null, '2025-01-01T00:00:00Z');
      expect(result).toBe(false);
    });

    it('should return false when baseline is null', () => {
      const result = DateUtils.isNewer('2025-01-01T00:00:00Z', null);
      expect(result).toBe(false);
    });

    it('should return false when both are null', () => {
      const result = DateUtils.isNewer(null, null);
      expect(result).toBe(false);
    });

    it('should return false when candidate is undefined', () => {
      const result = DateUtils.isNewer(undefined, '2025-01-01T00:00:00Z');
      expect(result).toBe(false);
    });

    it('should return false for invalid date strings', () => {
      const result = DateUtils.isNewer('not-a-date', '2025-01-01T00:00:00Z');
      expect(result).toBe(false);
    });

    it('should return false when baseline is an invalid date string', () => {
      const result = DateUtils.isNewer('2025-06-15T00:00:00Z', 'not-a-date');
      expect(result).toBe(false);
    });

    it('should handle Date objects', () => {
      const result = DateUtils.isNewer(
        new Date('2025-06-15T00:00:00Z'),
        new Date('2025-01-01T00:00:00Z')
      );
      expect(result).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // normaliseDateFields
  // ---------------------------------------------------------------------------
  describe('normaliseDateFields', () => {
    it('should convert Date objects in specified fields to ISO strings', () => {
      const obj = {
        createdAt: new Date('2025-06-15T10:30:00Z'),
        updatedAt: new Date('2025-06-16T14:00:00Z'),
        name: 'test',
      };
      DateUtils.normaliseDateFields(obj, ['createdAt', 'updatedAt']);
      expect(obj.createdAt).toBe('2025-06-15T10:30:00.000Z');
      expect(obj.updatedAt).toBe('2025-06-16T14:00:00.000Z');
      expect(obj.name).toBe('test');
    });

    it('should leave ISO strings unchanged', () => {
      const obj = {
        createdAt: '2025-06-15T10:30:00.000Z',
        updatedAt: '2025-06-16T14:00:00.000Z',
      };
      DateUtils.normaliseDateFields(obj, ['createdAt', 'updatedAt']);
      expect(obj.createdAt).toBe('2025-06-15T10:30:00.000Z');
      expect(obj.updatedAt).toBe('2025-06-16T14:00:00.000Z');
    });

    it('should leave null values unchanged', () => {
      const obj = {
        createdAt: null,
        updatedAt: null,
      };
      DateUtils.normaliseDateFields(obj, ['createdAt', 'updatedAt']);
      expect(obj.createdAt).toBeNull();
      expect(obj.updatedAt).toBeNull();
    });

    it('should leave undefined values unchanged', () => {
      const obj = {
        createdAt: undefined,
        updatedAt: undefined,
      };
      DateUtils.normaliseDateFields(obj, ['createdAt', 'updatedAt']);
      expect(obj.createdAt).toBeUndefined();
      expect(obj.updatedAt).toBeUndefined();
    });

    it('should leave non-date values (numbers, booleans) unchanged', () => {
      const obj = {
        count: 42,
        active: true,
        name: 'test',
      };
      DateUtils.normaliseDateFields(obj, ['count', 'active', 'name']);
      expect(obj.count).toBe(42);
      expect(obj.active).toBe(true);
      expect(obj.name).toBe('test');
    });

    it('should handle empty field array (no-op)', () => {
      const obj = {
        createdAt: new Date('2025-06-15T10:30:00Z'),
        name: 'test',
      };
      DateUtils.normaliseDateFields(obj, []);
      expect(obj.createdAt).toBeInstanceOf(Date);
      expect(obj.name).toBe('test');
    });

    it('should return the same object reference (mutate in-place)', () => {
      const obj = {
        createdAt: new Date('2025-06-15T10:30:00Z'),
        name: 'test',
      };
      const result = DateUtils.normaliseDateFields(obj, ['createdAt']);
      expect(result).toBe(obj);
    });

    it('should handle missing fields gracefully (fields not on object are ignored)', () => {
      const obj = {
        name: 'test',
      };
      DateUtils.normaliseDateFields(obj, ['createdAt', 'updatedAt']);
      expect(obj.name).toBe('test');
      expect(obj).not.toHaveProperty('createdAt');
      expect(obj).not.toHaveProperty('updatedAt');
    });

    it('should handle nested objects (only top-level fields are normalised)', () => {
      const nestedDate = new Date('2025-06-15T10:30:00Z');
      const obj = {
        metadata: {
          createdAt: nestedDate,
        },
        createdAt: new Date('2025-06-16T14:00:00Z'),
      };
      DateUtils.normaliseDateFields(obj, ['createdAt']);
      expect(obj.createdAt).toBe('2025-06-16T14:00:00.000Z');
      // Nested object's Date should not be touched
      expect(obj.metadata.createdAt).toBe(nestedDate);
    });
  });
});
