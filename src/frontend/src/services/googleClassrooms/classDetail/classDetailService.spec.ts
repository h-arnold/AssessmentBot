import { afterEach, describe, expect, it, vi } from 'vitest';
import smallClassesRaw from '@synthetic/small/classesById.json?raw';
import { CANONICAL_NON_NULL_METADATA } from '@/test/abClass/abClassMetadataFixtures';
import { ClassFullSchema } from './classDetailService.zod';
import type {
  AssignmentPartial,
  ClassFull,
  StudentSubmissionPartial,
} from './classDetailService.zod';

const callApiMock = vi.fn();

vi.mock('@/services/apiService', async () => {
  const actual = await vi.importActual('@/services/apiService');
  return {
    ...actual,
    callApi: callApiMock,
  };
});

const validSubmissionPartial: StudentSubmissionPartial = {
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
        role: 'submission',
        pageId: 'slide-5',
        documentId: 'doc-abc',
        metadata: { slideOrder: 3 },
        uid: 'uid-artifact-1',
        type: 'base',
      },
      assessments: {
        completeness: { score: 4 },
        accuracy: { score: 4 },
        spag: { score: 'N' },
      },
      feedback: { comment: 'Great effort' },
    },
  },
  createdAt: '2025-05-01T08:00:00.000Z',
  updatedAt: '2025-05-15T12:00:00.000Z',
};

const validAssignmentPartial: AssignmentPartial = {
  assignmentId: 'assign-1',
  dueDate: null,
  updatedAt: '2025-05-15T12:00:00.000Z',
  createdAt: '2025-05-01T08:00:00.000Z',
  documentType: 'SLIDES',
  submissions: [validSubmissionPartial],
  assignmentDefinitionKey: 'algebra-baseline',
  assessmentContractVersion: 1,
};

const validClassFull: ClassFull = {
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
  metadata: structuredClone(CANONICAL_NON_NULL_METADATA),
};

const canonicalClass = ClassFullSchema.parse(
  (JSON.parse(smallClassesRaw) as Record<string, unknown>)['class-0']
);

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

  it('isolates a corrupt provided item to all criteria and preserves its healthy sibling', async () => {
    const payload: ClassFull = structuredClone(canonicalClass);
    const assignment = payload.assignments.find(
      (candidate) => candidate.assignmentId === 'assignment-0-1'
    )!;
    payload.assignments = [assignment];
    const submission = assignment.submissions[0]!;
    const [healthyTask, corruptTask] = Object.keys(submission.items);
    expect(Object.keys(submission.items)).toEqual(['task-1-0', 'task-1-1']);
    const originalTaskIds = Object.keys(submission.items);
    const originalStudentIds = assignment.submissions.map(({ studentId }) => studentId);
    for (const item of Object.values(submission.items)) {
      expect(item.artifact.role).toBe('submission');
    }
    submission.items[corruptTask]!.artifact.role = 'reference';
    callApiMock.mockResolvedValueOnce(payload);

    const { getABClass } = await import('./classDetailService');
    const result = await getABClass({ classId: 'class-1' });
    const items = result!.assignments[0]!.submissions[0]!.items;

    expect(items[healthyTask]!.assessments).toEqual(submission.items[healthyTask]!.assessments);
    const corruption = {
      score: 'E',
      reasoning: 'The stored assessment data for this task is invalid. Reassess the assignment.',
      error: { stage: 'validation', code: 'CORRUPT_RECORD' },
    };
    expect.soft(items[corruptTask]!.assessments).toEqual({
      completeness: corruption,
      accuracy: corruption,
      spag: corruption,
    });
    expect(Object.keys(items)).toEqual(originalTaskIds);
    expect(result!.assignments[0]!.submissions.map(({ studentId }) => studentId)).toEqual(
      originalStudentIds
    );
    expect(items[healthyTask]).toEqual(submission.items[healthyTask]);
  });

  it('preserves marker-null reassessment E and redacted partial source fields', async () => {
    const payload: ClassFull = structuredClone(validClassFull);
    const assignment = payload.assignments[0]!;
    assignment.assessmentContractVersion = null;
    const item = assignment.submissions[0]!.items['task-1']!;
    const reassessment = {
      score: 'E' as const,
      reasoning: 'Reassessment required',
      error: { stage: 'validation' as const, code: 'REASSESSMENT_REQUIRED' as const },
    };
    item.assessments = {
      completeness: reassessment,
      accuracy: reassessment,
      spag: reassessment,
    };
    callApiMock.mockResolvedValueOnce(payload);

    const { getABClass } = await import('./classDetailService');
    const result = await getABClass({ classId: 'class-1' });
    const actualAssignment = result!.assignments[0]!;
    const actualItem = actualAssignment.submissions[0]!.items['task-1']!;

    expect(actualAssignment.assessmentContractVersion).toBeNull();
    expect(actualItem.assessments).toEqual(item.assessments);
    expect(actualItem.artifact).not.toHaveProperty('content');
    expect(actualItem.artifact).not.toHaveProperty('contentHash');
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
