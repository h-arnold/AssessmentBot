import { afterEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

const { callApiMock, parseApiResponseMock } = await vi.hoisted(async () => {
  const { createApiServiceMockScaffold } = await import('../../test/api/apiServiceTestMocks');
  return createApiServiceMockScaffold();
});

vi.mock('../apiService', () => ({
  callApi: callApiMock,
  parseApiResponse: parseApiResponseMock,
}));

/**
 * Loads the auth service module under test.
 *
 * @returns {Promise<typeof import('./authService')>} The imported auth service module.
 */
async function loadAuthService() {
  return import('./authService');
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('authService.getAuthorisationStatus', () => {
  it('rejects when backend returns a non-boolean value', async () => {
    callApiMock.mockResolvedValueOnce('yes');

    const { getAuthorisationStatus } = await loadAuthService();

    const authorisationStatusPromise = getAuthorisationStatus();

    await expect(authorisationStatusPromise).rejects.toThrow(ZodError);
    await expect(authorisationStatusPromise).rejects.toThrow(/expected boolean/i);
    expect(callApiMock).toHaveBeenCalledWith('getAuthorisationStatus');
    expect(callApiMock).toHaveBeenCalledTimes(1);
  });

  it('rejects when backend returns null', async () => {
    callApiMock.mockResolvedValueOnce(null);

    const { getAuthorisationStatus } = await loadAuthService();

    const authorisationStatusPromise = getAuthorisationStatus();

    await expect(authorisationStatusPromise).rejects.toThrow(ZodError);
    await expect(authorisationStatusPromise).rejects.toThrow(/expected boolean/i);
    expect(callApiMock).toHaveBeenCalledWith('getAuthorisationStatus');
    expect(callApiMock).toHaveBeenCalledTimes(1);
  });

  it('calls callApi with getAuthorisationStatus and returns the backend value', async () => {
    callApiMock.mockResolvedValueOnce(true);

    const { getAuthorisationStatus } = await loadAuthService();

    await expect(getAuthorisationStatus()).resolves.toBe(true);
    expect(callApiMock).toHaveBeenCalledWith('getAuthorisationStatus');
    expect(callApiMock).toHaveBeenCalledTimes(1);
  });
});

// The typed access/settings services below exercise the landed auth transport
// surface in authService.ts: each typed call routes through callApi with the
// matching backend method name and validates the payload through the co-located
// Zod schemas, surfacing transport envelope rejections unchanged. The
// getAuthorisationStatus coverage above stays unchanged.
describe('authService.getApplicationAccess', () => {
  it('calls callApi with getApplicationAccess and returns the parsed access status', async () => {
    const okApplicationAccess = {
      allowed: true,
      role: 'admin',
      email: 'teacher@school.edu',
      reason: 'ok',
    };
    callApiMock.mockResolvedValueOnce(okApplicationAccess);

    const { getApplicationAccess } = await loadAuthService();

    await expect(getApplicationAccess()).resolves.toEqual(okApplicationAccess);
    expect(callApiMock).toHaveBeenCalledWith('getApplicationAccess');
    expect(callApiMock).toHaveBeenCalledTimes(1);
  });

  it('rejects a non-conforming access payload through the response schema', async () => {
    callApiMock.mockResolvedValueOnce({
      allowed: false,
      role: null,
      email: 'teacher@school.edu',
      reason: 'unconfigured',
    });

    const { getApplicationAccess } = await loadAuthService();

    await expect(getApplicationAccess()).rejects.toThrow(ZodError);
    expect(callApiMock).toHaveBeenCalledWith('getApplicationAccess');
    expect(callApiMock).toHaveBeenCalledTimes(1);
  });

  it('surfaces a transport envelope rejection from callApi unchanged', async () => {
    const transportError = new Error('FORBIDDEN: access denied');
    callApiMock.mockRejectedValueOnce(transportError);

    const { getApplicationAccess } = await loadAuthService();

    await expect(getApplicationAccess()).rejects.toBe(transportError);
    expect(callApiMock).toHaveBeenCalledWith('getApplicationAccess');
    expect(callApiMock).toHaveBeenCalledTimes(1);
  });
});

describe('authService.getAuthenticationSettings', () => {
  it('calls callApi with getAuthenticationSettings and returns the parsed scriptProperties settings', async () => {
    const scriptPropertiesSettings = {
      authMode: 'scriptProperties',
      authGroupEmail: 'staff@school.edu',
      authUsers: [
        { email: 'teacher@school.edu', role: 'admin' },
        { email: 'learner@school.edu', role: 'user' },
      ],
      authRevision: '7',
    };
    callApiMock.mockResolvedValueOnce(scriptPropertiesSettings);

    const { getAuthenticationSettings } = await loadAuthService();

    await expect(getAuthenticationSettings()).resolves.toEqual(scriptPropertiesSettings);
    expect(callApiMock).toHaveBeenCalledWith('getAuthenticationSettings');
    expect(callApiMock).toHaveBeenCalledTimes(1);
  });

  it('returns the parsed googleGroups settings with an empty list and a null revision', async () => {
    const googleGroupsSettings = {
      authMode: 'googleGroups',
      authGroupEmail: 'staff@school.edu',
      authUsers: [],
      authRevision: null,
    };
    callApiMock.mockResolvedValueOnce(googleGroupsSettings);

    const { getAuthenticationSettings } = await loadAuthService();

    await expect(getAuthenticationSettings()).resolves.toEqual(googleGroupsSettings);
    expect(callApiMock).toHaveBeenCalledWith('getAuthenticationSettings');
    expect(callApiMock).toHaveBeenCalledTimes(1);
  });

  it('surfaces a transport envelope rejection from callApi unchanged', async () => {
    const transportError = new Error('FORBIDDEN: admin only');
    callApiMock.mockRejectedValueOnce(transportError);

    const { getAuthenticationSettings } = await loadAuthService();

    await expect(getAuthenticationSettings()).rejects.toBe(transportError);
    expect(callApiMock).toHaveBeenCalledWith('getAuthenticationSettings');
    expect(callApiMock).toHaveBeenCalledTimes(1);
  });
});

describe('authService.setAuthenticationSettings', () => {
  it('calls callApi with setAuthenticationSettings and the parsed request', async () => {
    const scriptPropertiesSaveRequest = {
      authMode: 'scriptProperties',
      authUsers: [
        { email: 'teacher@school.edu', role: 'admin' },
        { email: 'learner@school.edu', role: 'user' },
      ],
      expectedAuthRevision: '3',
    };
    callApiMock.mockResolvedValueOnce({ success: true, authRevision: '4' });

    const { setAuthenticationSettings } = await loadAuthService();

    await expect(setAuthenticationSettings(scriptPropertiesSaveRequest)).resolves.toEqual({
      success: true,
      authRevision: '4',
    });
    expect(callApiMock).toHaveBeenCalledWith(
      'setAuthenticationSettings',
      scriptPropertiesSaveRequest
    );
    expect(callApiMock).toHaveBeenCalledTimes(1);
  });

  it('rejects an invalid request shape before transport', async () => {
    const { setAuthenticationSettings } = await loadAuthService();

    await expect(
      setAuthenticationSettings({
        authMode: 'googleGroups',
        authGroupEmail: 'staff@school.edu',
        authUsers: [{ email: 'teacher@school.edu', role: 'admin' }],
      })
    ).rejects.toBeInstanceOf(ZodError);
    expect(callApiMock).not.toHaveBeenCalled();
  });

  it('surfaces a transport envelope rejection from callApi unchanged', async () => {
    const transportError = new Error('INVALID_REQUEST: stale auth revision');
    callApiMock.mockRejectedValueOnce(transportError);

    const { setAuthenticationSettings } = await loadAuthService();

    await expect(
      setAuthenticationSettings({
        authMode: 'scriptProperties',
        authUsers: [{ email: 'teacher@school.edu', role: 'admin' }],
        expectedAuthRevision: '1',
      })
    ).rejects.toBe(transportError);
    expect(callApiMock).toHaveBeenCalledTimes(1);
  });
});
