/**
 * Shared test helpers for assignmentDefinitionPartials.unit.test.js
 * Reduces duplication across Section 5 API layer refactoring tests
 */

import { expect, vi } from 'vitest';
import path from 'node:path';

const modulePath = '../../src/backend/z_Api/assignmentDefinitionPartials.js';

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
