import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadSyntheticAnalysisProfile } from '#synthetic-data/loadSyntheticAnalysisProfile.js';
import { withGlobalMocks } from '../helpers/globalMockManager.js';

const classRows = loadSyntheticAnalysisProfile('small', 'classesById');
const assignmentRows = loadSyntheticAnalysisProfile('small', 'assignmentsByKey');
const canonicalClass = Object.values(classRows).find((row) => row.students.length > 0);
const canonicalAssignment = Object.values(assignmentRows).find(
  (row) => row.courseId === canonicalClass.classId
);
const studentId = canonicalClass.students[0].id;
const mimeType = 'application/vnd.google-apps.presentation';
const authoredLogProjection = (calls) =>
  JSON.stringify(calls, (_key, value) => (value instanceof Error ? undefined : value));

describe('submitted-document acquisition outcomes', () => {
  let restoreGlobals;

  afterEach(() => {
    restoreGlobals?.();
    restoreGlobals = undefined;
    vi.restoreAllMocks();
  });

  function buildAcquisition(list, getFileById = vi.fn(), studentName = 'SENTINEL_STUDENT_NAME') {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const context = withGlobalMocks({
      ABLogger: () => ({ getInstance: () => logger }),
      Classroom: () => ({
        Courses: {
          CourseWork: {
            StudentSubmissions: { list },
          },
        },
      }),
      DriveApp: () => ({ getFileById }),
    });
    restoreGlobals = context.restore;
    const assignment = globalThis.Assignment.fromJSON(canonicalAssignment);
    const submission = new globalThis.StudentSubmission(
      studentId,
      canonicalAssignment.assignmentId,
      null,
      studentName
    );
    assignment.submissions = [submission];
    return { acquisition: new globalThis.AssignmentSubmissions(assignment), assignment, logger };
  }

  it('follows every Classroom page and assigns an attachment found after the first page', () => {
    const list = vi.fn((courseId, assignmentId, options) => {
      expect(courseId).toBe(canonicalClass.classId);
      expect(assignmentId).toBe(canonicalAssignment.assignmentId);
      if (!options) return { studentSubmissions: [], nextPageToken: 'page-two' };
      expect(options).toEqual({ pageToken: 'page-two' });
      return {
        studentSubmissions: [
          {
            userId: studentId,
            assignmentSubmission: {
              attachments: [{ driveFile: { id: 'later-page-document' } }],
            },
          },
        ],
      };
    });
    const getFileById = vi.fn(() => ({ getMimeType: () => mimeType }));
    const { acquisition, assignment, logger } = buildAcquisition(list, getFileById);

    acquisition.fetchSubmittedDocumentsByMimeType(mimeType);

    expect(list).toHaveBeenCalledTimes(2);
    expect(assignment.submissions[0].documentId).toBe('later-page-document');
    expect(getFileById).toHaveBeenCalledWith('later-page-document');
  });

  it('propagates a later-page list failure instead of returning an absent-document outcome', () => {
    const pageFailure = new Error('second Classroom page failed');
    const list = vi
      .fn()
      .mockReturnValueOnce({ studentSubmissions: [], nextPageToken: 'page-two' })
      .mockImplementationOnce(() => {
        throw pageFailure;
      });
    const { acquisition, assignment } = buildAcquisition(list);

    expect(() => acquisition.fetchSubmittedDocumentsByMimeType(mimeType)).toThrow(pageFailure);
    expect(list).toHaveBeenCalledTimes(2);
    expect(assignment.submissions[0].documentId).toBeNull();
  });

  it('retains a genuine no-submission as a null document with no extracted items', () => {
    const list = vi.fn(() => ({ studentSubmissions: [] }));
    const { acquisition, assignment } = buildAcquisition(list);

    acquisition.fetchSubmittedDocumentsByMimeType(mimeType);

    expect(assignment.submissions[0].documentId).toBeNull();
    expect(assignment.submissions[0].items).toEqual({});
  });

  it('records unsupported submitted documents as acquisition errors for every known task', () => {
    const unsupportedMimeType = 'application/pdf';
    const list = vi.fn(() => ({
      studentSubmissions: [
        {
          userId: studentId,
          assignmentSubmission: { attachments: [{ driveFile: { id: 'unsupported-document' } }] },
        },
      ],
    }));
    const getFileById = vi.fn(() => ({ getMimeType: () => unsupportedMimeType }));
    const { acquisition, assignment, logger } = buildAcquisition(list, getFileById);
    const submission = assignment.submissions.find((row) => row.studentId === studentId);
    const taskIds = Object.keys(assignment.tasks);

    acquisition.fetchSubmittedDocumentsByMimeType(mimeType);

    expect(taskIds.length).toBeGreaterThan(0);
    expect(Object.keys(submission.items)).toEqual(expect.arrayContaining(taskIds));
    for (const taskId of taskIds) {
      expect(submission.items[taskId].assessments).toMatchObject({
        completeness: {
          score: 'E',
          reasoning: 'The submitted attachment is not a supported document for this assignment.',
          error: { stage: 'acquisition', code: 'UNSUPPORTED_DOCUMENT' },
        },
        accuracy: { score: 'E', error: { stage: 'acquisition', code: 'UNSUPPORTED_DOCUMENT' } },
        spag: { score: 'E', error: { stage: 'acquisition', code: 'UNSUPPORTED_DOCUMENT' } },
      });
      expect(submission.items[taskId].artifact.toJSON()).toMatchObject({
        type: 'base',
        role: 'submission',
        pageId: null,
        documentId: null,
        content: null,
        contentHash: null,
        metadata: {},
      });
      for (const criterion of ['completeness', 'accuracy', 'spag']) {
        expect(submission.items[taskId].assessments[criterion].reasoning).toBe(
          'The submitted attachment is not a supported document for this assignment.'
        );
      }
    }
    expect(logger.warn).not.toHaveBeenCalled();
    expect(
      authoredLogProjection([
        ...logger.info.mock.calls,
        ...logger.warn.mock.calls,
        ...logger.error.mock.calls,
      ])
    ).not.toContain('SENTINEL_STUDENT_NAME');
  });

  it('records an unreadable submitted document as acquisition errors for every known task', () => {
    const openFailure = new Error('Drive document could not be opened');
    const list = vi.fn(() => ({
      studentSubmissions: [
        {
          userId: studentId,
          assignmentSubmission: { attachments: [{ driveFile: { id: 'unreadable-document' } }] },
        },
      ],
    }));
    const getFileById = vi.fn(() => {
      throw openFailure;
    });
    const { acquisition, assignment, logger } = buildAcquisition(list, getFileById);
    const submission = assignment.submissions.find((row) => row.studentId === studentId);
    const taskIds = Object.keys(assignment.tasks);

    acquisition.fetchSubmittedDocumentsByMimeType(mimeType);

    expect(taskIds.length).toBeGreaterThan(0);
    expect(Object.keys(submission.items)).toEqual(expect.arrayContaining(taskIds));
    for (const taskId of taskIds) {
      expect(submission.items[taskId].assessments).toMatchObject({
        completeness: {
          score: 'E',
          reasoning: 'The submitted document could not be accessed.',
          error: { stage: 'acquisition', code: 'SOURCE_UNREADABLE' },
        },
        accuracy: { score: 'E', error: { stage: 'acquisition', code: 'SOURCE_UNREADABLE' } },
        spag: { score: 'E', error: { stage: 'acquisition', code: 'SOURCE_UNREADABLE' } },
      });
      expect(submission.items[taskId].artifact.toJSON()).toMatchObject({
        type: 'base',
        role: 'submission',
        pageId: null,
        documentId: null,
        content: null,
        contentHash: null,
        metadata: {},
      });
      for (const criterion of ['completeness', 'accuracy', 'spag']) {
        expect(submission.items[taskId].assessments[criterion].reasoning).toBe(
          'The submitted document could not be accessed.'
        );
      }
    }
    expect(getFileById).toHaveBeenCalledWith('unreadable-document');
    const rawErrorCalls = logger.error.mock.calls.filter((call) => call.includes(openFailure));
    expect(rawErrorCalls).toHaveLength(1);
    expect(rawErrorCalls[0][0]).toContain('unreadable-document');
    expect(
      authoredLogProjection([
        ...logger.info.mock.calls,
        ...logger.warn.mock.calls,
        ...logger.error.mock.calls,
      ])
    ).not.toContain('SENTINEL_STUDENT_NAME');
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('propagates an unexpected Drive file implementation error', () => {
    const implementationFailure = new TypeError('Drive file object is malformed');
    const list = vi.fn(() => ({
      studentSubmissions: [
        {
          userId: studentId,
          assignmentSubmission: {
            attachments: [{ driveFile: { id: 'document-with-broken-file' } }],
          },
        },
      ],
    }));
    const getFileById = vi.fn(() => ({
      getMimeType: () => {
        throw implementationFailure;
      },
    }));
    const { acquisition } = buildAcquisition(list, getFileById);

    expect(() => acquisition.fetchSubmittedDocumentsByMimeType(mimeType)).toThrow(
      implementationFailure
    );
  });
});
