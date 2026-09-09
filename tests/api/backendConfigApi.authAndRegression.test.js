import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync } from 'node:fs';

const { loadApiHandlerModule } = require('../helpers/apiHandlerTestUtils.js');
const {
  CONFIGURATION_MANAGER_DEFAULTS,
  createConfigurationManagerMock,
} = require('../helpers/backendConfigTestHelpers.js');

const AuthService = require('../../src/backend/Utils/AuthService.js');

const legacyConfigurationGlobalsPath = new URL(
  '../../src/backend/ConfigurationManager/99_globals.js',
  import.meta.url
);

afterEach(() => {
  vi.restoreAllMocks();
  AuthService.resetForTests();
  globalThis.CacheService._resetScriptCache();
  globalThis.Session._resetActiveUserEmail();
  globalThis.GroupsApp._resetGroups();
});

describe('backend configuration API transport — write failure and validation regression', () => {
  it('clears a stored apiKey through the real validation seam when setBackendConfig explicitly clears the API key', () => {
    const { validateApiKey_ } = require('../../src/backend/ConfigurationManager/03_validators.js');
    const configurationManagerMock = createConfigurationManagerMock(vi);

    try {
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      // Route the apiKey field through the REAL CONFIG_SCHEMA validator instead of
      // the transport-stub identity passthrough: the empty-string clear must be
      // honoured by the actual validation rule so no clearing write is rejected.
      configurationManagerMock.manager.preparePropertyValue.mockImplementation(
        (configKey, value) => (configKey === 'apiKey' ? validateApiKey_(value) : value)
      );

      const response = dispatcher.handle({
        method: 'setBackendConfig',
        params: {
          apiKey: '',
        },
      });

      // Clearing is a deliberate explicit empty-string write: the staged locked
      // mutation must carry apiKey:'' so the stored key is cleared, not skipped.
      expect(configurationManagerMock.manager.writeConfigurationLocked).toHaveBeenCalledTimes(1);
      const mutator = configurationManagerMock.manager.writeConfigurationLocked.mock.calls[0][0];
      expect(mutator({}).apiKey).toBe('');
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

  it('rejects an invalid non-empty apiKey through the real validation seam without a locked write', () => {
    const { validateApiKey_ } = require('../../src/backend/ConfigurationManager/03_validators.js');
    const configurationManagerMock = createConfigurationManagerMock(vi);

    try {
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      // Same real validation seam as the clearing test: only '' and valid tokens are
      // accepted, so a malformed non-empty key must fail staging before any write.
      configurationManagerMock.manager.preparePropertyValue.mockImplementation(
        (configKey, value) => (configKey === 'apiKey' ? validateApiKey_(value) : value)
      );

      const response = dispatcher.handle({
        method: 'setBackendConfig',
        params: {
          apiKey: 'invalid-key-',
        },
      });

      expect(configurationManagerMock.manager.writeConfigurationLocked).not.toHaveBeenCalled();
      expect(response).toEqual({
        ok: true,
        requestId: response.requestId,
        data: {
          success: false,
          error: expect.stringContaining(
            'apiKey: API Key must be an alphanumeric prefix followed by an underscore'
          ),
        },
      });
      expect(response.data.error).not.toContain('invalid-key-');
      expect(response.requestId).toEqual(expect.any(String));
    } finally {
      configurationManagerMock.restore();
    }
  });

  it('reports failed backend configuration writes through apiHandler', () => {
    const configurationManagerMock = createConfigurationManagerMock(
      vi,
      {},
      {
        writeConfigurationLocked: () => {
          throw new Error('persist failed');
        },
      }
    );

    try {
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const response = dispatcher.handle({
        method: 'setBackendConfig',
        params: {
          apiKey: 'new-secret',
          backendUrl: 'https://updated-backend.example.test',
        },
      });

      // A single locked write is attempted for the whole save; its failure
      // surfaces as the aggregate error and never leaks raw values.
      expect(configurationManagerMock.manager.writeConfigurationLocked).toHaveBeenCalledTimes(1);
      expect(response).toEqual({
        ok: true,
        requestId: response.requestId,
        data: {
          success: false,
          error: expect.stringContaining('Failed to save some configuration values:'),
        },
      });
      expect(response.data.error).not.toContain('new-secret');
      expect(response.data.error).not.toContain('https://updated-backend.example.test');
      expect(response.requestId).toEqual(expect.any(String));
    } finally {
      configurationManagerMock.restore();
    }
  });
});

describe('backend configuration API transport — request-shape and legacy regression', () => {
  it.each([
    ['null params', null],
    ['array params', []],
    ['string params', 'invalid'],
  ])(
    'returns an invalid request envelope for malformed setBackendConfig params: %s',
    (_caseName, params) => {
      const configurationManagerMock = createConfigurationManagerMock(vi);

      try {
        const { ApiDispatcher } = loadApiHandlerModule();
        const dispatcher = ApiDispatcher.getInstance();

        const response = dispatcher.handle({
          method: 'setBackendConfig',
          params,
        });

        // Called once by the ApiDispatcher auth gate's group email lookup before the
        // handler rejects the malformed params.
        expect(configurationManagerMock.configurationManager.getInstance).toHaveBeenCalledTimes(1);
        expect(response).toEqual({
          ok: false,
          requestId: response.requestId,
          error: {
            code: 'INVALID_REQUEST',
            message: 'params must be an object.',
            retriable: false,
          },
        });
        expect(response.requestId).toEqual(expect.any(String));
      } finally {
        configurationManagerMock.restore();
      }
    }
  );

  it('keeps configuration transport errors envelope-based through apiHandler', () => {
    const originalConfigurationManager = globalThis.ConfigurationManager;
    globalThis.ConfigurationManager = {
      DEFAULTS: CONFIGURATION_MANAGER_DEFAULTS,
      getInstance: vi.fn(() => {
        throw new Error('configuration exploded');
      }),
    };

    try {
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const response = dispatcher.handle({
        method: 'getBackendConfig',
      });

      expect(globalThis.ConfigurationManager.getInstance).toHaveBeenCalledTimes(1);
      expect(response).toEqual({
        ok: false,
        requestId: response.requestId,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal API error.',
          retriable: false,
        },
      });
      expect(response.requestId).toEqual(expect.any(String));
    } finally {
      if (originalConfigurationManager === undefined) {
        delete globalThis.ConfigurationManager;
      } else {
        globalThis.ConfigurationManager = originalConfigurationManager;
      }
    }
  });

  it('keeps configuration write transport errors envelope-based through apiHandler', () => {
    const originalConfigurationManager = globalThis.ConfigurationManager;
    globalThis.ConfigurationManager = {
      DEFAULTS: CONFIGURATION_MANAGER_DEFAULTS,
      getInstance: vi.fn(() => {
        throw new Error('configuration save exploded');
      }),
    };

    try {
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const response = dispatcher.handle({
        method: 'setBackendConfig',
        params: {
          backendUrl: 'https://updated-backend.example.test',
        },
      });

      expect(globalThis.ConfigurationManager.getInstance).toHaveBeenCalledTimes(1);
      expect(response).toEqual({
        ok: false,
        requestId: response.requestId,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal API error.',
          retriable: false,
        },
      });
      expect(response.requestId).toEqual(expect.any(String));
    } finally {
      if (originalConfigurationManager === undefined) {
        delete globalThis.ConfigurationManager;
      } else {
        globalThis.ConfigurationManager = originalConfigurationManager;
      }
    }
  });

  it('does not retain the legacy configuration globals transport file', () => {
    expect(existsSync(legacyConfigurationGlobalsPath)).toBe(false);
  });
});

describe('backend configuration API transport — auth-field read removal', () => {
  it('no longer emits authMode or authGroupEmail in the getBackendConfig response', () => {
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

      // Auth state is read exclusively through the dedicated auth endpoints
      // (getApplicationAccess / getAuthenticationSettings), so the backend
      // configuration read transport must stop emitting auth fields.
      expect(response.data).not.toHaveProperty('authMode');
      expect(response.data).not.toHaveProperty('authGroupEmail');
    } finally {
      configurationManagerMock.restore();
    }
  });
});

describe('backend configuration API transport — auth-field write rejection from any caller', () => {
  it.each(['authMode', 'authGroupEmail', 'authUsers', 'authRevision'])(
    'rejects the %s field in the setBackendConfig payload as INVALID_REQUEST',
    (field) => {
      const configurationManagerMock = createConfigurationManagerMock(vi);

      try {
        const { ApiDispatcher } = loadApiHandlerModule();
        const dispatcher = ApiDispatcher.getInstance();

        const response = dispatcher.handle({
          method: 'setBackendConfig',
          params: { [field]: field === 'authUsers' ? '[]' : 'some-value' },
        });

        // Rejected as a single request-shape violation (ApiValidationError /
        // INVALID_REQUEST), not an aggregate per-field failure with success:false.
        expect(response).toMatchObject({
          ok: false,
          error: { code: 'INVALID_REQUEST', retriable: false },
        });
        expect(response.data).toBeUndefined();
      } finally {
        configurationManagerMock.restore();
      }
    }
  );

  it.each(['none', 'googleGroups', 'scriptProperties'])(
    'rejects an authMode of %s in the setBackendConfig payload as INVALID_REQUEST',
    (authMode) => {
      const configurationManagerMock = createConfigurationManagerMock(vi);

      try {
        const { ApiDispatcher } = loadApiHandlerModule();
        const dispatcher = ApiDispatcher.getInstance();

        const response = dispatcher.handle({
          method: 'setBackendConfig',
          params: { authMode },
        });

        // No authMode value (including the removed 'none') may reach a config
        // write: rejection happens before any setter is invoked.
        expect(configurationManagerMock.manager.setAuthMode).not.toHaveBeenCalled();
        expect(response).toMatchObject({
          ok: false,
          error: { code: 'INVALID_REQUEST', retriable: false },
        });
        expect(response.data).toBeUndefined();
      } finally {
        configurationManagerMock.restore();
      }
    }
  );

  it('rejects auth fields in the setBackendConfig payload even for an admin caller', () => {
    const configurationManagerMock = createConfigurationManagerMock(vi);

    try {
      // Route an ADMIN caller through the real AuthService gate: the default
      // configured googleGroups install admits this email as an OWNER (admin).
      globalThis.Session._setActiveUserEmail('admin@school.edu');
      globalThis.GroupsApp._setMembers('teachers@school.edu', {
        'admin@school.edu': 'OWNER',
      });

      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const response = dispatcher.handle({
        method: 'setBackendConfig',
        params: { authMode: 'scriptProperties', authGroupEmail: 'owners@school.edu' },
      });

      // Admin is not exempt from auth-field rejection: auth is managed only
      // through the dedicated auth endpoints for every caller.
      expect(configurationManagerMock.manager.setAuthMode).not.toHaveBeenCalled();
      expect(configurationManagerMock.manager.setAuthGroupEmail).not.toHaveBeenCalled();
      expect(response).toMatchObject({
        ok: false,
        error: { code: 'INVALID_REQUEST', retriable: false },
      });
      expect(response.data).toBeUndefined();
    } finally {
      globalThis.Session._resetActiveUserEmail();
      globalThis.GroupsApp._resetGroups();
      configurationManagerMock.restore();
    }
  });
});

describe('backend configuration API transport — aggregate redaction regression', () => {
  it('preserves the aggregate redacted failure for an ordinary field write', () => {
    const configurationManagerMock = createConfigurationManagerMock(
      vi,
      {},
      {
        writeConfigurationLocked: () => {
          // A message-less failure at the locked-write seam must still surface
          // as the redacted aggregate, confirming raw values are never emitted
          // by the ordinary aggregate-failure path.
          throw { name: 'PersistError' };
        },
      }
    );

    try {
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const response = dispatcher.handle({
        method: 'setBackendConfig',
        params: {
          backendUrl: 'https://updated-backend.example.test',
        },
      });

      // Ordinary non-auth field failures still surface as the redacted aggregate
      // (success:false + aggregated error naming the field and redacting the raw
      // value), unchanged by the auth-field removal.
      expect(response.data.success).toBe(false);
      expect(response.data.error).toContain('Failed to save some configuration values:');
      expect(response.data.error).toContain('backendUrl');
      expect(response.data.error).toContain('REDACTED');
      expect(response.data.error).not.toContain('https://updated-backend.example.test');
    } finally {
      configurationManagerMock.restore();
    }
  });
});
