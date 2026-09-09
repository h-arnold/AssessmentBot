/**
 * ScriptPropertiesAuthService contract tests.
 *
 * The Script Properties provider reads the stored authUsers list fresh on every
 * request, maps stored roles to app roles (admin/user), denies callers absent
 * from the list, and never reads or writes a success cache entry. Broken stored
 * state (malformed users, zero admins, missing or invalid revision) denies with
 * an error-level audit that never includes the raw auth blob or revision value.
 *
 * All behaviour is exercised through AuthService.getInstance().checkAccess(),
 * the sole caller entrypoint. Every allow-row also asserts that the resolver
 * consulted the stored auth-user/revision surface, so the rows fail under the
 * legacy single-provider code (which never reads authUsers/authRevision) and
 * can only pass once Script Properties provider routing occurs.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  provisionAuthContext,
  buildUsersJson,
  createCacheSpy,
  flattenedLog,
} from './authServiceTestHarness.js';

const AuthService = require('../../../src/backend/Utils/AuthService.js');

/**
 * True when the resolver consulted any stored-auth read surface on the
 * ConfigurationManager mock. The legacy AuthService only reads
 * getAuthMode()/getAuthGroupEmail() and never touches the authUsers/authRevision
 * storage, so an allow-row that passes without this consultation is a false RED:
 * it would not prove Script Properties provider routing.
 * @param {Object} configManager - The mocked ConfigurationManager instance.
 * @returns {boolean} Whether stored auth state was consulted.
 */
function consultedStoredAuthState(configManager) {
  return (
    configManager.getAuthUsers.mock.calls.length > 0 ||
    configManager.getAuthRevision.mock.calls.length > 0 ||
    configManager.getProperty.mock.calls.length > 0 ||
    configManager.getAllConfigurations.mock.calls.length > 0
  );
}

describe('ScriptPropertiesAuthService contract', () => {
  let ctx;

  beforeEach(() => {
    AuthService.resetForTests();
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

  it('reads the stored user list fresh on every request (no memoisation)', () => {
    ctx = provisionAuthContext({
      config: {
        authMode: 'scriptProperties',
        authUsers: buildUsersJson([{ email: 'admin@school.edu', role: 'admin' }]),
        authRevision: '1',
      },
      email: 'teacher@school.edu',
    });
    const service = AuthService.getInstance();

    const firstResult = service.checkAccess();
    // The resolver must have read the stored list, not the legacy fail-open.
    expect(consultedStoredAuthState(ctx.configManager)).toBe(true);
    expect(firstResult.allowed).toBe(false);

    // The stored list changes between requests; the next request must observe it.
    ctx.config.authUsers = buildUsersJson([
      { email: 'admin@school.edu', role: 'admin' },
      { email: 'teacher@school.edu', role: 'user' },
    ]);

    expect(service.checkAccess()).toEqual({ allowed: true, role: 'user' });
  });

  it('maps a stored admin entry to the admin role', () => {
    ctx = provisionAuthContext({
      config: {
        authMode: 'scriptProperties',
        authUsers: buildUsersJson([{ email: 'admin@school.edu', role: 'admin' }]),
        authRevision: '1',
      },
      email: 'admin@school.edu',
    });

    const result = AuthService.getInstance().checkAccess();

    expect(consultedStoredAuthState(ctx.configManager)).toBe(true);
    expect(result).toEqual({ allowed: true, role: 'admin' });
  });

  it('maps a stored user entry to the user role', () => {
    ctx = provisionAuthContext({
      config: {
        authMode: 'scriptProperties',
        authUsers: buildUsersJson([
          { email: 'admin@school.edu', role: 'admin' },
          { email: 'user@school.edu', role: 'user' },
        ]),
        authRevision: '3',
      },
      email: 'user@school.edu',
    });

    const result = AuthService.getInstance().checkAccess();

    expect(consultedStoredAuthState(ctx.configManager)).toBe(true);
    expect(result).toEqual({ allowed: true, role: 'user' });
  });

  it('denies a caller who is not in the stored list', () => {
    ctx = provisionAuthContext({
      config: {
        authMode: 'scriptProperties',
        authUsers: buildUsersJson([{ email: 'admin@school.edu', role: 'admin' }]),
        authRevision: '1',
      },
      email: 'outsider@school.edu',
    });

    const result = AuthService.getInstance().checkAccess();

    expect(consultedStoredAuthState(ctx.configManager)).toBe(true);
    expect(result).toEqual({ allowed: false });
  });

  it('never reads or writes a success cache entry', () => {
    const cache = createCacheSpy();
    ctx = provisionAuthContext({
      config: {
        authMode: 'scriptProperties',
        authUsers: buildUsersJson([{ email: 'admin@school.edu', role: 'admin' }]),
        authRevision: '1',
      },
      email: 'admin@school.edu',
      cache,
    });

    const result = AuthService.getInstance().checkAccess();

    expect(consultedStoredAuthState(ctx.configManager)).toBe(true);
    expect(result).toEqual({ allowed: true, role: 'admin' });
    expect(cache.get).not.toHaveBeenCalled();
    expect(cache.put).not.toHaveBeenCalled();
  });

  it('denies a blank resolved email without claiming or caching', () => {
    const cache = createCacheSpy();
    ctx = provisionAuthContext({
      config: {
        authMode: 'scriptProperties',
        authUsers: buildUsersJson([{ email: 'admin@school.edu', role: 'admin' }]),
        authRevision: '1',
      },
      email: '',
      cache,
    });

    const result = AuthService.getInstance().checkAccess();

    expect(result.allowed).toBe(false);
    expect(cache.get).not.toHaveBeenCalled();
    expect(cache.put).not.toHaveBeenCalled();
    expect(ctx.configManager.writeConfigurationLocked).not.toHaveBeenCalled();
  });

  describe('broken stored state denies with an error-level audit and no secrets', () => {
    const adminList = buildUsersJson([{ email: 'admin@school.edu', role: 'admin' }]);

    it.each([
      ['malformed authUsers', { authUsers: '{not-json', authRevision: '777' }, '{not-json'],
      [
        'zero admins',
        {
          authUsers: buildUsersJson([{ email: 'user@school.edu', role: 'user' }]),
          authRevision: '777',
        },
        buildUsersJson([{ email: 'user@school.edu', role: 'user' }]),
      ],
      ['missing authRevision', { authUsers: adminList }, adminList],
      ['invalid authRevision', { authUsers: adminList, authRevision: '0' }, adminList],
    ])(
      '%s denies, audits at error level, and never logs the raw auth blob',
      (label, partialConfig, rawBlob) => {
        ctx = provisionAuthContext({
          config: { authMode: 'scriptProperties', ...partialConfig },
          email: 'admin@school.edu',
        });

        const result = AuthService.getInstance().checkAccess();

        expect(result.allowed).toBe(false);
        expect(ctx.logger.error).toHaveBeenCalled();

        const log = flattenedLog(ctx.logger);
        // The raw authUsers blob (which embeds user emails) and the revision
        // value must not leak into any logged argument or message.
        expect(log).not.toContain(rawBlob);
        expect(log).not.toContain('777');
      }
    );
  });
});
