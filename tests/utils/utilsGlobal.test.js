import { describe, it, expect, beforeEach, afterEach } from 'vitest';

/**
 * Regression test for Utils global availability.
 *
 * This test ensures that the Utils object is properly defined and accessible
 * in the backend runtime. It catches issues where the Utils class/object
 * might be renamed (e.g., to Utilities_ ) without updating all call sites.
 *
 * Background: Commit c629fe1 renamed `const Utils = {` to `const Utilities_ = {`
 * in src/backend/Utils/Utils.js but did not update all 13+ call sites that
 * reference `Utils`, causing ReferenceError in production.
 */
describe('Utils global availability regression check', () => {
  let originalUtils;
  let originalUtilities;

  beforeEach(() => {
    // Save original globals
    originalUtils = globalThis.Utils;
    originalUtilities = globalThis.Utilities;
    // Clear any test mocks to test the real module
    delete globalThis.Utils;
    delete globalThis.Utilities;

    // Setup mock GAS Utilities that the production code depends on
    globalThis.Utilities = {
      newBlob: (data) => {
        if (typeof data === 'string') {
          return { getBytes: () => new TextEncoder().encode(data) };
        }
        return { getBytes: () => data };
      },
      computeDigest: (algorithm, bytes) => {
        // Simple mock that returns a fixed array for predictable hashing
        // In real GAS, this would use DigestAlgorithm.SHA_256
        const hashBytes = new Uint8Array(32); // SHA-256 produces 32 bytes
        for (let i = 0; i < bytes.length; i++) {
          hashBytes[i % 32] = (hashBytes[i % 32] + bytes[i]) % 256;
        }
        return Array.from(hashBytes);
      },
      DigestAlgorithm: {
        SHA_256: 'SHA_256',
      },
      formatDate: (date, timezone, format) => {
        // Simple mock for date formatting
        return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
      },
    };
  });

  afterEach(() => {
    // Restore original globals
    if (originalUtils === undefined) {
      delete globalThis.Utils;
    } else {
      globalThis.Utils = originalUtils;
    }
    if (originalUtilities === undefined) {
      delete globalThis.Utilities;
    } else {
      globalThis.Utilities = originalUtilities;
    }
  });

  it('should expose Utils when loaded as CommonJS module', () => {
    // Clear the require cache to get a fresh load
    const modulePath = '../../src/backend/Utils/Utils.js';
    delete require.cache[require.resolve(modulePath)];

    // Load the module - it should export an object with the utility methods
    const utilsModule = require(modulePath);

    // The module should export an object with the utility methods
    expect(utilsModule).toBeDefined();
    expect(typeof utilsModule).toBe('object');

    // Check that key methods exist
    expect(utilsModule.generateHash).toBeDefined();
    expect(typeof utilsModule.generateHash).toBe('function');
    expect(utilsModule.getColumnLetter).toBeDefined();
    expect(typeof utilsModule.getColumnLetter).toBe('function');
    expect(utilsModule.normaliseKeysToLowerCase).toBeDefined();
    expect(typeof utilsModule.normaliseKeysToLowerCase).toBe('function');
    expect(utilsModule.definitionNeedsRefresh).toBeDefined();
    expect(typeof utilsModule.definitionNeedsRefresh).toBe('function');
  });

  it('should be accessible as Utils in GAS-style global scope after loading', () => {
    // This test simulates GAS concatenation behavior where files share a global scope.
    // In GAS, when Utils.js is evaluated, it should create a global `Utils` variable.
    // Note: In the current broken state, the file creates `Utilities_` but not `Utils`.
    // After the fix, it should create `Utils`.

    // We test this by evaluating the file in a fresh context and checking
    // what variables it creates
    const vm = require('node:vm');
    const fs = require('node:fs');
    const path = require('node:path');

    // Resolve the file path relative to the test file
    const utilsFilePath = path.resolve(__dirname, '../../src/backend/Utils/Utils.js');
    const fileContent = fs.readFileSync(utilsFilePath, 'utf8');

    const context = {
      globalThis: {},
      DateUtils: require('../../src/backend/Utils/DateUtils.js'),
      Validate: require('../../src/backend/Utils/Validate.js').Validate,
      ProgressTracker: { getInstance: () => ({ logAndThrowError: () => {} }) },
      Utilities: globalThis.Utilities, // Use our mock from beforeEach
    };

    // Execute in a new context
    vm.createContext(context);
    vm.runInContext(fileContent, context);

    // Check if `Utils` is defined in that context's globalThis
    // Note: In the current broken state, `Utilities_` will be defined but not `Utils`
    // After the fix (renaming Utilities_ to Utils), `Utils` should be defined
    // Also check globalThis since the fix adds globalThis.Utils assignment
    expect(context.globalThis.Utils).toBeDefined();
    expect(context.Utilities_).toBeUndefined();
  });

  it('should have generateHash produce consistent hashes for same input', () => {
    const modulePath = '../../src/backend/Utils/Utils.js';
    delete require.cache[require.resolve(modulePath)];
    const utilsModule = require(modulePath);

    const hash1 = utilsModule.generateHash('test string');
    const hash2 = utilsModule.generateHash('test string');

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 produces 64 hex characters
  });

  it('should have getColumnLetter return correct values for simple indices', () => {
    const modulePath = '../../src/backend/Utils/Utils.js';
    delete require.cache[require.resolve(modulePath)];
    const utilsModule = require(modulePath);

    expect(utilsModule.getColumnLetter(0)).toBe('A');
    expect(utilsModule.getColumnLetter(1)).toBe('B');
    expect(utilsModule.getColumnLetter(25)).toBe('Z');
    expect(utilsModule.getColumnLetter(26)).toBe('AA');
  });

  it('should have normaliseKeysToLowerCase work correctly', () => {
    const modulePath = '../../src/backend/Utils/Utils.js';
    delete require.cache[require.resolve(modulePath)];
    const utilsModule = require(modulePath);

    const input = { Foo: 'bar', BAZ: 'qux' };
    const result = utilsModule.normaliseKeysToLowerCase(input);

    expect(result.foo).toBe('bar');
    expect(result.baz).toBe('qux');
    expect(result.Foo).toBeUndefined();
    expect(result.BAZ).toBeUndefined();
  });

  it('should have definitionNeedsRefresh return true for missing tasks', () => {
    const modulePath = '../../src/backend/Utils/Utils.js';
    delete require.cache[require.resolve(modulePath)];
    const utilsModule = require(modulePath);

    const definition = { tasks: {} };
    const result = utilsModule.definitionNeedsRefresh(definition, null, null);

    expect(result).toBe(true);
  });

  it('should have definitionNeedsRefresh return true when definition has no tasks', () => {
    const modulePath = '../../src/backend/Utils/Utils.js';
    delete require.cache[require.resolve(modulePath)];
    const utilsModule = require(modulePath);

    const definition = {};
    const result = utilsModule.definitionNeedsRefresh(definition, null, null);

    expect(result).toBe(true);
  });

  describe('getColumnLetter', () => {
    it('returns correct letters for various indices', () => {
      const modulePath = '../../src/backend/Utils/Utils.js';
      delete require.cache[require.resolve(modulePath)];
      const utilsModule = require(modulePath);

      // Single letters
      expect(utilsModule.getColumnLetter(0)).toBe('A');
      expect(utilsModule.getColumnLetter(1)).toBe('B');
      expect(utilsModule.getColumnLetter(25)).toBe('Z');
      // Double letters
      expect(utilsModule.getColumnLetter(26)).toBe('AA');
      expect(utilsModule.getColumnLetter(27)).toBe('AB');
      expect(utilsModule.getColumnLetter(51)).toBe('AZ');
      // Triple letters
      expect(utilsModule.getColumnLetter(52)).toBe('BA');
      expect(utilsModule.getColumnLetter(701)).toBe('ZZ');
      expect(utilsModule.getColumnLetter(702)).toBe('AAA');
      // Last column in a typical sheet
      expect(utilsModule.getColumnLetter(25)).toBe('Z');
    });
  });

  describe('arraysEqual', () => {
    let utilsModule;

    beforeEach(() => {
      const modulePath = '../../src/backend/Utils/Utils.js';
      delete require.cache[require.resolve(modulePath)];
      utilsModule = require(modulePath);
    });

    it('returns true for identical arrays', () => {
      expect(utilsModule.arraysEqual([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(utilsModule.arraysEqual(['a', 'b'], ['a', 'b'])).toBe(true);
      expect(utilsModule.arraysEqual([], [])).toBe(true);
    });

    it('returns false for arrays with different lengths', () => {
      expect(utilsModule.arraysEqual([1, 2], [1])).toBe(false);
      expect(utilsModule.arraysEqual([1], [1, 2])).toBe(false);
      expect(utilsModule.arraysEqual([], [1])).toBe(false);
    });

    it('returns false for arrays with same length but different values', () => {
      expect(utilsModule.arraysEqual([1, 2], [1, 3])).toBe(false);
      expect(utilsModule.arraysEqual(['a', 'b'], ['a', 'c'])).toBe(false);
    });

    it('uses strict equality for comparison', () => {
      expect(utilsModule.arraysEqual([1, '1'], [1, '1'])).toBe(true);
      expect(utilsModule.arraysEqual([1, '1'], [1, 1])).toBe(false);
    });
  });

  describe('normaliseKeysToLowerCase', () => {
    let utilsModule;

    beforeEach(() => {
      const modulePath = '../../src/backend/Utils/Utils.js';
      delete require.cache[require.resolve(modulePath)];
      utilsModule = require(modulePath);
    });

    it('converts mixed-case keys to lowercase', () => {
      const result = utilsModule.normaliseKeysToLowerCase({ Foo: 'bar', BAZ: 'qux' });
      expect(result.foo).toBe('bar');
      expect(result.baz).toBe('qux');
    });

    it('handles empty objects', () => {
      const result = utilsModule.normaliseKeysToLowerCase({});
      expect(result).toEqual({});
    });

    it('does not modify nested objects', () => {
      const result = utilsModule.normaliseKeysToLowerCase({ Outer: { InnerKey: 'value' } });
      expect(result.outer).toEqual({ InnerKey: 'value' });
    });

    it('handles single key objects', () => {
      const result = utilsModule.normaliseKeysToLowerCase({ ALREADY_LOWER: 'val' });
      expect(result.already_lower).toBe('val');
    });

    it('overwrites duplicate keys after lowercasing', () => {
      const result = utilsModule.normaliseKeysToLowerCase({ Key: 'first', key: 'second' });
      expect(result.key).toBe('second');
    });
  });

  describe('generateHash edge cases', () => {
    let utilsModule;

    beforeEach(() => {
      const modulePath = '../../src/backend/Utils/Utils.js';
      delete require.cache[require.resolve(modulePath)];
      utilsModule = require(modulePath);
    });

    it('generates consistent hashes for same string input', () => {
      const hash1 = utilsModule.generateHash('test string');
      const hash2 = utilsModule.generateHash('test string');
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it('generates different hashes for different inputs', () => {
      const hash1 = utilsModule.generateHash('hello');
      const hash2 = utilsModule.generateHash('world');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('clearDocumentProperties (removed)', () => {
    it('[RED] clearDocumentProperties should not exist on Utils', () => {
      const modulePath = '../../src/backend/Utils/Utils.js';
      delete require.cache[require.resolve(modulePath)];
      const utilsModule = require(modulePath);

      // ASSERTION: This will FAIL (RED) because clearDocumentProperties
      // currently exists in Utils.js. After migration (GREEN phase) it
      // will be removed and this will pass.
      expect(utilsModule.clearDocumentProperties).toBeUndefined();
    });
  });
});
