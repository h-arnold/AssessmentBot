/**
 * Contract tests for the provider-switch saving-admin verification, groups-mode
 * group-email validation, and the auth-revision lifecycle in
 * `setAuthenticationSettings` (`AuthSettingsDomain.verifySavingAdminForSwitch` /
 * `validatedSaveCandidate` / `nextAuthRevision`).
 *
 * A switch from `scriptProperties` to `googleGroups` must validate the saving
 * administrator against the CANDIDATE group with a FRESH GroupsApp lookup:
 * `OWNER`/`MANAGER` are admitted, while `MEMBER` and non-membership are rejected
 * with the non-retriable `AUTH_SETTINGS_SAVING_ADMIN_DENIED` code and unchanged
 * storage (the warm membership cache must never satisfy the check). An external
 * GroupsApp lookup failure is distinguished from a genuine role denial and maps
 * to the retriable `RATE_LIMITED` service envelope. A groups-mode save with a
 * missing or blank group email is rejected before any write. The revision cases
 * cover the exact arbitrary-length increment, the cleared-on-switch groups
 * revision that allows a later switch back, and the domain-boundary rejection of
 * a non-string expected revision that would otherwise coerce onto the stored
 * value (the transport rejects it first; this is the defence-in-depth guard).
 *
 * These cases live in a dedicated file (rather than growing
 * `authEndpointsApi.test.js`) so both suites stay within the backend lint
 * `max-lines` threshold.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  dispatchAuthApi,
  provisionAuthApiContext,
  rawStoreBlob,
  resetAuthApiTestState,
  storedScriptPropertiesState,
  teardownAuthApiTestContext,
} from './authApiTestHarness.js';

const AuthService = require('../../src/backend/Utils/AuthService.js');
const ApiValidationError = require('../../src/backend/Utils/ErrorTypes/ApiValidationError.js');

const ADMIN = 'admin@school.edu';
const GROUP_EMAIL = 'teachers@school.edu';

describe('setAuthenticationSettings — scriptProperties to googleGroups saving-admin check', () => {
  let ctx;

  beforeEach(() => {
    ctx = undefined;
    resetAuthApiTestState();
  });

  afterEach(() => {
    teardownAuthApiTestContext(ctx);
    ctx = undefined;
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

      const response = dispatchAuthApi('setAuthenticationSettings', {
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

    const response = dispatchAuthApi('setAuthenticationSettings', {
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

    const response = dispatchAuthApi('setAuthenticationSettings', {
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

    const response = dispatchAuthApi('setAuthenticationSettings', {
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

    const response = dispatchAuthApi('setAuthenticationSettings', {
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
    ctx = undefined;
    resetAuthApiTestState();
  });

  afterEach(() => {
    teardownAuthApiTestContext(ctx);
    ctx = undefined;
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

    const response = dispatchAuthApi('setAuthenticationSettings', { authMode: 'googleGroups' });

    expect(response.ok).toBe(false);
    expect(response.error).toMatchObject({ code: 'INVALID_REQUEST', retriable: false });
    expect(rawStoreBlob(ctx.store)).toBe(before);
  });

  it('rejects a groups-mode save with a blank group email and leaves storage unchanged', () => {
    ctx = provisionGroupsContext();
    const before = rawStoreBlob(ctx.store);

    const response = dispatchAuthApi('setAuthenticationSettings', {
      authMode: 'googleGroups',
      authGroupEmail: '   ',
    });

    expect(response.ok).toBe(false);
    expect(response.error).toMatchObject({ code: 'INVALID_REQUEST', retriable: false });
    expect(rawStoreBlob(ctx.store)).toBe(before);
  });
});

describe('setAuthenticationSettings — auth revision lifecycle', () => {
  let ctx;

  beforeEach(() => {
    ctx = undefined;
    resetAuthApiTestState();
  });

  afterEach(() => {
    teardownAuthApiTestContext(ctx);
    ctx = undefined;
  });

  it('increments an arbitrarily long revision exactly without floating-point loss', () => {
    const storedRevision = '999999999999999999999999999999';
    ctx = provisionAuthApiContext({
      seed: storedScriptPropertiesState([{ email: ADMIN, role: 'admin' }], storedRevision),
      email: ADMIN,
    });

    const response = dispatchAuthApi('setAuthenticationSettings', {
      authMode: 'scriptProperties',
      authUsers: [{ email: ADMIN, role: 'admin' }],
      expectedAuthRevision: storedRevision,
    });

    expect(response.ok).toBe(true);
    expect(response.data).toEqual({
      success: true,
      authRevision: '1000000000000000000000000000000',
    });
    const parsed = JSON.parse(rawStoreBlob(ctx.store));
    expect(parsed.authRevision).toBe('1000000000000000000000000000000');
  });

  it('clears the non-applicable revision on a switch to googleGroups so a later switch back is possible', () => {
    ctx = provisionAuthApiContext({
      seed: storedScriptPropertiesState([{ email: ADMIN, role: 'admin' }], '1'),
      email: ADMIN,
      members: { [ADMIN]: 'OWNER' },
    });

    const switchedToGroups = dispatchAuthApi('setAuthenticationSettings', {
      authMode: 'googleGroups',
      authGroupEmail: GROUP_EMAIL,
    });
    expect(switchedToGroups.ok).toBe(true);
    const groupsBlob = JSON.parse(rawStoreBlob(ctx.store));
    expect(groupsBlob.authMode).toBe('googleGroups');
    expect(Object.hasOwn(groupsBlob, 'authRevision')).toBe(false);

    // Groups mode reports a null revision, so switching back must seed a fresh
    // revision rather than demanding an expected revision the UI never received.
    const read = dispatchAuthApi('getAuthenticationSettings');
    expect(read.data.authRevision).toBeNull();

    const switchedBack = dispatchAuthApi('setAuthenticationSettings', {
      authMode: 'scriptProperties',
      authUsers: [{ email: ADMIN, role: 'admin' }],
    });
    expect(switchedBack.ok).toBe(true);
    expect(switchedBack.data).toEqual({ success: true, authRevision: '1' });
    const backBlob = JSON.parse(rawStoreBlob(ctx.store));
    expect(backBlob.authMode).toBe('scriptProperties');
    expect(backBlob.authRevision).toBe('1');
  });

  it('rejects a non-string expected revision at the domain boundary without coercing it onto the stored value', () => {
    ctx = provisionAuthApiContext({
      seed: storedScriptPropertiesState([{ email: ADMIN, role: 'admin' }], '1'),
      email: ADMIN,
    });
    const before = rawStoreBlob(ctx.store);

    // A direct domain caller bypasses the transport guard; the number 1 must not
    // coerce onto the stored '1' revision and be admitted. The exact guard
    // message and field are asserted so the defence-in-depth check cannot be
    // satisfied by the stale-revision fallback that would otherwise also throw.
    let thrown;
    try {
      AuthService.getInstance().saveAuthenticationSettings({
        authMode: 'scriptProperties',
        authUsers: [{ email: ADMIN, role: 'admin' }],
        expectedAuthRevision: 1,
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ApiValidationError);
    expect(thrown.message).toBe('expectedAuthRevision must be a string.');
    expect(thrown.fieldName).toBe('expectedAuthRevision');
    expect(rawStoreBlob(ctx.store)).toBe(before);
  });
});
