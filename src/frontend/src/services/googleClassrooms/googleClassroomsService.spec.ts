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

describe('googleClassroomsService.getGoogleClassrooms', () => {
  afterEach(() => {
    callApiMock.mockReset();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('calls callApi with getGoogleClassrooms and parses the classroom summary list', async () => {
    callApiMock.mockResolvedValueOnce([
      {
        classId: 'course-001',
        className: '10A Computer Science',
      },
    ]);

    const { getGoogleClassrooms } = await import('./googleClassroomsService');

    await expect(getGoogleClassrooms()).resolves.toEqual([
      {
        classId: 'course-001',
        className: '10A Computer Science',
      },
    ]);
    expect(callApiMock).toHaveBeenCalledWith('getGoogleClassrooms');
    expect(callApiMock).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed classroom success payloads instead of caching them', async () => {
    callApiMock.mockResolvedValueOnce([
      {
        classId: 'course-001',
      },
    ]);

    const { getGoogleClassrooms } = await import('./googleClassroomsService');

    await expect(getGoogleClassrooms()).rejects.toBeInstanceOf(ZodError);
  });

  it('propagates transport failures unchanged', async () => {
    const transportError = new Error('Transport failure');
    callApiMock.mockRejectedValueOnce(transportError);

    const { getGoogleClassrooms } = await import('./googleClassroomsService');

    await expect(getGoogleClassrooms()).rejects.toBe(transportError);
  });
});
