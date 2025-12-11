/**
 * Factory functions for creating test model instances
 * Reduces duplication of model creation logic across tests
 */

const { TaskDefinition } = require('../../src/AdminSheet/Models/TaskDefinition.js');
const { StudentSubmission } = require('../../src/AdminSheet/Models/StudentSubmission.js');
const { ArtifactFactory } = require('../../src/AdminSheet/Models/Artifacts/index.js');
const { AssignmentDefinition } = require('../../src/AdminSheet/Models/AssignmentDefinition.js');
const Assignment = require('../../src/AdminSheet/AssignmentProcessor/Assignment.js');

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
 * Create a SlidesAssignment for testing using fromJSON to avoid GAS service calls.
 * @param {Object} props - Configuration properties
 * @param {string} props.courseId - Course ID (default: 'c1')
 * @param {string} props.assignmentId - Assignment ID (default: 'a1')
 * @param {string} props.referenceDocumentId - Reference document ID (default: 'ref1')
 * @param {string} props.templateDocumentId - Template document ID (default: 'tpl1')
 * @param {string} props.assignmentName - Assignment name (default: 'Test Slides Assignment')
 * @param {Object} props.tasks - Tasks object (default: {})
 * @param {Array} props.submissions - Submissions array (default: [])
 * @returns {SlidesAssignment} Created SlidesAssignment instance
 */
function createSlidesAssignment(props = {}) {
  const {
    courseId = 'c1',
    assignmentId = 'a1',
    referenceDocumentId = 'ref1',
    templateDocumentId = 'tpl1',
    assignmentName = 'Test Slides Assignment',
    tasks = {},
    submissions = [],
    ...rest
  } = props;

  const definition = new AssignmentDefinition({
    primaryTitle: assignmentName,
    primaryTopic: 'Topic',
    yearGroup: null,
    documentType: 'SLIDES',
    referenceDocumentId,
    templateDocumentId,
    tasks,
    referenceLastModified: '2024-01-01T00:00:00.000Z',
    templateLastModified: '2024-01-01T00:00:00.000Z',
  });

  return Assignment.fromJSON({
    courseId,
    assignmentId,
    assignmentName,
    assignmentDefinition: definition.toJSON(),
    submissions,
    ...rest,
  });
}

/**
 * Create a SheetsAssignment for testing using fromJSON to avoid GAS service calls.
 * @param {Object} props - Configuration properties
 * @param {string} props.courseId - Course ID (default: 'c1')
 * @param {string} props.assignmentId - Assignment ID (default: 'a1')
 * @param {string} props.referenceDocumentId - Reference document ID (default: 'ref1')
 * @param {string} props.templateDocumentId - Template document ID (default: 'tpl1')
 * @param {string} props.assignmentName - Assignment name (default: 'Test Sheets Assignment')
 * @param {Object} props.tasks - Tasks object (default: {})
 * @param {Array} props.submissions - Submissions array (default: [])
 * @returns {Assignment} Created SheetsAssignment instance
 */
function createSheetsAssignment(props = {}) {
  const {
    courseId = 'c1',
    assignmentId = 'a1',
    referenceDocumentId = 'ref1',
    templateDocumentId = 'tpl1',
    assignmentName = 'Test Sheets Assignment',
    tasks = {},
    submissions = [],
    ...rest
  } = props;

  const definition = new AssignmentDefinition({
    primaryTitle: assignmentName,
    primaryTopic: 'Topic',
    yearGroup: null,
    documentType: 'SHEETS',
    referenceDocumentId,
    templateDocumentId,
    tasks,
    referenceLastModified: '2024-01-01T00:00:00.000Z',
    templateLastModified: '2024-01-01T00:00:00.000Z',
  });

  return Assignment.fromJSON({
    courseId,
    assignmentId,
    assignmentName,
    assignmentDefinition: definition.toJSON(),
    submissions,
    ...rest,
  });
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
 * Dummy CacheManager class for testing
 */
class DummyCacheManager {
  constructor() {
    this.store = new Map();
  }
  getCachedAssessment(refHash, respHash) {
    return this.store.get(refHash + '::' + respHash) || null;
  }
  setCachedAssessment(refHash, respHash, val) {
    this.store.set(refHash + '::' + respHash, val);
  }
  clearCache() {
    this.store.clear();
  }
}

/**
 * Dummy BaseRequestManager class for testing
 */
class DummyBaseRequestManager {
  constructor(options = {}) {
    this.responseCode = options.responseCode || 200;
    this.responseBody = options.responseBody || null;
  }
  sendRequestsInBatches(requests) {
    return requests.map((r) => ({
      getResponseCode: () => this.responseCode,
      getContentText: () =>
        JSON.stringify(
          this.responseBody || {
            completeness: { score: 5, reasoning: 'ok' },
            accuracy: { score: 4, reasoning: 'fine' },
            spag: { score: 3, reasoning: 'avg' },
          }
        ),
    }));
  }
  sendRequestWithRetries() {
    return null;
  }
}

/**
 * Create a dummy CacheManager for testing
 * @returns {Object} Dummy CacheManager instance with in-memory store
 */
function createDummyCacheManager() {
  return new DummyCacheManager();
}

/**
 * Create a dummy BaseRequestManager for testing
 * @param {Object} options - Configuration options
 * @returns {Object} Dummy BaseRequestManager instance
 */
function createDummyBaseRequestManager(options = {}) {
  return new DummyBaseRequestManager(options);
}

/**
 * Setup global dummy classes for testing
 * Useful for tests that need basic implementations without full mocks
 */
function setupGlobalDummyClasses() {
  if (!globalThis.ProgressTracker) {
    globalThis.ProgressTracker = {
      getInstance: () => createDummyProgressTracker(),
    };
  }

  if (!globalThis.Assessment) {
    globalThis.Assessment = class {
      constructor(score, reasoning) {
        this.score = score;
        this.reasoning = reasoning;
      }
      toJSON() {
        return { score: this.score, reasoning: this.reasoning };
      }
    };
  }

  if (!globalThis.BaseRequestManager) {
    globalThis.BaseRequestManager = DummyBaseRequestManager;
  }

  if (!globalThis.CacheManager) {
    globalThis.CacheManager = DummyCacheManager;
  }
}

module.exports = {
  createTaskDefinition,
  createTextTask,
  createStudentSubmission,
  createSlidesAssignment,
  createSheetsAssignment,
  createDummyProgressTracker,
  createDummyConfigurationManager,
  createDummyCacheManager,
  createDummyBaseRequestManager,
  setupGlobalDummyClasses,
  DummyCacheManager,
  DummyBaseRequestManager,
};
