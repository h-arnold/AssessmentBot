/**
 * Contract tests for the competing-writer claim fall-through in the gate-exempt
 * `getApplicationAccess` endpoint (`AuthSettingsDomain.resolveApplicationAccess`).
 *
 * When the fresh-install bootstrap claim cannot complete because a competing
 * writer committed a configuration blob while the claim was in flight, the
 * access-status resolution must NOT overwrite that blob or report a transient
 * denial. It must fall through to the strict auth-state resolver and classify
 * the newly committed state (`ok`, `denied` or `brokenConfig`).
 *
 * The competing write is simulated inside the mocked locked-write path: the
 * competing blob is committed and the default locked-write implementation is
 * invoked so the claim's in-lock re-check aborts against the real store. This
 * pins the distinct `resolveApplicationAccess` fall-through path, which the
 * equivalent `checkAccess` bootstrap-claim coverage does not reach.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadApiHandlerModule } from '../helpers/apiHandlerTestUtils.js';
import { provisionAuthApiContext, rawStoreBlob } from './authApiTestHarness.js';
import { buildUsersJson } from '../utils/authService/authServiceTestHarness.js';
import { CONFIG_STORE_KEY } from '../utils/authService/authServiceBootstrapHarness.js';

const AuthService = require('../../src/backend/Utils/AuthService.js');

const ADMIN = 'admin@school.edu';
const OUTSIDER = 'outsider@school.edu';
const GROUP_EMAIL = 'teachers@school.edu';

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

/**
 * Simulates a competing writer committing a blob between the pre-lock freshness
 * probe and the claim's in-lock re-check.
 * @param {Object} context - The provisioned auth API context.
 * @param {Object} competingConfig - The blob the competing writer commits.
 * @returns {string} The serialised competing blob, for unchanged-storage assertions.
 */
function attemptCompetingWrite(context, competingConfig) {
  const competingBlob = JSON.stringify(competingConfig);
  context.configManager.writeConfigurationLocked.mockImplementation((mutator) => {
    context.store[CONFIG_STORE_KEY] = competingBlob;
    context.defaultWriteConfigurationLocked(mutator);
  });
  return competingBlob;
}

describe('getApplicationAccess — competing-writer claim fall-through', () => {
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

  it('falls through to ok when the competing blob authorises the caller as admin', () => {
    ctx = provisionAuthApiContext({ email: ADMIN });
    const competingBlob = attemptCompetingWrite(ctx, {
      authMode: 'scriptProperties',
      authUsers: buildUsersJson([{ email: ADMIN, role: 'admin' }]),
      authRevision: '1',
    });

    const response = dispatch('getApplicationAccess');

    expect(response.ok).toBe(true);
    expect(response.data).toEqual({
      allowed: true,
      role: 'admin',
      email: ADMIN,
      reason: 'ok',
    });
    // The aborted claim never overwrote the competing blob.
    expect(rawStoreBlob(ctx.store)).toBe(competingBlob);
    // Exactly one locked-write attempt (the aborted claim), no retry.
    expect(ctx.configManager.writeConfigurationLocked).toHaveBeenCalledTimes(1);
  });

  it('falls through to denied when the competing blob does not list the caller', () => {
    ctx = provisionAuthApiContext({ email: ADMIN });
    const competingBlob = attemptCompetingWrite(ctx, {
      authMode: 'scriptProperties',
      authUsers: buildUsersJson([{ email: OUTSIDER, role: 'admin' }]),
      authRevision: '1',
    });

    const response = dispatch('getApplicationAccess');

    expect(response.ok).toBe(true);
    expect(response.data).toEqual({
      allowed: false,
      role: null,
      email: ADMIN,
      reason: 'denied',
    });
    expect(rawStoreBlob(ctx.store)).toBe(competingBlob);
  });

  it('falls through to brokenConfig when the competing blob is a broken auth state', () => {
    ctx = provisionAuthApiContext({ email: ADMIN });
    const competingBlob = attemptCompetingWrite(ctx, {
      authMode: 'none',
      authGroupEmail: GROUP_EMAIL,
    });

    const response = dispatch('getApplicationAccess');

    expect(response.ok).toBe(true);
    expect(response.data).toEqual({
      allowed: false,
      role: null,
      email: ADMIN,
      reason: 'brokenConfig',
    });
    expect(rawStoreBlob(ctx.store)).toBe(competingBlob);
  });
});
