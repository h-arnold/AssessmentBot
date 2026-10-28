import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { loadSyntheticAnalysisProfile } from '#synthetic-data/loadSyntheticAnalysisProfile.js';
import { withGlobalMocks } from '../helpers/globalMockManager.js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  saveGlobals,
  restoreGlobals: restoreSavedGlobals,
} = require('../helpers/globalMockManager.js');
const originalParserGlobal = saveGlobals(['DocumentParser', 'SlidesParser', 'SheetsParser']);
let ActualSlidesParser;
let ActualSheetsParser;
const rows = Object.values(loadSyntheticAnalysisProfile('small', 'assignmentsByKey'));
const slidesRow = rows.find((row) => row.documentType === 'SLIDES');
const sheetsRow = rows.find((row) => row.documentType === 'SHEETS');
const exactErrors = Object.fromEntries(
  ['completeness', 'accuracy', 'spag'].map((criterion) => [
    criterion,
    {
      score: 'E',
      reasoning: 'The submitted document could not be accessed.',
      error: { stage: 'acquisition', code: 'SOURCE_UNREADABLE' },
    },
  ])
);

describe('student document open outcomes', () => {
  let restoreGlobals;

  beforeAll(() => {
    globalThis.DocumentParser =
      require('#backend/DocumentParsers/DocumentParser.js').DocumentParser;
    ActualSlidesParser = require('#backend/DocumentParsers/SlidesParser/index.js');
    ActualSheetsParser = require('#backend/DocumentParsers/SheetsParser.js').SheetsParser;
  });

  afterAll(() => restoreSavedGlobals(originalParserGlobal));

  afterEach(() => {
    restoreGlobals?.();
    restoreGlobals = undefined;
    vi.restoreAllMocks();
  });

  function createCase(kind, openById) {
    const canonical = kind === 'SLIDES' ? slidesRow : sheetsRow;
    const assignmentJSON = structuredClone(canonical);
    const eligible = Object.entries(assignmentJSON.assignmentDefinition.tasks).filter(([, task]) =>
      kind === 'SLIDES'
        ? task.artifacts.reference[0].type === 'TEXT'
        : task.artifacts.reference[0].type === 'SPREADSHEET'
    );
    const [taskId, task] = eligible[0];
    if (kind === 'SHEETS') {
      task.pageId = '11';
      task.taskMetadata = {
        ...task.taskMetadata,
        bbox: { startRow: 1, startColumn: 1, numRows: 1, numColumns: 1 },
      };
      for (const role of ['reference', 'template']) {
        task.artifacts[role][0].pageId = '11';
      }
    }
    assignmentJSON.assignmentDefinition.tasks = { [taskId]: task };
    assignmentJSON.submissions = assignmentJSON.submissions.map((submission) => ({
      ...submission,
      items: Object.fromEntries(Object.entries(submission.items).filter(([id]) => id === taskId)),
    }));
    const taskInstance =
      kind === 'SLIDES'
        ? globalThis.SlidesAssignment.fromJSON(assignmentJSON, 'full')
        : globalThis.SheetsAssignment.fromJSON(assignmentJSON, 'full');
    const studentRows = canonical.submissions
      .filter((submission) => submission.documentId)
      .slice(0, 2);
    const failedStudent = new globalThis.StudentSubmission(
      studentRows[0].studentId,
      canonical.assignmentId,
      'failed-document',
      studentRows[0].studentName
    );
    const healthyStudent = new globalThis.StudentSubmission(
      studentRows[1].studentId,
      canonical.assignmentId,
      'healthy-document',
      studentRows[1].studentName
    );
    taskInstance.submissions = [failedStudent, healthyStudent];
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const tracker = { updateProgress: vi.fn(), logError: vi.fn() };
    const mocks = {
      ABLogger: { getInstance: () => logger },
      ProgressTracker: { getInstance: () => tracker },
      [kind === 'SLIDES' ? 'SlidesApp' : 'SpreadsheetApp']: {
        openById,
        ...(kind === 'SLIDES'
          ? {
              PageElementType: { SHAPE: 'SHAPE', TABLE: 'TABLE' },
              CellMergeState: { MERGED: 'MERGED' },
            }
          : {}),
      },
      SlidesParser: () => class extends ActualSlidesParser {},
      SheetsParser: () => class extends ActualSheetsParser {},
    };
    restoreGlobals = withGlobalMocks(mocks).restore;
    return {
      assignment: taskInstance,
      failedStudent,
      healthyStudent,
      taskId,
      taskTitle: task.taskTitle,
      pageId: task.pageId,
      logger,
    };
  }

  function healthyDocument(kind, taskTitle, pageId) {
    return kind === 'SLIDES'
      ? {
          getSlides: () => [
            {
              getObjectId: () => 'healthy-page',
              getPageElements: () => [
                {
                  getDescription: () => `#${taskTitle}`,
                  getPageElementType: () => 'SHAPE',
                  asShape: () => ({ getText: () => ({ asString: () => 'healthy response' }) }),
                },
              ],
            },
          ],
        }
      : {
          getSheets: () => [
            {
              getSheetId: () => Number(pageId),
              getName: () => taskTitle,
              getRange: vi.fn(() => ({ getFormulas: vi.fn(() => [['=A1']]) })),
            },
          ],
        };
  }

  it.each(['SLIDES', 'SHEETS'])(
    '%s internal generic parser failure escapes unchanged without materialising items',
    (kind) => {
      const internalFailure = new Error('internal parser failure');
      const openById = vi.fn(() => healthyDocument(kind, 'task', '11'));
      const { assignment, failedStudent, logger } = createCase(kind, openById);
      const Parser = kind === 'SLIDES' ? ActualSlidesParser : ActualSheetsParser;
      globalThis[kind === 'SLIDES' ? 'SlidesParser' : 'SheetsParser'] = class extends Parser {
        extractSubmissionArtifacts() {
          throw internalFailure;
        }
      };
      let thrown;
      try {
        assignment.processAllSubmissions();
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBe(internalFailure);
      expect(failedStudent.items).toEqual({});
      expect(logger.error).not.toHaveBeenCalled();
    }
  );

  it('treats a successfully opened empty spreadsheet as unavailable extracted content', () => {
    const openById = vi.fn(() => ({ getSheets: () => [] }));
    const { assignment, failedStudent, taskId } = createCase('SHEETS', openById);
    assignment.submissions = [failedStudent];

    assignment.processAllSubmissions();

    const item = failedStudent.getItem(taskId);
    expect(item.artifact).toMatchObject({
      documentId: 'failed-document',
      pageId: null,
      content: null,
      contentHash: null,
    });
    expect(item.assessments).toEqual(
      Object.fromEntries(
        ['completeness', 'accuracy', 'spag'].map((criterion) => [
          criterion,
          {
            score: 'E',
            reasoning: 'No source content could be extracted for this task.',
            error: { stage: 'extraction', code: 'SOURCE_CONTENT_UNAVAILABLE' },
          },
        ])
      )
    );
  });

  it.each(['SLIDES', 'SHEETS'])('%s open access failure is isolated to that student', (kind) => {
    const failure = new Error('private document-open detail');
    const openById = vi.fn((id) => {
      if (id === 'failed-document') throw failure;
      return healthyDocument(kind);
    });
    const { assignment, failedStudent, healthyStudent, taskId, taskTitle, pageId, logger } =
      createCase(kind, openById);
    openById.mockImplementation((id) =>
      id === 'failed-document'
        ? (() => {
            throw failure;
          })()
        : healthyDocument(kind, taskTitle, pageId)
    );
    expect(() => assignment.processAllSubmissions()).not.toThrow();
    expect(openById).toHaveBeenCalledWith('failed-document');
    expect(openById).toHaveBeenCalledWith('healthy-document');
    expect(failedStudent.getItem(taskId)).toBeDefined();
    expect(failedStudent.getItem(taskId).assessments).toEqual(exactErrors);
    expect(failedStudent.getItem(taskId).artifact.content).toBeNull();
    expect(failedStudent.getItem(taskId).artifact.contentHash).toBeNull();
    expect(failedStudent.getItem(taskId).artifact.documentId).toBe('failed-document');
    expect(failedStudent.getItem(taskId).artifact.pageId).toBeNull();
    if (kind === 'SLIDES') {
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith('Failed to open student Slides document', {
        documentId: 'failed-document',
        err: failure,
      });
      expect(logger.error.mock.calls[0][1].err).toBe(failure);
      expect(logger.warn).not.toHaveBeenCalled();
    }
    expect(healthyStudent.getItem(taskId).artifact.content).toEqual(
      kind === 'SLIDES' ? 'healthy response' : [['=A1']]
    );
    expect(healthyStudent.getItem(taskId).assessments).toEqual({});
  });

  it.each([
    ['TypeError', () => new TypeError('openById implementation fault')],
    ['ReferenceError', () => new ReferenceError('openById is missing')],
    ['non-Error value', () => ({ fault: 'openById' })],
  ])('Slides %s open fault escapes by identity without diagnostics', (_kind, makeFailure) => {
    const failure = makeFailure();
    const openById = vi.fn((id) => {
      if (id === 'failed-document') throw failure;
      return healthyDocument('SLIDES');
    });
    const { assignment, failedStudent, logger } = createCase('SLIDES', openById);
    let thrown;
    try {
      assignment.processAllSubmissions();
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBe(failure);
    expect(failedStudent.items).toEqual({});
    expect(logger.error).not.toHaveBeenCalled();
  });

  it.each([
    ['TypeError', new TypeError('openById implementation fault')],
    ['ReferenceError', new ReferenceError('openById is missing')],
    ['non-Error value', 'openById fault'],
  ])('Sheets %s open fault escapes by identity without logging', (_kind, failure) => {
    const openById = vi.fn(() => {
      throw failure;
    });
    const { assignment, failedStudent, logger } = createCase('SHEETS', openById);
    let thrown;
    try {
      assignment.processAllSubmissions();
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBe(failure);
    expect(failedStudent.items).toEqual({});
    expect(logger.error).not.toHaveBeenCalled();
  });

  it.each(['SLIDES', 'SHEETS'])(
    '%s healthy parser control opens and extracts the real task',
    (kind) => {
      const openById = vi.fn();
      const { assignment, healthyStudent, taskId, taskTitle, pageId } = createCase(kind, openById);
      openById.mockImplementation(() => healthyDocument(kind, taskTitle, pageId));
      assignment.submissions = [healthyStudent];

      assignment.processAllSubmissions();

      expect(openById).toHaveBeenCalledWith('healthy-document');
      expect(healthyStudent.getItem(taskId).artifact.content).toEqual(
        kind === 'SLIDES' ? 'healthy response' : [['=A1']]
      );
      expect(healthyStudent.getItem(taskId).artifact.contentHash).toEqual(expect.any(String));
    }
  );
});
