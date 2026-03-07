import { afterEach, describe, expect, it, vi } from 'vitest';

const callApiMock = vi.fn();

vi.mock('./apiService', () => ({
  callApi: callApiMock,
}));

describe('authService.getAuthorisationStatus', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls callApi with getAuthorisationStatus and returns the backend value', async () => {
    callApiMock.mockResolvedValueOnce(true);

    const { getAuthorisationStatus } = await import('./authService');

    await expect(getAuthorisationStatus()).resolves.toBe(true);
    expect(callApiMock).toHaveBeenCalledWith('getAuthorisationStatus');
    expect(callApiMock).toHaveBeenCalledTimes(1);
  });
});
