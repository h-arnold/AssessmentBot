/**
 * Assignment factory and serialization regression tests
 *
 * Covers polymorphic assignment creation, deserialization and serialization
 * controls. These retained factory cases pass; the separately added current-read
 * serializer rejection remains the outstanding intentional Red case.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Assignment from '#backend/AssignmentProcessor/Assignment/index.js';
import { AssignmentDefinition } from '#backend/Models/AssignmentDefinition.js';
import { createSlidesAssignment, createSheetsAssignment } from '../helpers/modelFactories.js';

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
  beforeEach(() => {
    globalThis.Classroom = {
      Courses: {
        CourseWork: {
          get: vi.fn(() => ({
            creationTime: '2026-01-01T00:00:00.000Z',
            title: 'Test Assignment',
          })),
        },
      },
    };
  });

  afterEach(() => {
    delete globalThis.Classroom;
  });

  const testCases = [
    { docType: 'SLIDES', courseId: 'c1', assignmentId: 'a1', refId: 'ref1', tplId: 'tpl1' },
    { docType: 'SHEETS', courseId: 'c2', assignmentId: 'a2', refId: 'ref2', tplId: 'tpl2' },
  ];

  testCases.forEach(({ docType, courseId, assignmentId, refId, tplId }) => {
    it(`should create a ${docType}Assignment for documentType ${docType}`, () => {
      const definition = new AssignmentDefinition({
        primaryTitle: 'Test Assignment',
        primaryTopic: 'Topic',
        yearGroupKey: 'year-group-test',
        yearGroupLabel: 'Year Test',
        documentType: docType,
        referenceDocumentId: refId,
        templateDocumentId: tplId,
        tasks: {},
        referenceLastModified: '2024-01-01T00:00:00.000Z',
        templateLastModified: '2024-01-01T00:00:00.000Z',
      });
      const assignment = Assignment.create(definition, courseId, assignmentId);
      assertAssignmentProperties(assignment, docType, courseId);
    });
  });

  it('should throw an error for an unknown documentType', () => {
    expect(() => {
      const definition = new AssignmentDefinition({
        primaryTitle: 'Test Assignment',
        primaryTopic: 'Topic',
        yearGroupKey: 'year-group-test',
        yearGroupLabel: 'Year Test',
        documentType: 'INVALID',
        referenceDocumentId: 'ref1',
        templateDocumentId: 'tpl1',
        tasks: [],
      });
      Assignment.create(definition, 'c1', 'a1');
    }).toThrow(/Unknown documentType/i);
  });

  it('should throw for null/undefined documentType', () => {
    expect(() => {
      Assignment.create(null, 'c1', 'a1');
    }).toThrow();

    expect(() => {
      Assignment.create({ documentType: undefined }, 'c1', 'a1');
    }).toThrow();
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

      expect(json.assignmentDefinition.documentType).toBe(docType);
      expect(json.assignmentDefinition.referenceDocumentId).toBe(refId);
      expect(json.assignmentDefinition.templateDocumentId).toBe(tplId);
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
    expect(json.assignmentDefinition.tasks).toBeDefined();
    expect(json.submissions).toBeDefined();
    // Verify subclass fields are present
    expect(json.assignmentDefinition.documentType).toBe('SLIDES');
    expect(json.assignmentDefinition.referenceDocumentId).toBe('ref-super');
    expect(json.assignmentDefinition.templateDocumentId).toBe('tpl-super');
  });
});

describe('Transient Field Exclusion', () => {
  it('should not serialize _hydrationLevel even if present', () => {
    // The field is transient runtime state and must not appear in persistence.
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

    expect(json.assignmentDefinition.documentType).toBe('SHEETS');
    expect(json.students).toBeUndefined();
  });

  it('should not serialize progressTracker even if present', () => {
    const assignment = createSlidesAssignment({
      courseId: 'c-tracker',
      assignmentId: 'a-tracker',
    });

    assignment.progressTracker = { mocked: true };

    const json = assignment.toJSON();

    expect(json.assignmentDefinition.documentType).toBe('SLIDES');
    expect(json.progressTracker).toBeUndefined();
  });
});
