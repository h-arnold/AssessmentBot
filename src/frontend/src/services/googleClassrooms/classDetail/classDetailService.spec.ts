import { afterEach, describe, expect, it, vi } from 'vitest';

const callApiMock = vi.fn();

vi.mock('../../apiService', () => ({
  callApi: callApiMock,
  parseApiResponse: (
    schema: { parse: (data: unknown) => unknown },
    _method: string,
    data: unknown
  ) => schema.parse(data),
}));

const validSubmissionPartial = {
  studentId: 'student-1',
  studentName: 'Alice Johnson',
  assignmentId: 'assign-1',
  documentId: 'doc-abc',
  items: {
    'task-1': {
      id: 'sub-1',
      taskId: 'task-1',
      artifact: {
        taskId: 'task-1',
        role: 'student',
        pageId: 'slide-5',
        documentId: 'doc-abc',
        content: null,
        contentHash: null,
        metadata: { slideOrder: 3 },
        uid: 'uid-artifact-1',
        type: 'slides',
      },
      assessments: { accuracy: { score: 4 } },
      feedback: { comment: 'Great effort' },
    },
  },
  createdAt: '2025-05-01T08:00:00.000Z',
  updatedAt: '2025-05-15T12:00:00.000Z',
};

const validAssignmentPartial = {
  courseId: 'course-1',
  assignmentId: 'assign-1',
  assignmentName: 'Algebra Basics',
  dueDate: '2025-06-01T23:59:59.000Z',
  updatedAt: '2025-05-15T12:00:00.000Z',
  createdAt: '2025-05-01T08:00:00.000Z',
  documentType: 'SLIDES',
  submissions: [validSubmissionPartial],
  assignmentDefinitionKey: 'algebra-baseline',
};

const validClassFull = {
  classId: 'class-1',
  className: 'Mathematics 10A',
  cohortKey: 'cohort-2025',
  courseLength: 2,
  yearGroupKey: 'year-10',
  classOwner: {
    userId: 'owner-1',
    email: 'owner-1@example.com',
    teacherName: 'Dr Smith',
  },
  teachers: [
    {
      userId: 'teacher-1',
      email: 'teacher-1@example.com',
      teacherName: 'Ms Example',
    },
  ],
  students: [{ name: 'Alice Johnson', email: 'alice@example.com', id: 'student-1' }],
  assignments: [validAssignmentPartial],
  active: true,
};

describe('classDetailService.getABClass', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('delegates to callApi with the getABClass method name and the supplied classId', async () => {
    callApiMock.mockResolvedValueOnce(validClassFull);

    const { getABClass } = await import('./classDetailService');

    await getABClass({ classId: 'class-1' });

    expect(callApiMock).toHaveBeenCalledWith('getABClass', { classId: 'class-1' });
    expect(callApiMock).toHaveBeenCalledTimes(1);
  });

  it('parses the response through ClassFullResponseSchema and returns a typed ClassFull', async () => {
    callApiMock.mockResolvedValueOnce(validClassFull);

    const { getABClass } = await import('./classDetailService');

    const result = await getABClass({ classId: 'class-1' });

    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      classId: 'class-1',
      className: 'Mathematics 10A',
      cohortKey: 'cohort-2025',
    });
    expect(result?.assignments).toHaveLength(1);
    expect(result?.assignments[0].assignmentDefinitionKey).toBe('algebra-baseline');
  });

  it('returns null when the backend returns data: null', async () => {
    callApiMock.mockResolvedValueOnce(null);

    const { getABClass } = await import('./classDetailService');

    const result = await getABClass({ classId: 'class-1' });

    expect(result).toBeNull();
  });

  it('propagates Zod parse errors loudly', async () => {
    callApiMock.mockResolvedValueOnce({ invalid: 'data' });

    const { getABClass } = await import('./classDetailService');

    await expect(getABClass({ classId: 'class-1' })).rejects.toThrow();
  });

  it('propagates rejection when callApi rejects', async () => {
    const apiError = new Error('Transport failure');
    callApiMock.mockRejectedValueOnce(apiError);

    const { getABClass } = await import('./classDetailService');

    await expect(getABClass({ classId: 'class-1' })).rejects.toThrow('Transport failure');
  });
});
