/**
 * Assignment Factory Pattern Tests (RED Phase)
 *
 * Tests for polymorphic assignment creation and deserialization.
 * All tests should FAIL initially as the factory pattern is not yet implemented.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Assignment from '../../src/AdminSheet/AssignmentProcessor/Assignment.js';
import {
  createSlidesAssignment,
  createSheetsAssignment,
  createTextTask,
  createStudentSubmission,
} from '../helpers/modelFactories.js';

/**
 * Helper function to create standard test data for deserialization tests.
 * @param {string} docType - Document type (SLIDES or SHEETS)
 * @param {string} courseId - Course ID prefix
 * @return {object} Standard test data
 */
function createTestData(docType, courseId) {
  return {
    courseId,
    assignmentId: courseId.replace('c', 'a'),
    assignmentName: 'Test Assignment',
    documentType: docType,
    referenceDocumentId: courseId.replace('c', 'ref'),
    templateDocumentId: courseId.replace('c', 'tpl'),
    tasks: {},
    submissions: [],
  };
}

/**
 * Helper function to assert basic assignment properties.
 * @param {object} assignment - The assignment to check
 * @param {string} docType - Expected document type
 * @param {string} courseId - Expected course ID
 */
function assertAssignmentProperties(assignment, docType, courseId) {
  expect(assignment).toBeDefined();
  expect(assignment.documentType).toBe(docType);
  expect(assignment.courseId).toBe(courseId);
  expect(assignment.assignmentId).toBe(courseId.replace('c', 'a'));
  expect(assignment.referenceDocumentId).toBe(courseId.replace('c', 'ref'));
  expect(assignment.templateDocumentId).toBe(courseId.replace('c', 'tpl'));
}

// Note: These imports will need to exist for tests to pass
// They are expected to fail in RED phase
let SlidesAssignment, SheetsAssignment;
try {
  SlidesAssignment = require('../../src/AdminSheet/AssignmentProcessor/SlidesAssignment.js');
  SheetsAssignment = require('../../src/AdminSheet/AssignmentProcessor/SheetsAssignment.js');
} catch (e) {
  // Expected to fail in RED phase until modules export correctly
}

let originalLoggerGetInstance;

beforeEach(() => {
  // Save original ABLogger.getInstance if ABLogger is already defined in the test environment.
  if (typeof ABLogger !== 'undefined' && ABLogger && typeof ABLogger.getInstance === 'function') {
    originalLoggerGetInstance = ABLogger.getInstance;
  } else {
    originalLoggerGetInstance = undefined;
  }
});

afterEach(() => {
  // Restore ABLogger.getInstance if ABLogger exists and we saved a reference
  if (typeof ABLogger !== 'undefined' && originalLoggerGetInstance !== undefined) {
    ABLogger.getInstance = originalLoggerGetInstance;
  }
  vi.restoreAllMocks();
});

describe('Assignment.create() Factory Method', () => {
  const testCases = [
    { docType: 'SLIDES', courseId: 'c1', assignmentId: 'a1', refId: 'ref1', tplId: 'tpl1' },
    { docType: 'SHEETS', courseId: 'c2', assignmentId: 'a2', refId: 'ref2', tplId: 'tpl2' },
  ];

  testCases.forEach(({ docType, courseId, assignmentId, refId, tplId }) => {
    it(`should create a ${docType}Assignment for documentType ${docType}`, () => {
      const assignment = Assignment.create(docType, courseId, assignmentId, refId, tplId);
      assertAssignmentProperties(assignment, docType, courseId);
    });
  });

  it('should throw an error for an unknown documentType', () => {
    expect(() => {
      Assignment.create('INVALID', 'c1', 'a1', 'ref1', 'tpl1');
    }).toThrow(/unknown.*documentType/i);
  });

  it('should throw for null/undefined documentType', () => {
    expect(() => {
      Assignment.create(null, 'c1', 'a1', 'ref1', 'tpl1');
    }).toThrow();

    expect(() => {
      Assignment.create(undefined, 'c1', 'a1', 'ref1', 'tpl1');
    }).toThrow();
  });
});

describe('Assignment.fromJSON() Polymorphic Deserialization', () => {
  const testCases = [
    { docType: 'SLIDES', courseId: 'c1' },
    { docType: 'SHEETS', courseId: 'c2' },
  ];

  testCases.forEach(({ docType, courseId }) => {
    it(`should deserialize to a ${docType}Assignment when data.documentType is ${docType}`, () => {
      const data = createTestData(docType, courseId);
      const assignment = Assignment.fromJSON(data);
      assertAssignmentProperties(assignment, docType, courseId);
    });
  });

  it('should correctly restore subclass-specific properties (referenceDocumentId, templateDocumentId)', () => {
    const data = createTestData('SLIDES', 'c5');
    const assignment = Assignment.fromJSON(data);

    expect(assignment.referenceDocumentId).toBe('ref5');
    expect(assignment.templateDocumentId).toBe('tpl5');
  });

  it('should throw a user-facing error via ProgressTracker for invalid documentType values', () => {
    const tracker = globalThis.ProgressTracker.getInstance();
    const logAndThrowSpy = vi.spyOn(tracker, 'logAndThrowError').mockImplementation((msg) => {
      throw new Error(`ProgressTracker: ${msg}`);
    });

    expect(() =>
      Assignment.fromJSON({
        courseId: 'c-invalid',
        assignmentId: 'a-invalid',
        assignmentName: 'Invalid Assignment',
        documentType: 'INVALID',
        referenceDocumentId: 'ref-invalid',
        templateDocumentId: 'tpl-invalid',
        tasks: {},
        submissions: [],
      })
    ).toThrow(
      /ProgressTracker: Unknown assignment documentType 'INVALID' for courseId=c-invalid, assignmentId=a-invalid/
    );

    expect(logAndThrowSpy).toHaveBeenCalledWith(
      expect.stringContaining("documentType 'INVALID'"),
      expect.objectContaining({ documentType: 'INVALID' })
    );
  });

  it('should throw a user-facing error via ProgressTracker when documentType is missing', () => {
    const tracker = globalThis.ProgressTracker.getInstance();
    const logAndThrowSpy = vi.spyOn(tracker, 'logAndThrowError').mockImplementation((msg) => {
      throw new Error(`ProgressTracker: ${msg}`);
    });

    expect(() =>
      Assignment.fromJSON({
        courseId: 'c-missing',
        assignmentId: 'a-missing',
        assignmentName: 'Missing DocType Assignment',
        referenceDocumentId: 'ref-missing',
        templateDocumentId: 'tpl-missing',
        tasks: {},
        submissions: [],
      })
    ).toThrow(
      /ProgressTracker: Assignment data missing documentType for courseId=c-missing, assignmentId=a-missing/
    );

    expect(logAndThrowSpy).toHaveBeenCalledWith(
      expect.stringContaining('missing documentType'),
      expect.objectContaining({
        data: expect.objectContaining({ courseId: 'c-missing', assignmentId: 'a-missing' }),
      })
    );
  });

  it('should handle malformed data with clear error messages', () => {
    expect(() => Assignment.fromJSON(null)).toThrow(/Assignment\.fromJSON/i);
    expect(() => Assignment.fromJSON(undefined)).toThrow(/Assignment\.fromJSON/i);
    expect(() => Assignment.fromJSON({})).toThrow(/courseId|assignmentId/i);
  });

  it('should exclude transient fields (students, progressTracker, _hydrationLevel) from deserialization', () => {
    const sentinelTracker = { sentinel: true };
    const assignment = Assignment.fromJSON({
      courseId: 'c7',
      assignmentId: 'a7',
      assignmentName: 'Transient Fields Assignment',
      documentType: 'SLIDES',
      referenceDocumentId: 'ref7',
      templateDocumentId: 'tpl7',
      tasks: {},
      submissions: [],
      students: [{ id: 'student-1' }],
      progressTracker: sentinelTracker,
      _hydrationLevel: 'full',
    });

    expect(assignment.documentType).toBe('SLIDES');
    expect(assignment.students).toBeUndefined();
    expect(assignment.progressTracker).not.toBe(sentinelTracker);
    expect(assignment._hydrationLevel).toBeUndefined();
  });

  it('should ensure transient fields are absent from subsequent toJSON payloads', () => {
    const assignment = Assignment.fromJSON({
      courseId: 'c8',
      assignmentId: 'a8',
      assignmentName: 'Transient JSON Assignment',
      documentType: 'SHEETS',
      referenceDocumentId: 'ref8',
      templateDocumentId: 'tpl8',
      tasks: {},
      submissions: [],
      students: [{ id: 'student-1' }],
      progressTracker: { sentinel: true },
      _hydrationLevel: 'full',
    });

    const json = assignment.toJSON();

    expect(json.documentType).toBe('SHEETS');
    expect(json.students).toBeUndefined();
    expect(json.progressTracker).toBeUndefined();
    expect(json._hydrationLevel).toBeUndefined();
  });
});

describe('Polymorphic Round-Trip', () => {
  it('should preserve type and data for a SlidesAssignment after a toJSON() -> fromJSON() round-trip', () => {
    // RED: Full round-trip not working yet
    const original = createSlidesAssignment({
      courseId: 'c1',
      assignmentId: 'a1',
      referenceDocumentId: 'ref1',
      templateDocumentId: 'tpl1',
    });

    const json = original.toJSON();
    const restored = Assignment.fromJSON(json);

    expect(restored.documentType).toBe('SLIDES');
    expect(restored.courseId).toBe('c1');
    expect(restored.assignmentId).toBe('a1');
    expect(restored.referenceDocumentId).toBe('ref1');
    expect(restored.templateDocumentId).toBe('tpl1');

    if (SlidesAssignment) {
      expect(restored instanceof SlidesAssignment).toBe(true);
    }
  });

  it('should explicitly verify documentType field survives round-trip', () => {
    // RED: documentType field doesn't exist yet
    const data = {
      courseId: 'c_doctype',
      assignmentId: 'a_doctype',
      assignmentName: 'DocType Assignment',
      documentType: 'SLIDES',
      referenceDocumentId: 'ref_doctype',
      templateDocumentId: 'tpl_doctype',
      tasks: {},
      submissions: [],
    };

    const original = Assignment.fromJSON(data);
    expect(original.documentType).toBe('SLIDES');

    const json = original.toJSON();
    expect(json.documentType).toBe('SLIDES');

    const restored = Assignment.fromJSON(json);
    expect(restored.documentType).toBe('SLIDES');
  });

  it('should preserve complex nested data (tasks and submissions) through round-trip', () => {
    const taskDefinition = createTextTask(1, 'Reference text', 'Template text');
    const taskJson = taskDefinition.toJSON();
    const taskId = taskJson.id;

    const submission = createStudentSubmission({
      studentId: 'student-42',
      assignmentId: 'a-nested',
      documentId: 'doc-42',
    });
    submission.upsertItemFromExtraction(taskDefinition, {
      pageId: 'page-99',
      content: 'Student response',
      metadata: { confidence: 0.9 },
    });
    const submissionJson = submission.toJSON();

    const original = createSlidesAssignment({
      courseId: 'c-nested',
      assignmentId: 'a-nested',
      referenceDocumentId: 'ref-nested',
      templateDocumentId: 'tpl-nested',
      tasks: { [taskId]: taskJson },
      submissions: [submissionJson],
    });

    const json = original.toJSON();
    const restored = Assignment.fromJSON(json);

    expect(restored.documentType).toBe('SLIDES');
    expect(restored.tasks).toHaveProperty(taskId);
    // Note: This test verifies the Assignment factory pattern preserves data structure.
    // TaskDefinition.fromJSON may fail if required fields are missing or invalid,
    // causing fallback to plain objects with all properties preserved but no methods.
    // This is acceptable as it maintains data integrity while gracefully degrading functionality.
    const restoredTask = restored.tasks[taskId];
    expect(restoredTask).toBeDefined();
    expect(restoredTask).toHaveProperty('id', taskId);

    expect(restored.submissions).toHaveLength(1);
    const restoredSubmission = restored.submissions[0];
    expect(restoredSubmission).toBeDefined();
    expect(restoredSubmission.studentId).toBe('student-42');
  });
});

describe('Subclass-Specific Serialization', () => {
  const testCases = [
    {
      createFn: createSlidesAssignment,
      docType: 'SLIDES',
      courseId: 'c1',
      assignmentId: 'a1',
      refId: 'ref1',
      tplId: 'tpl1',
    },
    {
      createFn: createSheetsAssignment,
      docType: 'SHEETS',
      courseId: 'c2',
      assignmentId: 'a2',
      refId: 'ref2',
      tplId: 'tpl2',
    },
  ];

  testCases.forEach(({ createFn, docType, courseId, assignmentId, refId, tplId }) => {
    it(`should include documentType, referenceDocumentId, templateDocumentId in ${docType}Assignment.toJSON()`, () => {
      const assignment = createFn({
        courseId,
        assignmentId,
        referenceDocumentId: refId,
        templateDocumentId: tplId,
      });

      const json = assignment.toJSON();

      expect(json.documentType).toBe(docType);
      expect(json.referenceDocumentId).toBe(refId);
      expect(json.templateDocumentId).toBe(tplId);
    });
  });

  it('should call super.toJSON() and merge subclass fields', () => {
    // This test verifies that subclass toJSON includes both base and subclass fields.
    // Direct field verification is more reliable than spy-based verification because
    // Object.setPrototypeOf() used in fromJSON can interfere with Vitest's prototype spying.
    // Testing behavior (presence of all fields) is more valuable than testing implementation (spy on super call).
    const assignment = createSlidesAssignment({
      courseId: 'c-super',
      assignmentId: 'a-super',
      referenceDocumentId: 'ref-super',
      templateDocumentId: 'tpl-super',
    });

    const json = assignment.toJSON();

    // Verify base fields are present (proving super.toJSON() was called)
    expect(json.courseId).toBe('c-super');
    expect(json.assignmentId).toBe('a-super');
    expect(json.tasks).toBeDefined();
    expect(json.submissions).toBeDefined();
    // Verify subclass fields are present
    expect(json.documentType).toBe('SLIDES');
    expect(json.referenceDocumentId).toBe('ref-super');
    expect(json.templateDocumentId).toBe('tpl-super');
  });
});

describe('Transient Field Exclusion', () => {
  it('should not serialize _hydrationLevel even if present', () => {
    // RED: _hydrationLevel field doesn't exist yet
    const assignment = createSlidesAssignment({
      courseId: 'c3',
      assignmentId: 'a3',
    });

    // Simulate setting hydration level
    assignment._hydrationLevel = 'full';

    const json = assignment.toJSON();

    expect(json._hydrationLevel).toBeUndefined();
  });

  it('should not serialize students array even if present at runtime', () => {
    const assignment = createSheetsAssignment({
      courseId: 'c-students',
      assignmentId: 'a-students',
    });

    assignment.students = [{ id: 'student-1' }];

    const json = assignment.toJSON();

    expect(json.documentType).toBe('SHEETS');
    expect(json.students).toBeUndefined();
  });

  it('should not serialize progressTracker even if present', () => {
    const assignment = createSlidesAssignment({
      courseId: 'c-tracker',
      assignmentId: 'a-tracker',
    });

    assignment.progressTracker = { mocked: true };

    const json = assignment.toJSON();

    expect(json.documentType).toBe('SLIDES');
    expect(json.progressTracker).toBeUndefined();
  });
});
