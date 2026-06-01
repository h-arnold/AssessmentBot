/**
 * Shared test helpers for assignmentDefinitionPartials.unit.test.js
 * Reduces duplication across Section 5 API layer refactoring tests
 */

import { expect, vi } from 'vitest';
import path from 'node:path';

const modulePath = '../../src/backend/z_Api/assignmentDefinitionPartials.js';
const ApiValidationError = require('../../src/backend/Utils/ErrorTypes/ApiValidationError.js');

/**
 * Creates a mock AssignmentDefinitionController and installs it globally.
 * Also returns the mock so tests can access it.
 * @param {Array} partials - Array of partial definitions to return from getAllPartialDefinitions
 * @returns {Object} { AssignmentDefinitionController, getAllPartialDefinitions, restore }
 */
export function installAssignmentDefinitionControllerStub(partials) {
  const getAllPartialDefinitions = vi.fn(() => partials);
  const AssignmentDefinitionController = vi.fn(function StubAssignmentDefinitionController() {
    this.getAllPartialDefinitions = getAllPartialDefinitions;
  });

  globalThis.AssignmentDefinitionController = AssignmentDefinitionController;

  return { AssignmentDefinitionController, getAllPartialDefinitions };
}

/**
 * Loads the assignmentDefinitionPartials module.
 * Clears require cache first to ensure fresh load.
 * @returns {Object} The module exports
 */
export function loadAssignmentDefinitionPartialsModule() {
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

/**
 * Reads the source file content.
 * @returns {string} The source code as a string
 */
export function readSourceFile() {
  const fs = require('node:fs');
  const absolutePath = path.resolve(__dirname, modulePath);
  return fs.readFileSync(absolutePath, 'utf8');
}

/**
 * Creates a mock definition object with toPartialJSON method for testing toTransportPartialRow_.
 * This is the common pattern used in Section 5 tests for partial row serialization.
 * @param {Object} overrides - Properties to override in the partial JSON output
 * @returns {Object} Mock definition with toPartialJSON method
 */
export function createMockDefinitionForPartialRow(overrides = {}) {
  const defaultPartialJSON = {
    primaryTitle: 'Test',
    primaryTopic: 'Test Topic',
    primaryTopicKey: 'test-topic',
    yearGroupKey: 'year-10',
    yearGroupLabel: 'Year 10',
    alternateTitles: [],
    alternateTopics: [],
    documentType: 'SLIDES',
    referenceDocumentId: 'ref-001',
    templateDocumentId: 'tpl-001',
    assignmentWeighting: 1,
    definitionKey: 'test-key',
    tasks: null,
    createdAt: '2026-01-05T10:00:00.000Z',
    updatedAt: '2026-01-06T12:30:00.000Z',
  };

  return {
    toPartialJSON: () => ({ ...defaultPartialJSON, ...overrides }),
  };
}

/**
 * Creates beforeEach and afterEach handlers for AssignmentDefinitionController tests.
 * This reduces duplication of the common setup/teardown pattern across describe blocks.
 *
 * @returns {Object} { beforeEachHandler, afterEachHandler }
 */
export function createAssignmentDefinitionControllerHooks() {
  let originalAssignmentDefinitionController;

  const beforeEachHandler = () => {
    originalAssignmentDefinitionController = globalThis.AssignmentDefinitionController;
  };

  const afterEachHandler = () => {
    delete require.cache[require.resolve(modulePath)];

    if (originalAssignmentDefinitionController === undefined) {
      delete globalThis.AssignmentDefinitionController;
    } else {
      globalThis.AssignmentDefinitionController = originalAssignmentDefinitionController;
    }

    vi.restoreAllMocks();
  };

  return { beforeEachHandler, afterEachHandler };
}

/**
 * Creates a complete describe block wrapper for AssignmentDefinitionController tests.
 * This provides a cleaner way to define test suites with consistent setup/teardown.
 *
 * @param {string} title - The describe block title
 * @param {Function} testFn - Function that receives hooks and defines tests
 * @returns {void}
 */
export function describeWithAssignmentDefinitionController(title, testFn) {
  describe(title, () => {
    const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

    beforeEach(beforeEachHandler);
    afterEach(afterEachHandler);

    testFn();
  });
}

/**
 * Helper to verify a function name does NOT exist in the source file.
 * Used in Section 5 tests to verify helper functions were removed.
 * @param {string} functionName - The function name to check for
 * @returns {void}
 */
export function expectFunctionNotInSource(functionName) {
  const sourceCode = readSourceFile();
  expect(sourceCode).not.toContain(`function ${functionName}`);
}

/**
 * Helper to verify a function name DOES exist in the source file.
 * @param {string} functionName - The function name to check for
 * @returns {void}
 */
export function expectFunctionInSource(functionName) {
  const sourceCode = readSourceFile();
  expect(sourceCode).toContain(`function ${functionName}`);
}

/**
 * Helper to verify a string pattern exists in the source file.
 * @param {string} pattern - The pattern to search for
 * @returns {void}
 */
export function expectPatternInSource(pattern) {
  const sourceCode = readSourceFile();
  expect(sourceCode).toContain(pattern);
}

/**
 * Helper to verify a string pattern does NOT exist in the source file.
 * @param {string} pattern - The pattern to search for
 * @returns {void}
 */
export function expectPatternNotInSource(pattern) {
  const sourceCode = readSourceFile();
  expect(sourceCode).not.toContain(pattern);
}

/**
 * Standard partial definition builder for test data.
 * @param {Object} overrides - Properties to override
 * @returns {Object} A valid partial definition object
 */
export function buildValidPartial(overrides = {}) {
  return {
    primaryTitle: 'Algebra Baseline',
    primaryTopic: 'Algebra',
    primaryTopicKey: 'topic-algebra',
    yearGroupKey: 'year-group-10',
    yearGroupLabel: 'Year 10',
    alternateTitles: ['Algebra Starter'],
    alternateTopics: ['Linear Equations'],
    documentType: 'SLIDES',
    referenceDocumentId: 'ref-doc-001',
    templateDocumentId: 'tpl-doc-001',
    assignmentWeighting: null,
    definitionKey: 'algebra-baseline',
    tasks: null,
    createdAt: '2026-01-05T10:00:00.000Z',
    updatedAt: '2026-01-06T12:30:00.000Z',
    ...overrides,
  };
}

// ============================================================================
// Generic Test Utilities for Validation Functions
// ============================================================================

/**
 * Generic test runner for binary functions (returning true/false).
 * Reduces duplication for functions like hasControlCharacters_, isIsoDateTimeString_.
 *
 * @param {Object} options - Test configuration
 * @param {string} options.functionName - Name of function to test
 * @param {string} options.modulePath - Path to module (default: modulePath)
 * @param {Array} options.testCases - Array of test case objects with description, value, expected
 * @returns {void}
 */
export function runBinaryFunctionTest({ functionName, testCases }) {
  installAssignmentDefinitionControllerStub([]);
  const module = loadAssignmentDefinitionPartialsModule();
  const func = module[functionName];

  testCases.forEach(({ description, value, expected }) => {
    it(`returns ${expected} for ${description}`, () => {
      expect(func(value)).toBe(expected);
    });
  });
}

/**
 * Generic test runner for validation functions that throw ApiValidationError.
 * Handles the common pattern: expect(() => func()).toThrow(ApiValidationError)
 *
 * @param {Object} options - Test configuration
 * @param {Function} options.setup - Setup function called before each test
 * @param {Function} options.func - Function under test
 * @param {Array} options.testCases - Array of test case objects
 * @param {string} options.method - Method name for error assertion
 * @param {boolean} options.expectDetails - Whether to expect details field in error
 * @returns {void}
 */
export function runThrowingValidationTest({
  setup,
  func,
  testCases,
  method,
  expectDetails = false,
}) {
  testCases.forEach(({ description, shouldThrow, expectedError, expectedField, ...params }) => {
    const paramValues = Object.values(params);
    const paramNames = Object.keys(params);

    it(`handles ${description} correctly`, () => {
      setup();

      if (shouldThrow) {
        expect(() => func(...paramValues)).toThrow(ApiValidationError);
        expect(() => func(...paramValues)).toThrow(expectedError);
        try {
          func(...paramValues);
        } catch (err) {
          expect(err.fieldName).toBe(expectedField);
          expect(err.method).toBe(method);
          if (expectDetails && err.details !== undefined) {
            const rowIndex = paramNames.includes('rowIndex') ? params.rowIndex : undefined;
            if (rowIndex !== undefined) {
              expect(err.details).toBe(`rowIndex=${rowIndex}`);
            }
          }
        }
      } else {
        expect(() => func(...paramValues)).not.toThrow();
      }
    });
  });
}

/**
 * Generic test runner for simple validation functions with single parameter.
 * Common pattern for functions like validateDefinitionKey_, validatePrimaryTopicKey_.
 *
 * @param {Object} options - Test configuration
 * @param {string} options.functionName - Name of function to test
 * @param {Array} options.testCases - Array of test case objects
 * @param {string} options.method - Method name for error assertion
 * @param {boolean} options.hasRowIndex - Whether function takes rowIndex parameter
 * @param {boolean} options.hasFieldName - Whether function takes fieldName parameter
 * @returns {void}
 */
export function runSimpleValidationTest({
  functionName,
  testCases,
  method,
  hasRowIndex = true,
  hasFieldName = false,
}) {
  installAssignmentDefinitionControllerStub([]);
  const module = loadAssignmentDefinitionPartialsModule();
  const func = module[functionName];

  testCases.forEach(({ description, shouldThrow, expectedError, expectedField, ...params }) => {
    const paramValues = Object.values(params);

    it(`handles ${description} correctly`, () => {
      if (shouldThrow) {
        expect(() => func(...paramValues)).toThrow(ApiValidationError);
        expect(() => func(...paramValues)).toThrow(expectedError);
        try {
          func(...paramValues);
        } catch (err) {
          expect(err.fieldName).toBe(expectedField);
          expect(err.method).toBe(method);
          if (hasRowIndex && params.rowIndex !== undefined) {
            expect(err.details).toBe(`rowIndex=${params.rowIndex}`);
          }
        }
      } else {
        expect(() => func(...paramValues)).not.toThrow();
      }
    });
  });
}

/**
 * Helper to build a valid upsert parameters object.
 * @param {Object} overrides - Properties to override
 * @returns {Object} Valid upsert parameters
 */
export function buildValidUpsertParams(overrides = {}) {
  return {
    primaryTitle: 'Test Assignment',
    primaryTopicKey: 'test-topic',
    referenceDocumentId: 'ref-doc-001',
    templateDocumentId: 'tpl-doc-001',
    yearGroupKey: 'year-10',
    ...overrides,
  };
}

/**
 * Helper to build a valid row for partial row validation tests.
 * @param {Object} overrides - Properties to override
 * @returns {Object} Valid row object
 */
export function buildValidRow(overrides = {}) {
  return buildValidPartial(overrides);
}

// ============================================================================
// Test Execution Helpers for Deduplication
// ============================================================================

/**
 * Creates a test context with loaded module and stub for validation tests.
 * This reduces duplication of the common pattern: install stub, load module, get function.
 *
 * @param {string} functionName - The function name to extract from the module
 * @returns {Object} { module, func, AssignmentDefinitionController, getAllPartialDefinitions }
 */
export function createValidationTestContext(functionName) {
  const stubResult = installAssignmentDefinitionControllerStub([]);
  const module = loadAssignmentDefinitionPartialsModule();
  const func = module[functionName];
  return { module, func, ...stubResult };
}

/**
 * Creates a test context with loaded module and stub, with fresh module cache.
 * Use this in beforeEach for tests that need the module reloaded each time.
 *
 * @param {string} functionName - The function name to extract from the module
 * @returns {Function} A function that returns { module, func, AssignmentDefinitionController, getAllPartialDefinitions }
 */
export function createFreshValidationTestContext(functionName) {
  return () => {
    const stubResult = installAssignmentDefinitionControllerStub([]);
    const module = loadAssignmentDefinitionPartialsModule();
    const func = module[functionName];
    return { module, func, ...stubResult };
  };
}

/**
 * Generic assertion helper for validation error tests.
 * Verifies that a function throws ApiValidationError with expected properties.
 *
 * @param {Function} func - The function to test
 * @param {Array} args - Arguments to pass to the function
 * @param {Object} expectations - Expected error properties
 * @param {string} expectations.errorMessage - Expected error message
 * @param {string} expectations.fieldName - Expected fieldName
 * @param {string} expectations.method - Expected method
 * @param {string} [expectations.details] - Expected details (optional)
 * @returns {void}
 */
export function assertValidationError(func, args, { errorMessage, fieldName, method, details }) {
  expect(() => func(...args)).toThrow(ApiValidationError);
  expect(() => func(...args)).toThrow(errorMessage);
  try {
    func(...args);
  } catch (err) {
    expect(err.fieldName).toBe(fieldName);
    expect(err.method).toBe(method);
    if (details !== undefined) {
      expect(err.details).toBe(details);
    }
  }
}

/**
 * Generic assertion helper for validation pass tests.
 * Verifies that a function does not throw.
 *
 * @param {Function} func - The function to test
 * @param {Array} args - Arguments to pass to the function
 * @returns {void}
 */
export function assertValidationPasses(func, args) {
  expect(() => func(...args)).not.toThrow();
}

/**
 * Helper to create describe blocks for validation functions with rowIndex parameter.
 * This consolidates the common pattern for functions like validateDefinitionKey_,
 * validatePrimaryTopicKey_, validateTimestamp_, etc.
 *
 * @param {string} functionName - Name of the validation function to test
 * @param {string} method - The method name for error assertions
 * @param {Array} testCases - Array of test case objects
 * @returns {void}
 */
export function describeRowIndexValidation(functionName, method, testCases) {
  describe(functionName, () => {
    const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

    beforeEach(beforeEachHandler);
    afterEach(afterEachHandler);

    let func;
    beforeEach(() => {
      installAssignmentDefinitionControllerStub([]);
      const module = loadAssignmentDefinitionPartialsModule();
      func = module[functionName];
    });

    testCases.forEach(({ description, shouldThrow, expectedError, expectedField, ...params }) => {
      const paramValues = Object.values(params);

      it(`handles ${description} correctly`, () => {
        if (shouldThrow) {
          expect(() => func(...paramValues)).toThrow(ApiValidationError);
          expect(() => func(...paramValues)).toThrow(expectedError);
          try {
            func(...paramValues);
          } catch (err) {
            expect(err.fieldName).toBe(expectedField);
            expect(err.method).toBe(method);
            // Check for rowIndex in params and add to details if present
            if (params.rowIndex !== undefined) {
              expect(err.details).toBe(`rowIndex=${params.rowIndex}`);
            }
          }
        } else {
          expect(() => func(...paramValues)).not.toThrow();
        }
      });
    });
  });
}

/**
 * Helper to create describe blocks for simple parameter validation functions.
 * This consolidates the common pattern for functions like validateReadParameters_,
 * validateRequiredYearGroupKey_, etc.
 *
 * @param {string} functionName - Name of the validation function to test
 * @param {string} method - The method name for error assertions
 * @param {Array} testCases - Array of test case objects
 * @param {boolean} hasRowIndex - Whether to expect rowIndex in error details
 * @returns {void}
 */
export function describeParameterValidation(functionName, method, testCases, hasRowIndex = false) {
  describe(functionName, () => {
    const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

    beforeEach(beforeEachHandler);
    afterEach(afterEachHandler);

    let func;
    beforeEach(() => {
      installAssignmentDefinitionControllerStub([]);
      const module = loadAssignmentDefinitionPartialsModule();
      func = module[functionName];
    });

    testCases.forEach(({ description, shouldThrow, expectedError, expectedField, ...params }) => {
      const paramValues = Object.values(params);

      it(`handles ${description} correctly`, () => {
        if (shouldThrow) {
          expect(() => func(...paramValues)).toThrow(ApiValidationError);
          expect(() => func(...paramValues)).toThrow(expectedError);
          try {
            func(...paramValues);
          } catch (err) {
            expect(err.fieldName).toBe(expectedField);
            expect(err.method).toBe(method);
            if (hasRowIndex && params.rowIndex !== undefined) {
              expect(err.details).toBe(`rowIndex=${params.rowIndex}`);
            }
          }
        } else {
          const result = func(...paramValues);
          // For validateReadParameters_, it returns the definitionKey
          if (params.definitionKey !== undefined) {
            expect(result).toBe(params.definitionKey);
          }
          expect(() => func(...paramValues)).not.toThrow();
        }
      });
    });
  });
}

/**
 * Helper to create describe blocks for throwing validation error functions.
 * This consolidates the common pattern for functions like throwValidationError_,
 * throwReadValidationError_, throwUpsertValidationError_, throwDeleteValidationError_.
 *
 * @param {string} functionName - Name of the error throwing function to test
 * @param {string} method - The method name for error assertions
 * @param {Array} testCases - Array of test case objects with args and expectations
 * @returns {void}
 */
export function describeThrowValidationError(functionName, method, testCases) {
  describe(functionName, () => {
    const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

    beforeEach(beforeEachHandler);
    afterEach(afterEachHandler);

    let func;
    beforeEach(() => {
      installAssignmentDefinitionControllerStub([]);
      const module = loadAssignmentDefinitionPartialsModule();
      func = module[functionName];
    });

    testCases.forEach(({ description, args, errorMessage, fieldName, details }) => {
      it(description, () => {
        expect(() => func(...args)).toThrow(ApiValidationError);
        expect(() => func(...args)).toThrow(errorMessage);
        try {
          func(...args);
        } catch (err) {
          expect(err.message).toBe(errorMessage);
          expect(err.method).toBe(method);
          expect(err.fieldName).toBe(fieldName);
          if (details !== undefined) {
            expect(err.details).toBe(details);
          }
        }
      });
    });
  });
}
