import { ZodError } from 'zod';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StartAssessmentRunResponseSchema } from './assignmentAssessment.zod';
import type { AssignmentFull } from './assignmentAssessment.zod';
import type * as ApiService from '../apiService';

const { callApiMock, mockLogFrontendError } = await vi.hoisted(() => {
  return {
    callApiMock: vi.fn(),
    mockLogFrontendError:
      vi.fn<(context: string, error: unknown, metadata?: Record<string, unknown>) => void>(),
  };
});
const INDEPENDENT_ASSIGNMENT_READ_COUNT = 2;

vi.mock('../apiService', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiService>();
  return {
    ...actual,
    callApi: callApiMock,
  };
});

vi.mock('@/logging/frontendLogger', () => {
  return {
    logFrontendError: mockLogFrontendError,
    logFrontendEvent: vi.fn(),
  };
});

const validStartAssessmentRunRequest = {
  definitionKey: 'algebra-baseline',
  assignmentId: 'assign-123',
  courseId: 'course-456',
};

const validFullAssignment: AssignmentFull = {
  courseId: 'course-1',
  assignmentId: 'assign-1',
  assignmentName: 'Algebra Baseline',
  dueDate: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
  createdAt: '2026-05-01T00:00:00.000Z',
  documentType: 'QUIZ',
  assessmentContractVersion: 1,
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
            content: 'Reference response',
            contentHash: 'reference-hash',
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
            role: 'submission',
            pageId: 'page-1',
            documentId: 'doc-1',
            content: 'Student response',
            contentHash: 'student-hash',
            metadata: {},
            uid: 'uid-1',
            type: 'base',
          },
          assessments: {
            completeness: { score: 4, reasoning: 'Complete.' },
            accuracy: { score: 3, reasoning: 'Mostly accurate.' },
            spag: { score: 'N', reasoning: 'Not applicable.' },
          },
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
              content: 'Reference response',
              contentHash: 'reference-hash',
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

/**
 * Adds a task-2 entry derived from task-1 to both task maps, remapping every artifact taskId.
 *
 * @param {AssignmentFull} assignment Mutable assignment to extend.
 * @returns {AssignmentFull} The same assignment with task-2 present in both task maps.
 */
function withRemappedTaskTwo(assignment: AssignmentFull): AssignmentFull {
  type Task = NonNullable<AssignmentFull['tasks']>[string];
  const remapTaskTwo = (task: Task): Task => {
    return {
      ...task,
      id: 'task-2',
      artifacts: {
        reference: task.artifacts.reference.map((artifact) => ({ ...artifact, taskId: 'task-2' })),
        template: task.artifacts.template.map((artifact) => ({ ...artifact, taskId: 'task-2' })),
      },
    };
  };
  assignment.tasks!['task-2'] = remapTaskTwo(assignment.tasks!['task-1']!);
  assignment.assignmentDefinition.tasks['task-2'] = remapTaskTwo(
    assignment.assignmentDefinition.tasks['task-1']!
  );
  return assignment;
}

describe('assignmentAssessmentService', () => {
  afterEach(() => {
    callApiMock.mockReset();
    mockLogFrontendError.mockReset();
    vi.resetModules();
  });

  it('startAssessmentRun() returns the request ID on a successful call', async () => {
    const response = { requestId: '550e8400-e29b-41d4-a716-446655440000' };
    callApiMock.mockResolvedValueOnce(response);

    const { startAssessmentRun } = await loadAssignmentAssessmentService();

    await expect(startAssessmentRun(validStartAssessmentRunRequest)).resolves.toEqual(response);
    expect(callApiMock).toHaveBeenCalledTimes(1);
    expect(StartAssessmentRunResponseSchema.parse(response)).toEqual(response);
  });

  it('startAssessmentRun() calls callApi with the correct method name and payload', async () => {
    callApiMock.mockResolvedValueOnce({ requestId: '550e8400-e29b-41d4-a716-446655440000' });

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

  it('startAssessmentRun() rejects a null response at the service boundary', async () => {
    callApiMock.mockResolvedValueOnce(null);

    const { startAssessmentRun } = await loadAssignmentAssessmentService();

    await expect(startAssessmentRun(validStartAssessmentRunRequest)).rejects.toBeInstanceOf(
      ZodError
    );
  });

  describe('getProgress', () => {
    const validProgressRecord = {
      requestId: '550e8400-e29b-41d4-a716-446655440000',
      step: 1,
      message: 'Marking task one',
      completed: false,
      error: null,
      timestamp: '2026-11-25T10:00:00.000Z',
    };

    it('returns parsed tasks using the getProgress backend method', async () => {
      const response = { tasks: [validProgressRecord] };
      callApiMock.mockResolvedValueOnce(response);
      const { getProgress } = await loadAssignmentAssessmentService();
      await expect(getProgress()).resolves.toEqual(response);
      expect(callApiMock).toHaveBeenCalledWith('getProgress');
      expect(callApiMock).toHaveBeenCalledTimes(1);
    });

    it('accepts an empty tasks array', async () => {
      callApiMock.mockResolvedValueOnce({ tasks: [] });
      const { getProgress } = await loadAssignmentAssessmentService();
      await expect(getProgress()).resolves.toEqual({ tasks: [] });
      expect(callApiMock).toHaveBeenCalledWith('getProgress');
    });

    it('rejects a malformed task timestamp at the service boundary', async () => {
      callApiMock.mockResolvedValueOnce({
        tasks: [{ ...validProgressRecord, timestamp: 'not-a-date' }],
      });
      const { getProgress } = await loadAssignmentAssessmentService();
      await expect(getProgress()).rejects.toBeInstanceOf(ZodError);
    });
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

    it('preserves a backend-materialised E result and its reasoning and cause', async () => {
      const payload = structuredClone(validFullAssignment);
      const expected = {
        score: 'E',
        reasoning: 'The assessment service could not complete the request after retries.',
        error: { stage: 'assessment', code: 'LLM_UNAVAILABLE' },
      } as const;
      payload.submissions[0]!.items['task-1']!.assessments.accuracy = expected;
      callApiMock.mockResolvedValueOnce(payload);
      const { getAssignment } = await loadAssignmentAssessmentService();
      const result = await getAssignment({ courseId: 'course-1', assignmentId: 'assign-1' });
      expect(result?.submissions[0]?.items['task-1']?.assessments.accuracy).toEqual(expected);
    });

    it('isolates a corrupt identifiable item and preserves its healthy sibling', async () => {
      const payload = withRemappedTaskTwo(structuredClone(validFullAssignment));
      expect(
        Object.values(payload.tasks!['task-2']!.artifacts)
          .flat()
          .every((artifact) => artifact.taskId === 'task-2')
      ).toBe(true);
      expect(
        Object.values(payload.assignmentDefinition.tasks['task-2']!.artifacts)
          .flat()
          .every((artifact) => artifact.taskId === 'task-2')
      ).toBe(true);
      const healthy = structuredClone(payload.submissions[0]!.items['task-1']!);
      payload.submissions[0]!.items['task-2'] = { ...healthy, taskId: 'task-2' };
      payload.submissions[0]!.items['task-2']!.artifact.role = 'reference';
      callApiMock.mockResolvedValueOnce(payload);
      const { getAssignment } = await loadAssignmentAssessmentService();
      const result = await getAssignment({ courseId: 'course-1', assignmentId: 'assign-1' });
      expect(result?.submissions[0]?.items['task-1']?.assessments).toEqual(healthy.assessments);
      expect.soft(result?.submissions[0]?.items['task-2']?.assessments.completeness).toMatchObject({
        score: 'E',
        error: { stage: 'validation', code: 'CORRUPT_RECORD' },
      });
    });

    it('preserves same-payload missing-task defence and strict unknown-task rejection', async () => {
      const incomplete = withRemappedTaskTwo(structuredClone(validFullAssignment));
      expect(
        Object.values(incomplete.tasks!['task-2']!.artifacts)
          .flat()
          .every((artifact) => artifact.taskId === 'task-2')
      ).toBe(true);
      expect(
        Object.values(incomplete.assignmentDefinition.tasks['task-2']!.artifacts)
          .flat()
          .every((artifact) => artifact.taskId === 'task-2')
      ).toBe(true);
      callApiMock.mockResolvedValueOnce(incomplete);
      const { getAssignment } = await loadAssignmentAssessmentService();
      const result = await getAssignment({ courseId: 'course-1', assignmentId: 'assign-1' });
      expect.soft(result?.submissions[0]?.items['task-2']?.assessments.completeness).toMatchObject({
        score: 'E',
        error: { code: 'CORRUPT_RECORD' },
      });

      const unknown = structuredClone(validFullAssignment);
      unknown.submissions[0]!.items['unknown'] = structuredClone(
        unknown.submissions[0]!.items['task-1']!
      );
      callApiMock.mockResolvedValueOnce(unknown);
      await expect
        .soft(getAssignment({ courseId: 'course-1', assignmentId: 'assign-1' }))
        .rejects.toThrow();
      expect(callApiMock).toHaveBeenCalledTimes(INDEPENDENT_ASSIGNMENT_READ_COUNT);
    });

    it('propagates transport programming exceptions unchanged', async () => {
      const failure = new TypeError('transport wiring failed');
      callApiMock.mockRejectedValueOnce(failure);
      const { getAssignment } = await loadAssignmentAssessmentService();
      await expect(getAssignment({ courseId: 'course-1', assignmentId: 'assign-1' })).rejects.toBe(
        failure
      );
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

      expect(callApiMock).toHaveBeenCalledWith('getAssignment', {
        courseId: 'course-1',
        assignmentId: 'assign-1',
      });
    });

    it('parses input through the request schema before calling callApi', async () => {
      const { getAssignment } = await loadAssignmentAssessmentService();

      await expect(
        getAssignment({ assignmentId: 'assign-1' } as Parameters<typeof getAssignment>[0])
      ).rejects.toBeInstanceOf(ZodError);
      expect(callApiMock).not.toHaveBeenCalled();
    });

    it('logs a normaliser failure once at the service boundary and rethrows the original error', async () => {
      const payload = structuredClone(validFullAssignment);
      const submission = payload.submissions[0]! as unknown as Record<string, unknown>;
      submission.items = [];
      callApiMock.mockResolvedValueOnce(payload);

      const { getAssignment } = await loadAssignmentAssessmentService();
      const request = { courseId: 'course-1', assignmentId: 'assign-1' };

      let thrownError: unknown;
      try {
        await getAssignment(request);
      } catch (error: unknown) {
        thrownError = error;
      }

      expect(thrownError).toBeInstanceOf(TypeError);
      expect((thrownError as Error).message).toBe('Invalid submission items');
      expect(callApiMock).toHaveBeenCalledTimes(1);
      expect(callApiMock).toHaveBeenCalledWith('getAssignment', request);

      expect(mockLogFrontendError).toHaveBeenCalledTimes(1);
      const [context, loggedError, metadata] = mockLogFrontendError.mock.calls[0]!;
      expect(context).toBe('services/assignmentAssessment.getAssignment');
      expect(loggedError).toBe(thrownError);
      expect(metadata).toEqual({ method: 'getAssignment' });
      expect(
        mockLogFrontendError.mock.calls.some(
          ([callContext]) => callContext === 'services/apiService.parseApiResponse'
        )
      ).toBe(false);
    });
  });
});
