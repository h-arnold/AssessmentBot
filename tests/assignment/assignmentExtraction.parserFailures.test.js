import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { loadSyntheticAnalysisProfile } from '#synthetic-data/loadSyntheticAnalysisProfile.js';
import { withGlobalMocks } from '../helpers/globalMockManager.js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { saveGlobals } = require('../helpers/globalMockManager.js');
const originalGlobals = saveGlobals(['DocumentParser']);
const { DocumentParser } = require('#backend/DocumentParsers/DocumentParser.js');
Object.defineProperty(globalThis, 'DocumentParser', {
  configurable: true,
  enumerable: true,
  writable: true,
  value: DocumentParser,
});
const { SheetsParser } = require('#backend/DocumentParsers/SheetsParser.js');
const SlidesAssignment = require('#backend/AssignmentProcessor/SlidesAssignment.js');
const SlidesParser = require('#backend/DocumentParsers/SlidesParser/index.js');

const assignmentRow = Object.values(loadSyntheticAnalysisProfile('small', 'assignmentsByKey')).find(
  (row) => row.documentType === 'SHEETS'
);
const slidesAssignmentRow = Object.values(
  loadSyntheticAnalysisProfile('small', 'assignmentsByKey')
).find((row) => row.documentType === 'SLIDES');
const student = assignmentRow.submissions.find((row) => row.documentId);
const [firstTaskId, failedTaskId] = Object.keys(assignmentRow.assignmentDefinition.tasks);
const bbox = { startRow: 1, startColumn: 1, numRows: 1, numColumns: 1 };
const unavailableSourceResult = {
  score: 'E',
  reasoning: 'No source content could be extracted for this task.',
  error: { stage: 'extraction', code: 'SOURCE_CONTENT_UNAVAILABLE' },
};
const unavailableSourceAssessments = Object.fromEntries(
  ['completeness', 'accuracy', 'spag'].map((criterion) => [criterion, unavailableSourceResult])
);

describe('assignment parser failures', () => {
  let restoreGlobals;

  afterEach(() => {
    restoreGlobals?.();
    restoreGlobals = undefined;
    vi.restoreAllMocks();
  });

  afterAll(() => {
    require('../helpers/globalMockManager.js').restoreGlobals(originalGlobals);
  });

  function createExtraction() {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const tracker = { updateProgress: vi.fn(), logError: vi.fn() };
    const globals = withGlobalMocks({
      ABLogger: { getInstance: () => logger },
      ProgressTracker: { getInstance: () => tracker },
      SpreadsheetApp: {
        openById: vi.fn(),
      },
      SheetsParser: () => class extends SheetsParser {},
    });
    restoreGlobals = globals.restore;

    const assignmentJSON = structuredClone(assignmentRow);
    const spreadsheetTask = Object.values(assignmentJSON.assignmentDefinition.tasks).find(
      (task) => task.artifacts.reference[0].type === 'SPREADSHEET'
    );
    const definitions = Object.fromEntries(
      [firstTaskId, failedTaskId].map((taskId, index) => {
        const task = structuredClone(spreadsheetTask);
        task.id = taskId;
        task.pageId = '11';
        task.index = index;
        task.taskMetadata = { ...task.taskMetadata, bbox };
        for (const role of ['reference', 'template']) {
          task.artifacts[role][0].taskId = taskId;
          task.artifacts[role][0].pageId = '11';
        }
        return [taskId, task];
      })
    );
    assignmentJSON.assignmentDefinition.tasks = definitions;
    const nativeGetRange = vi.fn(() => ({ getFormulas: vi.fn(() => [['=A1']]) }));
    globalThis.SpreadsheetApp.openById.mockImplementation(() => ({
      getSheets: () => [
        { getSheetId: () => 11, getName: () => 'Canonical task', getRange: nativeGetRange },
      ],
    }));
    const assignment = globalThis.SheetsAssignment.fromJSON(assignmentJSON, 'full');
    for (const taskId of [firstTaskId, failedTaskId]) {
      const reference = assignment.assignmentDefinition.tasks[taskId].getPrimaryReference();
      expect(reference.getType()).toBe('SPREADSHEET');
      expect(reference.content).toEqual(expect.any(Array));
      expect(reference.content[0]).toEqual(expect.any(Array));
    }
    const submission = new globalThis.StudentSubmission(
      student.studentId,
      assignmentRow.assignmentId,
      student.documentId,
      student.studentName
    );
    assignment.submissions = [submission];
    assignment.progressTracker = { updateProgress: vi.fn() };
    return { assignment, submission, nativeGetRange, logger, tracker };
  }

  it('maps a native formula range-read failure to task E without losing a healthy sibling', () => {
    const { assignment, submission, nativeGetRange, logger, tracker } = createExtraction();
    const failure = new Error('read failed');
    // The real parser visits tasks in order; make the failure specific to the second task.
    nativeGetRange
      .mockReturnValueOnce({ getFormulas: () => [['=A1']] })
      .mockImplementationOnce(() => {
        throw failure;
      });

    assignment.processAllSubmissions();

    const healthyItem = submission.getItem(firstTaskId);
    const failedItem = submission.getItem(failedTaskId);
    expect(healthyItem).toBeDefined();
    expect(healthyItem.artifact.content).toEqual([['=A1']]);
    expect(healthyItem.artifact.contentHash).toEqual(expect.any(String));
    expect(failedItem).toBeDefined();
    expect(failedItem.artifact.content).toBeNull();
    expect(failedItem.artifact.contentHash).toBeNull();
    expect(failedItem.assessments).toEqual(unavailableSourceAssessments);
    expect(failedItem.artifact.documentId).toBe(student.documentId);
    expect(failedItem.artifact.pageId).toBe('11');
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(expect.any(String), {
      error: failure,
      documentId: student.documentId,
      taskId: failedTaskId,
      pageId: '11',
      bbox,
    });
    expect(tracker.logError).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('does not turn an internal task materialisation fault into a task error', () => {
    const internalFailure = new Error('task materialisation failed');
    const { assignment, submission, logger } = createExtraction();
    vi.spyOn(
      assignment.assignmentDefinition.tasks[firstTaskId],
      'getPrimaryReference'
    ).mockImplementation(() => {
      throw internalFailure;
    });
    let thrown;
    try {
      assignment.processAllSubmissions();
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBe(internalFailure);
    expect(submission.items).toEqual({});
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  function createSlidesExtraction({ type, readContent }) {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    const tracker = { updateProgress: vi.fn(), logError: vi.fn() };
    const assignmentJSON = structuredClone(slidesAssignmentRow);
    const canonicalTextTask = Object.values(assignmentJSON.assignmentDefinition.tasks).find(
      (candidate) => candidate.artifacts.reference[0].type === 'TEXT'
    );
    const healthyTaskId = canonicalTextTask.id;
    const failedTaskId = Object.keys(assignmentJSON.assignmentDefinition.tasks).find(
      (id) => id !== healthyTaskId
    );
    const healthyTaskJSON = assignmentJSON.assignmentDefinition.tasks[canonicalTextTask.id];
    const failedTaskJSON = structuredClone(healthyTaskJSON);
    failedTaskJSON.id = failedTaskId;
    failedTaskJSON.taskTitle = assignmentJSON.assignmentDefinition.tasks[failedTaskId].taskTitle;
    failedTaskJSON.index = 1;
    for (const role of ['reference', 'template']) {
      const artifact = failedTaskJSON.artifacts[role][0];
      artifact.taskId = failedTaskId;
      artifact.pageId = healthyTaskJSON.pageId;
      delete artifact.contentHash;
      if (type === 'TABLE') {
        artifact.type = 'TABLE';
        artifact.content = [['valid table content']];
      }
    }
    assignmentJSON.assignmentDefinition.tasks = {
      [canonicalTextTask.id]: healthyTaskJSON,
      [failedTaskId]: failedTaskJSON,
    };
    const assignment = SlidesAssignment.fromJSON(assignmentJSON, 'full');
    const task = assignment.assignmentDefinition.tasks[failedTaskId];
    const healthyTask = assignment.assignmentDefinition.tasks[healthyTaskId];
    expect(healthyTask.getPrimaryReference().getType()).toBe('TEXT');
    const element = {
      getDescription: () => `#${task.taskTitle}`,
      getPageElementType: () => (type === 'TEXT' ? 'SHAPE' : 'TABLE'),
      asShape: () => ({ getText: readContent }),
      asTable: () => readContent(),
    };
    const globals = withGlobalMocks({
      ABLogger: { getInstance: () => logger },
      ProgressTracker: { getInstance: () => tracker },
      SlidesApp: {
        PageElementType: { SHAPE: 'SHAPE', TABLE: 'TABLE' },
        CellMergeState: { MERGED: 'MERGED' },
        openById: vi.fn(() => ({
          getSlides: () => [
            {
              getObjectId: () => 'student-page-7',
              getPageElements: () => [
                {
                  ...element,
                  getDescription: () => `#${healthyTask.taskTitle}`,
                  getPageElementType: () => 'SHAPE',
                  asShape: () => ({ getText: () => ({ asString: () => 'healthy response' }) }),
                },
                element,
              ],
            },
          ],
        })),
      },
      SlidesParser: () => SlidesParser,
    });
    restoreGlobals = globals.restore;
    const submission = new globalThis.StudentSubmission(
      student.studentId,
      slidesAssignmentRow.assignmentId,
      student.documentId,
      student.studentName
    );
    assignment.submissions = [submission];
    assignment.progressTracker = tracker;
    return { assignment, submission, task, healthyTask, logger };
  }

  it.each([
    [
      'shape text',
      'TEXT',
      (failure) => () => {
        throw failure;
      },
    ],
    [
      'table cell',
      'TABLE',
      (failure) => () => ({
        getNumRows: () => 1,
        getNumColumns: () => 1,
        getCell: () => ({
          getMergeState: () => 'HEAD',
          getText: () => ({
            asString: () => {
              throw failure;
            },
          }),
        }),
      }),
    ],
  ])(
    'observes an actual Slides %s source read failure at the parser boundary',
    (_label, type, makeReadContent) => {
      const failure = new Error('native Slides source read failed');
      const trackedReadContent = vi.fn(makeReadContent(failure));
      const { assignment, submission, task, healthyTask, logger } = createSlidesExtraction({
        type,
        readContent: trackedReadContent,
      });
      let thrown;
      try {
        assignment.processAllSubmissions();
      } catch (error) {
        thrown = error;
      }
      expect(trackedReadContent).toHaveBeenCalled();
      expect(thrown).toBeUndefined();
      const failedItem = submission.getItem(task.getId());
      expect(failedItem).toBeDefined();
      expect(failedItem.artifact.content).toBeNull();
      expect(failedItem.artifact.contentHash).toBeNull();
      expect(failedItem.assessments).toEqual(unavailableSourceAssessments);
      expect(failedItem.artifact.documentId).toBe(student.documentId);
      expect(failedItem.artifact.pageId).toBe('student-page-7');
      const healthyItem = submission.getItem(healthyTask.getId());
      expect(healthyItem).toBeDefined();
      expect(healthyItem.artifact.content).toBe('healthy response');
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error.mock.calls[0][1].error).toBe(failure);
      expect(logger.warn).not.toHaveBeenCalled();
    }
  );

  it('maps a null native table cell to task E through SlidesAssignment', () => {
    const { assignment, submission, task, healthyTask, logger } = createSlidesExtraction({
      type: 'TABLE',
      readContent: () => ({
        getNumRows: () => 1,
        getNumColumns: () => 1,
        getCell: () => null,
      }),
    });
    assignment.processAllSubmissions();
    const failedItem = submission.getItem(task.getId());
    expect(failedItem).toBeDefined();
    expect(failedItem.assessments).toEqual(unavailableSourceAssessments);
    expect(failedItem.artifact).toMatchObject({
      content: null,
      contentHash: null,
      documentId: student.documentId,
      pageId: 'student-page-7',
    });
    expect(submission.getItem(healthyTask.getId()).artifact.content).toBe('healthy response');
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error.mock.calls[0][1].error).toBeInstanceOf(TypeError);
  });
});
