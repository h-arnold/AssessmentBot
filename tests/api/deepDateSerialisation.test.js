/**
 * Deep Date Serialisation Regression Tests
 *
 * Regression tests for the bug where google.script.run serialises Date objects
 * as Java toString() format (e.g. "Tue Jul 07 09:51:13 GMT+10:00 2026") instead
 * of JSON, causing the frontend to receive unparseable data.
 *
 * These tests use the anonymised test data fixture to verify that
 * DateUtils.deepConvertDates correctly converts all Date objects in deeply
 * nested structures (documents -> assignments -> submissions -> artifacts)
 * to ISO 8601 strings, preventing the GAS serialisation bug.
 *
 * The tests would fail if:
 * - deepConvertDates is removed from getABClass_ handler
 * - deepConvertDates does not recursively traverse nested structures
 * - Date objects are introduced at any nesting level without conversion
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { withGlobalMocks } from '../helpers/globalMockManager.js';

const TEST_DATA_PATH = '../__mocks__/data/anon-test-data.json';
const MODULE_PATH = '../../src/backend/z_Api/abclass/abclassRead.js';

function loadModule() {
  delete require.cache[require.resolve(MODULE_PATH)];
  return require(MODULE_PATH);
}

describe('Deep Date Serialisation Regression', () => {
  let DateUtils;
  let restoreGlobals;
  let testData;

  beforeEach(() => {
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

    delete require.cache[require.resolve('../../src/backend/Utils/DateUtils.js')];
    DateUtils = require('../../src/backend/Utils/DateUtils.js');

    testData = require(TEST_DATA_PATH);
  });

  afterEach(() => {
    restoreGlobals();
    delete require.cache[require.resolve('../../src/backend/Utils/DateUtils.js')];
    delete require.cache[require.resolve(TEST_DATA_PATH)];
  });

  /**
   * Recursively walks an object and collects all Date instances.
   * @param {*} value - The value to inspect.
   * @param {string} path - The current path for error reporting.
   * @returns {Array<{path: string, value: Date}>} Array of Date instances found.
   */
  function collectDateObjects(value, path = 'root') {
    const dates = [];
    if (value instanceof Date) {
      dates.push({ path, value });
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        dates.push(...collectDateObjects(item, `${path}[${index}]`));
      });
    } else if (value !== null && typeof value === 'object') {
      for (const [key, val] of Object.entries(value)) {
        dates.push(...collectDateObjects(val, `${path}.${key}`));
      }
    }
    return dates;
  }

  /**
   * Injects Date objects at various nesting levels in the test data to simulate
   * what happens when the controller returns data with live Date objects.
   * @param {Object} data - The test data to inject dates into.
   * @returns {Object} The data with Date objects injected.
   */
  function injectDateObjects(data) {
    const result = JSON.parse(JSON.stringify(data));

    for (const doc of Object.values(result.documents)) {
      // Inject dates at document level
      doc.createdAt = new Date('2026-01-15T10:30:00Z');
      doc.updatedAt = new Date('2026-07-07T08:00:00Z');

      for (const assignment of doc.assignments || []) {
        // Inject dates at assignment level
        assignment.createdAt = new Date('2026-06-29T09:40:37.069Z');
        assignment.updatedAt = new Date('2026-07-07T07:51:13.282Z');

        if (assignment.assignmentDefinition) {
          assignment.assignmentDefinition.createdAt = new Date('2026-07-07T07:45:23.916Z');
          assignment.assignmentDefinition.updatedAt = new Date('2026-07-07T07:49:06.791Z');
        }

        for (const submission of assignment.submissions || []) {
          // Inject dates at submission level
          submission.createdAt = new Date('2026-07-07T07:49:23.014Z');
          submission.updatedAt = new Date('2026-07-07T07:49:29.872Z');

          // Inject dates in nested items/artifacts
          for (const item of Object.values(submission.items || {})) {
            if (item.artifact) {
              item.artifact.createdAt = new Date('2026-07-07T07:49:25.000Z');
            }
          }
        }
      }
    }

    return result;
  }

  describe('DateUtils.deepConvertDates', () => {
    it('converts all Date objects in deeply nested structures to ISO strings', () => {
      const dataWithDates = injectDateObjects(testData);

      const datesBefore = collectDateObjects(dataWithDates);
      expect(datesBefore.length).toBeGreaterThan(0);

      const converted = DateUtils.deepConvertDates(dataWithDates);

      const datesAfter = collectDateObjects(converted);
      expect(datesAfter).toEqual([]);
    });

    it('preserves the structure of the data while converting dates', () => {
      const dataWithDates = injectDateObjects(testData);
      const converted = DateUtils.deepConvertDates(dataWithDates);

      const originalDocKeys = Object.keys(dataWithDates.documents);
      const convertedDocKeys = Object.keys(converted.documents);
      expect(convertedDocKeys).toEqual(originalDocKeys);

      for (const docKey of originalDocKeys) {
        const originalDoc = dataWithDates.documents[docKey];
        const convertedDoc = converted.documents[docKey];

        expect(convertedDoc.classId).toBe(originalDoc.classId);
        expect(convertedDoc.className).toBe(originalDoc.className);
        expect(convertedDoc.students.length).toBe(originalDoc.students.length);
        expect(convertedDoc.assignments.length).toBe(originalDoc.assignments.length);
      }
    });

    it('converts dates at document level to ISO strings', () => {
      const dataWithDates = injectDateObjects(testData);
      const converted = DateUtils.deepConvertDates(dataWithDates);

      for (const doc of Object.values(converted.documents)) {
        expect(typeof doc.createdAt).toBe('string');
        expect(doc.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        expect(typeof doc.updatedAt).toBe('string');
        expect(doc.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      }
    });

    it('converts dates at assignment level to ISO strings', () => {
      const dataWithDates = injectDateObjects(testData);
      const converted = DateUtils.deepConvertDates(dataWithDates);

      for (const doc of Object.values(converted.documents)) {
        for (const assignment of doc.assignments || []) {
          expect(typeof assignment.createdAt).toBe('string');
          expect(assignment.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
          expect(typeof assignment.updatedAt).toBe('string');
          expect(assignment.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        }
      }
    });

    it('converts dates at submission level to ISO strings', () => {
      const dataWithDates = injectDateObjects(testData);
      const converted = DateUtils.deepConvertDates(dataWithDates);

      for (const doc of Object.values(converted.documents)) {
        for (const assignment of doc.assignments || []) {
          for (const submission of assignment.submissions || []) {
            expect(typeof submission.createdAt).toBe('string');
            expect(submission.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
            expect(typeof submission.updatedAt).toBe('string');
            expect(submission.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
          }
        }
      }
    });

    it('converts dates in deeply nested artifacts to ISO strings', () => {
      const dataWithDates = injectDateObjects(testData);
      const converted = DateUtils.deepConvertDates(dataWithDates);

      for (const doc of Object.values(converted.documents)) {
        for (const assignment of doc.assignments || []) {
          for (const submission of assignment.submissions || []) {
            for (const item of Object.values(submission.items || {})) {
              if (item.artifact && item.artifact.createdAt) {
                expect(typeof item.artifact.createdAt).toBe('string');
                expect(item.artifact.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
              }
            }
          }
        }
      }
    });

    it('does not mutate the original data structure', () => {
      const dataWithDates = injectDateObjects(testData);
      const originalCreatedAt =
        dataWithDates.documents[Object.keys(dataWithDates.documents)[0]].createdAt;

      DateUtils.deepConvertDates(dataWithDates);

      const afterCallCreatedAt =
        dataWithDates.documents[Object.keys(dataWithDates.documents)[0]].createdAt;
      expect(afterCallCreatedAt).toBe(originalCreatedAt);
      expect(afterCallCreatedAt).toBeInstanceOf(Date);
    });

    it('handles null and undefined values without throwing', () => {
      expect(() => DateUtils.deepConvertDates(null)).not.toThrow();
      expect(() => DateUtils.deepConvertDates(undefined)).not.toThrow();
      expect(DateUtils.deepConvertDates(null)).toBeNull();
      expect(DateUtils.deepConvertDates(undefined)).toBeUndefined();
    });

    it('handles primitive values without modification', () => {
      expect(DateUtils.deepConvertDates('string')).toBe('string');
      expect(DateUtils.deepConvertDates(42)).toBe(42);
      expect(DateUtils.deepConvertDates(true)).toBe(true);
      expect(DateUtils.deepConvertDates(false)).toBe(false);
    });

    it('converts Date objects in arrays to ISO strings', () => {
      const date1 = new Date('2026-01-01T00:00:00Z');
      const date2 = new Date('2026-06-15T12:00:00Z');
      const array = [date1, 'string', date2, 42];

      const converted = DateUtils.deepConvertDates(array);

      expect(converted[0]).toBe('2026-01-01T00:00:00.000Z');
      expect(converted[1]).toBe('string');
      expect(converted[2]).toBe('2026-06-15T12:00:00.000Z');
      expect(converted[3]).toBe(42);
    });
  });

  describe('GAS serialisation simulation', () => {
    it('produces JSON-serialisable output with no Date objects', () => {
      const dataWithDates = injectDateObjects(testData);
      const converted = DateUtils.deepConvertDates(dataWithDates);

      const datesRemaining = collectDateObjects(converted);
      expect(datesRemaining).toEqual([]);

      expect(() => JSON.stringify(converted)).not.toThrow();

      const jsonString = JSON.stringify(converted);
      const parsed = JSON.parse(jsonString);
      expect(parsed).toEqual(converted);
    });

    it('would fail if deepConvertDates is not applied (regression guard)', () => {
      const dataWithDates = injectDateObjects(testData);

      const datesWithoutConversion = collectDateObjects(dataWithDates);
      expect(datesWithoutConversion.length).toBeGreaterThan(0);

      expect(() => JSON.stringify(dataWithDates)).not.toThrow();
      const jsonString = JSON.stringify(dataWithDates);
      const parsed = JSON.parse(jsonString);

      const datesAfterJsonRoundTrip = collectDateObjects(parsed);
      expect(datesAfterJsonRoundTrip.length).toBe(0);

      const converted = DateUtils.deepConvertDates(dataWithDates);
      const datesAfterConversion = collectDateObjects(converted);
      expect(datesAfterConversion.length).toBe(0);
    });
  });

  describe('getABClass_ handler integration', () => {
    let originalABClassController;
    let originalABLogger;

    beforeEach(() => {
      originalABClassController = globalThis.ABClassController;
      originalABLogger = globalThis.ABLogger;

      const abLoggerSpies = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
      globalThis.ABLogger = { getInstance: () => abLoggerSpies };
    });

    afterEach(() => {
      try {
        delete require.cache[require.resolve(MODULE_PATH)];
      } catch (e) {
        if (e.code !== 'MODULE_NOT_FOUND') throw e;
      }

      if (originalABClassController === undefined) {
        delete globalThis.ABClassController;
      } else {
        globalThis.ABClassController = originalABClassController;
      }

      if (originalABLogger === undefined) {
        delete globalThis.ABLogger;
      } else {
        globalThis.ABLogger = originalABLogger;
      }

      vi.restoreAllMocks();
    });

    it('returns response with no Date objects when controller returns data with Date objects', () => {
      const dataWithDates = injectDateObjects(testData);

      const readClass = vi.fn().mockReturnValue(dataWithDates);
      const ABClassController = vi.fn(function StubABClassController() {
        this.readClass = readClass;
      });
      globalThis.ABClassController = ABClassController;

      const { getABClass_ } = loadModule();

      const result = getABClass_({ classId: 'class-001' });

      const datesRemaining = collectDateObjects(result);
      expect(datesRemaining).toEqual([]);
    });

    it('converts dates at all nesting levels in the handler response', () => {
      const dataWithDates = injectDateObjects(testData);

      const readClass = vi.fn().mockReturnValue(dataWithDates);
      const ABClassController = vi.fn(function StubABClassController() {
        this.readClass = readClass;
      });
      globalThis.ABClassController = ABClassController;

      const { getABClass_ } = loadModule();

      const result = getABClass_({ classId: 'class-001' });

      for (const doc of Object.values(result.documents)) {
        expect(typeof doc.createdAt).toBe('string');
        expect(typeof doc.updatedAt).toBe('string');

        for (const assignment of doc.assignments || []) {
          expect(typeof assignment.createdAt).toBe('string');
          expect(typeof assignment.updatedAt).toBe('string');

          if (assignment.assignmentDefinition) {
            expect(typeof assignment.assignmentDefinition.createdAt).toBe('string');
            expect(typeof assignment.assignmentDefinition.updatedAt).toBe('string');
          }

          for (const submission of assignment.submissions || []) {
            expect(typeof submission.createdAt).toBe('string');
            expect(typeof submission.updatedAt).toBe('string');

            for (const item of Object.values(submission.items || {})) {
              if (item.artifact && item.artifact.createdAt) {
                expect(typeof item.artifact.createdAt).toBe('string');
              }
            }
          }
        }
      }
    });
  });
});
