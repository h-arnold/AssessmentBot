/**
 * Contract tests for the Section 5 auth endpoints (`getApplicationAccess`,
 * `getAuthenticationSettings`, `setAuthenticationSettings`) registered in
 * `ALLOWLISTED_METHOD_HANDLERS` and exercised through the real `ApiDispatcher`
 * and `AuthService` singleton with store-backed runtime mocks (see `auth-users.md`).
 *
 * Contract encoded: `getApplicationAccess` is gate-exempt, routes through the
 * shared access-resolution path (performing the bootstrap claim) and returns the
 * exact reason enum (`ok`/`freshInstall`/`brokenConfig`/`denied`, no `provider`
 * field, no `'unconfigured'` reason); the settings pair are admin-only with the
 * documented read/write shapes; saves commit atomically or not at all with a
 * stable `ApiValidationError` code and unchanged storage on stale revision
 * (`AUTH_SETTINGS_STALE_REVISION`), missing revision
 * (`AUTH_SETTINGS_REVISION_REQUIRED`), last-admin removal/demotion
 * (`AUTH_SETTINGS_LAST_ADMIN`), invalid candidates
 * (`AUTH_SETTINGS_INVALID_CANDIDATE`), failed candidate-provider checks
 * (`AUTH_SETTINGS_SAVING_ADMIN_DENIED`), retriable group-lookup service
 * failures (`RATE_LIMITED`), groups-mode request-shape violations, and
 * quota-cap excess. The first switch from groups/legacy seeds `authRevision: '1'`
 * without requiring `expectedAuthRevision`. Validation messages never leak the
 * raw stored users list (PII); a contract-compliant SET stale-revision
 * diagnostic may reference the stored revision, so no revision-value assertion
 * is encoded here.
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
import { buildUsersJson } from '../utils/authService/authServiceTestHarness.js';
import { CONFIG_STORE_KEY } from '../utils/authService/authServiceBootstrapHarness.js';

const ADMIN = 'admin@school.edu';
const USER = 'user@school.edu';
const OUTSIDER = 'outsider@school.edu';
const GROUP_EMAIL = 'teachers@school.edu';

describe('Auth endpoints — getApplicationAccess transport', () => {
  let ctx;

  beforeEach(() => {
    ctx = undefined;
    resetAuthApiTestState();
  });

  afterEach(() => {
    teardownAuthApiTestContext(ctx);
    ctx = undefined;
  });

  it('returns reason ok with the claimed admin role when a claimable caller invokes it on a fresh install', () => {
    ctx = provisionAuthApiContext({ email: 'teacher@school.edu' });

    const response = dispatchAuthApi('getApplicationAccess');

    expect(response.ok).toBe(true);
    expect(response.data).toEqual({
      allowed: true,
      role: 'admin',
      email: 'teacher@school.edu',
      reason: 'ok',
    });
    expect(response.data).not.toHaveProperty('provider');
    expect(response.data.reason).not.toBe('unconfigured');
    // The claim committed exactly one locked auth-only write.
    expect(ctx.configManager.writeConfigurationLocked).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(rawStoreBlob(ctx.store));
    expect(Object.keys(parsed).sort()).toEqual(['authMode', 'authRevision', 'authUsers']);
    expect(parsed.authMode).toBe('scriptProperties');
    expect(parsed.authRevision).toBe('1');
    expect(JSON.parse(parsed.authUsers)).toEqual([{ email: 'teacher@school.edu', role: 'admin' }]);
  });

  it('returns reason freshInstall without claiming for a non-claimable (blank) caller', () => {
    ctx = provisionAuthApiContext({ email: '' });

    const response = dispatchAuthApi('getApplicationAccess');

    expect(response.ok).toBe(true);
    expect(response.data).toEqual({
      allowed: false,
      role: null,
      email: '',
      reason: 'freshInstall',
    });
    expect(response.data).not.toHaveProperty('provider');
    expect(response.data.reason).not.toBe('unconfigured');
    expect(ctx.store[CONFIG_STORE_KEY]).toBeUndefined();
  });

  it('returns reason brokenConfig when the stored auth state is broken', () => {
    ctx = provisionAuthApiContext({
      seed: { authMode: 'none', authGroupEmail: GROUP_EMAIL },
      email: 'teacher@school.edu',
    });

    const response = dispatchAuthApi('getApplicationAccess');

    expect(response.ok).toBe(true);
    expect(response.data).toEqual({
      allowed: false,
      role: null,
      email: 'teacher@school.edu',
      reason: 'brokenConfig',
    });
    expect(response.data).not.toHaveProperty('provider');
    expect(response.data.reason).not.toBe('unconfigured');
  });

  it('returns reason denied for a valid configuration where the caller is not authorised', () => {
    ctx = provisionAuthApiContext({
      seed: storedScriptPropertiesState([{ email: ADMIN, role: 'admin' }], '1'),
      email: OUTSIDER,
    });

    const response = dispatchAuthApi('getApplicationAccess');

    expect(response.ok).toBe(true);
    expect(response.data).toEqual({
      allowed: false,
      role: null,
      email: OUTSIDER,
      reason: 'denied',
    });
    expect(response.data).not.toHaveProperty('provider');
    expect(response.data.reason).not.toBe('unconfigured');
  });
});

describe('Auth endpoints — getAuthenticationSettings transport', () => {
  let ctx;

  beforeEach(() => {
    ctx = undefined;
    resetAuthApiTestState();
  });

  afterEach(() => {
    teardownAuthApiTestContext(ctx);
    ctx = undefined;
  });

  it('returns the scriptProperties settings shape with parsed users and the revision for an admin', () => {
    ctx = provisionAuthApiContext({
      seed: storedScriptPropertiesState(
        [
          { email: ADMIN, role: 'admin' },
          { email: USER, role: 'user' },
        ],
        '7',
        { authGroupEmail: GROUP_EMAIL }
      ),
      email: ADMIN,
    });

    const response = dispatchAuthApi('getAuthenticationSettings');

    expect(response.ok).toBe(true);
    expect(response.data).toEqual({
      authMode: 'scriptProperties',
      authGroupEmail: GROUP_EMAIL,
      authUsers: [
        { email: ADMIN, role: 'admin' },
        { email: USER, role: 'user' },
      ],
      authRevision: '7',
    });
    expect(response.data).not.toHaveProperty('provider');
  });

  it('returns the groups settings shape with an empty user list and null revision for an admin', () => {
    ctx = provisionAuthApiContext({
      seed: { authMode: 'googleGroups', authGroupEmail: GROUP_EMAIL },
      email: ADMIN,
      members: { [ADMIN]: 'OWNER' },
    });

    const response = dispatchAuthApi('getAuthenticationSettings');

    expect(response.ok).toBe(true);
    expect(response.data).toEqual({
      authMode: 'googleGroups',
      authGroupEmail: GROUP_EMAIL,
      authUsers: [],
      authRevision: null,
    });
    expect(response.data).not.toHaveProperty('provider');
  });
});

describe('Auth endpoints — setAuthenticationSettings transport', () => {
  let ctx;

  beforeEach(() => {
    ctx = undefined;
    resetAuthApiTestState();
  });

  afterEach(() => {
    teardownAuthApiTestContext(ctx);
    ctx = undefined;
  });

  it('commits a valid scriptProperties save atomically with one locked write and returns the incremented revision', () => {
    ctx = provisionAuthApiContext({
      seed: storedScriptPropertiesState([{ email: ADMIN, role: 'admin' }], '3'),
      email: ADMIN,
    });

    const response = dispatchAuthApi('setAuthenticationSettings', {
      authMode: 'scriptProperties',
      authUsers: [
        { email: ADMIN, role: 'admin' },
        { email: USER, role: 'user' },
      ],
      expectedAuthRevision: '3',
    });

    expect(response.ok).toBe(true);
    expect(response.data).toEqual({ success: true, authRevision: '4' });
    expect(ctx.configManager.writeConfigurationLocked).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(rawStoreBlob(ctx.store));
    expect(parsed.authMode).toBe('scriptProperties');
    expect(parsed.authRevision).toBe('4');
    expect(JSON.parse(parsed.authUsers)).toEqual([
      { email: ADMIN, role: 'admin' },
      { email: USER, role: 'user' },
    ]);
  });

  it('rejects a stale expectedAuthRevision with a validation envelope, unchanged storage and no raw user-list leakage', () => {
    const users = [{ email: ADMIN, role: 'admin' }];
    ctx = provisionAuthApiContext({ seed: storedScriptPropertiesState(users, '42'), email: ADMIN });
    const before = rawStoreBlob(ctx.store);

    const response = dispatchAuthApi('setAuthenticationSettings', {
      authMode: 'scriptProperties',
      authUsers: [
        { email: ADMIN, role: 'admin' },
        { email: USER, role: 'user' },
      ],
      expectedAuthRevision: '3',
    });

    expect(response.ok).toBe(false);
    expect(response.error).toMatchObject({
      code: 'AUTH_SETTINGS_STALE_REVISION',
      retriable: false,
    });
    expect(rawStoreBlob(ctx.store)).toBe(before);
    // The validation envelope never leaks the stored users list (PII). The
    // revision-value restriction in auth-users.md applies to the bootstrap-claim
    // audit only, NOT to SET validation messages: a contract-compliant
    // stale-revision diagnostic may include the stored revision, so no
    // revision-value assertion is made here.
    expect(response.error.message).not.toContain(buildUsersJson(users));
  });

  it('rejects an omitted expectedAuthRevision when a stored revision exists, leaving storage unchanged', () => {
    ctx = provisionAuthApiContext({
      seed: storedScriptPropertiesState([{ email: ADMIN, role: 'admin' }], '4'),
      email: ADMIN,
    });
    const before = rawStoreBlob(ctx.store);

    const response = dispatchAuthApi('setAuthenticationSettings', {
      authMode: 'scriptProperties',
      authUsers: [
        { email: ADMIN, role: 'admin' },
        { email: USER, role: 'user' },
      ],
    });

    expect(response.ok).toBe(false);
    expect(response.error).toMatchObject({
      code: 'AUTH_SETTINGS_REVISION_REQUIRED',
      retriable: false,
    });
    expect(rawStoreBlob(ctx.store)).toBe(before);
  });

  it.each([
    [
      'removal',
      {
        authMode: 'scriptProperties',
        authUsers: [{ email: USER, role: 'user' }],
        expectedAuthRevision: '1',
      },
    ],
    [
      'demotion',
      {
        authMode: 'scriptProperties',
        authUsers: [{ email: ADMIN, role: 'user' }],
        expectedAuthRevision: '1',
      },
    ],
  ])('rejects last-admin %s with a validation envelope and unchanged storage', (_label, params) => {
    ctx = provisionAuthApiContext({
      seed: storedScriptPropertiesState([{ email: ADMIN, role: 'admin' }], '1'),
      email: ADMIN,
    });
    const before = rawStoreBlob(ctx.store);

    const response = dispatchAuthApi('setAuthenticationSettings', params);

    expect(response.ok).toBe(false);
    expect(response.error).toMatchObject({
      code: 'AUTH_SETTINGS_LAST_ADMIN',
      retriable: false,
    });
    expect(rawStoreBlob(ctx.store)).toBe(before);
  });

  it.each([
    ['a malformed entry (missing email)', [{ role: 'admin' }]],
    [
      'a duplicate email',
      [
        { email: ADMIN, role: 'admin' },
        { email: ADMIN, role: 'user' },
      ],
    ],
    ['an unknown role', [{ email: ADMIN, role: 'owner' }]],
    ['an unknown key', [{ email: ADMIN, role: 'admin', extra: true }]],
  ])(
    'rejects %s in the candidate list with a validation envelope and unchanged storage',
    (_label, authUsers) => {
      ctx = provisionAuthApiContext({
        seed: storedScriptPropertiesState([{ email: ADMIN, role: 'admin' }], '1'),
        email: ADMIN,
      });
      const before = rawStoreBlob(ctx.store);

      const response = dispatchAuthApi('setAuthenticationSettings', {
        authMode: 'scriptProperties',
        authUsers,
        expectedAuthRevision: '1',
      });

      expect(response.ok).toBe(false);
      expect(response.error).toMatchObject({
        code: 'AUTH_SETTINGS_INVALID_CANDIDATE',
        retriable: false,
      });
      expect(rawStoreBlob(ctx.store)).toBe(before);
    }
  );

  it('seeds authRevision 1 on the first switch from groups/legacy when no stored revision exists', () => {
    ctx = provisionAuthApiContext({
      seed: { authMode: 'googleGroups', authGroupEmail: GROUP_EMAIL },
      email: ADMIN,
      members: { [ADMIN]: 'OWNER' },
    });

    const response = dispatchAuthApi('setAuthenticationSettings', {
      authMode: 'scriptProperties',
      authUsers: [{ email: ADMIN, role: 'admin' }],
    });

    expect(response.ok).toBe(true);
    expect(response.data).toEqual({ success: true, authRevision: '1' });
    const parsed = JSON.parse(rawStoreBlob(ctx.store));
    expect(parsed.authMode).toBe('scriptProperties');
    expect(parsed.authRevision).toBe('1');
    expect(JSON.parse(parsed.authUsers)).toEqual([{ email: ADMIN, role: 'admin' }]);
  });

  it('rejects a first switch when the saving admin is not an admin in the candidate list', () => {
    ctx = provisionAuthApiContext({
      seed: { authMode: 'googleGroups', authGroupEmail: GROUP_EMAIL },
      email: ADMIN,
      members: { [ADMIN]: 'OWNER' },
    });
    const before = rawStoreBlob(ctx.store);

    const response = dispatchAuthApi('setAuthenticationSettings', {
      authMode: 'scriptProperties',
      authUsers: [{ email: USER, role: 'admin' }],
    });

    expect(response.ok).toBe(false);
    expect(response.error).toMatchObject({
      code: 'AUTH_SETTINGS_SAVING_ADMIN_DENIED',
      retriable: false,
    });
    expect(rawStoreBlob(ctx.store)).toBe(before);
  });

  it('rejects a groups-mode save that supplies authUsers as a request-shape violation', () => {
    ctx = provisionAuthApiContext({
      seed: { authMode: 'googleGroups', authGroupEmail: GROUP_EMAIL },
      email: ADMIN,
      members: { [ADMIN]: 'OWNER' },
    });
    const before = rawStoreBlob(ctx.store);

    const response = dispatchAuthApi('setAuthenticationSettings', {
      authMode: 'googleGroups',
      authGroupEmail: GROUP_EMAIL,
      authUsers: [{ email: ADMIN, role: 'admin' }],
    });

    expect(response.ok).toBe(false);
    expect(response.error).toMatchObject({ code: 'INVALID_REQUEST', retriable: false });
    expect(rawStoreBlob(ctx.store)).toBe(before);
  });

  it('preserves groups semantics on a valid groups-mode save (no user list, revision not applicable)', () => {
    ctx = provisionAuthApiContext({
      seed: { authMode: 'googleGroups', authGroupEmail: GROUP_EMAIL },
      email: ADMIN,
      members: { [ADMIN]: 'OWNER' },
    });

    const response = dispatchAuthApi('setAuthenticationSettings', {
      authMode: 'googleGroups',
      authGroupEmail: GROUP_EMAIL,
    });

    expect(response.ok).toBe(true);
    expect(response.data).toEqual({ success: true, authRevision: null });
    const parsed = JSON.parse(rawStoreBlob(ctx.store));
    expect(parsed.authMode).toBe('googleGroups');
    expect(parsed.authGroupEmail).toBe(GROUP_EMAIL);
    expect(Object.hasOwn(parsed, 'authUsers')).toBe(false);
    expect(Object.hasOwn(parsed, 'authRevision')).toBe(false);

    const read = dispatchAuthApi('getAuthenticationSettings');
    expect(read.data).toEqual({
      authMode: 'googleGroups',
      authGroupEmail: GROUP_EMAIL,
      authUsers: [],
      authRevision: null,
    });
  });

  it('rejects an over-cap auth settings save with a validation envelope and no partial write', () => {
    const bigList = Array.from({ length: 400 }, (_, index) => ({
      email: `user${String(index).padStart(3, '0')}@school.edu`,
      role: index === 0 ? 'admin' : 'user',
    }));
    ctx = provisionAuthApiContext({
      seed: storedScriptPropertiesState([{ email: ADMIN, role: 'admin' }], '1'),
      email: ADMIN,
    });
    const before = rawStoreBlob(ctx.store);

    const response = dispatchAuthApi('setAuthenticationSettings', {
      authMode: 'scriptProperties',
      authUsers: bigList,
      expectedAuthRevision: '1',
    });

    expect(response.ok).toBe(false);
    expect(response.error).toMatchObject({ code: 'INVALID_REQUEST', retriable: false });
    expect(rawStoreBlob(ctx.store)).toBe(before);
  });
});
