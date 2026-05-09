import { ZodError } from 'zod';
import { afterEach, describe, expect, it, vi } from 'vitest';

const callApiMock = vi.fn();

vi.mock('./apiService', () => ({
  callApi: callApiMock,
}));

const validAssignmentTopicsResponse = [
  { key: 'topic-algebra', name: 'Algebra' },
  { key: 'topic-geometry', name: 'Geometry' },
];

/**
 * Loads the assignment-topics service module under test.
 *
 * @returns {Promise<Record<string, () => Promise<unknown>>>} Imported service module.
 */
async function loadAssignmentTopicsService() {
  return import('./assignmentTopicsService') as Promise<Record<string, () => Promise<unknown>>>;
}

describe('assignmentTopicsService', () => {
  afterEach(() => {
    callApiMock.mockReset();
    vi.resetModules();
  });

  it('getAssignmentTopics() delegates to callApi and parses response payloads', async () => {
    callApiMock.mockResolvedValueOnce(validAssignmentTopicsResponse);

    const service = await loadAssignmentTopicsService();
    const getAssignmentTopics = service.getAssignmentTopics;

    await expect(getAssignmentTopics()).resolves.toEqual(validAssignmentTopicsResponse);
    expect(callApiMock).toHaveBeenCalledWith('getAssignmentTopics');
  });

  it('rejects malformed topic responses from transport wrappers', async () => {
    callApiMock.mockResolvedValueOnce([{ key: 'topic-algebra', name: '' }]);

    const service = await loadAssignmentTopicsService();
    const getAssignmentTopics = service.getAssignmentTopics;

    await expect(getAssignmentTopics()).rejects.toBeInstanceOf(ZodError);
    expect(callApiMock).toHaveBeenCalledWith('getAssignmentTopics');
  });
});
