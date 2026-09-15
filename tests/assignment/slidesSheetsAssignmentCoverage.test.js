import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { withGlobalMocks } from '../helpers/globalMockManager.js';

// Hermetic behaviour coverage for SlidesAssignment and SheetsAssignment
// runners: construction, image hydration, task population and submission
// processing without invoking GAS services.

/**
 * Builds the hermetic assignment test bed shared by both suites: mock logger,
 * progress tracker, common GAS globals, and the restore handle. The
 * title-specific Classroom course-work data is supplied by the caller.
 * @param {Object} options - Test-bed options.
 * @param {string} options.title - Classroom course-work title for the suite.
 * @returns {{mockLogger: Object, mockTracker: Object, restoreGlobals: Function}} Test-bed mocks.
 */
function installAssignmentTestBed({ title }) {
  const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const mockTracker = {
    updateProgress: vi.fn(),
    logError: vi.fn(),
    logAndThrowError: vi.fn((message) => {
      throw new Error(message);
    }),
  };
  const mockContext = withGlobalMocks({
    ABLogger: () => ({ getInstance: () => mockLogger }),
    ProgressTracker: () => ({ getInstance: () => mockTracker }),
    Classroom: () => ({
      Courses: {
        CourseWork: {
          get: vi.fn(() => ({ title, creationTime: '2026-01-01T00:00:00.000Z' })),
        },
      },
    }),
    ImageManager: () => globalThis.ImageManager,
    SlidesParser: () => globalThis.SlidesParser,
    SheetsParser: () => globalThis.SheetsParser,
    SheetsAssessor: () => globalThis.SheetsAssessor,
    SheetsFeedback: () => globalThis.SheetsFeedback,
  });
  return { mockLogger, mockTracker, restoreGlobals: mockContext.restore };
}

describe('SlidesAssignment behaviour', () => {
  let restoreGlobals;
  let mockLogger;
  let mockTracker;

  beforeEach(() => {
    ({ mockLogger, mockTracker, restoreGlobals } = installAssignmentTestBed({
      title: 'Slides Title',
    }));
  });

  afterEach(() => {
    restoreGlobals();
    vi.restoreAllMocks();
  });

  function buildAssignment(definition = {}) {
    return new globalThis.SlidesAssignment('course-one', 'assignment-one', {
      primaryTitle: 'Slides Title',
      primaryTopic: 'Topic',
      yearGroupKey: 'year-group-ten',
      yearGroupLabel: 'Year Ten',
      documentType: 'SLIDES',
      referenceDocumentId: 'ref-doc',
      templateDocumentId: 'tpl-doc',
      tasks: {},
      ...definition,
    });
  }

  it('constructs from definition instances and plain JSON', () => {
    const instance = new globalThis.AssignmentDefinition({
      primaryTitle: 'Title',
      primaryTopic: 'Topic',
      yearGroupKey: 'year-ten',
      yearGroupLabel: 'Year Ten',
      documentType: 'SLIDES',
      referenceDocumentId: 'ref-doc',
      templateDocumentId: 'tpl-doc',
      tasks: {},
    });
    const fromInstance = new globalThis.SlidesAssignment('course-one', 'assignment-one', instance);
    expect(fromInstance.assignmentDefinition).toBe(instance);

    const fromJson = buildAssignment();
    expect(fromJson.assignmentName).toBe('Slides Title');
    expect(fromJson.createdAt).toBeInstanceOf(Date);
  });

  it('rehydrates through the base helper with the subclass prototype', () => {
    const restored = globalThis.SlidesAssignment.fromJSON({
      courseId: 'course-one',
      assignmentId: 'assignment-one',
      assignmentName: 'Restored',
      createdAt: '2026-01-01T00:00:00.000Z',
      submissions: [],
    });
    expect(restored).toBeInstanceOf(globalThis.SlidesAssignment);
  });

  it('skips image hydration when no artefacts exist', () => {
    globalThis.ImageManager = class {
      collectAllImageArtifacts() {
        return [];
      }
    };
    const assignment = buildAssignment();
    assignment.progressTracker = mockTracker;
    assignment.processImages();
    expect(mockTracker.updateProgress).not.toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(
      'No image artifacts to process.',
      expect.objectContaining({
        workflow: 'SlidesAssignment.processImages',
        courseId: 'course-one',
        assignmentId: 'assignment-one',
      })
    );
  });

  it('hydrates image artefacts end to end', () => {
    const entries = [{ uid: 'uid-one' }];
    const blobs = [{ uid: 'uid-one', blob: {} }];
    const writeBackBlobs = vi.fn();
    globalThis.ImageManager = class {
      collectAllImageArtifacts() {
        return entries;
      }

      fetchImagesAsBlobs() {
        return blobs;
      }

      writeBackBlobs(...args) {
        return writeBackBlobs(...args);
      }
    };
    const assignment = buildAssignment();
    assignment.progressTracker = mockTracker;
    assignment.processImages();
    expect(mockTracker.updateProgress).toHaveBeenCalledTimes(2);
    expect(writeBackBlobs).toHaveBeenCalledWith(assignment, blobs);
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Hydrated 1 image artifacts.',
      expect.objectContaining({
        workflow: 'SlidesAssignment.processImages',
        courseId: 'course-one',
        assignmentId: 'assignment-one',
        count: 1,
      })
    );
  });

  it('reports image hydration failures with a stable safe message, structured context and rethrow', () => {
    const failure = new Error('collect failed');
    globalThis.ImageManager = class {
      collectAllImageArtifacts() {
        throw failure;
      }
    };
    const assignment = buildAssignment();
    assignment.progressTracker = mockTracker;
    // The raw lower-level failure is preserved for the caller via rethrow.
    expect(() => assignment.processImages()).toThrow('collect failed');
    // Developer boundary preserves the raw error with structured workflow context.
    expect(mockLogger.error).toHaveBeenCalledWith(
      'SlidesAssignment.processImages failed',
      expect.objectContaining({
        workflow: 'SlidesAssignment.processImages',
        courseId: 'course-one',
        assignmentId: 'assignment-one',
        err: failure,
      })
    );
    // User-facing text stays stable and never leaks the lower-level detail.
    expect(mockTracker.logError).toHaveBeenCalledTimes(1);
    const userMessage = mockTracker.logError.mock.calls[0][0];
    expect(userMessage).toBe('Image processing failed.');
    expect(userMessage).not.toContain('collect failed');
    expect(mockTracker.logError).toHaveBeenCalledWith(
      'Image processing failed.',
      expect.objectContaining({
        devContext: expect.objectContaining({
          workflow: 'SlidesAssignment.processImages',
          courseId: 'course-one',
          assignmentId: 'assignment-one',
        }),
        err: failure,
      })
    );
  });

  it('populates tasks while reporting invalid definitions', () => {
    const valid = { getId: () => 'task-valid', taskTitle: 'Valid', validate: () => ({ ok: true }) };
    const invalid = {
      getId: () => 'task-invalid',
      taskTitle: 'Invalid',
      pageId: 'page-invalid',
      validate: () => ({ ok: false, errors: ['missing'] }),
    };
    globalThis.SlidesParser = class {
      extractTaskDefinitions() {
        return [valid, invalid];
      }
    };
    const assignment = buildAssignment();
    assignment.progressTracker = mockTracker;
    assignment.populateTasks();
    expect(Object.keys(assignment.assignmentDefinition.tasks)).toEqual(['task-valid']);
    expect(mockTracker.logError).toHaveBeenCalledWith(
      'Task "Invalid" is missing required slide artifacts.',
      expect.objectContaining({ taskId: 'task-invalid' })
    );
    expect(mockLogger.info).toHaveBeenCalled();
  });

  it('fetches slides documents by mime type', () => {
    const assignment = buildAssignment();
    const spy = vi
      .spyOn(assignment, 'fetchSubmittedDocumentsByMimeType')
      .mockReturnValue(undefined);
    assignment.fetchSubmittedDocuments();
    expect(spy).toHaveBeenCalledWith('application/vnd.google-apps.presentation');
  });

  it('processes submissions while skipping incomplete or unknown artefacts', () => {
    const definition = { getId: () => 'task-one', taskTitle: 'Task One' };
    const submissionWithDoc = {
      documentId: 'student-doc',
      studentName: 'Student One',
      upsertItemFromExtraction: vi.fn(),
    };
    const submissionWithoutDoc = { documentId: null, studentName: 'No Doc' };
    const assignment = buildAssignment();
    assignment.assignmentDefinition.tasks = { 'task-one': definition };
    assignment.submissions = [submissionWithoutDoc, submissionWithDoc];
    assignment.progressTracker = mockTracker;
    globalThis.SlidesParser = class {
      extractSubmissionArtifacts() {
        return [
          {
            taskId: 'task-one',
            pageId: 'page-one',
            content: 'answer',
            metadata: {},
            documentId: 'student-doc',
          },
          {
            taskId: 'unknown-task',
            pageId: 'page-x',
            content: 'lost',
            metadata: {},
            documentId: 'student-doc',
          },
        ];
      }
    };
    assignment.processAllSubmissions();
    expect(submissionWithDoc.upsertItemFromExtraction).toHaveBeenCalledWith(
      expect.objectContaining({ taskTitle: 'Task One' }),
      expect.objectContaining({ content: 'answer' })
    );
    expect(mockTracker.updateProgress).toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'No document ID for student: No Doc. Skipping.',
      expect.objectContaining({
        workflow: 'SlidesAssignment.processAllSubmissions',
        courseId: 'course-one',
        assignmentId: 'assignment-one',
        studentName: 'No Doc',
      })
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Submission artifact references unknown taskId unknown-task',
      expect.objectContaining({
        workflow: 'SlidesAssignment.processAllSubmissions',
        courseId: 'course-one',
        assignmentId: 'assignment-one',
        taskId: 'unknown-task',
      })
    );
  });
});

describe('SheetsAssignment behaviour', () => {
  let restoreGlobals;
  let mockLogger;
  let mockTracker;

  beforeEach(() => {
    ({ mockLogger, mockTracker, restoreGlobals } = installAssignmentTestBed({
      title: 'Sheets Title',
    }));
  });

  afterEach(() => {
    restoreGlobals();
    vi.restoreAllMocks();
  });

  function buildAssignment(tasks = {}) {
    return new globalThis.SheetsAssignment('course-one', 'assignment-one', {
      primaryTitle: 'Sheets Title',
      primaryTopic: 'Topic',
      yearGroupKey: 'year-group-ten',
      yearGroupLabel: 'Year Ten',
      documentType: 'SHEETS',
      referenceDocumentId: 'ref-doc',
      templateDocumentId: 'tpl-doc',
      tasks,
    });
  }

  it('constructs and rehydrates sheets assignments', () => {
    const assignment = buildAssignment();
    expect(assignment.assignmentName).toBe('Sheets Title');
    const restored = globalThis.SheetsAssignment.fromJSON({
      courseId: 'course-one',
      assignmentId: 'assignment-one',
      assignmentName: 'Restored',
      createdAt: '2026-01-01T00:00:00.000Z',
      submissions: [],
    });
    expect(restored).toBeInstanceOf(globalThis.SheetsAssignment);
  });

  it('populates spreadsheet tasks and fetches sheets documents', () => {
    const first = { getId: () => 'sheet-one' };
    const second = { getId: () => 'sheet-two' };
    globalThis.SheetsParser = class {
      extractTaskDefinitions() {
        return [first, second];
      }
    };
    const assignment = buildAssignment();
    assignment.populateTasks();
    expect(Object.keys(assignment.assignmentDefinition.tasks).sort()).toEqual([
      'sheet-one',
      'sheet-two',
    ]);
    expect(mockLogger.info).toHaveBeenCalled();

    const spy = vi
      .spyOn(assignment, 'fetchSubmittedDocumentsByMimeType')
      .mockReturnValue(undefined);
    assignment.fetchSubmittedDocuments();
    expect(spy).toHaveBeenCalledWith('application/vnd.google-apps.spreadsheet');
  });

  it('processes spreadsheet submissions with skips and warnings', () => {
    const definition = { getId: () => 'sheet-one' };
    const submission = {
      studentId: 's-one',
      documentId: 'student-doc',
      upsertItemFromExtraction: vi.fn(),
    };
    const assignment = buildAssignment();
    assignment.assignmentDefinition.tasks = { 'sheet-one': definition };
    assignment.submissions = [{ studentId: 's-missing', documentId: null }, submission];
    assignment.progressTracker = mockTracker;
    globalThis.SheetsParser = class {
      extractSubmissionArtifacts() {
        return [
          {
            taskId: 'sheet-one',
            pageId: '11',
            content: [['=A1']],
            metadata: {},
            documentId: 'student-doc',
          },
          { taskId: 'unknown', pageId: '11', content: [], metadata: {}, documentId: 'student-doc' },
        ];
      }
    };
    assignment.processAllSubmissions();
    expect(submission.upsertItemFromExtraction).toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('fails fast when the sheets assessor is unavailable', () => {
    const assignment = buildAssignment();
    globalThis.SheetsAssessor = undefined;
    expect(() => assignment.assessResponses()).toThrow(
      'SheetsAssessor not available; cannot assess spreadsheet responses.'
    );
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('assesses through the dedicated assessor and feedback populator', () => {
    const assessResponses = vi.fn();
    const applyFeedback = vi.fn();
    globalThis.SheetsAssessor = class {
      constructor(tasks, submissions) {
        this.tasks = tasks;
        this.submissions = submissions;
      }

      assessResponses(...args) {
        return assessResponses(...args);
      }
    };
    globalThis.SheetsFeedback = class {
      applyFeedback(...args) {
        return applyFeedback(...args);
      }
    };
    const assignment = buildAssignment();
    assignment.assignmentDefinition.tasks = { 'sheet-one': { taskTitle: 'One' } };
    assignment.submissions = [{ studentId: 's-one' }];
    assignment.assessResponses();
    expect(assessResponses).toHaveBeenCalled();
    expect(applyFeedback).toHaveBeenCalled();
  });
});
