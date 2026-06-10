import { ZodError } from 'zod';
import { afterEach, describe, expect, it, vi } from 'vitest';

const callApiMock = vi.fn();

vi.mock('../apiService', () => ({
  callApi: callApiMock,
}));

const validStartAssessmentRunRequest = {
  definitionKey: 'algebra-baseline',
  assignmentId: 'assign-123',
  courseId: 'course-456',
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
    vi.resetModules();
  });

  it('startAssessmentRun() returns null on a successful call', async () => {
    callApiMock.mockResolvedValueOnce(null);

    const { startAssessmentRun } = await loadAssignmentAssessmentService();

    await expect(startAssessmentRun(validStartAssessmentRunRequest)).resolves.toBeNull();
    expect(callApiMock).toHaveBeenCalledTimes(1);
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
});
