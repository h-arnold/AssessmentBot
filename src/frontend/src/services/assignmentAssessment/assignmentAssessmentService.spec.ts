import { ZodError } from 'zod';
import { afterEach, describe, expect, it, vi } from 'vitest';

const callApiMock = vi.fn();
const logFrontendErrorMock = vi.fn();

vi.mock('../apiService', () => ({
  callApi: callApiMock,
}));

vi.mock('../../logging/frontendLogger', () => ({
  logFrontendError: logFrontendErrorMock,
}));

const validStartAssessmentRunRequest = {
  definitionKey: 'algebra-baseline',
  assignmentId: 'assign-123',
  courseId: 'course-456',
};

const validFullAssignment = {
  courseId: 'course-1',
  assignmentId: 'assign-1',
  assignmentName: 'Algebra Baseline',
  dueDate: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
  createdAt: '2026-05-01T00:00:00.000Z',
  documentType: 'QUIZ',
  referenceDocumentId: 'ref-1',
  templateDocumentId: 'tpl-1',
  tasks: {
    'task-1': {
      id: 'task-1',
      taskTitle: 'Task One',
      pageId: 'page-1',
      taskNotes: null,
      taskMetadata: {},
      taskWeighting: 1,
      index: 0,
      artifacts: {
        reference: [
          {
            taskId: 'task-1',
            role: 'reference',
            pageId: 'page-1',
            documentId: 'doc-ref',
            content: null,
            contentHash: null,
            metadata: {},
            uid: 'uid-1',
            type: 'base',
          },
        ],
        template: [],
      },
    },
  },
  submissions: [
    {
      studentId: 'student-1',
      studentName: 'Student One',
      assignmentId: 'assign-1',
      documentId: 'doc-1',
      items: {
        'task-1': {
          id: 'item-1',
          taskId: 'task-1',
          artifact: {
            taskId: 'task-1',
            role: 'reference',
            pageId: 'page-1',
            documentId: 'doc-ref',
            content: null,
            contentHash: null,
            metadata: {},
            uid: 'uid-1',
            type: 'base',
          },
          assessments: {},
          feedback: {},
        },
      },
      createdAt: '2026-05-02T00:00:00.000Z',
      updatedAt: '2026-05-02T00:00:00.000Z',
    },
  ],
  assignmentDefinition: {
    primaryTitle: 'Algebra',
    primaryTopic: 'algebra',
    primaryTopicKey: 'algebra',
    yearGroupKey: 'yg-1',
    yearGroupLabel: 'Year 1',
    alternateTitles: [],
    alternateTopics: [],
    documentType: 'QUIZ',
    referenceDocumentId: 'ref-1',
    templateDocumentId: 'tpl-1',
    referenceLastModified: '2026-04-01T00:00:00.000Z',
    templateLastModified: '2026-04-01T00:00:00.000Z',
    assignmentWeighting: 1,
    definitionKey: 'def-1',
    tasks: {
      'task-1': {
        id: 'task-1',
        taskTitle: 'Task One',
        pageId: 'page-1',
        taskNotes: null,
        taskMetadata: {},
        taskWeighting: 1,
        index: 0,
        artifacts: {
          reference: [
            {
              taskId: 'task-1',
              role: 'reference',
              pageId: 'page-1',
              documentId: 'doc-ref',
              content: null,
              contentHash: null,
              metadata: {},
              uid: 'uid-1',
              type: 'base',
            },
          ],
          template: [],
        },
      },
    },
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
};

/**
 * Loads the assignment-assessment service module under test.
 *
 * @returns {Promise<typeof import('./assignmentAssessmentService')>} The imported service module.
 */
async function loadAssignmentAssessmentService() {
  return import('./assignmentAssessmentService');
}

describe('assignmentAssessmentService', () => {
  afterEach(() => {
    callApiMock.mockReset();
    logFrontendErrorMock.mockReset();
    vi.resetModules();
  });

  it('startAssessmentRun() returns null on a successful call', async () => {
    callApiMock.mockResolvedValueOnce(null);

    const { startAssessmentRun } = await loadAssignmentAssessmentService();

    await expect(startAssessmentRun(validStartAssessmentRunRequest)).resolves.toBeNull();
    expect(callApiMock).toHaveBeenCalledTimes(1);
    expect(logFrontendErrorMock).not.toHaveBeenCalled();
  });

  it('startAssessmentRun() calls callApi with the correct method name and payload', async () => {
    callApiMock.mockResolvedValueOnce(null);

    const { startAssessmentRun } = await loadAssignmentAssessmentService();

    await startAssessmentRun(validStartAssessmentRunRequest);
    expect(callApiMock).toHaveBeenCalledWith('startAssessmentRun', validStartAssessmentRunRequest);
    expect(callApiMock).toHaveBeenCalledTimes(1);
  });

  it('startAssessmentRun() validates input through Zod schema before calling callApi', async () => {
    const { startAssessmentRun } = await loadAssignmentAssessmentService();

    await expect(
      startAssessmentRun({} as Parameters<typeof startAssessmentRun>[0])
    ).rejects.toBeInstanceOf(ZodError);
    expect(callApiMock).not.toHaveBeenCalled();
  });

  describe('getAssignment', () => {
    it('resolves with valid data when the backend returns a well-formed full assignment', async () => {
      callApiMock.mockResolvedValueOnce(validFullAssignment);

      const { getAssignment } = await loadAssignmentAssessmentService();

      const result = await getAssignment({
        courseId: 'course-1',
        assignmentId: 'assign-1',
      });

      expect(result).toEqual(validFullAssignment);
      expect(callApiMock).toHaveBeenCalledWith('getAssignment', {
        courseId: 'course-1',
        assignmentId: 'assign-1',
      });
    });

    it('rejects with a Zod error when the response has an unexpected shape (missing courseId)', async () => {
      const incompleteResponse = { ...validFullAssignment };
      delete (incompleteResponse as Record<string, unknown>).courseId;
      callApiMock.mockResolvedValueOnce(incompleteResponse);

      const { getAssignment } = await loadAssignmentAssessmentService();

      await expect(
        getAssignment({ courseId: 'course-1', assignmentId: 'assign-1' })
      ).rejects.toBeInstanceOf(ZodError);
    });

    it('accepts null as a valid response (assignment not found)', async () => {
      callApiMock.mockResolvedValueOnce(null);

      const { getAssignment } = await loadAssignmentAssessmentService();

      await expect(
        getAssignment({ courseId: 'course-1', assignmentId: 'assign-1' })
      ).resolves.toBeNull();
    });

    it('rejects with a Zod error when the response has extra fields', async () => {
      callApiMock.mockResolvedValueOnce({ ...validFullAssignment, unexpectedField: 1 });

      const { getAssignment } = await loadAssignmentAssessmentService();

      await expect(
        getAssignment({ courseId: 'course-1', assignmentId: 'assign-1' })
      ).rejects.toBeInstanceOf(ZodError);
    });

    it('logs structured diagnostics (method and zodIssues) when the response fails schema validation', async () => {
      const incompleteResponse = { ...validFullAssignment };
      delete (incompleteResponse as Record<string, unknown>).courseId;
      callApiMock.mockResolvedValueOnce(incompleteResponse);

      const { getAssignment } = await loadAssignmentAssessmentService();

      await expect(
        getAssignment({ courseId: 'course-1', assignmentId: 'assign-1' })
      ).rejects.toBeInstanceOf(ZodError);

      expect(logFrontendErrorMock).toHaveBeenCalledTimes(1);
      const [context, error, metadata] = logFrontendErrorMock.mock.calls[0] as [
        string,
        unknown,
        Record<string, unknown>,
      ];
      expect(context).toBe('services/assignmentAssessment.parseResponse');
      expect(error).toBeInstanceOf(ZodError);
      expect(metadata).toMatchObject({
        method: 'getAssignment',
        zodIssues: expect.any(Array),
      });
      expect((metadata.zodIssues as unknown[]).length).toBeGreaterThan(0);
      expect(typeof metadata.responsePreview).toBe('string');
    });

    it('parses input through the request schema before calling callApi', async () => {
      const { getAssignment } = await loadAssignmentAssessmentService();

      await expect(
        getAssignment({ assignmentId: 'assign-1' } as Parameters<typeof getAssignment>[0])
      ).rejects.toBeInstanceOf(ZodError);
      expect(callApiMock).not.toHaveBeenCalled();
    });
  });
});
