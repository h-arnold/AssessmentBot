import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';

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
    if (originalUtils !== undefined) {
      globalThis.Utils = originalUtils;
    } else {
      delete globalThis.Utils;
    }
    if (originalUtilities !== undefined) {
      globalThis.Utilities = originalUtilities;
    } else {
      delete globalThis.Utilities;
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
    const vm = require('vm');
    const fs = require('fs');
    const path = require('path');

    // Resolve the file path relative to the test file
    const utilsFilePath = path.resolve(__dirname, '../../src/backend/Utils/Utils.js');
    const fileContent = fs.readFileSync(utilsFilePath, 'utf8');

    const context = {
      globalThis: {},
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
});
