import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { loadSyntheticAnalysisProfile } from '#synthetic-data/loadSyntheticAnalysisProfile.js';
import { withGlobalMocks } from '../helpers/globalMockManager.js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { saveGlobals, restoreGlobals } = require('../helpers/globalMockManager.js');
const originalDocumentParser = saveGlobals(['DocumentParser']);
globalThis.DocumentParser = require('#backend/DocumentParsers/DocumentParser.js').DocumentParser;
const SlidesParser = require('#backend/DocumentParsers/SlidesParser/index.js');
const SheetsParser = require('#backend/DocumentParsers/SheetsParser.js').SheetsParser;
const { TaskDefinition } = require('#backend/Models/TaskDefinition.js');
const assignments = Object.values(loadSyntheticAnalysisProfile('small', 'assignmentsByKey'));
const slidesRow = assignments.find(
  (row) =>
    row.documentType === 'SLIDES' &&
    Object.values(row.assignmentDefinition.tasks).some(
      (task) => task.artifacts.reference[0].type === 'IMAGE'
    )
);
const sheetsRow = assignments.find((row) => row.documentType === 'SHEETS');
const criteria = ['completeness', 'accuracy', 'spag'];

describe('attachment scan recovery and selected extraction', () => {
  let restore;
  afterEach(() => {
    restore?.();
    restore = undefined;
    vi.restoreAllMocks();
  });

  afterAll(() => restoreGlobals(originalDocumentParser));

  function prepare(kind, order, acquire, secondSupported, duplicateRecord) {
    const row = kind === 'IMAGE' ? slidesRow : sheetsRow;
    const source = structuredClone(row);
    const taskId = Object.keys(source.assignmentDefinition.tasks).find((id) =>
      kind === 'IMAGE'
        ? source.assignmentDefinition.tasks[id].artifacts.reference[0].type === 'IMAGE'
        : source.assignmentDefinition.tasks[id].artifacts.reference[0].type === 'SPREADSHEET'
    );
    if (!taskId) throw new Error(`Canonical ${kind} task missing`);
    const task = source.assignmentDefinition.tasks[taskId];
    if (kind === 'SPREADSHEET') {
      task.pageId = '11';
      task.taskMetadata = {
        ...task.taskMetadata,
        bbox: { startRow: 1, startColumn: 1, numRows: 1, numColumns: 1 },
      };
      for (const role of ['reference', 'template']) task.artifacts[role][0].pageId = '11';
    }
    source.assignmentDefinition.tasks = { [taskId]: task };
    const canonicalStudent = source.submissions.find((entry) => entry.documentId);
    source.submissions = [];
    const studentId = canonicalStudent.studentId;
    const assignment = globalThis.Assignment.fromJSON(source, 'full');
    const restoredTask = TaskDefinition.fromJSON(task);
    assignment.assignmentDefinition.tasks = { [taskId]: restoredTask };
    const reference = restoredTask.getPrimaryReference();
    if (kind === 'IMAGE') reference.metadata.tag = `#${taskId}`;
    expect(reference.getType()).toBe(kind);
    assignment.submissions = [new globalThis.StudentSubmission(studentId, row.assignmentId)];
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const tracker = { updateProgress: vi.fn() };
    const selectedId = 'selected-supported-document';
    const secondSupportedId = 'second-supported-document';
    const rejectedId = 'rejected-document';
    const record = (ids) => ({
      userId: studentId,
      assignmentSubmission: { attachments: ids.map((id) => ({ driveFile: { id } })) },
    });
    const list = vi.fn(() => ({
      studentSubmissions: duplicateRecord
        ? [record(order.slice(0, 2)), record(order.slice(2))]
        : [record(order)],
    }));
    const getMimeType = vi.fn((id) =>
      id === selectedId || (secondSupported && id === secondSupportedId)
        ? kind === 'IMAGE'
          ? 'application/vnd.google-apps.presentation'
          : 'application/vnd.google-apps.spreadsheet'
        : 'application/pdf'
    );
    const presentation = {
      getSlides: () => [
        {
          getObjectId: () => 'matched-student-page',
          getPageElements: () => [
            {
              getDescription: () => `~${taskId}`,
              getPageElementType: () => 'SHAPE',
              asShape: () => ({ getText: () => ({ asString: () => 'image response' }) }),
            },
          ],
        },
      ],
    };
    const range = { getFormulas: vi.fn(() => [['=SUM(A1:A2)']]) };
    const globals = withGlobalMocks({
      ABLogger: { getInstance: () => logger },
      ProgressTracker: { getInstance: () => tracker },
      Classroom: { Courses: { CourseWork: { StudentSubmissions: { list } } } },
      DriveApp: { getFileById: (id) => ({ getMimeType: () => getMimeType(id) }) },
      SlidesApp: {
        openById: vi.fn(() => presentation),
        PageElementType: { SHAPE: 'SHAPE', TABLE: 'TABLE' },
        CellMergeState: { MERGED: 'MERGED' },
      },
      SpreadsheetApp: {
        openById: vi.fn(() => ({
          getSheets: () => [
            { getSheetId: () => 11, getName: () => task.taskTitle, getRange: vi.fn(() => range) },
          ],
        })),
      },
      SlidesParser: () => class extends SlidesParser {},
      SheetsParser: () => class extends SheetsParser {},
    });
    restore = globals.restore;
    if (acquire) {
      assignment.fetchSubmittedDocuments();
      assignment.processAllSubmissions();
    }
    return {
      assignment,
      taskId,
      logger,
      range,
      selectedId,
      secondSupportedId,
      rejectedId,
      list,
      getMimeType,
    };
  }

  function expectAcceptedSource(result, kind, selectedId) {
    const submission = result.assignment.submissions[0];
    const item = submission.getItem(result.taskId);
    const artifact = item.artifact.toJSON();
    expect(submission.documentId).toBe(selectedId);
    expect(artifact).toMatchObject({ type: kind, role: 'submission', documentId: selectedId });
    expect(item.assessments).toEqual({});
    for (const criterion of criteria) expect(item.assessments[criterion]).toBeUndefined();
    if (kind === 'IMAGE') {
      expect(artifact.pageId).toBe('matched-student-page');
      expect(artifact.content).toBeNull();
      expect(artifact.contentHash).toBeNull();
      expect(artifact.metadata.sourceUrl).toContain(selectedId);
    } else {
      expect(artifact.pageId).toBe('11');
      expect(artifact.content).toEqual([['=SUM(A1:A2)']]);
      expect(artifact.contentHash).toEqual(expect.any(String));
      expect(result.range.getFormulas).toHaveBeenCalled();
    }
  }

  it.each(['SPREADSHEET', 'IMAGE'])(
    '%s accepted-source extraction works without a rejected candidate',
    (kind) => {
      const result = prepare(kind, ['selected-supported-document'], true, false, false);
      const submission = result.assignment.submissions[0];
      const artifact = submission.getItem(result.taskId).artifact.toJSON();
      expect(submission.documentId).toBe(result.selectedId);
      expect(artifact.documentId).toBe(result.selectedId);
      expect(artifact.type).toBe(kind);
      expect(submission.getItem(result.taskId).assessments).toEqual({});
      expectAcceptedSource(result, kind, result.selectedId);
      expect(result.getMimeType).toHaveBeenCalledWith(result.selectedId);
      if (kind === 'SPREADSHEET') expect(result.logger.error).not.toHaveBeenCalled();
      if (kind === 'SPREADSHEET') {
        expect(result.range.getFormulas).toHaveBeenCalled();
        expect(artifact.content).toEqual([['=SUM(A1:A2)']]);
        expect(artifact.contentHash).toEqual(expect.any(String));
      } else {
        expect(artifact.pageId).toBe('matched-student-page');
        expect(artifact.metadata.sourceUrl).toContain(result.selectedId);
        expect(artifact.content).toBeNull();
        expect(artifact.contentHash).toBeNull();
      }
    }
  );

  it.each([
    ['SPREADSHEET', ['rejected-document', 'selected-supported-document']],
    ['SPREADSHEET', ['selected-supported-document', 'rejected-document']],
    ['IMAGE', ['rejected-document', 'selected-supported-document']],
    ['IMAGE', ['selected-supported-document', 'rejected-document']],
  ])('%s recovery retains the accepted source after a failed candidate: %j', (kind, order) => {
    const result = prepare(kind, order, true, false, false);
    const submission = result.assignment.submissions[0];
    const item = submission.getItem(result.taskId);
    const artifact = item.artifact.toJSON();

    expect(submission.documentId).toBe(result.selectedId);
    expect(artifact.documentId).toBe(result.selectedId);
    expect(artifact.type).toBe(kind);
    expect(item.assessments).toEqual({});
    expect(item.feedback).toEqual({});
    expectAcceptedSource(result, kind, result.selectedId);
    if (kind === 'SPREADSHEET') {
      expect(result.range.getFormulas).toHaveBeenCalled();
      expect(artifact.pageId).toBe('11');
      expect(artifact.content).toEqual([['=SUM(A1:A2)']]);
      expect(artifact.contentHash).toEqual(expect.any(String));
    } else {
      expect(artifact.pageId).toBe('matched-student-page');
      expect(artifact.content).toBeNull();
      expect(artifact.contentHash).toBeNull();
      expect(artifact.metadata.sourceUrl).toContain('selected-supported-document');
    }
  });

  it.each([
    [
      'rejected-document',
      'unreadable-document',
      'UNSUPPORTED_DOCUMENT',
      'The submitted attachment is not a supported document for this assignment.',
    ],
    [
      'unreadable-document',
      'rejected-document',
      'SOURCE_UNREADABLE',
      'The submitted document could not be accessed.',
    ],
  ])(
    'uses the first failure (%s then %s) when all candidates fail',
    (first, second, code, reasoning) => {
      const result = prepare('IMAGE', [first, second], false, false, false);
      const getFile = vi.fn((id) => {
        if (id === 'unreadable-document') throw new Error('native Drive access denial');
        return { getMimeType: () => 'application/pdf' };
      });
      globalThis.DriveApp.getFileById = getFile;
      result.assignment.fetchSubmittedDocuments();
      const submission = result.assignment.submissions[0];
      expect(submission.documentId).toBeNull();
      expect(submission.getItem(result.taskId).artifact.toJSON()).toMatchObject({
        type: 'base',
        role: 'submission',
        pageId: null,
        documentId: null,
        content: null,
        contentHash: null,
        metadata: {},
      });
      expect(submission.getItem(result.taskId).feedback).toEqual({});
      for (const criterion of criteria) {
        expect(submission.getItem(result.taskId).assessments[criterion]).toEqual({
          score: 'E',
          reasoning,
          error: { stage: 'acquisition', code },
        });
      }
      expect(getFile).toHaveBeenCalledTimes(2);
    }
  );

  it.each([
    ['SPREADSHEET', ['unreadable-document', 'selected-supported-document']],
    ['SPREADSHEET', ['selected-supported-document', 'unreadable-document']],
    ['IMAGE', ['unreadable-document', 'selected-supported-document']],
    ['IMAGE', ['selected-supported-document', 'unreadable-document']],
  ])('%s recovers around an unreadable Drive attachment: %j', (kind, order) => {
    const result = prepare(kind, order, false, false, false);
    const getFile = vi.fn((id) => {
      if (id === 'unreadable-document') throw new Error('native Drive access denial');
      return {
        getMimeType: () =>
          kind === 'IMAGE'
            ? 'application/vnd.google-apps.presentation'
            : 'application/vnd.google-apps.spreadsheet',
      };
    });
    globalThis.DriveApp.getFileById = getFile;
    result.assignment.fetchSubmittedDocuments();
    result.assignment.processAllSubmissions();
    expectAcceptedSource(result, kind, result.selectedId);
    expect(getFile).toHaveBeenCalledWith('unreadable-document');
  });

  it.each(['SPREADSHEET', 'IMAGE'])(
    '%s chooses the last of two actual supported document IDs',
    (kind) => {
      const order = ['selected-supported-document', 'second-supported-document'];
      const result = prepare(kind, order, true, true, false);
      const submission = result.assignment.submissions[0];
      const artifact = submission.getItem(result.taskId).artifact.toJSON();
      expect(submission.documentId).toBe(result.secondSupportedId);
      expect(artifact.documentId).toBe(result.secondSupportedId);
      expect(artifact.type).toBe(kind);
      expect(artifact.contentHash).toEqual(kind === 'SPREADSHEET' ? expect.any(String) : null);
      if (kind === 'IMAGE') {
        expect(artifact.pageId).toBe('matched-student-page');
        expect(artifact.metadata.sourceUrl).toContain(result.secondSupportedId);
      } else {
        expect(artifact.pageId).toBe('11');
        expect(result.range.getFormulas).toHaveBeenCalled();
      }
      expect(result.logger.error).not.toHaveBeenCalled();
      expectAcceptedSource(result, kind, result.secondSupportedId);
    }
  );

  it.each([
    [
      'SPREADSHEET',
      [
        'rejected-document',
        'selected-supported-document',
        'rejected-document',
        'second-supported-document',
        'rejected-document',
      ],
    ],
    [
      'IMAGE',
      [
        'rejected-document',
        'selected-supported-document',
        'rejected-document',
        'second-supported-document',
        'rejected-document',
      ],
    ],
  ])(
    '%s preserves the last supported source despite a later rejected attachment',
    (kind, order) => {
      const result = prepare(kind, order, true, true, false);
      expectAcceptedSource(result, kind, result.secondSupportedId);
      const { logger } = result;
      expect(logger.error).not.toHaveBeenCalled();
    }
  );

  it.each(['SPREADSHEET', 'IMAGE'])(
    '%s selects the last supported source across duplicate Classroom records',
    (kind) => {
      const result = prepare(
        kind,
        [
          'selected-supported-document',
          'rejected-document',
          'second-supported-document',
          'rejected-document',
        ],
        true,
        true,
        true
      );
      expectAcceptedSource(result, kind, result.secondSupportedId);
      expect(result.list).toHaveBeenCalledOnce();
      expect(result.logger.error).not.toHaveBeenCalled();
    }
  );
});
