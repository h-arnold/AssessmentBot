/**
 * Section 5 auth-endpoint error-envelope regression tests.
 *
 * SPEC decision 12 requires that configuration-lock contention from
 * `setAuthenticationSettings` reaches the transport boundary as a retriable
 * validation/rate-limit envelope, never as a non-retriable INTERNAL_ERROR. The
 * Section 2 locked write path signals contention via `CONFIG_LOCK_CONTENTION`
 * (lock unavailable / `waitLock` throws); the auth settings domain translates
 * that internal signal to the existing `ApiRateLimitError` so the dispatcher's
 * standard mapping produces the retriable `RATE_LIMITED` envelope. This test
 * makes the configured contention condition throw and asserts the resulting
 * envelope and that storage remains unchanged.
 *
 * These cases are split into a dedicated file (rather than growing
 * `authEndpointsApi.test.js`) so both suites stay within the backend lint
 * `max-lines` threshold.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadApiHandlerModule } from '../helpers/apiHandlerTestUtils.js';
import { provisionAuthApiContext, rawStoreBlob } from './authApiTestHarness.js';
import { buildUsersJson } from '../utils/authService/authServiceTestHarness.js';

const AuthService = require('../../src/backend/Utils/AuthService.js');

const ADMIN = 'admin@school.edu';

/**
 * Builds a stored scriptProperties auth state.
 * @param {Array<{email: string, role: string}>} users - The stored user list.
 * @param {string} revision - The stored auth revision.
 * @returns {Object} The stored config object.
 */
function scriptPropertiesState(users, revision) {
  return {
    authMode: 'scriptProperties',
    authUsers: buildUsersJson(users),
    authRevision: revision,
  };
}

/**
 * Dispatches a request through the real ApiDispatcher singleton.
 * @param {string} method - The allowlisted method name.
 * @param {Object} [params] - Optional method payload.
 * @returns {Object} The response envelope.
 */
function dispatch(method, params) {
  const { ApiDispatcher } = loadApiHandlerModule();
  return ApiDispatcher.getInstance().handle({
    method,
    ...(params === undefined ? {} : { params }),
  });
}

describe('setAuthenticationSettings — configuration-lock contention envelope', () => {
  let ctx;

  beforeEach(() => {
    AuthService.resetForTests();
    globalThis.PropertiesService._resetUserProperties();
    globalThis.CacheService._resetScriptCache();
  });

  afterEach(() => {
    if (ctx) {
      ctx.restore();
      ctx = undefined;
    }
    AuthService.resetForTests();
    vi.restoreAllMocks();
  });

  it('maps the configured contention condition to a retriable RATE_LIMITED envelope with unchanged storage', () => {
    ctx = provisionAuthApiContext({
      seed: scriptPropertiesState([{ email: ADMIN, role: 'admin' }], '1'),
      email: ADMIN,
    });
    const before = rawStoreBlob(ctx.store);
    const contention = new Error('Script lock could not be acquired within the timeout.');
    contention.code = 'CONFIG_LOCK_CONTENTION';
    contention.retriable = true;
    // Make the configured contention condition throw: the Section 2 locked write
    // path signals an unavailable script lock via CONFIG_LOCK_CONTENTION.
    ctx.configManager.writeConfigurationLocked.mockImplementation(() => {
      throw contention;
    });

    const response = dispatch('setAuthenticationSettings', {
      authMode: 'scriptProperties',
      authUsers: [{ email: ADMIN, role: 'admin' }],
      expectedAuthRevision: '1',
    });

    // Contention is transient: it must reach the caller as a retriable
    // validation/rate-limit envelope, never a non-retriable INTERNAL_ERROR.
    expect(response.ok).toBe(false);
    expect(response.error).toMatchObject({ code: 'RATE_LIMITED', retriable: true });
    expect(response.error.code).not.toBe('INTERNAL_ERROR');
    expect(response.error.message).not.toBe('Internal API error.');
    // No partial write occurred: the stored config blob is byte-for-byte unchanged.
    expect(rawStoreBlob(ctx.store)).toBe(before);
    // The failure is audited at the domain boundary.
    expect(ctx.logger.warn).toHaveBeenCalled();
  });
});
