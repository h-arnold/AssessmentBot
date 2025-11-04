/**
 * Helper functions for controller tests to reduce duplication
 * Provides reusable patterns for common test setups and assertions
 */

import {
  createSlidesAssignment,
  createSheetsAssignment,
  createTextTask,
  createStudentSubmission,
} from './modelFactories.js';

/**
 * Create a test fixture with ABClass and assignment for controller tests
 * @param {Object} options - Configuration options
 * @param {Object} options.ABClass - ABClass constructor
 * @param {string} options.courseId - Course ID
 * @param {string} options.assignmentId - Assignment ID
 * @param {string} options.documentType - 'SLIDES' or 'SHEETS'
 * @param {boolean} options.includeTask - Whether to include a task
 * @param {boolean} options.includeSubmission - Whether to include a submission
 * @returns {Object} { abClass, assignment, taskDef?, submission? }
 */
export function createTestFixture(options = {}) {
  const {
    ABClass,
    courseId = 'test-course',
    assignmentId = 'test-assignment',
    documentType = 'SLIDES',
    includeTask = false,
    includeSubmission = false,
    className = 'Test Class',
  } = options;

  const abClass = new ABClass(courseId, className);

  let taskDef = null;
  let submission = null;
  const tasks = {};
  const submissions = [];

  if (includeTask) {
    taskDef = createTextTask(0, 'Reference content', 'Template content');
    tasks[taskDef.getId()] = taskDef.toJSON();
  }

  if (includeSubmission) {
    submission = createStudentSubmission({
      studentId: 'student-1',
      assignmentId,
      documentId: 'doc-1',
    });

    // If we have both task and submission, add an item for the task to the submission
    if (includeTask && taskDef) {
      submission.upsertItemFromExtraction(taskDef, {
        pageId: 'p0',
        content: 'Student response content',
        metadata: {},
      });
    }

    submissions.push(submission.toJSON());
  }

  const createFn = documentType === 'SLIDES' ? createSlidesAssignment : createSheetsAssignment;
  const assignment = createFn({
    courseId,
    assignmentId,
    tasks,
    submissions,
  });

  return {
    abClass,
    assignment,
    taskDef,
    submission,
  };
}

/**
 * Setup rehydration test scenario with partial assignment in abClass
 * @param {Object} options - Configuration options
 * @param {Object} options.abClass - ABClass instance
 * @param {Object} options.assignment - Assignment instance
 * @param {Object} options.Assignment - Assignment constructor/factory
 * @param {Object} options.mockCollection - Mock collection to setup
 * @returns {Object} { partialInstance, fullJson }
 */
export function setupRehydrationScenario(options = {}) {
  const { abClass, assignment, Assignment, mockCollection } = options;

  // Add partial assignment to abClass
  const partialJson = assignment.toPartialJSON();
  const partialInstance = Assignment.fromJSON(partialJson);
  abClass.addAssignment(partialInstance);

  // Mock database to return full assignment
  const fullJson = assignment.toJSON();
  mockCollection.findOne.mockReturnValue(fullJson);

  return {
    partialInstance,
    fullJson,
  };
}

/**
 * Assert that a method exists (RED phase pattern)
 * @param {Object} instance - Instance to check
 * @param {string} methodName - Method name to check
 */
export function assertMethodExists(instance, methodName) {
  expect(typeof instance[methodName]).toBe('function');
}

/**
 * Create multiple assignments for testing
 * @param {Object} options - Configuration options
 * @param {string} options.courseId - Course ID
 * @param {number} options.count - Number of assignments to create
 * @param {string} options.documentType - 'SLIDES' or 'SHEETS' or 'mixed'
 * @returns {Array} Array of assignment instances
 */
export function createMultipleAssignments(options = {}) {
  const { courseId = 'test-course', count = 3, documentType = 'SLIDES' } = options;

  const assignments = [];
  for (let i = 0; i < count; i++) {
    const assignmentId = `assign-${i + 1}`;
    let createFn;

    if (documentType === 'mixed') {
      createFn = i % 2 === 0 ? createSlidesAssignment : createSheetsAssignment;
    } else {
      createFn = documentType === 'SLIDES' ? createSlidesAssignment : createSheetsAssignment;
    }

    const assignment = createFn({
      courseId,
      assignmentId,
    });
    assignments.push(assignment);
  }

  return assignments;
}

/**
 * Verify database write operations occurred
 * @param {Object} mockCollection - Mock collection instance
 * @returns {Object} { writeOccurred, writeCall, payload }
 */
export function verifyDatabaseWrite(mockCollection) {
  const writeCalls =
    mockCollection.replaceOne.mock.calls.length + mockCollection.insertOne.mock.calls.length;
  const writeOccurred = writeCalls > 0;
  const writeCall =
    mockCollection.replaceOne.mock.calls[0] || mockCollection.insertOne.mock.calls[0];
  const payload = writeCall ? writeCall[0] : null;

  return {
    writeOccurred,
    writeCall,
    payload,
  };
}

/**
 * Create error test scenario for missing/corrupt data
 * @param {Object} mockCollection - Mock collection to configure
 * @param {string} errorType - 'missing', 'empty', 'corrupt'
 */
export function setupErrorScenario(mockCollection, errorType) {
  switch (errorType) {
    case 'missing':
      mockCollection.findOne.mockImplementation(() => {
        throw new Error('Collection not found');
      });
      break;
    case 'empty':
      mockCollection.findOne.mockReturnValue(null);
      break;
    case 'corrupt':
      mockCollection.findOne.mockReturnValue({
        // Missing required fields
        courseId: 'test',
        // assignmentId missing
        // documentType missing
      });
      break;
    default:
      throw new Error(`Unknown error type: ${errorType}`);
  }
}
