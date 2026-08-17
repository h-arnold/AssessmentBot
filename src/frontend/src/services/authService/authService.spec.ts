import { afterEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

const callApiMock = vi.fn();
const parseApiResponseMock = vi.fn(
  (schema: { parse: (data: unknown) => unknown }, _method: string, data: unknown) =>
    schema.parse(data)
);

vi.mock('../apiService', () => ({
  callApi: callApiMock,
  parseApiResponse: parseApiResponseMock,
}));

describe('authService.getAuthorisationStatus', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('rejects when backend returns a non-boolean value', async () => {
    callApiMock.mockResolvedValueOnce('yes');

    const { getAuthorisationStatus } = await import('./authService');

    const authorisationStatusPromise = getAuthorisationStatus();

    await expect(authorisationStatusPromise).rejects.toThrow(ZodError);
    await expect(authorisationStatusPromise).rejects.toThrow(/expected boolean/i);
    expect(callApiMock).toHaveBeenCalledWith('getAuthorisationStatus');
    expect(callApiMock).toHaveBeenCalledTimes(1);
  });

  it('rejects when backend returns null', async () => {
    callApiMock.mockResolvedValueOnce(null);

    const { getAuthorisationStatus } = await import('./authService');

    const authorisationStatusPromise = getAuthorisationStatus();

    await expect(authorisationStatusPromise).rejects.toThrow(ZodError);
    await expect(authorisationStatusPromise).rejects.toThrow(/expected boolean/i);
    expect(callApiMock).toHaveBeenCalledWith('getAuthorisationStatus');
    expect(callApiMock).toHaveBeenCalledTimes(1);
  });

  it('calls callApi with getAuthorisationStatus and returns the backend value', async () => {
    callApiMock.mockResolvedValueOnce(true);

    const { getAuthorisationStatus } = await import('./authService');

    await expect(getAuthorisationStatus()).resolves.toBe(true);
    expect(callApiMock).toHaveBeenCalledWith('getAuthorisationStatus');
    expect(callApiMock).toHaveBeenCalledTimes(1);
  });
});
