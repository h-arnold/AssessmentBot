/**
 * Helper functions for createDefinitionFromWizardInputs tests
 * Reduces duplication in test setup and assertions
 */

const { createTaskDefinition } = require('./modelFactories.js');

/**
 * Default timestamp for mock definitions
 */
const DEFAULT_TIMESTAMP = '2024-01-01T00:00:00.000Z';

/**
 * Get AssignmentController class
 */
function getAssignmentController() {
  const AssignmentController =
    require('../../src/backend/y_controllers/AssignmentController').default ||
    require('../../src/backend/y_controllers/AssignmentController');
  return AssignmentController;
}

/**
 * Get ABClassController class
 */
function getABClassController() {
  const ABClassController =
    require('../../src/backend/y_controllers/ABClassController').default ||
    require('../../src/backend/y_controllers/ABClassController');
  return ABClassController;
}

/**
 * Create a mock AssignmentDefinition
 * @param {Object} vi - Vitest vi for mocking (not always needed)
 * @param {Object} options - Configuration
 * @param {string} options.primaryTitle - Title (default: 'Title')
 * @param {string} options.primaryTopic - Topic (default: 'Topic')
 * @param {string} options.yearGroupKey - Year group (default: 'year-group-10')
 * @param {string} options.documentType - Type (default: 'SLIDES')
 * @param {string} options.referenceDocumentId - Required
 * @param {string} options.templateDocumentId - Required
 * @param {number} options.taskIndex - Task index (default: 0)
 * @param {Object} options.tasks - Custom tasks
 * @returns {AssignmentDefinition} Mock definition
 */
function createMockDefinition(vi, options = {}) {
  const {
    primaryTitle = 'Title',
    primaryTopic = 'Topic',
    yearGroupKey = 'year-group-10',
    documentType = 'SLIDES',
    referenceDocumentId,
    templateDocumentId,
    taskIndex = 0,
    tasks = null,
    referenceLastModified = DEFAULT_TIMESTAMP,
    templateLastModified = DEFAULT_TIMESTAMP,
  } = options;

  if (!referenceDocumentId || !templateDocumentId) {
    throw new Error('referenceDocumentId and templateDocumentId are required');
  }

  const mockTask = createTaskDefinition({ index: taskIndex });
  const tasksObj = tasks || { [`task_${taskIndex}`]: mockTask };

  const { AssignmentDefinition } = require('../../src/backend/Models/AssignmentDefinition.js');
  return new AssignmentDefinition({
    primaryTitle,
    primaryTopic,
    yearGroupKey,
    documentType,
    referenceDocumentId,
    templateDocumentId,
    tasks: tasksObj,
    referenceLastModified,
    templateLastModified,
  });
}

/**
 * Create and mock AssignmentController.ensureDefinitionFromInputs
 * @param {Object} vi - Vitest vi
 * @param {Object} options - Configuration
 * @param {Object} options.definition - Definition to return
 * @param {Object} options.abClass - Optional abClass to return
 * @param {Function} options.implementation - Custom implementation for error cases
 * @returns {Object} The spy
 */
function setupMockEnsureDefinition(vi, options = {}) {
  const { definition, abClass, implementation } = options;
  const AssignmentController = getAssignmentController();

  if (implementation) {
    return vi
      .spyOn(AssignmentController.prototype, 'ensureDefinitionFromInputs')
      .mockImplementation(implementation);
  }

  const mockReturn = { definition };
  if (abClass !== undefined) {
    mockReturn.abClass = abClass;
  }

  return vi
    .spyOn(AssignmentController.prototype, 'ensureDefinitionFromInputs')
    .mockReturnValue(mockReturn);
}

/**
 * Create a new AssignmentController
 * @returns {AssignmentController} Instance
 */
function createTestController() {
  return new (getAssignmentController())();
}

/**
 * Create Google Drive URL from file ID
 * @param {string} fileId - File ID
 * @param {string} docType - 'SLIDES' or 'SHEETS' (default: 'SLIDES')
 * @returns {string} URL
 */
function buildDriveUrl(fileId, docType = 'SLIDES') {
  const path = docType === 'SHEETS' ? 'spreadsheets' : 'presentation';
  return `https://docs.google.com/${path}/d/${fileId}/edit`;
}

/**
 * Assert basic result properties
 * @param {Object} expect - Vitest expect
 * @param {Object} result - Result to check
 * @param {string} docType - Expected document type (default: 'SLIDES')
 */
function assertBasicResult(expect, result, docType = 'SLIDES') {
  expect(result).toBeDefined();
  expect(result.documentType).toBe(docType);
  expect(result.tasks).toBeDefined();
}

/**
 * Assert full AssignmentDefinition shape
 * @param {Object} expect - Vitest expect
 * @param {Object} result - Result to check
 */
function assertDefinitionShape(expect, result) {
  expect(result).toHaveProperty('primaryTitle');
  expect(result).toHaveProperty('primaryTopic');
  expect(result).toHaveProperty('documentType');
  expect(result).toHaveProperty('referenceDocumentId');
  expect(result).toHaveProperty('templateDocumentId');
  expect(result).toHaveProperty('tasks');
  expect(result).toHaveProperty('definitionKey');
}

/**
 * Assert normalised document IDs were passed to ensureDefinitionFromInputs
 * @param {Object} expect - Vitest expect
 * @param {Object} spy - The spy
 * @param {string} refId - Expected reference ID
 * @param {string} tplId - Expected template ID
 */
function assertNormalisedIds(expect, spy, refId, tplId) {
  expect(spy).toHaveBeenCalledWith(
    expect.objectContaining({
      documentIds: {
        referenceDocumentId: refId,
        templateDocumentId: tplId,
      },
    })
  );
}

/**
 * Assert yearGroupKey was passed to ensureDefinitionFromInputs
 * @param {Object} expect - Vitest expect
 * @param {Object} spy - The spy
 * @param {string|null} yearGroupKey - Expected yearGroupKey
 */
function assertYearGroupKey(expect, spy, yearGroupKey) {
  expect(spy).toHaveBeenCalledWith(
    expect.objectContaining({
      yearGroupKey,
    })
  );
}

/**
 * Create standard parameters for testing
 * @param {Object} overrides - Override defaults
 * @returns {Object} Parameters
 */
function standardParams(overrides = {}) {
  return {
    assignmentId: 'a1',
    courseId: 'course-1',
    assignmentTitle: 'Title',
    referenceDocumentId: STANDARD_DOCS.refId,
    templateDocumentId: STANDARD_DOCS.tplId,
    ...overrides,
  };
}

/**
 * Standard document file IDs for consistency
 */
const STANDARD_DOCS = {
  refId: '1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uv',
  tplId: '2xY9wV8uT7sR6qP5oN4mL3kJ2iH1gF0ef',
  slidesRef: '3zX8wV7uT6sR5qP4oN3mL2kJ1iH0gF9ef',
  slidesTpl: '4aB3cD2eF1gH0iJ9kL8mN7oP6qR5sT4uv',
  sheetsRef: '7cD6eF5gH4iJ3kL2mN1oP0qR9sT8uV7wx',
  sheetsTpl: '8dE7fG6hI5jK4lM3nO2pQ1rS0tU9vW8xy',
};

module.exports = {
  DEFAULT_TIMESTAMP,
  getAssignmentController,
  getABClassController,
  createMockDefinition,
  setupMockEnsureDefinition,
  createTestController,
  buildDriveUrl,
  assertBasicResult,
  assertDefinitionShape,
  assertNormalisedIds,
  assertYearGroupKey,
  standardParams,
  STANDARD_DOCS,
};
