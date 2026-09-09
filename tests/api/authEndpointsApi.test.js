/**
 * Contract tests for the auth endpoints (`getApplicationAccess`,
 * `getAuthenticationSettings`, `setAuthenticationSettings`) registered in
 * `ALLOWLISTED_METHOD_HANDLERS` (ACTION_PLAN §5 / `auth-users.md` transport
 * block). The endpoints are exercised through the real `ApiDispatcher` against
 * the real `AuthService` singleton with store-backed runtime mocks, so the tests
 * fail at the current RED phase because the endpoints are not yet registered
 * (dispatch returns `UNKNOWN_METHOD`) and will pass once `z_Api/apiAuth.js` and
 * the dispatcher gate wiring land.
 *
 * Contract encoded:
 *   - `getApplicationAccess` is gate-exempt, routes through the shared
 *     access-resolution path (performing the bootstrap claim), and returns the
 *     exact `auth-users.md` shape for `ok` post-claim, `freshInstall` for a
 *     non-claimable caller, `brokenConfig`, and `denied` — with no `provider`
 *     field and no `'unconfigured'` reason.
 *   - `getAuthenticationSettings` is admin-only and returns fresh settings data
 *     (`authMode`, `authGroupEmail`, parsed `authUsers` where applicable,
 *     `authRevision` per mode) with no secrets/provider leakage.
 *   - `setAuthenticationSettings` commits atomically or not at all: one locked
 *     write, revision increment, exact persisted fields, `{ success: true,
 *     authRevision }` on success, and a validation failure envelope with
 *     unchanged storage on stale revision, last-admin removal/demotion, invalid
 *     candidate lists, failed candidate-provider checks, groups-mode
 *     request-shape violations, and quota-cap excess.
 *   - First switch groups/legacy → scriptProperties seeds `authRevision: '1'`
 *     without requiring `expectedAuthRevision`; the saving admin must pass the
 *     candidate-provider check.
 *   - Error envelopes use the existing standard `ApiValidationError` /
 *     `INVALID_REQUEST` convention; no raw stored authUsers list (PII) leaks in
 *     a validation message. A contract-compliant SET stale-revision diagnostic
 *     MAY reference the stored revision (auth-users.md restricts revision-value
 *     leakage to the bootstrap-claim audit only), so no revision-value assertion
 *     is encoded here.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadApiHandlerModule } from '../helpers/apiHandlerTestUtils.js';
import { provisionAuthApiContext, rawStoreBlob } from './authApiTestHarness.js';
import { buildUsersJson } from '../utils/authService/authServiceTestHarness.js';
import { CONFIG_STORE_KEY } from '../utils/authService/authServiceBootstrapHarness.js';

const AuthService = require('../../src/backend/Utils/AuthService.js');

const ADMIN = 'admin@school.edu';
const USER = 'user@school.edu';
const OUTSIDER = 'outsider@school.edu';
const GROUP_EMAIL = 'teachers@school.edu';

/**
 * Builds a stored scriptProperties auth state.
 * @param {Array<{email: string, role: string}>} users - The stored user list.
 * @param {string} revision - The stored auth revision.
 * @param {Object} [extra={}] - Extra stored fields (e.g. authGroupEmail).
 * @returns {Object} The stored config object.
 */
function scriptPropertiesState(users, revision, extra = {}) {
  return {
    authMode: 'scriptProperties',
    authUsers: buildUsersJson(users),
    authRevision: revision,
    ...extra,
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

describe('Auth endpoints — getApplicationAccess transport', () => {
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

  it('returns reason ok with the claimed admin role when a claimable caller invokes it on a fresh install', () => {
    ctx = provisionAuthApiContext({ email: 'teacher@school.edu' });

    const response = dispatch('getApplicationAccess');

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

    const response = dispatch('getApplicationAccess');

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

    const response = dispatch('getApplicationAccess');

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
      seed: scriptPropertiesState([{ email: ADMIN, role: 'admin' }], '1'),
      email: OUTSIDER,
    });

    const response = dispatch('getApplicationAccess');

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

  it('returns the scriptProperties settings shape with parsed users and the revision for an admin', () => {
    ctx = provisionAuthApiContext({
      seed: scriptPropertiesState(
        [
          { email: ADMIN, role: 'admin' },
          { email: USER, role: 'user' },
        ],
        '7',
        { authGroupEmail: GROUP_EMAIL }
      ),
      email: ADMIN,
    });

    const response = dispatch('getAuthenticationSettings');

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

    const response = dispatch('getAuthenticationSettings');

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

  it('commits a valid scriptProperties save atomically with one locked write and returns the incremented revision', () => {
    ctx = provisionAuthApiContext({
      seed: scriptPropertiesState([{ email: ADMIN, role: 'admin' }], '3'),
      email: ADMIN,
    });

    const response = dispatch('setAuthenticationSettings', {
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
    ctx = provisionAuthApiContext({ seed: scriptPropertiesState(users, '42'), email: ADMIN });
    const before = rawStoreBlob(ctx.store);

    const response = dispatch('setAuthenticationSettings', {
      authMode: 'scriptProperties',
      authUsers: [
        { email: ADMIN, role: 'admin' },
        { email: USER, role: 'user' },
      ],
      expectedAuthRevision: '3',
    });

    expect(response.ok).toBe(false);
    expect(response.error).toMatchObject({ code: 'INVALID_REQUEST', retriable: false });
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
      seed: scriptPropertiesState([{ email: ADMIN, role: 'admin' }], '4'),
      email: ADMIN,
    });
    const before = rawStoreBlob(ctx.store);

    const response = dispatch('setAuthenticationSettings', {
      authMode: 'scriptProperties',
      authUsers: [
        { email: ADMIN, role: 'admin' },
        { email: USER, role: 'user' },
      ],
    });

    expect(response.ok).toBe(false);
    expect(response.error).toMatchObject({ code: 'INVALID_REQUEST', retriable: false });
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
      seed: scriptPropertiesState([{ email: ADMIN, role: 'admin' }], '1'),
      email: ADMIN,
    });
    const before = rawStoreBlob(ctx.store);

    const response = dispatch('setAuthenticationSettings', params);

    expect(response.ok).toBe(false);
    expect(response.error).toMatchObject({ code: 'INVALID_REQUEST', retriable: false });
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
    ['zero admins', [{ email: USER, role: 'user' }]],
  ])(
    'rejects %s in the candidate list with a validation envelope and unchanged storage',
    (_label, authUsers) => {
      ctx = provisionAuthApiContext({
        seed: scriptPropertiesState([{ email: ADMIN, role: 'admin' }], '1'),
        email: ADMIN,
      });
      const before = rawStoreBlob(ctx.store);

      const response = dispatch('setAuthenticationSettings', {
        authMode: 'scriptProperties',
        authUsers,
        expectedAuthRevision: '1',
      });

      expect(response.ok).toBe(false);
      expect(response.error).toMatchObject({ code: 'INVALID_REQUEST', retriable: false });
      expect(rawStoreBlob(ctx.store)).toBe(before);
    }
  );

  it('seeds authRevision 1 on the first switch from groups/legacy when no stored revision exists', () => {
    ctx = provisionAuthApiContext({
      seed: { authMode: 'googleGroups', authGroupEmail: GROUP_EMAIL },
      email: ADMIN,
      members: { [ADMIN]: 'OWNER' },
    });

    const response = dispatch('setAuthenticationSettings', {
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

    const response = dispatch('setAuthenticationSettings', {
      authMode: 'scriptProperties',
      authUsers: [{ email: USER, role: 'admin' }],
    });

    expect(response.ok).toBe(false);
    expect(response.error).toMatchObject({ code: 'INVALID_REQUEST', retriable: false });
    expect(rawStoreBlob(ctx.store)).toBe(before);
  });

  it('rejects a groups-mode save that supplies authUsers as a request-shape violation', () => {
    ctx = provisionAuthApiContext({
      seed: { authMode: 'googleGroups', authGroupEmail: GROUP_EMAIL },
      email: ADMIN,
      members: { [ADMIN]: 'OWNER' },
    });
    const before = rawStoreBlob(ctx.store);

    const response = dispatch('setAuthenticationSettings', {
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

    const response = dispatch('setAuthenticationSettings', {
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

    const read = dispatch('getAuthenticationSettings');
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
      seed: scriptPropertiesState([{ email: ADMIN, role: 'admin' }], '1'),
      email: ADMIN,
    });
    const before = rawStoreBlob(ctx.store);

    const response = dispatch('setAuthenticationSettings', {
      authMode: 'scriptProperties',
      authUsers: bigList,
      expectedAuthRevision: '1',
    });

    expect(response.ok).toBe(false);
    expect(response.error).toMatchObject({ code: 'INVALID_REQUEST', retriable: false });
    expect(rawStoreBlob(ctx.store)).toBe(before);
  });
});
