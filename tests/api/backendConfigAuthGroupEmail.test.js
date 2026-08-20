import { afterEach, describe, expect, it, vi } from 'vitest';

const { loadApiHandlerModule } = require('../helpers/apiHandlerTestUtils.js');
const { createConfigurationManagerMock } = require('../helpers/backendConfigTestHelpers.js');

afterEach(() => {
  vi.restoreAllMocks();
});

describe('backend configuration API transport — authGroupEmail', () => {
  it('includes authGroupEmail with an empty string fallback when unset', () => {
    const configurationManagerMock = createConfigurationManagerMock(
      vi,
      {},
      {},
      { allConfigurations: {} }
    );

    try {
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const response = dispatcher.handle({
        method: 'getBackendConfig',
      });

      expect(response.data.authGroupEmail).toBe('');
    } finally {
      configurationManagerMock.restore();
    }
  });

  it('includes the stored authGroupEmail value when configured', () => {
    const configurationManagerMock = createConfigurationManagerMock(
      vi,
      { authGroupEmail: 'teachers@school.edu' },
      {},
      { allConfigurations: { authGroupEmail: 'teachers@school.edu' } }
    );

    try {
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const response = dispatcher.handle({
        method: 'getBackendConfig',
      });

      expect(response.data.authGroupEmail).toBe('teachers@school.edu');
    } finally {
      configurationManagerMock.restore();
    }
  });

  it('calls setAuthGroupEmail when authGroupEmail is present in the setBackendConfig payload', () => {
    const configurationManagerMock = createConfigurationManagerMock(vi);

    try {
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const response = dispatcher.handle({
        method: 'setBackendConfig',
        params: {
          authGroupEmail: 'teachers@school.edu',
        },
      });

      expect(configurationManagerMock.manager.setAuthGroupEmail).toHaveBeenCalledWith(
        'teachers@school.edu'
      );
      expect(response).toEqual({
        ok: true,
        requestId: response.requestId,
        data: { success: true },
      });
      expect(response.requestId).toEqual(expect.any(String));
    } finally {
      configurationManagerMock.restore();
    }
  });
});
