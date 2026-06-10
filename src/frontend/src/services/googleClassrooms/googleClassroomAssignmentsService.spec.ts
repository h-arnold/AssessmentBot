import { ZodError } from 'zod';
import { afterEach, describe, expect, it, vi } from 'vitest';

const callApiMock = vi.fn();

vi.mock('../apiService', () => ({
  callApi: callApiMock,
}));

describe('googleClassroomAssignmentsService.getGoogleClassroomAssignments', () => {
  afterEach(() => {
    callApiMock.mockReset();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('calls callApi with getGoogleClassroomAssignments and { classId }', async () => {
    callApiMock.mockResolvedValueOnce([{ assignmentId: 'a1', title: 'Essay' }]);

    const { getGoogleClassroomAssignments } = await import('./googleClassroomAssignmentsService');

    await getGoogleClassroomAssignments('123');

    expect(callApiMock).toHaveBeenCalledWith('getGoogleClassroomAssignments', {
      classId: '123',
    });
    expect(callApiMock).toHaveBeenCalledTimes(1);
  });

  it('parses and returns a valid response', async () => {
    callApiMock.mockResolvedValueOnce([{ assignmentId: 'a1', title: 'Essay' }]);

    const { getGoogleClassroomAssignments } = await import('./googleClassroomAssignmentsService');

    await expect(getGoogleClassroomAssignments('123')).resolves.toEqual([
      { assignmentId: 'a1', title: 'Essay', topicId: null, topicName: null },
    ]);
  });

  it('rejects a response missing assignmentId', async () => {
    callApiMock.mockResolvedValueOnce([{ title: 'Essay' }]);

    const { getGoogleClassroomAssignments } = await import('./googleClassroomAssignmentsService');

    await expect(getGoogleClassroomAssignments('123')).rejects.toBeInstanceOf(ZodError);
  });

  it('rejects a response missing title', async () => {
    callApiMock.mockResolvedValueOnce([{ assignmentId: 'a1' }]);

    const { getGoogleClassroomAssignments } = await import('./googleClassroomAssignmentsService');

    await expect(getGoogleClassroomAssignments('123')).rejects.toBeInstanceOf(ZodError);
  });

  it('rejects a response with unexpected fields (strict schema)', async () => {
    callApiMock.mockResolvedValueOnce([
      { assignmentId: 'a1', title: 'Essay', extraField: 'should be stripped' },
    ]);

    const { getGoogleClassroomAssignments } = await import('./googleClassroomAssignmentsService');

    await expect(getGoogleClassroomAssignments('123')).rejects.toBeInstanceOf(ZodError);
  });
});
