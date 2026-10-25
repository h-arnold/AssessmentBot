import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { withGlobalMocks } from '../helpers/globalMockManager.js';

// Hermetic behaviour coverage for Assignment factory routing and serialisation
// without invoking GAS services.
describe('AssignmentFactory behaviour', () => {
  let restoreGlobals;
  let mockTracker;

  beforeEach(() => {
    mockTracker = {
      logAndThrowError: vi.fn((message) => {
        throw new Error(message);
      }),
    };
    class MockSlidesAssignment {
      constructor(courseId, assignmentId, definition) {
        this.courseId = courseId;
        this.assignmentId = assignmentId;
        this.assignmentDefinition = definition;
      }

      static fromJSON(data) {
        return { kind: 'slides', data };
      }
    }
    class MockSheetsAssignment {
      constructor(courseId, assignmentId, definition) {
        this.courseId = courseId;
        this.assignmentId = assignmentId;
        this.assignmentDefinition = definition;
      }

      static fromJSON(data) {
        return { kind: 'sheets', data };
      }
    }
    class MockAssignmentDefinition {
      constructor(options) {
        Object.assign(this, options);
      }

      toJSON() {
        return { ...this };
      }
    }
    const mockContext = withGlobalMocks({
      ProgressTracker: () => ({ getInstance: () => mockTracker }),
      SlidesAssignment: () => MockSlidesAssignment,
      SheetsAssignment: () => MockSheetsAssignment,
      AssignmentDefinition: () => MockAssignmentDefinition,
    });
    restoreGlobals = mockContext.restore;
  });

  afterEach(() => {
    restoreGlobals();
    vi.restoreAllMocks();
  });

  it('creates subclass instances by document type', () => {
    const factory = globalThis.AssignmentFactory;
    const slides = factory.create({ documentType: 'slides' }, 'course-one', 'assignment-one');
    expect(slides).toBeInstanceOf(globalThis.SlidesAssignment);
    const sheets = factory.create({ documentType: 'SHEETS' }, 'course-one', 'assignment-one');
    expect(sheets).toBeInstanceOf(globalThis.SheetsAssignment);
  });

  it('rejects missing or unknown document types', () => {
    const factory = globalThis.AssignmentFactory;
    expect(() => factory.create(null, 'c', 'a')).toThrow(TypeError);
    expect(() => factory.create({}, 'c', 'a')).toThrow(TypeError);
    expect(() => factory.create({ documentType: 'DOCS' }, 'c', 'a')).toThrow(
      /Unknown documentType/
    );
  });

  it('routes deserialisation with embedded definitions', () => {
    const factory = globalThis.AssignmentFactory;
    const routed = factory.fromJSON({
      courseId: 'c-one',
      assignmentId: 'a-one',
      assignmentDefinition: { documentType: 'SLIDES' },
    });
    expect(routed.kind).toBe('slides');

    expect(() => factory.fromJSON(null)).toThrow('Invalid data supplied to Assignment.fromJSON');
    expect(() => factory.fromJSON({ courseId: 'c-one' })).toThrow(
      'courseId and assignmentId are required fields in Assignment data'
    );
  });

  it('builds legacy definitions from flat document fields', () => {
    const factory = globalThis.AssignmentFactory;
    const routed = factory.fromJSON({
      courseId: 'c-two',
      assignmentId: 'a-two',
      assignmentName: 'Legacy',
      documentType: 'SHEETS',
      referenceDocumentId: 'ref',
      templateDocumentId: 'tpl',
      tasks: {},
    });
    expect(routed.kind).toBe('sheets');
    expect(routed.data.assignmentDefinition.documentType).toBe('SHEETS');
  });

  it('fails when legacy data has no usable document type', () => {
    const factory = globalThis.AssignmentFactory;
    expect(() => factory.fromJSON({ courseId: 'c-three', assignmentId: 'a-three' })).toThrow(
      /missing documentType/
    );
    expect(mockTracker.logAndThrowError).toHaveBeenCalled();

    expect(() =>
      factory.fromJSON({
        courseId: 'c-four',
        assignmentId: 'a-four',
        assignmentDefinition: { documentType: 123 },
      })
    ).toThrow(/missing documentType/);
  });

  it('fails for unknown routed document types', () => {
    const factory = globalThis.AssignmentFactory;
    expect(() =>
      factory.fromJSON({
        courseId: 'c-five',
        assignmentId: 'a-five',
        assignmentDefinition: { documentType: 'DOCS' },
      })
    ).toThrow(/Unknown assignment documentType/);
  });
});

describe('AssignmentSerialisation behaviour', () => {
  it('serialises current typed submissions and rejects plain submission fallbacks', () => {
    const serialisation = new globalThis.AssignmentSerialisation({
      courseId: 'course-one',
      assignmentId: 'assignment-one',
      assignmentName: 'Assignment One',
      dueDate: new Date('2026-02-03T04:05:06.000Z'),
      updatedAt: new Date('2026-04-05T06:07:08.000Z'),
      createdAt: new Date('2026-01-02T03:04:05.000Z'),
      assignmentDefinition: {
        toJSON: () => ({
          documentType: 'SLIDES',
          referenceDocumentId: 'ref-doc',
          templateDocumentId: 'tpl-doc',
          tasks: { task_one: true },
        }),
      },
      submissions: [{ toJSON: () => ({ studentId: 's-one' }) }],
      assessmentContractVersion: 1,
    });
    const json = serialisation.toJSON();
    expect(json.courseId).toBe('course-one');
    expect(json.assignmentId).toBe('assignment-one');
    expect(json.dueDate).toBe('2026-02-03T04:05:06.000Z');
    expect(json.updatedAt).toBe('2026-04-05T06:07:08.000Z');
    expect(json.createdAt).toBe('2026-01-02T03:04:05.000Z');
    expect(json.documentType).toBe('SLIDES');
    expect(json.referenceDocumentId).toBe('ref-doc');
    expect(json.templateDocumentId).toBe('tpl-doc');
    expect(json.tasks).toEqual({ task_one: true });
    expect(json.submissions).toHaveLength(1);
    expect(json.submissions[0]).toEqual({ studentId: 's-one' });
    expect(json.assessmentContractVersion).toBe(1);

    // Keep the rejection probe separate so it cannot skip the valid serialization assertions.
    const invalidSerialisation = new globalThis.AssignmentSerialisation({
      courseId: 'course-one',
      assignmentId: 'assignment-one',
      assignmentName: 'Assignment One',
      dueDate: null,
      updatedAt: null,
      createdAt: new Date('2026-01-02T03:04:05.000Z'),
      assignmentDefinition: {
        toJSON: () => ({ documentType: 'SLIDES', tasks: { task_one: true } }),
      },
      submissions: [
        { studentId: 's-two', documentId: 'doc-two', score: 3, extra: 'must not persist' },
      ],
      assessmentContractVersion: 1,
    });
    expect(serialisation._extractFullDefinitionFields(null)).toEqual({
      documentType: null,
      referenceDocumentId: null,
      templateDocumentId: null,
      tasks: null,
    });
    expect(serialisation._extractPartialRootFields(null)).toEqual({ documentType: null });
    expect(serialisation._extractPartialRootFields({ documentType: 'SHEETS' })).toEqual({
      documentType: 'SHEETS',
    });

    expect(() => invalidSerialisation.toJSON()).toThrow();
  });

  it('serialises partial assignments with redacted definitions', () => {
    const serialisation = new globalThis.AssignmentSerialisation({
      courseId: 'course-two',
      assignmentId: 'assignment-two',
      assignmentName: 'Assignment Two',
      dueDate: null,
      updatedAt: null,
      createdAt: new Date('2026-01-02T03:04:05.000Z'),
      assignmentDefinition: {
        toPartialJSON: () => ({ documentType: 'SHEETS' }),
      },
      submissions: [{ toPartialJSON: () => ({ studentId: 's-one' }) }],
    });
    const partial = serialisation.toPartialJSON();
    expect(partial.documentType).toBe('SHEETS');
    expect(partial.submissions).toEqual([{ studentId: 's-one' }]);
  });
});

describe('AssignmentRehydration behaviour', () => {
  let restoreGlobals;

  beforeEach(() => {
    const { StudentSubmissionItem } = require('#backend/Models/StudentSubmission/index.js');
    const mockContext = withGlobalMocks({
      ProgressTracker: () => ({
        getInstance: () => ({}),
      }),
      StudentSubmissionItem: () => StudentSubmissionItem,
      AssignmentDefinition: () => ({ fromJSON: (data) => data }),
    });
    restoreGlobals = mockContext.restore;
  });

  afterEach(() => {
    restoreGlobals();
    vi.restoreAllMocks();
  });

  it('rejects invalid or incomplete assignment payloads', () => {
    expect(() => globalThis.AssignmentRehydration._baseFromJSON(null)).toThrow(
      'Invalid data supplied to Assignment._baseFromJSON'
    );
    expect(() => globalThis.AssignmentRehydration._baseFromJSON({})).toThrow(
      'courseId and assignmentId are required fields in Assignment data'
    );
    expect(() =>
      globalThis.AssignmentRehydration._baseFromJSON({ courseId: 'c', assignmentId: 'a' })
    ).toThrow(/createdAt is required/);
  });

  it('restores base fields, dates, definitions and unknown extras', () => {
    const instance = globalThis.AssignmentRehydration._baseFromJSON({
      courseId: 'course-one',
      assignmentId: 'assignment-one',
      assignmentName: 'Named',
      dueDate: '2026-02-03T04:05:06.000Z',
      updatedAt: '2026-04-05T06:07:08.000Z',
      createdAt: '2026-01-02T03:04:05.000Z',
      assignmentDefinition: { documentType: 'SLIDES' },
      submissions: [],
      customField: 'kept',
      students: ['transient'],
    });
    expect(instance.assignmentName).toBe('Named');
    expect(instance.dueDate).toBeInstanceOf(Date);
    expect(instance.customField).toBe('kept');
    expect(instance).not.toHaveProperty('students');
    expect(instance.submissions).toEqual([]);
  });

  it('applies default names and null dates when absent', () => {
    const instance = globalThis.AssignmentRehydration._baseFromJSON({
      courseId: 'course-two',
      assignmentId: 'assignment-two',
      createdAt: '2026-01-02T03:04:05.000Z',
      submissions: [],
    });
    expect(instance.assignmentName).toBe('Assignment assignment-two');
    expect(instance.dueDate).toBeNull();
    expect(instance.updatedAt).toBeNull();
    expect(instance.assignmentDefinition).toBeNull();
  });

  it('rehydrates valid submissions directly', () => {
    const instance = { assignmentId: 'assignment-one', submissions: [] };
    const subObject = { studentId: 's-one', assignmentId: 'assignment-one' };
    const original = globalThis.StudentSubmission.fromJSON;
    const created = { studentId: 's-one' };
    globalThis.StudentSubmission.fromJSON = vi.fn(() => created);
    try {
      globalThis.AssignmentRehydration._rehydrateSubmission(instance, subObject);
      expect(instance.submissions).toEqual([created]);
    } finally {
      globalThis.StudentSubmission.fromJSON = original;
    }
  });
});
