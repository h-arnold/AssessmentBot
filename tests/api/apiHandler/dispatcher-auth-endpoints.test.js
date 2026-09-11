/**
 * Dispatcher auth-endpoint gate wiring tests (ACTION_PLAN §5).
 *
 * These tests pin the `z_apiHandler.js` gate behaviour for the three auth
 * endpoints to the settled mechanism:
 *
 *   - `getApplicationAccess` joins `getAuthorisationStatus` in the gate-exempt
 *     set: the ordinary access gate must NOT run for it, so a caller the gate
 *     would deny still reaches the allowlisted handler (which routes through the
 *     shared access-resolution path itself).
 *   - `getAuthenticationSettings` / `setAuthenticationSettings` are
 *     admin-required: the dispatcher admission phase checks a declarative
 *     admin-required method set against access state resolved FRESH (cache
 *     bypassed), and a user-role caller receives the standard `FORBIDDEN`
 *     envelope (`{ ok: false, error: { code: 'FORBIDDEN', message: 'Access
 *     denied.', retriable: false } }`). A groups-mode admin is admitted via a
 *     fresh `GroupsApp` role lookup, never a stale membership cache entry.
 *   - No new error type or `_mapErrorToFailureEnvelope` case is introduced:
 *     auth-handler failures map through the existing `INVALID_REQUEST` /
 *     `INTERNAL_ERROR` conventions.
 *
 * Handler-level admin guards are deliberately NOT tested here: enforcement is a
 * dispatcher responsibility and must not be duplicated in the transport helpers.
 *
 * Handler spies are installed AFTER `loadApiHandlerModule()` and before
 * dispatch: the allowlisted closure resolves the trailing-underscore global at
 * call time, so a spy set between load and dispatch intercepts the actual
 * dispatcher call while an unconditional production module-export wiring step
 * (which runs during load) can never clobber it. Cleanup saves/restores the
 * pre-dispatch global value so the production-wired function (once it exists)
 * is preserved for other tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const AuthService = require('../../../src/backend/Utils/AuthService.js');
const {
  loadApiHandlerModule,
  createDispatcherAuthEnvironment,
  setupDispatcherAuthTest,
  teardownDispatcherAuthTest,
  ApiValidationError,
} = require('./shared.js');

const CONFIGURED_GROUP_EMAIL = 'teachers@school.edu';

describe('Api/apiHandler dispatcher — auth endpoint gate wiring', () => {
  let context;

  /**
   * Provisions a mocked ConfigurationManager whose stored auth state is a
   * googleGroups install, matching the dispatcher-auth-gate suite convention.
   * @param {string} [groupEmail=CONFIGURED_GROUP_EMAIL] - The stored group email.
   * @returns {Object} The installed ConfigurationManager mock.
   */
  function provisionAuthEnvironment(groupEmail = CONFIGURED_GROUP_EMAIL) {
    context.authEnvironment = createDispatcherAuthEnvironment(vi, { groupEmail });
    return context.authEnvironment.configManager;
  }

  /**
   * Restores a handler global after a test, preserving any production-wired
   * function that the module load installed.
   * @param {string} globalName - The trailing-underscore global name.
   * @param {*} originalValue - The value captured after module load.
   * @returns {void}
   */
  function restoreHandlerGlobal(globalName, originalValue) {
    if (originalValue === undefined) {
      delete globalThis[globalName];
      return;
    }
    globalThis[globalName] = originalValue;
  }

  /**
   * Builds a stubbed `getAuthenticationSettings_` handler returning the
   * canonical googleGroups settings shape.
   * @returns {import('vitest').Mock} The handler stub.
   */
  function buildAuthenticationSettingsHandlerStub() {
    return vi.fn(() => ({
      authMode: 'googleGroups',
      authGroupEmail: CONFIGURED_GROUP_EMAIL,
      authUsers: [],
      authRevision: null,
    }));
  }

  /**
   * Dispatches a request through the real dispatcher with a temporary
   * trailing-underscore handler stub, restoring the pre-dispatch global after.
   * @param {string} handlerName - The trailing-underscore global name.
   * @param {import('vitest').Mock} handler - The handler stub.
   * @param {Object} request - The dispatcher request.
   * @returns {Object} The response envelope.
   */
  function dispatchWithHandlerStub(handlerName, handler, request) {
    let originalHandler;
    try {
      const { ApiDispatcher } = loadApiHandlerModule();
      originalHandler = globalThis[handlerName];
      globalThis[handlerName] = handler;
      return ApiDispatcher.getInstance().handle(request);
    } finally {
      restoreHandlerGlobal(handlerName, originalHandler);
    }
  }

  beforeEach(() => {
    context = setupDispatcherAuthTest(vi);
  });

  afterEach(() => {
    teardownDispatcherAuthTest(vi, context);
  });

  describe('getApplicationAccess gate exemption', () => {
    it('reaches the allowlisted handler for a caller the ordinary gate would deny', () => {
      provisionAuthEnvironment();
      // A non-member would be rejected by the ordinary access gate; because the
      // method is gate-exempt the allowlisted handler must still run.
      globalThis.Session._setActiveUserEmail('outsider@school.edu');
      const getApplicationAccess_ = vi.fn(() => ({
        allowed: false,
        role: null,
        email: 'outsider@school.edu',
        reason: 'denied',
      }));

      const response = dispatchWithHandlerStub('getApplicationAccess_', getApplicationAccess_, {
        method: 'getApplicationAccess',
      });

      expect(response.ok).toBe(true);
      expect(response.error).toBeUndefined();
      expect(getApplicationAccess_).toHaveBeenCalledTimes(1);
      expect(response.data).toMatchObject({ allowed: false, reason: 'denied' });
    });
  });

  describe('admin-required settings pair enforcement', () => {
    it('rejects getAuthenticationSettings for a user role with FORBIDDEN from a fresh cache-bypassing resolution', () => {
      provisionAuthEnvironment();
      globalThis.Session._setActiveUserEmail('teacher@school.edu');
      const checkAccessSpy = vi
        .spyOn(AuthService.getInstance(), 'checkAccess')
        .mockReturnValue({ allowed: true, role: 'user' });
      const getAuthenticationSettings_ = buildAuthenticationSettingsHandlerStub();

      const response = dispatchWithHandlerStub(
        'getAuthenticationSettings_',
        getAuthenticationSettings_,
        { method: 'getAuthenticationSettings' }
      );

      expect(response).toMatchObject({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied.',
          retriable: false,
        },
      });
      // The admission-phase admin check must use a fresh access resolution
      // with the cache bypassed, never a cached role.
      expect(checkAccessSpy).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'getAuthenticationSettings', bypassCache: true })
      );
      expect(getAuthenticationSettings_).not.toHaveBeenCalled();
    });

    it('rejects setAuthenticationSettings for a user role with FORBIDDEN from a fresh cache-bypassing resolution', () => {
      provisionAuthEnvironment();
      globalThis.Session._setActiveUserEmail('teacher@school.edu');
      const checkAccessSpy = vi
        .spyOn(AuthService.getInstance(), 'checkAccess')
        .mockReturnValue({ allowed: true, role: 'user' });
      const setAuthenticationSettings_ = vi.fn(() => ({ success: true, authRevision: null }));

      const response = dispatchWithHandlerStub(
        'setAuthenticationSettings_',
        setAuthenticationSettings_,
        {
          method: 'setAuthenticationSettings',
          params: { authMode: 'googleGroups', authGroupEmail: CONFIGURED_GROUP_EMAIL },
        }
      );

      expect(response).toMatchObject({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied.',
          retriable: false,
        },
      });
      expect(checkAccessSpy).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'setAuthenticationSettings', bypassCache: true })
      );
      expect(setAuthenticationSettings_).not.toHaveBeenCalled();
    });

    it('allows an admin caller through to the settings handler (enforcement stays in the dispatcher)', () => {
      provisionAuthEnvironment();
      globalThis.Session._setActiveUserEmail('admin@school.edu');
      vi.spyOn(AuthService.getInstance(), 'checkAccess').mockReturnValue({
        allowed: true,
        role: 'admin',
      });
      const getAuthenticationSettings_ = buildAuthenticationSettingsHandlerStub();

      const response = dispatchWithHandlerStub(
        'getAuthenticationSettings_',
        getAuthenticationSettings_,
        { method: 'getAuthenticationSettings' }
      );

      expect(response.ok).toBe(true);
      expect(getAuthenticationSettings_).toHaveBeenCalledTimes(1);
    });

    it('admits a groups-mode admin through a fresh GroupsApp role lookup, not the stale membership cache', () => {
      provisionAuthEnvironment();
      globalThis.Session._setActiveUserEmail('admin@school.edu');
      globalThis.GroupsApp._setMembers(CONFIGURED_GROUP_EMAIL, {
        'admin@school.edu': 'OWNER',
      });
      // Warm the membership cache with a STALE role (user): an admin check that
      // read the cache would deny; only a fresh lookup grants admin admission.
      globalThis.CacheService.getScriptCache().put(
        `auth:${CONFIGURED_GROUP_EMAIL}:admin@school.edu`,
        { allowed: true, role: 'user' },
        21600
      );
      // Passthrough spy on the real AuthService access resolution: it must be
      // consulted fresh (cache bypassed) for the admin-required method, proving
      // the stale cache entry never drove the decision.
      const checkAccessSpy = vi.spyOn(AuthService.getInstance(), 'checkAccess');
      const getAuthenticationSettings_ = buildAuthenticationSettingsHandlerStub();

      const response = dispatchWithHandlerStub(
        'getAuthenticationSettings_',
        getAuthenticationSettings_,
        { method: 'getAuthenticationSettings' }
      );

      // The behavioural assertion: despite the stale cached 'user' role, the
      // groups-mode admin reaches the settings handler.
      expect(response.ok).toBe(true);
      expect(getAuthenticationSettings_).toHaveBeenCalledTimes(1);
      // The mechanism assertion: admission resolved access fresh with the
      // cache bypassed for this admin-required method.
      expect(checkAccessSpy).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'getAuthenticationSettings', bypassCache: true })
      );
    });
  });

  describe('auth-handler error envelopes reuse the existing conventions', () => {
    it.each([
      [
        'an ApiValidationError',
        () => new ApiValidationError('Stale auth revision.'),
        {
          code: 'INVALID_REQUEST',
          message: 'Stale auth revision.',
          retriable: false,
        },
      ],
      [
        'an unexpected failure',
        () => new Error('boom'),
        {
          code: 'INTERNAL_ERROR',
          message: 'Internal API error.',
          retriable: false,
        },
      ],
    ])(
      'maps %s from an auth handler to the standard failure envelope (no invented auth error type)',
      (_label, makeError, expectedError) => {
        provisionAuthEnvironment();
        globalThis.Session._setActiveUserEmail('admin@school.edu');
        vi.spyOn(AuthService.getInstance(), 'checkAccess').mockReturnValue({
          allowed: true,
          role: 'admin',
        });
        const setAuthenticationSettings_ = vi.fn(() => {
          throw makeError();
        });

        const response = dispatchWithHandlerStub(
          'setAuthenticationSettings_',
          setAuthenticationSettings_,
          { method: 'setAuthenticationSettings', params: { authMode: 'scriptProperties' } }
        );

        expect(response).toMatchObject({ ok: false, error: expectedError });
      }
    );
  });
});
