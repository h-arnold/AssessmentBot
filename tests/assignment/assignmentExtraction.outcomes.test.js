import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { loadSyntheticAnalysisProfile } from '#synthetic-data/loadSyntheticAnalysisProfile.js';
import { withGlobalMocks } from '../helpers/globalMockManager.js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  saveGlobals,
  restoreGlobals: restoreSavedGlobals,
} = require('../helpers/globalMockManager.js');
const originalDocumentParser = saveGlobals(['DocumentParser']);
globalThis.DocumentParser = require('#backend/DocumentParsers/DocumentParser.js').DocumentParser;
const { createStudentSubmission } = require('../helpers/modelFactories.js');
const { TaskDefinition } = require('#backend/Models/TaskDefinition.js');
const SlidesParser = require('#backend/DocumentParsers/SlidesParser/index.js');

const canonicalAssignments = loadSyntheticAnalysisProfile('small', 'assignmentsByKey');
const canonicalAssignment = Object.values(canonicalAssignments).find(
  (assignment) => assignment.documentType === 'SLIDES'
);
const canonicalStudent = canonicalAssignment.submissions.find(
  (submission) => submission.documentId
);
const SOURCE_ERROR = {
  score: 'E',
  reasoning: 'No source content could be extracted for this task.',
  error: { stage: 'extraction', code: 'SOURCE_CONTENT_UNAVAILABLE' },
};
const authoredLogProjection = (calls) =>
  JSON.stringify(calls, (_key, value) => (value instanceof Error ? undefined : value));
describe('assignment extraction outcomes', () => {
  let restoreGlobals;

  afterEach(() => {
    restoreGlobals?.();
    restoreGlobals = undefined;
    vi.restoreAllMocks();
  });
  afterAll(() => restoreSavedGlobals(originalDocumentParser));
  function assignmentHarness({
    slides = [],
    sheets = [],
    taskCount = 2,
    spreadsheet = false,
  } = {}) {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const tracker = { updateProgress: vi.fn(), logError: vi.fn() };
    const context = withGlobalMocks({
      ABLogger: () => ({ getInstance: () => logger }),
      ProgressTracker: () => ({ getInstance: () => tracker }),
      SlidesParser: () =>
        class {
          extractSubmissionArtifacts = vi.fn(() => slides);
        },
      SheetsParser: () =>
        class {
          extractSubmissionArtifacts = vi.fn(() => sheets);
        },
    });
    restoreGlobals = context.restore;
    const taskIds = Object.keys(canonicalAssignment.assignmentDefinition.tasks).slice(0, taskCount);
    const taskDefinitions = Object.fromEntries(
      taskIds.map((taskId, index) => {
        const canonicalTask = canonicalAssignment.assignmentDefinition.tasks[taskId];
        const task = new TaskDefinition({
          id: taskId,
          taskTitle: canonicalTask.taskTitle,
          pageId: canonicalTask.pageId,
          index,
          taskMetadata: canonicalTask.taskMetadata,
        });
        task.addReferenceArtifact({
          type: spreadsheet ? 'SPREADSHEET' : 'TEXT',
          content: spreadsheet ? [['=SUM(A1:A2)']] : 'A usable reference response',
        });
        task.addTemplateArtifact({
          type: spreadsheet ? 'SPREADSHEET' : 'TEXT',
          content: spreadsheet ? [['=SUM(A1:A2)']] : 'A usable template response',
        });
        return [taskId, task];
      })
    );
    for (const [taskId, task] of Object.entries(taskDefinitions)) {
      expect(task.getId()).toBe(taskId);
      expect(task.getPrimaryReference().taskId).toBe(taskId);
    }
    const makeSubmission = (documentId, studentId = canonicalStudent.studentId) => {
      const submission = createStudentSubmission({
        studentId,
        assignmentId: canonicalAssignment.assignmentId,
        documentId,
      });
      vi.spyOn(submission, 'upsertItemFromExtraction');
      vi.spyOn(submission, 'getItem');
      return submission;
    };
    return { logger, tracker, taskDefinitions, makeSubmission };
  }

  it('turns a Slides missing-match placeholder into task E and keeps a healthy sibling', () => {
    const taskIds = Object.keys(canonicalAssignment.assignmentDefinition.tasks).slice(0, 2);
    const healthy = {
      taskId: taskIds[0],
      pageId: 'student-page-1',
      content: 'answer',
      metadata: {},
      documentId: canonicalStudent.documentId,
      type: 'TEXT',
    };
    const missing = {
      taskId: taskIds[1],
      pageId: null,
      content: null,
      metadata: {},
      documentId: canonicalStudent.documentId,
      type: 'TEXT',
    };
    const { logger, taskDefinitions, makeSubmission } = assignmentHarness({
      slides: [healthy, missing],
    });
    const submission = makeSubmission(canonicalStudent.documentId);
    const assignment = Object.create(globalThis.SlidesAssignment.prototype);
    Object.assign(assignment, {
      courseId: canonicalAssignment.courseId,
      assignmentId: canonicalAssignment.assignmentId,
      assignmentDefinition: { tasks: taskDefinitions },
      submissions: [submission],
      progressTracker: { updateProgress: vi.fn() },
    });

    assignment.processAllSubmissions();

    expect(submission.upsertItemFromExtraction).toHaveBeenCalledTimes(2);
    expect(submission.upsertItemFromExtraction).toHaveBeenCalledWith(
      taskDefinitions[taskIds[0]],
      expect.objectContaining({ content: 'answer' })
    );
    expect(submission.items[taskIds[1]]?.assessments).toEqual(
      Object.fromEntries(
        ['completeness', 'accuracy', 'spag'].map((criterion) => [criterion, SOURCE_ERROR])
      )
    );
    expect(submission.items[taskIds[1]]?.artifact.toJSON()).toMatchObject({
      content: null,
      contentHash: null,
      documentId: canonicalStudent.documentId,
      pageId: null,
    });
    expect(submission.items[taskIds[0]]?.assessments).toEqual({});
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('keeps acquisition diagnostics opaque when Slides skips its failed no-document submission', () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const tracker = { updateProgress: vi.fn(), logError: vi.fn() };
    const driveFailure = new Error('native Drive access failure');
    const globals = withGlobalMocks({
      ABLogger: () => ({ getInstance: () => logger }),
      ProgressTracker: () => ({ getInstance: () => tracker }),
      Classroom: () => ({
        Courses: {
          CourseWork: {
            StudentSubmissions: {
              list: vi.fn(() => ({
                studentSubmissions: [
                  {
                    userId: canonicalStudent.studentId,
                    assignmentSubmission: {
                      attachments: [{ driveFile: { id: 'opaque-source-id' } }],
                    },
                  },
                ],
              })),
            },
          },
        },
      }),
      DriveApp: () => ({
        getFileById: vi.fn(() => {
          throw driveFailure;
        }),
      }),
      SlidesParser: () =>
        class {
          extractSubmissionArtifacts = vi.fn(() => []);
        },
    });
    restoreGlobals = globals.restore;
    const assignment = globalThis.Assignment.fromJSON(canonicalAssignment);
    const submission = createStudentSubmission({
      studentId: canonicalStudent.studentId,
      assignmentId: canonicalAssignment.assignmentId,
    });
    submission.documentId = null;
    submission.studentName = 'SENTINEL_STUDENT_NAME';
    assignment.submissions = [submission];

    assignment.fetchSubmittedDocuments();
    assignment.processAllSubmissions();

    expect(submission.documentId).toBeNull();
    expect(Object.keys(submission.items)).toEqual(
      Object.keys(assignment.assignmentDefinition.tasks)
    );
    expect(
      Object.values(submission.items).every((item) =>
        Object.values(item.assessments).every(
          (result) => result.error?.code === 'SOURCE_UNREADABLE'
        )
      )
    ).toBe(true);
    const loggedValues = authoredLogProjection([
      ...logger.info.mock.calls,
      ...logger.warn.mock.calls,
      ...logger.error.mock.calls,
    ]);
    expect(loggedValues).not.toContain('SENTINEL_STUDENT_NAME');
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0][1]).toMatchObject({ studentId: canonicalStudent.studentId });
    expect(logger.warn.mock.calls[0][1]).not.toHaveProperty('studentName');
    expect(logger.error.mock.calls.filter((call) => call.includes(driveFailure))).toHaveLength(1);
    expect(logger.error.mock.calls.find((call) => call.includes(driveFailure))[0]).toContain(
      'opaque-source-id'
    );
  });

  it.each([false, true])(
    'distinguishes a missing IMAGE match from a matched pending image (matched: %s)',
    (matched) => {
      const sourceAssignment = Object.values(canonicalAssignments).find(
        (row) =>
          row.documentType === 'SLIDES' &&
          Object.values(row.assignmentDefinition.tasks).some(
            (task) => task.artifacts.reference[0].type === 'IMAGE'
          ) &&
          Object.values(row.assignmentDefinition.tasks).some(
            (task) => task.artifacts.reference[0].type === 'TEXT'
          )
      );
      const student = sourceAssignment.submissions.find((row) => row.documentId);
      const imageJSON = Object.values(sourceAssignment.assignmentDefinition.tasks).find(
        (task) => task.artifacts.reference[0].type === 'IMAGE'
      );
      const textJSON = Object.values(sourceAssignment.assignmentDefinition.tasks).find(
        (task) => task.artifacts.reference[0].type === 'TEXT'
      );
      const imageTask = TaskDefinition.fromJSON(structuredClone(imageJSON));
      const textTask = TaskDefinition.fromJSON(structuredClone(textJSON));
      const imageTaskId = imageTask.getId();
      const textTaskId = textTask.getId();
      expect(imageTask.getPrimaryReference().getType()).toBe('IMAGE');
      expect(textTask.getPrimaryReference().getType()).toBe('TEXT');
      const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
      const tracker = { updateProgress: vi.fn(), logError: vi.fn() };
      const globals = withGlobalMocks({
        ABLogger: () => ({ getInstance: () => logger }),
        ProgressTracker: () => ({ getInstance: () => tracker }),
        SlidesParser: () => SlidesParser,
        SlidesApp: {
          PageElementType: { SHAPE: 'SHAPE', TABLE: 'TABLE' },
          CellMergeState: { MERGED: 'MERGED' },
          openById: vi.fn(() => ({
            getSlides: () => [
              {
                getObjectId: () => 'real-student-page',
                getPageElements: () => {
                  const elements = [
                    {
                      getDescription: () => `#${textTask.taskTitle}`,
                      getPageElementType: () => 'SHAPE',
                      asShape: () => ({ getText: () => ({ asString: () => 'healthy answer' }) }),
                    },
                  ];
                  if (matched) {
                    elements.push({
                      getDescription: () => `~${imageTaskId}`,
                      getPageElementType: () => 'SHAPE',
                      asShape: () => ({ getText: () => ({ asString: () => 'image marker' }) }),
                    });
                  }
                  return elements;
                },
              },
            ],
          })),
        },
      });
      restoreGlobals = globals.restore;
      const submission = createStudentSubmission({
        studentId: student.studentId,
        assignmentId: sourceAssignment.assignmentId,
        documentId: student.documentId,
      });
      const assignment = Object.create(globalThis.SlidesAssignment.prototype);
      Object.assign(assignment, {
        courseId: sourceAssignment.courseId,
        assignmentId: sourceAssignment.assignmentId,
        assignmentDefinition: { tasks: { [textTaskId]: textTask, [imageTaskId]: imageTask } },
        submissions: [submission],
        progressTracker: tracker,
      });

      assignment.processAllSubmissions();

      const imageItem = submission.getItem(imageTaskId);
      const image = imageItem.artifact.toJSON();
      expect(submission.documentId).toBe(student.documentId);
      expect(image.type).toBe('IMAGE');
      expect(image.documentId).toBe(student.documentId);
      expect(imageItem.assessments).toEqual(
        matched
          ? {}
          : Object.fromEntries(
              ['completeness', 'accuracy', 'spag'].map((criterion) => [criterion, SOURCE_ERROR])
            )
      );
      expect(image.content).toBeNull();
      expect(image.contentHash).toBeNull();
      if (matched) {
        expect(image.pageId).toBe('real-student-page');
        expect(image.metadata.sourceUrl).toContain(student.documentId);
        expect(image.metadata.sourceUrl).toContain('real-student-page');
      } else {
        expect(image.pageId).toBeNull();
        expect(image.metadata).toEqual({});
      }
      const healthyItem = submission.getItem(textTaskId);
      expect(healthyItem.artifact.content).toBe('healthy answer');
      expect(healthyItem.artifact.contentHash).toEqual(expect.any(String));
      expect(healthyItem.assessments).toEqual({});
      if (!matched) expect(logger.error).toHaveBeenCalled();
    }
  );
  it('keeps the caller-selected Slides artifact healthy', () => {
    const taskId = Object.keys(canonicalAssignment.assignmentDefinition.tasks)[0];
    const artifact = {
      taskId,
      pageId: 'first-match',
      content: 'first answer',
      metadata: {},
      documentId: canonicalStudent.documentId,
      type: 'TEXT',
    };
    const { taskDefinitions, logger, makeSubmission } = assignmentHarness({
      slides: [artifact],
      taskCount: 1,
    });
    const submission = makeSubmission(canonicalStudent.documentId);
    const assignment = Object.create(globalThis.SlidesAssignment.prototype);
    Object.assign(assignment, {
      courseId: canonicalAssignment.courseId,
      assignmentId: canonicalAssignment.assignmentId,
      assignmentDefinition: { tasks: taskDefinitions },
      submissions: [submission],
      progressTracker: { updateProgress: vi.fn() },
    });
    assignment.processAllSubmissions();
    expect(submission.items[taskId]?.artifact.toJSON()).toMatchObject({
      content: 'first answer',
      pageId: 'first-match',
    });
    expect(submission.items[taskId]?.assessments).toEqual({});
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('records unavailable Sheets range content as task-scoped extraction E', () => {
    const taskIds = Object.keys(canonicalAssignment.assignmentDefinition.tasks).slice(0, 2);
    const taskId = taskIds[1];
    const healthy = {
      taskId: taskIds[0],
      pageId: '11',
      content: [['=A1']],
      metadata: {},
      documentId: canonicalStudent.documentId,
      type: 'SPREADSHEET',
    };
    const { taskDefinitions, makeSubmission } = assignmentHarness({
      sheets: [healthy],
      spreadsheet: true,
    });
    const submission = makeSubmission(canonicalStudent.documentId);
    const assignment = Object.create(globalThis.SheetsAssignment.prototype);
    Object.assign(assignment, {
      courseId: canonicalAssignment.courseId,
      assignmentId: canonicalAssignment.assignmentId,
      assignmentDefinition: { tasks: taskDefinitions },
      submissions: [submission],
      progressTracker: { updateProgress: vi.fn() },
    });
    assignment.processAllSubmissions();
    expect(submission.items[taskIds[0]]?.artifact.toJSON()).toMatchObject({
      content: [['=A1']],
      pageId: '11',
    });
    expect(submission.items[taskId]?.assessments).toEqual(
      Object.fromEntries(
        ['completeness', 'accuracy', 'spag'].map((criterion) => [criterion, SOURCE_ERROR])
      )
    );
    expect(submission.items[taskId]?.artifact.toJSON()).toMatchObject({
      content: null,
      contentHash: null,
      documentId: canonicalStudent.documentId,
      pageId: null,
    });
  });

  it('propagates an unexpected parser implementation fault instead of relabelling it', () => {
    const { taskDefinitions, makeSubmission } = assignmentHarness();
    const taskId = Object.keys(taskDefinitions)[0];
    const submission = makeSubmission(canonicalStudent.documentId);
    const assignment = Object.create(globalThis.SlidesAssignment.prototype);
    Object.assign(assignment, {
      courseId: canonicalAssignment.courseId,
      assignmentId: canonicalAssignment.assignmentId,
      assignmentDefinition: { tasks: taskDefinitions },
      submissions: [submission],
      progressTracker: { updateProgress: vi.fn() },
    });
    const internalFailure = new TypeError('parser wiring is broken');
    globalThis.SlidesParser = class {
      extractSubmissionArtifacts() {
        throw internalFailure;
      }
    };

    expect(() => assignment.processAllSubmissions()).toThrow(internalFailure);
    expect(submission.upsertItemFromExtraction).not.toHaveBeenCalled();
  });

  it('warns and ignores unknown extraction task IDs while retaining known work', () => {
    const taskId = Object.keys(canonicalAssignment.assignmentDefinition.tasks)[0];
    const artifact = {
      taskId: 'unknown-extraction-task',
      pageId: 'unexpected-page',
      content: 'unrouted',
      metadata: {},
      documentId: canonicalStudent.documentId,
      type: 'TEXT',
    };
    const knownArtifact = { ...artifact, taskId, content: '' };
    const { logger, taskDefinitions, makeSubmission } = assignmentHarness({
      slides: [artifact, knownArtifact],
      taskCount: 1,
    });
    const submission = makeSubmission(canonicalStudent.documentId);
    const assignment = Object.create(globalThis.SlidesAssignment.prototype);
    Object.assign(assignment, {
      courseId: canonicalAssignment.courseId,
      assignmentId: canonicalAssignment.assignmentId,
      assignmentDefinition: { tasks: taskDefinitions },
      submissions: [submission],
      progressTracker: { updateProgress: vi.fn() },
    });

    assignment.processAllSubmissions();

    expect(submission.items[taskId]?.artifact.toJSON()).toMatchObject({ content: '' });
    expect(submission.items[taskId]?.assessments).toEqual({});
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('unknown taskId unknown-extraction-task'),
      expect.objectContaining({ taskId: 'unknown-extraction-task' })
    );
  });

  it('preserves successfully extracted blank work for downstream template/formula handling', () => {
    const taskId = Object.keys(canonicalAssignment.assignmentDefinition.tasks)[0];
    const blankArtifact = {
      taskId,
      pageId: 'blank-page',
      content: '',
      metadata: {},
      documentId: canonicalStudent.documentId,
      type: 'TEXT',
    };
    const { taskDefinitions, makeSubmission } = assignmentHarness({ slides: [blankArtifact] });
    const submission = makeSubmission(canonicalStudent.documentId);
    const assignment = Object.create(globalThis.SlidesAssignment.prototype);
    Object.assign(assignment, {
      courseId: canonicalAssignment.courseId,
      assignmentId: canonicalAssignment.assignmentId,
      assignmentDefinition: { tasks: taskDefinitions },
      submissions: [submission],
      progressTracker: { updateProgress: vi.fn() },
    });

    assignment.processAllSubmissions();

    expect(submission.items[taskId]?.artifact.toJSON()).toMatchObject({ content: '' });
    expect(submission.items[taskId]?.assessments).toEqual({});
  });
});
