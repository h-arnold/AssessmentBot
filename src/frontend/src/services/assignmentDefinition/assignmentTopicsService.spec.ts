import { ZodError } from 'zod';
import { afterEach, describe, expect, it, vi } from 'vitest';

const callApiMock = vi.fn();
const parseApiResponseMock = vi.fn(
  (schema: { parse: (data: unknown) => unknown }, _method: string, data: unknown) =>
    schema.parse(data)
);

vi.mock('../apiService', () => ({
  callApi: callApiMock,
  parseApiResponse: parseApiResponseMock,
}));

const validAssignmentTopicsResponse = [
  { key: 'topic-algebra', name: 'Algebra', yearGroupKeys: [] },
  { key: 'topic-geometry', name: 'Geometry', yearGroupKeys: [] },
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
    callApiMock.mockResolvedValueOnce([{ key: 'topic-algebra', name: '', yearGroupKeys: [] }]);

    const service = await loadAssignmentTopicsService();
    const getAssignmentTopics = service.getAssignmentTopics;

    await expect(getAssignmentTopics()).rejects.toBeInstanceOf(ZodError);
    expect(callApiMock).toHaveBeenCalledWith('getAssignmentTopics');
  });

  it('rejects topic responses missing yearGroupKeys from transport wrappers', async () => {
    callApiMock.mockResolvedValueOnce([{ key: 'topic-algebra', name: 'Algebra' }]);

    const service = await loadAssignmentTopicsService();
    const getAssignmentTopics = service.getAssignmentTopics;

    await expect(getAssignmentTopics()).rejects.toBeInstanceOf(ZodError);
    expect(callApiMock).toHaveBeenCalledWith('getAssignmentTopics');
  });
});
