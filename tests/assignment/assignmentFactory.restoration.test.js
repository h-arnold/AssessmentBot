/**
 * Assignment restoration factory tests.
 *
 * Polymorphic deserialisation and round-trip behaviour is kept separate from
 * assignment creation and subclass serialization coverage.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Assignment from '#backend/AssignmentProcessor/Assignment/index.js';
import { AssignmentDefinition } from '#backend/Models/AssignmentDefinition.js';
import {
  createSlidesAssignment,
  createTextTask,
  createStudentSubmission,
} from '../helpers/modelFactories.js';

/** Build the small assignment root used by polymorphic restoration cases. */
function createTestData(docType, courseId) {
  const definition = new AssignmentDefinition({
    primaryTitle: 'Test Assignment',
    primaryTopic: 'Topic',
    yearGroupKey: 'year-group-test',
    yearGroupLabel: 'Year Test',
    documentType: docType,
    referenceDocumentId: courseId.replace('c', 'ref'),
    templateDocumentId: courseId.replace('c', 'tpl'),
    tasks: {},
    referenceLastModified: '2024-01-01T00:00:00.000Z',
    templateLastModified: '2024-01-01T00:00:00.000Z',
  });
  return {
    courseId,
    assignmentId: courseId.replace('c', 'a'),
    assignmentName: 'Test Assignment',
    assignmentDefinition: definition.toJSON(),
    createdAt: '2026-01-01T00:00:00.000Z',
    submissions: [],
  };
}

function assertAssignmentProperties(assignment, docType, courseId) {
  expect(assignment).toBeDefined();
  expect(assignment.assignmentDefinition).toBeDefined();
  expect(assignment.assignmentDefinition.documentType).toBe(docType);
  expect(assignment.courseId).toBe(courseId);
  expect(assignment.assignmentId).toBe(courseId.replace('c', 'a'));
  expect(assignment.assignmentDefinition.referenceDocumentId).toBe(courseId.replace('c', 'ref'));
  expect(assignment.assignmentDefinition.templateDocumentId).toBe(courseId.replace('c', 'tpl'));
}

const SlidesAssignment = require('#backend/AssignmentProcessor/SlidesAssignment.js');
require('#backend/AssignmentProcessor/SheetsAssignment.js');

let originalLoggerGetInstance;
beforeEach(() => {
  originalLoggerGetInstance =
    typeof ABLogger !== 'undefined' && ABLogger && typeof ABLogger.getInstance === 'function'
      ? ABLogger.getInstance
      : undefined;
});
afterEach(() => {
  if (typeof ABLogger !== 'undefined' && originalLoggerGetInstance !== undefined)
    ABLogger.getInstance = originalLoggerGetInstance;
  vi.restoreAllMocks();
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

    expect(assignment.assignmentDefinition.referenceDocumentId).toBe('ref5');
    expect(assignment.assignmentDefinition.templateDocumentId).toBe('tpl5');
  });

  it('should throw a user-facing error via ProgressTracker for invalid documentType values', () => {
    const tracker = globalThis.ProgressTracker.getInstance();
    const logAndThrowSpy = vi.spyOn(tracker, 'logAndThrowError').mockImplementation((msg) => {
      const message = typeof msg === 'string' ? msg : JSON.stringify(msg);
      throw new Error(`ProgressTracker: ${message}`);
    });

    const invalidDefinition = new AssignmentDefinition({
      primaryTitle: 'Invalid Assignment',
      primaryTopic: 'Topic',
      yearGroupKey: 'year-group-test',
      yearGroupLabel: 'Year Test',
      documentType: 'INVALID',
      referenceDocumentId: 'ref-invalid',
      templateDocumentId: 'tpl-invalid',
      tasks: {},
    });

    expect(() =>
      Assignment.fromJSON({
        courseId: 'c-invalid',
        assignmentId: 'a-invalid',
        assignmentName: 'Invalid Assignment',
        assignmentDefinition: invalidDefinition.toJSON(),
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
      const message = typeof msg === 'string' ? msg : JSON.stringify(msg);
      throw new Error(`ProgressTracker: ${message}`);
    });

    expect(() =>
      Assignment.fromJSON({
        courseId: 'c-missing',
        assignmentId: 'a-missing',
        assignmentName: 'Missing DocType Assignment',
        assignmentDefinition: {
          referenceDocumentId: 'ref-missing',
          templateDocumentId: 'tpl-missing',
          tasks: {},
        },
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
    const definition = new AssignmentDefinition({
      primaryTitle: 'Transient Fields Assignment',
      primaryTopic: 'Topic',
      yearGroupKey: 'year-group-test',
      yearGroupLabel: 'Year Test',
      documentType: 'SLIDES',
      referenceDocumentId: 'ref7',
      templateDocumentId: 'tpl7',
      tasks: {},
    });
    const assignment = Assignment.fromJSON({
      courseId: 'c7',
      assignmentId: 'a7',
      assignmentName: 'Transient Fields Assignment',
      assignmentDefinition: definition.toJSON(),
      createdAt: '2026-01-01T00:00:00.000Z',
      submissions: [],
      students: [{ id: 'student-1' }],
      progressTracker: sentinelTracker,
      _hydrationLevel: 'full',
    });

    expect(assignment.assignmentDefinition.documentType).toBe('SLIDES');
    expect(assignment.students).toBeUndefined();
    expect(assignment.progressTracker).not.toBe(sentinelTracker);
    expect(assignment._hydrationLevel).toBeUndefined();
  });

  it('should ensure transient fields are absent from subsequent toJSON payloads', () => {
    const definition = new AssignmentDefinition({
      primaryTitle: 'Transient JSON Assignment',
      primaryTopic: 'Topic',
      yearGroupKey: 'year-group-test',
      yearGroupLabel: 'Year Test',
      documentType: 'SHEETS',
      referenceDocumentId: 'ref8',
      templateDocumentId: 'tpl8',
      tasks: {},
    });

    const assignment = Assignment.fromJSON({
      courseId: 'c8',
      assignmentId: 'a8',
      assignmentName: 'Transient JSON Assignment',
      assignmentDefinition: definition.toJSON(),
      createdAt: '2026-01-01T00:00:00.000Z',
      submissions: [],
      students: [{ id: 'student-1' }],
      progressTracker: { sentinel: true },
      _hydrationLevel: 'full',
    });

    const json = assignment.toJSON();

    expect(json.assignmentDefinition.documentType).toBe('SHEETS');
    expect(json.students).toBeUndefined();
    expect(json.progressTracker).toBeUndefined();
    expect(json._hydrationLevel).toBeUndefined();
  });
});

describe('Polymorphic Round-Trip', () => {
  it('should preserve type and data for a SlidesAssignment after a toJSON() -> fromJSON() round-trip', () => {
    // Typed definition restoration preserves the assignment's polymorphic type.
    const original = createSlidesAssignment({
      courseId: 'c1',
      assignmentId: 'a1',
      referenceDocumentId: 'ref1',
      templateDocumentId: 'tpl1',
    });

    const json = original.toJSON();
    const restored = Assignment.fromJSON(json);

    expect(restored.assignmentDefinition.documentType).toBe('SLIDES');
    expect(restored.courseId).toBe('c1');
    expect(restored.assignmentId).toBe('a1');
    expect(restored.assignmentDefinition.referenceDocumentId).toBe('ref1');
    expect(restored.assignmentDefinition.templateDocumentId).toBe('tpl1');

    if (SlidesAssignment) {
      expect(restored instanceof SlidesAssignment).toBe(true);
    }
  });

  it('should explicitly verify documentType field survives round-trip', () => {
    // The typed definition owns documentType across persistence round trips.
    const data = {
      courseId: 'c_doctype',
      assignmentId: 'a_doctype',
      assignmentName: 'DocType Assignment',
      assignmentDefinition: new AssignmentDefinition({
        primaryTitle: 'DocType Assignment',
        primaryTopic: 'Topic',
        yearGroupKey: 'year-group-test',
        yearGroupLabel: 'Year Test',
        documentType: 'SLIDES',
        referenceDocumentId: 'ref_doctype',
        templateDocumentId: 'tpl_doctype',
        tasks: {},
      }).toJSON(),
      createdAt: '2026-01-01T00:00:00.000Z',
      submissions: [],
    };

    const original = Assignment.fromJSON(data);
    expect(original.assignmentDefinition.documentType).toBe('SLIDES');

    const json = original.toJSON();
    expect(json.assignmentDefinition.documentType).toBe('SLIDES');

    const restored = Assignment.fromJSON(json);
    expect(restored.assignmentDefinition.documentType).toBe('SLIDES');
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
    const originalHistory = JSON.parse(JSON.stringify(json.submissions));
    const originalMarker = json.assessmentContractVersion;
    const restored = Assignment.fromJSON(json);

    expect(restored.assignmentDefinition.documentType).toBe('SLIDES');
    expect(restored.assignmentDefinition.tasks).toHaveProperty(taskId);
    // Legacy submission bodies remain opaque while their supported task definitions
    // are restored as typed model instances.
    const restoredTask = restored.assignmentDefinition.tasks[taskId];
    expect(restoredTask).toBeDefined();
    expect(restoredTask).toHaveProperty('id', taskId);

    expect(restored.toJSON().submissions).toEqual(originalHistory);
    expect(restored.toJSON()).not.toHaveProperty('assessmentContractVersion');
    expect(originalMarker).toBeUndefined();
  });
});
