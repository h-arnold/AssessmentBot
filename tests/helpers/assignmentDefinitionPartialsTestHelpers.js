/**
 * Shared fixtures and helpers for the assignmentDefinitionPartials.<concern>.test.js suites.
 * Used by the split transport and validation suites to avoid duplicated setup.
 */

import { expect, it, vi } from 'vitest';
import path from 'node:path';

const transportModulePath = '../../src/backend/z_Api/assignmentDefinitionTransport.js';
// Assignment-definition validation is split across a three-module folder; keep
// all paths together so cache clearing and source assertions cover each module.
const validationModulePath =
  '../../src/backend/z_Api/assignmentDefinition/assignmentDefinitionValidation.js';
const upsertValidationModulePath =
  '../../src/backend/z_Api/assignmentDefinition/assignmentDefinitionUpsertValidation.js';
const partialRowValidationModulePath =
  '../../src/backend/z_Api/assignmentDefinition/assignmentDefinitionPartialRowValidation.js';
const ApiValidationError = require('#backend/Utils/ErrorTypes/ApiValidationError.js');

// Test URLs similar to but not exactly the same as the example:
// https://docs.google.com/presentation/d/1udlgDTkZlHB6Xh4GKlOk6I0zJI-dvAF4iFAun09yW0k/edit
export const VALID_GOOGLE_URLS = {
  SLIDES: {
    basic: 'https://docs.google.com/presentation/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/edit',
    withQuery:
      'https://docs.google.com/presentation/d/2aBcDeFgHiJkLmNoPqRsTuVwXyZ/edit?usp=sharing',
    withHash: 'https://docs.google.com/presentation/d/3aBcDeFgHiJkLmNoPqRsTuVwXyZ/edit#slide=id.p1',
    withQueryAndHash:
      'https://docs.google.com/presentation/d/4aBcDeFgHiJkLmNoPqRsTuVwXyZ/view?usp=sharing#slide=id.p1',
    viewMode: 'https://docs.google.com/presentation/d/5aBcDeFgHiJkLmNoPqRsTuVwXyZ/view',
    mixedCaseHost: 'https://DOCS.GOOGLE.COM/presentation/d/6aBcDeFgHiJkLmNoPqRsTuVwXyZ/edit',
  },
  SHEETS: {
    basic: 'https://docs.google.com/spreadsheets/d/1xYzAbCdEfGhIjKlMnOpQrStUvWx/edit',
    withQuery:
      'https://docs.google.com/spreadsheets/d/2xYzAbCdEfGhIjKlMnOpQrStUvWx/edit?usp=sharing',
    gsheetPrefix: 'https://docs.google.com/spreadsheets/d/3xYzAbCdEfGhIjKlMnOpQrStUvWx/edit#gid=0',
  },
};

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
  delete require.cache[require.resolve(transportModulePath)];
  return require(transportModulePath);
}

/**
 * Loads the split assignment-definition validation modules (shared core, upsert
 * and partial-row) and returns their exports merged into a single object.
 * Clears require caches so the three modules re-execute. Cross-file helpers keep
 * resolving via the test-bootstrapped globals, mirroring GAS single-scope
 * concatenation; all exported helpers are stateless, so stale global bindings
 * cannot affect behaviour.
 * @returns {Object} The merged exports of all three validation modules
 */
export function loadAssignmentDefinitionValidationModule() {
  delete require.cache[require.resolve(validationModulePath)];
  delete require.cache[require.resolve(upsertValidationModulePath)];
  delete require.cache[require.resolve(partialRowValidationModulePath)];
  return {
    ...require(validationModulePath),
    ...require(upsertValidationModulePath),
    ...require(partialRowValidationModulePath),
  };
}

/**
 * Reads the source file content.
 * @param {string} [filePath] - Optional file path (defaults to transport module path)
 * @returns {string} The source code as a string
 */
export function readSourceFile(filePath) {
  const fs = require('node:fs');
  const absolutePath = path.resolve(__dirname, filePath || transportModulePath);
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
    tasks: [],
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
    delete require.cache[require.resolve(transportModulePath)];
    delete require.cache[require.resolve(validationModulePath)];
    delete require.cache[require.resolve(upsertValidationModulePath)];
    delete require.cache[require.resolve(partialRowValidationModulePath)];

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
 * Reads and concatenates the contents of all three assignment-definition
 * validation source files.
 * @returns {string} The combined validation source code
 */
function readAssignmentDefinitionValidationSources() {
  return [validationModulePath, upsertValidationModulePath, partialRowValidationModulePath]
    .map((filePath) => readSourceFile(filePath))
    .join('\n');
}

/**
 * Helper to verify a function name DOES exist in one of the validation source
 * files.
 * @param {string} functionName - The function name to check for
 * @returns {void}
 */
export function expectValidationFunctionInSource(functionName) {
  const sourceCode = readAssignmentDefinitionValidationSources();
  expect(sourceCode).toContain(`function ${functionName}`);
}

/**
 * Helper to verify a function name does NOT exist in any of the validation
 * source files.
 * @param {string} functionName - The function name to check for
 * @returns {void}
 */
export function expectValidationFunctionNotInSource(functionName) {
  const sourceCode = readAssignmentDefinitionValidationSources();
  expect(sourceCode).not.toContain(`function ${functionName}`);
}

/**
 * Helper to verify a string pattern exists in one of the validation source
 * files.
 * @param {string} pattern - The pattern to search for
 * @returns {void}
 */
export function expectValidationPatternInSource(pattern) {
  const sourceCode = readAssignmentDefinitionValidationSources();
  expect(sourceCode).toContain(pattern);
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
    tasks: [],
    createdAt: '2026-01-05T10:00:00.000Z',
    updatedAt: '2026-01-06T12:30:00.000Z',
    ...overrides,
  };
}

/**
 * Generates boolean-result cases; invoke(value) returns the result for one value.
 * @param {Object} options - Runner options
 * @param {Array} options.testCases - Cases with description, value and expected
 * @param {Function} options.invoke - Returns the boolean result for a value
 * @param {Function} [options.setup] - Optional per-test setup
 * @returns {void}
 */
export function runBinaryCases({ testCases, invoke, setup }) {
  testCases.forEach(({ description, value, expected }) => {
    it(`returns ${expected} for ${description}`, () => {
      setup?.();
      expect(invoke(value)).toBe(expected);
    });
  });
}

/**
 * Generates validation cases; invoke(params) returns a zero-argument thunk for
 * the function under test, so module loading stays inside each test.
 * @param {Object} options - Runner options
 * @param {Array} options.testCases - Cases with description, shouldThrow, expectedError,
 *   expectedField and the parameters passed to invoke
 * @param {Function} options.invoke - Returns a zero-argument thunk calling the function under test
 * @param {string} options.method - Method name expected on thrown errors
 * @param {boolean} [options.expectDetails] - Whether to assert rowIndex details
 * @param {Function} [options.onSuccess] - Receives the result and params for non-throwing cases
 * @param {Function} [options.setup] - Per-test setup; defaults to the controller stub
 * @returns {void}
 */
export function runValidationCases({
  testCases,
  invoke,
  setup = () => installAssignmentDefinitionControllerStub([]),
  method,
  expectDetails = false,
  onSuccess,
}) {
  testCases.forEach(({ description, shouldThrow, expectedError, expectedField, ...params }) => {
    it(`handles ${description} correctly`, () => {
      setup();
      const call = invoke(params);

      if (shouldThrow) {
        expect(call).toThrow(ApiValidationError);
        expect(call).toThrow(expectedError);
        try {
          call();
        } catch (err) {
          expect(err.fieldName).toBe(expectedField);
          expect(err.method).toBe(method);
          if (expectDetails) {
            expect(err.details).toBe(`rowIndex=${params.rowIndex}`);
          }
        }
      } else {
        const result = call();
        if (onSuccess) {
          onSuccess(result, params);
        }
        expect(call).not.toThrow();
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
