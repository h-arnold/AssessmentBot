/**
 * Factory functions for creating test model instances
 * Reduces duplication of model creation logic across tests
 */

const { TaskDefinition } = require('../../src/AdminSheet/Models/TaskDefinition.js');
const { StudentSubmission } = require('../../src/AdminSheet/Models/StudentSubmission.js');
const { ArtifactFactory } = require('../../src/AdminSheet/Models/Artifacts/index.js');

/**
 * Create a TaskDefinition for testing with sensible defaults
 * @param {Object} options - Configuration options
 * @param {number} options.index - Task index (default: 0)
 * @param {string} options.title - Task title (default: "Task {index}")
 * @param {string} options.pageId - Page ID (default: "p{index}")
 * @param {string} options.refContent - Reference artifact content (default: "Reference content")
 * @param {string} options.refType - Reference artifact type (default: "TEXT")
 * @param {string} options.templateContent - Template artifact content (default: "")
 * @param {string} options.templateType - Template artifact type (default: "TEXT")
 * @param {Object} options.taskMetadata - Additional task metadata
 * @param {boolean} options.skipArtifacts - Skip adding artifacts (default: false)
 * @returns {TaskDefinition} Created task definition
 */
function createTaskDefinition(options = {}) {
  const {
    index = 0,
    title = `Task ${index}`,
    pageId = `p${index}`,
    refContent = 'Reference content',
    refType = 'TEXT',
    templateContent = '',
    templateType = 'TEXT',
    taskMetadata = {},
    skipArtifacts = false,
  } = options;

  const td = new TaskDefinition({
    taskTitle: title,
    pageId: pageId,
    index: index,
    taskMetadata: taskMetadata,
  });

  if (!skipArtifacts) {
    td.addReferenceArtifact({ type: refType, content: refContent });
    td.addTemplateArtifact({ type: templateType, content: templateContent });
  }

  return td;
}

/**
 * Create a text TaskDefinition (convenience wrapper)
 * @param {number} index - Task index
 * @param {string} refContent - Reference content
 * @param {string} templateContent - Template content
 * @returns {TaskDefinition} Created task definition
 */
function createTextTask(index, refContent, templateContent = '') {
  return createTaskDefinition({
    index,
    title: `Task ${index}`,
    pageId: `p${index}`,
    refContent,
    templateContent,
    refType: 'TEXT',
    templateType: 'TEXT',
  });
}

/**
 * Create a StudentSubmission for testing
 * @param {Object} options - Configuration options
 * @param {string} options.studentId - Student ID (default: "student1")
 * @param {string} options.assignmentId - Assignment ID (default: "assignment1")
 * @param {string} options.documentId - Document ID (default: "doc1")
 * @returns {StudentSubmission} Created student submission
 */
function createStudentSubmission(options = {}) {
  const { studentId = 'student1', assignmentId = 'assignment1', documentId = 'doc1' } = options;

  return new StudentSubmission(studentId, assignmentId, documentId);
}

/**
 * Create a dummy ProgressTracker for testing
 * @returns {Object} Dummy ProgressTracker instance
 */
function createDummyProgressTracker() {
  return {
    logError: () => {},
    logAndThrowError: (msg) => {
      throw new Error(msg);
    },
    updateProgress: () => {},
    logInfo: () => {},
  };
}

/**
 * Create a dummy ConfigurationManager for testing
 * @param {Object} overrides - Override default methods
 * @returns {Object} Dummy ConfigurationManager instance
 */
function createDummyConfigurationManager(overrides = {}) {
  return {
    getBackendUrl: () => 'https://example.test',
    getApiKey: () => 'TESTKEY',
    getBackendAssessorBatchSize: () => 50,
    getWarmUpUrl: () => 'https://example.test/warm',
    getLangflowApiKey: () => 'WARMKEY',
    ...overrides,
  };
}

/**
 * Create a dummy CacheManager for testing
 * @returns {Object} Dummy CacheManager instance with in-memory store
 */
function createDummyCacheManager() {
  const store = new Map();
  return {
    store,
    getCachedAssessment: (refHash, respHash) => store.get(refHash + '::' + respHash) || null,
    setCachedAssessment: (refHash, respHash, val) => store.set(refHash + '::' + respHash, val),
    clearCache: () => store.clear(),
  };
}

/**
 * Create a dummy BaseRequestManager for testing
 * @param {Object} options - Configuration options
 * @returns {Object} Dummy BaseRequestManager instance
 */
function createDummyBaseRequestManager(options = {}) {
  const { responseCode = 200, responseBody = {} } = options;

  return {
    sendRequestsInBatches: (requests) => {
      return requests.map((r) => ({
        getResponseCode: () => responseCode,
        getContentText: () =>
          JSON.stringify(
            responseBody || {
              completeness: { score: 5, reasoning: 'ok' },
              accuracy: { score: 4, reasoning: 'fine' },
              spag: { score: 3, reasoning: 'avg' },
            }
          ),
      }));
    },
    sendRequestWithRetries: () => null,
  };
}

/**
 * Setup global dummy classes for testing
 * Useful for tests that need basic implementations without full mocks
 */
function setupGlobalDummyClasses() {
  if (!global.ProgressTracker) {
    global.ProgressTracker = {
      getInstance: () => createDummyProgressTracker(),
    };
  }

  if (!global.Assessment) {
    global.Assessment = class {
      constructor(score, reasoning) {
        this.score = score;
        this.reasoning = reasoning;
      }
      toJSON() {
        return { score: this.score, reasoning: this.reasoning };
      }
    };
  }

  if (!global.BaseRequestManager) {
    global.BaseRequestManager = createDummyBaseRequestManager;
  }

  if (!global.CacheManager) {
    global.CacheManager = createDummyCacheManager;
  }
}

module.exports = {
  createTaskDefinition,
  createTextTask,
  createStudentSubmission,
  createDummyProgressTracker,
  createDummyConfigurationManager,
  createDummyCacheManager,
  createDummyBaseRequestManager,
  setupGlobalDummyClasses,
};
