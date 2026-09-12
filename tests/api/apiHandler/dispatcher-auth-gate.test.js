import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// These tests cover the API dispatcher auth gate in src/backend/z_Api/z_apiHandler.js,
// which runs the real AuthService singleton against the fail-closed state machine
// (ACTION_PLAN Section 3): configured googleGroups allows members, blank group or
// broken auth state denies with FORBIDDEN, and the removed fail-open bootstrap
// window no longer exists. The gate runs AFTER request validation and BEFORE the
// allowlist method lookup and `_runAdmissionPhase()`; on denial the gate returns
// `_failure(requestId, API_ERROR_CODE_MAP.FORBIDDEN, 'Access denied.', false)`.
//
// The gate is exercised through the real AuthService singleton with mocked dependencies
// (ConfigurationManager auth state, Session active email, GroupsApp registry),
// covering the authorised, deny, broken-config, blank-email and GroupsApp-error cases.
const AuthService = require('../../../src/backend/Utils/AuthService.js');
const {
  installLockServiceMock,
  loadApiHandlerModule,
  createDispatcherAuthEnvironment,
  setupDispatcherAuthTest,
  teardownDispatcherAuthTest,
} = require('./shared.js');

const CONFIGURED_GROUP_EMAIL = 'teachers@school.edu';
const UNREGISTERED_GROUP_EMAIL = 'unregistered-owners@school.edu';

describe('Api/apiHandler dispatcher — auth gate (FORBIDDEN)', () => {
  let context;

  /**
   * Provisions a mocked ConfigurationManager whose stored auth state is a
   * googleGroups install with the supplied group email.
   * @param {string} [groupEmail=CONFIGURED_GROUP_EMAIL] - The stored group email.
   * @returns {Object} The installed ConfigurationManager mock.
   */
  function provisionAuthEnvironment(groupEmail = CONFIGURED_GROUP_EMAIL) {
    context.authEnvironment = createDispatcherAuthEnvironment(vi, { groupEmail });
    return context.authEnvironment.configManager;
  }

  /**
   * Asserts the standard non-retriable FORBIDDEN access-denied envelope.
   * @param {Object} response - The dispatcher response envelope.
   * @returns {void}
   */
  function expectForbiddenEnvelope(response) {
    expect(response).toMatchObject({
      ok: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Access denied.',
        retriable: false,
      },
    });
  }

  beforeEach(() => {
    context = setupDispatcherAuthTest(vi);
  });

  afterEach(() => {
    teardownDispatcherAuthTest(vi, context);
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

        expectForbiddenEnvelope(response);
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

    it('denies with FORBIDDEN when AUTH_GROUP_EMAIL is empty (removed fail-open bootstrap)', () => {
      provisionAuthEnvironment('');

      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const response = dispatcher.handle({ method: 'getCohorts', params: {} });

      // The old fail-open bootstrap window (groups mode with a blank group) is
      // removed: a blank group in googleGroups mode is a broken-config deny, so
      // the gate fails closed with FORBIDDEN.
      expectForbiddenEnvelope(response);
    });

    it('returns FORBIDDEN when the active user email resolves to blank', () => {
      provisionAuthEnvironment(CONFIGURED_GROUP_EMAIL);
      globalThis.Session._setActiveUserEmail('');

      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const response = dispatcher.handle({ method: 'getCohorts', params: {} });

      expectForbiddenEnvelope(response);
    });

    it('returns FORBIDDEN when the configured group cannot be resolved by GroupsApp', () => {
      provisionAuthEnvironment(UNREGISTERED_GROUP_EMAIL);
      globalThis.Session._setActiveUserEmail('teacher@school.edu');

      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const response = dispatcher.handle({ method: 'getCohorts', params: {} });

      expectForbiddenEnvelope(response);
    });

    it('returns FORBIDDEN (not UNKNOWN_METHOD) for a non-member calling an unknown method', () => {
      // Security property: the gate runs before the allowlist method lookup, so
      // non-members receive FORBIDDEN uniformly and cannot probe which API
      // methods exist — UNKNOWN_METHOD is only observable by authorised callers.
      provisionAuthEnvironment(CONFIGURED_GROUP_EMAIL);
      globalThis.Session._setActiveUserEmail('outsider@school.edu');

      const { ApiDispatcher } = loadApiHandlerModule();
      const response = ApiDispatcher.getInstance().handle({ method: 'noSuchMethod' });

      expectForbiddenEnvelope(response);
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
