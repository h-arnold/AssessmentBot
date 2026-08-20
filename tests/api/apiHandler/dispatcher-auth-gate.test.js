import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Red-phase tests for ACTION_PLAN Section 5: FORBIDDEN error code + auth gate in ApiDispatcher.
//
// The auth gate does not exist yet in src/backend/z_Api/z_apiHandler.js — the green
// implementation agent will insert it AFTER request validation and BEFORE the allowlist
// method lookup and `_runAdmissionPhase()`. On denial the gate returns
// `_failure(requestId, API_ERROR_CODE_MAP.FORBIDDEN, 'Access denied.', false)`.
//
// These tests use the real AuthService singleton (delivered in Section 4) and mock its
// dependencies (ConfigurationManager group email, Session active email, GroupsApp
// registry) so the deny/fail-open/blank-email/GroupsApp-error cases fail against the
// current un-gated dispatcher — the request proceeds to admission and dispatches instead
// of returning FORBIDDEN. That missing-gate failure IS the intended red state.
const AuthService = require('../../../src/backend/Utils/AuthService.js');
const { withGlobalMocks } = require('../../helpers/globalMockManager.js');
const {
  installLockServiceMock,
  loadApiHandlerModule,
  getApiDispatcherInstance,
  setupDispatcherTest,
  teardownDispatcherTest,
} = require('./shared.js');

const CONFIGURED_GROUP_EMAIL = 'teachers@school.edu';
const UNREGISTERED_GROUP_EMAIL = 'unregistered-owners@school.edu';

describe('Api/apiHandler dispatcher — auth gate (FORBIDDEN)', () => {
  let context;
  let restoreMocks;

  /**
   * Provisions a mocked ConfigurationManager whose getAuthGroupEmail() returns the
   * supplied group email. This is what AuthService.checkAccess reads to decide the
   * bootstrap (empty) state and the membership lookup target.
   * @param {string} groupEmail - The value getAuthGroupEmail() should return.
   * @returns {Function} The restore handle for the installed global mocks.
   */
  function provisionAuthEnvironment(groupEmail = CONFIGURED_GROUP_EMAIL) {
    const configManager = {
      getAuthGroupEmail: vi.fn(() => groupEmail),
      getAuthMode: vi.fn(() => 'googleGroups'),
    };
    const mockContext = withGlobalMocks({
      ConfigurationManager: () => ({ getInstance: () => configManager }),
    });
    restoreMocks = mockContext.restore;
    return configManager;
  }

  beforeEach(() => {
    context = setupDispatcherTest(vi);
    AuthService.resetForTests();
    globalThis.CacheService._resetScriptCache();
    globalThis.Session._resetActiveUserEmail?.();
    globalThis.GroupsApp._resetGroups?.();
  });

  afterEach(() => {
    if (restoreMocks) {
      restoreMocks();
      restoreMocks = undefined;
    }
    teardownDispatcherTest(vi, context);
    AuthService.resetForTests();
    globalThis.Session._resetActiveUserEmail?.();
    globalThis.GroupsApp._resetGroups?.();
  });

  describe('auth gate authorisation', () => {
    it('dispatches the handler normally when the caller is an authorised group member', () => {
      provisionAuthEnvironment(CONFIGURED_GROUP_EMAIL);
      globalThis.Session._setActiveUserEmail('teacher@school.edu');

      // Observe the gate invocation only — the real AuthService.checkAccess runs
      // (the authorised member path must exercise the gate before dispatching).
      const checkAccessSpy = vi.spyOn(AuthService.getInstance(), 'checkAccess');

      const { ApiDispatcher } = loadApiHandlerModule();
      const response = ApiDispatcher.getInstance().handle({
        method: 'getCohorts',
        params: {},
      });

      expect(response.ok).toBe(true);
      expect(response.error).toBeUndefined();
      expect(checkAccessSpy).toHaveBeenCalledTimes(1);
      expect(checkAccessSpy).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'getCohorts' })
      );
    });

    it('returns a FORBIDDEN envelope and does not run admission for a non-member', () => {
      provisionAuthEnvironment(CONFIGURED_GROUP_EMAIL);
      globalThis.Session._setActiveUserEmail('outsider@school.edu');

      const { originalLockService, mockLock } = installLockServiceMock(vi);

      try {
        const { ApiDispatcher } = loadApiHandlerModule();
        const dispatcher = ApiDispatcher.getInstance();

        const response = dispatcher.handle({ method: 'getCohorts', params: {} });

        expect(response).toMatchObject({
          ok: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied.',
            retriable: false,
          },
        });
        // Denied requests never reach the admission phase — no lock is consumed.
        expect(mockLock.tryLock).not.toHaveBeenCalled();
      } finally {
        globalThis.LockService = originalLockService;
      }
    });

    it('treats getAuthorisationStatus as gate-exempt: runs its OAuth check only', () => {
      provisionAuthEnvironment(CONFIGURED_GROUP_EMAIL);
      const checkAccessSpy = vi.spyOn(AuthService.getInstance(), 'checkAccess');
      context.scriptAppManagerInstance.isAuthorised.mockReturnValue(true);

      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const response = dispatcher.handle({ method: 'getAuthorisationStatus' });

      expect(response).toMatchObject({ ok: true, data: true });
      expect(context.scriptAppManagerCtor).toHaveBeenCalledTimes(1);
      // The gate-exempt method must NOT trigger the group membership check.
      expect(checkAccessSpy).not.toHaveBeenCalled();
    });

    it('fails open with a warning when AUTH_GROUP_EMAIL is empty', () => {
      provisionAuthEnvironment('');

      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const response = dispatcher.handle({ method: 'getCohorts', params: {} });

      expect(response.ok).toBe(true);
      // The bootstrap fail-open path is surfaced with a loud warning log.
      expect(context.warnSpy).toHaveBeenCalled();
    });

    it('returns FORBIDDEN when the active user email resolves to blank', () => {
      provisionAuthEnvironment(CONFIGURED_GROUP_EMAIL);
      globalThis.Session._setActiveUserEmail('');

      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const response = dispatcher.handle({ method: 'getCohorts', params: {} });

      expect(response).toMatchObject({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied.',
          retriable: false,
        },
      });
    });

    it('returns FORBIDDEN when the configured group cannot be resolved by GroupsApp', () => {
      provisionAuthEnvironment(UNREGISTERED_GROUP_EMAIL);
      globalThis.Session._setActiveUserEmail('teacher@school.edu');

      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const response = dispatcher.handle({ method: 'getCohorts', params: {} });

      expect(response).toMatchObject({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied.',
          retriable: false,
        },
      });
    });

    it('returns FORBIDDEN (not UNKNOWN_METHOD) for a non-member calling an unknown method', () => {
      // Security property: the gate runs before the allowlist method lookup, so
      // non-members receive FORBIDDEN uniformly and cannot probe which API
      // methods exist — UNKNOWN_METHOD is only observable by authorised callers.
      provisionAuthEnvironment(CONFIGURED_GROUP_EMAIL);
      globalThis.Session._setActiveUserEmail('outsider@school.edu');

      const { ApiDispatcher } = loadApiHandlerModule();
      const response = ApiDispatcher.getInstance().handle({ method: 'noSuchMethod' });

      expect(response).toMatchObject({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied.',
          retriable: false,
        },
      });
    });

    it('maps a thrown AuthService.checkAccess to INTERNAL_ERROR and logs it at the boundary', () => {
      // A thrown auth check (e.g. ConfigurationManager persistence failure) is a
      // transport-boundary error, not a group-membership denial — it must map to
      // the INTERNAL_ERROR envelope AND be logged once at the catch boundary per
      // backend logging policy §5.3/§6.2, mirroring the sibling handler-failure path.
      provisionAuthEnvironment(CONFIGURED_GROUP_EMAIL);
      globalThis.Session._setActiveUserEmail('teacher@school.edu');
      vi.spyOn(AuthService.getInstance(), 'checkAccess').mockImplementation(() => {
        throw new Error('auth boom');
      });

      const { ApiDispatcher } = loadApiHandlerModule();
      const response = ApiDispatcher.getInstance().handle({ method: 'getCohorts', params: {} });

      expect(response).toMatchObject({ ok: false, error: { code: 'INTERNAL_ERROR' } });
      expect(context.errorSpy).toHaveBeenCalledWith(
        'Auth check failed.',
        expect.objectContaining({ requestId: expect.any(String), method: 'getCohorts' }),
        expect.any(Error)
      );
    });
  });

  describe('auth gate method propagation', () => {
    it('passes the requested method to AuthService.checkAccess', () => {
      provisionAuthEnvironment(CONFIGURED_GROUP_EMAIL);
      globalThis.Session._setActiveUserEmail('teacher@school.edu');
      const checkAccessSpy = vi
        .spyOn(AuthService.getInstance(), 'checkAccess')
        .mockReturnValue({ allowed: true, role: 'user' });

      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      dispatcher.handle({ method: 'getCohorts', params: {} });

      expect(checkAccessSpy).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'getCohorts' })
      );
    });
  });
});
