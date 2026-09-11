/**
 * Contract tests for the provider-switch saving-admin verification and
 * groups-mode group-email validation in `setAuthenticationSettings`
 * (`AuthSettingsDomain.verifySavingAdminForSwitch` / `validatedSaveCandidate`).
 *
 * A switch from `scriptProperties` to `googleGroups` must validate the saving
 * administrator against the CANDIDATE group with a FRESH GroupsApp lookup:
 * `OWNER`/`MANAGER` are admitted, while `MEMBER` and non-membership are rejected
 * with the non-retriable `AUTH_SETTINGS_SAVING_ADMIN_DENIED` code and unchanged
 * storage (the warm membership cache must never satisfy the check). An external
 * GroupsApp lookup failure is distinguished from a genuine role denial and maps
 * to the retriable `RATE_LIMITED` service envelope. A groups-mode save with a
 * missing or blank group email is rejected before any write.
 *
 * These cases live in a dedicated file (rather than growing
 * `authEndpointsApi.test.js`) so both suites stay within the backend lint
 * `max-lines` threshold.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadApiHandlerModule } from '../helpers/apiHandlerTestUtils.js';
import { provisionAuthApiContext, rawStoreBlob } from './authApiTestHarness.js';
import { buildUsersJson } from '../utils/authService/authServiceTestHarness.js';

const AuthService = require('../../src/backend/Utils/AuthService.js');

const ADMIN = 'admin@school.edu';
const GROUP_EMAIL = 'teachers@school.edu';

/**
 * Builds a stored scriptProperties auth state.
 * @param {Array<{email: string, role: string}>} users - The stored user list.
 * @param {string} revision - The stored auth revision.
 * @returns {Object} The stored config object.
 */
function storedScriptPropertiesState(users, revision) {
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

describe('setAuthenticationSettings — scriptProperties to googleGroups saving-admin check', () => {
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

  /**
   * Provisions a stored scriptProperties install whose saving admin switches to
   * the candidate group.
   * @param {Object} options - Mock configuration.
   * @param {Record<string,string>} options.members - Candidate-group members map.
   * @returns {Object} The provisioned context handles.
   */
  function provisionSwitchContext({ members }) {
    return provisionAuthApiContext({
      seed: storedScriptPropertiesState([{ email: ADMIN, role: 'admin' }], '1'),
      email: ADMIN,
      members,
    });
  }

  it.each(['OWNER', 'MANAGER'])(
    'allows the switch when the saving admin is a fresh %s of the candidate group',
    (groupRole) => {
      ctx = provisionSwitchContext({ members: { [ADMIN]: groupRole } });

      const response = dispatch('setAuthenticationSettings', {
        authMode: 'googleGroups',
        authGroupEmail: GROUP_EMAIL,
      });

      expect(response.ok).toBe(true);
      expect(response.data).toEqual({ success: true, authRevision: null });
      // The candidate check performed a fresh GroupsApp lookup against the
      // candidate group.
      expect(ctx.groupsApp.getGroupByEmail).toHaveBeenCalledWith(GROUP_EMAIL);
      const parsed = JSON.parse(rawStoreBlob(ctx.store));
      expect(parsed.authMode).toBe('googleGroups');
      expect(parsed.authGroupEmail).toBe(GROUP_EMAIL);
    }
  );

  it('rejects the switch when the saving admin is only a MEMBER of the candidate group', () => {
    ctx = provisionSwitchContext({ members: { [ADMIN]: 'MEMBER' } });
    const before = rawStoreBlob(ctx.store);

    const response = dispatch('setAuthenticationSettings', {
      authMode: 'googleGroups',
      authGroupEmail: GROUP_EMAIL,
    });

    expect(response.ok).toBe(false);
    expect(response.error).toMatchObject({
      code: 'AUTH_SETTINGS_SAVING_ADMIN_DENIED',
      retriable: false,
    });
    expect(ctx.groupsApp.getGroupByEmail).toHaveBeenCalledWith(GROUP_EMAIL);
    expect(rawStoreBlob(ctx.store)).toBe(before);
  });

  it('rejects the switch when the saving admin is not a member of the candidate group', () => {
    ctx = provisionSwitchContext({ members: {} });
    const before = rawStoreBlob(ctx.store);

    const response = dispatch('setAuthenticationSettings', {
      authMode: 'googleGroups',
      authGroupEmail: GROUP_EMAIL,
    });

    expect(response.ok).toBe(false);
    expect(response.error).toMatchObject({
      code: 'AUTH_SETTINGS_SAVING_ADMIN_DENIED',
      retriable: false,
    });
    expect(rawStoreBlob(ctx.store)).toBe(before);
  });

  it('maps a candidate group lookup failure to a retriable service envelope, distinct from a role denial', () => {
    ctx = provisionAuthApiContext({
      seed: storedScriptPropertiesState([{ email: ADMIN, role: 'admin' }], '1'),
      email: ADMIN,
      groupExists: false,
    });
    const before = rawStoreBlob(ctx.store);

    const response = dispatch('setAuthenticationSettings', {
      authMode: 'googleGroups',
      authGroupEmail: GROUP_EMAIL,
    });

    // An external GroupsApp failure is a transient service failure, NOT a
    // non-retriable saving-admin role denial.
    expect(response.ok).toBe(false);
    expect(response.error).toMatchObject({ code: 'RATE_LIMITED', retriable: true });
    expect(response.error.code).not.toBe('AUTH_SETTINGS_SAVING_ADMIN_DENIED');
    expect(rawStoreBlob(ctx.store)).toBe(before);
  });

  it('uses a fresh GroupsApp lookup rather than a warm membership cache entry', () => {
    ctx = provisionSwitchContext({ members: { [ADMIN]: 'MEMBER' } });
    // Warm the groups cache with an admin allow for the candidate group: a
    // switch check that trusted the cache would admit the save, while the fresh
    // GroupsApp role (MEMBER) must deny it.
    globalThis.CacheService.getScriptCache().put(
      `auth:${GROUP_EMAIL}:${ADMIN}`,
      { allowed: true, role: 'admin' },
      21600
    );
    const before = rawStoreBlob(ctx.store);

    const response = dispatch('setAuthenticationSettings', {
      authMode: 'googleGroups',
      authGroupEmail: GROUP_EMAIL,
    });

    expect(response.ok).toBe(false);
    expect(response.error).toMatchObject({
      code: 'AUTH_SETTINGS_SAVING_ADMIN_DENIED',
      retriable: false,
    });
    expect(ctx.groupsApp.getGroupByEmail).toHaveBeenCalledWith(GROUP_EMAIL);
    expect(rawStoreBlob(ctx.store)).toBe(before);
  });
});

describe('setAuthenticationSettings — groups-mode group email validation', () => {
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

  /**
   * Provisions a stored googleGroups install with an admin caller.
   * @returns {Object} The provisioned context handles.
   */
  function provisionGroupsContext() {
    return provisionAuthApiContext({
      seed: { authMode: 'googleGroups', authGroupEmail: GROUP_EMAIL },
      email: ADMIN,
      members: { [ADMIN]: 'OWNER' },
    });
  }

  it('rejects a groups-mode save with a missing group email and leaves storage unchanged', () => {
    ctx = provisionGroupsContext();
    const before = rawStoreBlob(ctx.store);

    const response = dispatch('setAuthenticationSettings', { authMode: 'googleGroups' });

    expect(response.ok).toBe(false);
    expect(response.error).toMatchObject({ code: 'INVALID_REQUEST', retriable: false });
    expect(rawStoreBlob(ctx.store)).toBe(before);
  });

  it('rejects a groups-mode save with a blank group email and leaves storage unchanged', () => {
    ctx = provisionGroupsContext();
    const before = rawStoreBlob(ctx.store);

    const response = dispatch('setAuthenticationSettings', {
      authMode: 'googleGroups',
      authGroupEmail: '   ',
    });

    expect(response.ok).toBe(false);
    expect(response.error).toMatchObject({ code: 'INVALID_REQUEST', retriable: false });
    expect(rawStoreBlob(ctx.store)).toBe(before);
  });
});
