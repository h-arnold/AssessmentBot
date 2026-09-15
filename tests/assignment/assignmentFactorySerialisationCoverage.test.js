import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { withGlobalMocks } from '../helpers/globalMockManager.js';

// Hermetic behaviour coverage for Assignment factory routing, serialisation
// fallbacks and rehydration resilience without invoking GAS services.
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
  it('serialises full assignments with fallbacks for plain submissions', () => {
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
      submissions: [
        { toJSON: () => ({ studentId: 's-one' }) },
        {
          studentId: 's-two',
          documentId: 'doc-two',
          score: 3,
          feedback: { comment: 'good' },
          updatedAt: new Date('2026-06-07T08:09:10.000Z'),
          extra: 'kept',
        },
        {
          userId: 's-three',
          updatedAt: 'already-a-string',
        },
      ],
    });
    const json = serialisation.toJSON();
    expect(json.courseId).toBe('course-one');
    expect(json.documentType).toBe('SLIDES');
    expect(json.submissions).toHaveLength(3);
    expect(json.submissions[0]).toEqual({ studentId: 's-one' });
    expect(json.submissions[1].documentId).toBe('doc-two');
    expect(json.submissions[1].extra).toBe('kept');
    expect(json.submissions[2].studentId).toBe('s-three');

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
  let warnings;
  let errors;

  beforeEach(() => {
    warnings = [];
    errors = [];
    const { StudentSubmissionItem } = require('../../src/backend/Models/StudentSubmission.js');
    const mockContext = withGlobalMocks({
      ABLogger: () => ({
        getInstance: () => ({
          warn: (...args) => warnings.push(args),
          error: (...args) => errors.push(args),
        }),
      }),
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

  it('summarises corrupt artefacts for diagnostics', () => {
    const summarise = globalThis.AssignmentRehydration._summariseCorruptArtifacts;
    expect(summarise(null)).toEqual([]);
    expect(summarise({})).toEqual([]);
    expect(summarise({ items: 'not-an-object' })).toEqual([]);
    const summary = summarise({
      items: {
        task_one: { id: 'item-one', artifact: { type: 'TEXT' } },
        task_two: { id: 'item-two' },
      },
    });
    expect(summary).toHaveLength(2);
    expect(summary[0].missing).toContain('contentHash');
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

  it('reconstructs resiliently when model deserialisation fails', () => {
    const instance = { assignmentId: 'assignment-two', submissions: [] };
    const original = globalThis.StudentSubmission.fromJSON;
    globalThis.StudentSubmission.fromJSON = vi.fn(() => {
      throw new Error('corrupt');
    });
    try {
      globalThis.AssignmentRehydration._rehydrateSubmission(instance, {
        studentId: 's-two',
        documentId: 'doc-two',
        studentName: 'Student Two',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: '2026-02-01T00:00:00.000Z',
        items: {},
      });
      expect(instance.submissions).toHaveLength(1);
      expect(instance.submissions[0].studentId).toBe('s-two');
      expect(warnings.length).toBeGreaterThan(0);
    } finally {
      globalThis.StudentSubmission.fromJSON = original;
    }
  });

  it('drops corrupt items but keeps the submission', () => {
    const instance = { assignmentId: 'assignment-three', submissions: [] };
    const originalFromJSON = globalThis.StudentSubmission.fromJSON;
    const mockContext = withGlobalMocks({
      StudentSubmissionItem: () => ({
        fromJSON: vi.fn((json) => {
          if (json.bad) throw new Error('corrupt item');
          return { id: json.id };
        }),
      }),
    });
    globalThis.StudentSubmission.fromJSON = vi.fn(() => {
      throw new Error('corrupt submission');
    });
    try {
      // Provide the item class through the submission prototype chain used by the fallback.
      const RealSubmission = originalFromJSON;
      void RealSubmission;
      globalThis.AssignmentRehydration._rehydrateSubmission(instance, {
        userId: 's-three',
        items: {
          good: { id: 'good' },
          bad: { id: 'bad', bad: true, artifact: { type: 'TEXT' } },
        },
      });
      expect(instance.submissions).toHaveLength(1);
    } finally {
      globalThis.StudentSubmission.fromJSON = originalFromJSON;
      mockContext.restore();
    }
  });

  it('omits submissions that cannot be reconstructed', () => {
    const instance = { assignmentId: 'assignment-four', submissions: [] };
    const mockContext = withGlobalMocks({
      StudentSubmission: () =>
        class {
          constructor() {
            throw new Error('cannot construct');
          }

          static fromJSON() {
            throw new Error('corrupt');
          }
        },
    });
    try {
      globalThis.AssignmentRehydration._rehydrateSubmission(instance, { studentId: 's-four' });
      expect(instance.submissions).toHaveLength(0);
      expect(errors.length).toBeGreaterThan(0);
    } finally {
      mockContext.restore();
    }
  });
});
