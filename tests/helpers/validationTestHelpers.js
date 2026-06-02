/**
 * Generic validation test helpers for assignmentDefinitionPartials tests
 * Reduces duplication in validation function test suites
 */

import { expect } from 'vitest';
import {
  installAssignmentDefinitionControllerStub,
  loadAssignmentDefinitionPartialsModule,
} from './assignmentDefinitionPartialsTestHelpers.js';
const ApiValidationError = require('../../src/backend/Utils/ErrorTypes/ApiValidationError.js');

/**
 * Helper constants for backslash strings
 */
export const BACKSLASH_STRINGS = {
  single: '\\',
  double: '\\\\',
  path: '\\path\\to\\file',
  keyWithBackslash: 'key\\with\\backslash',
  invalidKey: 'invalid\\key',
  validKey: 'valid\\key',
  testValue: 'test\\value',
  invalidSlash: 'invalid/key',
  validSlash: 'valid/key',
};
