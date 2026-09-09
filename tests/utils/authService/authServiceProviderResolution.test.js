/**
 * Provider-resolution contract tests for the refactored AuthService base.
 *
 * Encodes the state-machine rows from SPEC.md (Application Authentication):
 * fresh install, legacy groups (with the single leniency), configured
 * googleGroups, configured scriptProperties, every broken-config row, and the
 * removed-bypass regression guards. Access decisions are driven through
 * AuthService.getInstance().checkAccess() — the sole caller entrypoint — with a
 * ConfigurationManager mock that mirrors the forgiving getter contract.
 *
 * checkAccess options contract encoded here and in
 * authServiceTriggerContext.test.js:
 *   { bypassCache?: boolean, neverClaim?: boolean, method?: string }
 * The removed `requireConfigured` option must not appear anywhere.
 *
 * Fresh-install rows assert resolver classification/deny/no-provider behaviour
 * only; the Section 4 bootstrap claim (atomic write of the caller as sole
 * admin) is deliberately not expected or asserted here.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { provisionAuthContext, buildUsersJson, createCacheSpy } from './authServiceTestHarness.js';

const AuthService = require('../../../src/backend/Utils/AuthService.js');

describe('AuthService provider resolution', () => {
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

  describe('fresh install', () => {
    it('denies a claimable interactive caller without resolving a provider or claiming', () => {
      ctx = provisionAuthContext({ config: {}, fresh: true });

      const result = AuthService.getInstance().checkAccess();

      expect(result.allowed).toBe(false);
      // No provider is consulted for a genuinely fresh install.
      expect(ctx.groupsApp.getGroupByEmail).not.toHaveBeenCalled();
      // No bootstrap claim write — the Section 4 claim is not in scope here.
      expect(ctx.configManager.writeConfigurationLocked).not.toHaveBeenCalled();
      expect(ctx.configManager.setProperty).not.toHaveBeenCalled();
      // A fresh install is classified, not a broken-config deny: no error audit.
      expect(ctx.logger.error).not.toHaveBeenCalled();
    });

    it('denies a fresh-install trigger context without claiming', () => {
      ctx = provisionAuthContext({ config: {}, fresh: true });

      const result = AuthService.getInstance().checkAccess({
        bypassCache: true,
        neverClaim: true,
      });

      expect(result.allowed).toBe(false);
      expect(ctx.configManager.writeConfigurationLocked).not.toHaveBeenCalled();
    });
  });

  describe('legacy groups leniency', () => {
    it('reads an absent authMode with a non-blank group as googleGroups and allows a member', () => {
      ctx = provisionAuthContext({
        config: { authGroupEmail: 'teachers@school.edu' },
        members: { 'teacher@school.edu': 'MEMBER' },
      });

      expect(AuthService.getInstance().checkAccess()).toEqual({ allowed: true, role: 'user' });
    });

    it('reads a blank authMode with a non-blank group as googleGroups and maps OWNER to admin', () => {
      ctx = provisionAuthContext({
        config: { authMode: '', authGroupEmail: 'teachers@school.edu' },
        members: { 'teacher@school.edu': 'OWNER' },
      });

      expect(AuthService.getInstance().checkAccess()).toEqual({ allowed: true, role: 'admin' });
    });

    it('is the only lenient fallback: an existing blob without a mode or group denies', () => {
      ctx = provisionAuthContext({ config: {} });

      const result = AuthService.getInstance().checkAccess();

      expect(result.allowed).toBe(false);
      expect(ctx.logger.error).toHaveBeenCalled();
    });
  });

  describe('configured providers', () => {
    it('resolves googleGroups mode to the Google Groups provider', () => {
      ctx = provisionAuthContext({
        config: { authMode: 'googleGroups', authGroupEmail: 'teachers@school.edu' },
        members: { 'teacher@school.edu': 'MEMBER' },
      });

      expect(AuthService.getInstance().checkAccess()).toEqual({ allowed: true, role: 'user' });
    });

    it('resolves scriptProperties mode to the Script Properties provider and maps an admin entry', () => {
      ctx = provisionAuthContext({
        config: {
          authMode: 'scriptProperties',
          authUsers: buildUsersJson([{ email: 'admin@school.edu', role: 'admin' }]),
          authRevision: '1',
        },
        email: 'admin@school.edu',
      });

      expect(AuthService.getInstance().checkAccess()).toEqual({ allowed: true, role: 'admin' });
    });

    it('resolves scriptProperties mode to a user role for a listed non-admin', () => {
      ctx = provisionAuthContext({
        config: {
          authMode: 'scriptProperties',
          authUsers: buildUsersJson([
            { email: 'admin@school.edu', role: 'admin' },
            { email: 'user@school.edu', role: 'user' },
          ]),
          authRevision: '2',
        },
        email: 'user@school.edu',
      });

      expect(AuthService.getInstance().checkAccess()).toEqual({ allowed: true, role: 'user' });
    });

    it('denies a scriptProperties caller absent from the stored list', () => {
      ctx = provisionAuthContext({
        config: {
          authMode: 'scriptProperties',
          authUsers: buildUsersJson([{ email: 'admin@school.edu', role: 'admin' }]),
          authRevision: '1',
        },
        email: 'outsider@school.edu',
      });

      expect(AuthService.getInstance().checkAccess()).toEqual({ allowed: false });
    });
  });

  describe('broken configuration rows', () => {
    const storedNoneWithGroup = [
      'stored none mode with a group present',
      { authMode: 'none', authGroupEmail: 'teachers@school.edu' },
    ];
    const storedNoneNoGroup = ['stored none mode without a group', { authMode: 'none' }];
    const unrecognisedWithGroup = [
      'unrecognised mode with a group present',
      { authMode: 'bogus', authGroupEmail: 'teachers@school.edu' },
    ];
    const absentModeNoGroup = ['absent mode without a group', {}];
    const blankModeNoGroup = ['blank mode without a group', { authMode: '' }];
    const blankGroup = [
      'googleGroups mode with a blank group',
      { authMode: 'googleGroups', authGroupEmail: '  ' },
    ];
    const missingUsers = [
      'scriptProperties mode with missing users',
      { authMode: 'scriptProperties', authRevision: '1' },
    ];
    const malformedUsers = [
      'scriptProperties mode with malformed users',
      { authMode: 'scriptProperties', authUsers: '{broken', authRevision: '1' },
    ];
    const zeroAdmins = [
      'scriptProperties mode with zero admins',
      {
        authMode: 'scriptProperties',
        authUsers: buildUsersJson([{ email: 'user@school.edu', role: 'user' }]),
        authRevision: '1',
      },
    ];
    const missingRevision = [
      'scriptProperties mode with a missing revision',
      {
        authMode: 'scriptProperties',
        authUsers: buildUsersJson([{ email: 'admin@school.edu', role: 'admin' }]),
      },
    ];
    const invalidRevision = [
      'scriptProperties mode with an invalid revision',
      {
        authMode: 'scriptProperties',
        authUsers: buildUsersJson([{ email: 'admin@school.edu', role: 'admin' }]),
        authRevision: '0',
      },
    ];

    it.each([
      storedNoneWithGroup,
      storedNoneNoGroup,
      unrecognisedWithGroup,
      absentModeNoGroup,
      blankModeNoGroup,
      blankGroup,
      missingUsers,
      malformedUsers,
      zeroAdmins,
      missingRevision,
      invalidRevision,
    ])('%s denies access and audits at error level', (label, config) => {
      // The caller is a group member, so any accidental fallback to Google
      // Groups would wrongly allow the request.
      ctx = provisionAuthContext({ config, members: { 'teacher@school.edu': 'MEMBER' } });

      const result = AuthService.getInstance().checkAccess();

      expect(result.allowed).toBe(false);
      expect(ctx.logger.error).toHaveBeenCalled();
    });
  });

  describe('blank resolved session email', () => {
    it('denies and never claims on a fresh install', () => {
      ctx = provisionAuthContext({ config: {}, fresh: true, email: '' });

      const result = AuthService.getInstance().checkAccess();

      expect(result.allowed).toBe(false);
      expect(ctx.configManager.writeConfigurationLocked).not.toHaveBeenCalled();
      expect(ctx.configManager.setProperty).not.toHaveBeenCalled();
    });

    it('denies in googleGroups mode without reading or writing the cache', () => {
      const cache = createCacheSpy();
      ctx = provisionAuthContext({
        config: { authMode: 'googleGroups', authGroupEmail: 'teachers@school.edu' },
        members: { 'teacher@school.edu': 'MEMBER' },
        email: '',
        cache,
      });

      const result = AuthService.getInstance().checkAccess();

      expect(result.allowed).toBe(false);
      expect(cache.get).not.toHaveBeenCalled();
      expect(cache.put).not.toHaveBeenCalled();
    });

    it('denies in scriptProperties mode without consulting the provider', () => {
      ctx = provisionAuthContext({
        config: {
          authMode: 'scriptProperties',
          authUsers: buildUsersJson([{ email: 'admin@school.edu', role: 'admin' }]),
          authRevision: '1',
        },
        email: '',
      });

      const result = AuthService.getInstance().checkAccess();

      expect(result.allowed).toBe(false);
      expect(ctx.configManager.writeConfigurationLocked).not.toHaveBeenCalled();
    });
  });

  describe('removed auth-mode bypass regression guard', () => {
    it('denies a stored none mode even when a Google Group exists and the caller is a member', () => {
      ctx = provisionAuthContext({
        config: { authMode: 'none', authGroupEmail: 'teachers@school.edu' },
        members: { 'teacher@school.edu': 'MEMBER' },
      });

      const result = AuthService.getInstance().checkAccess();

      // The removed bypass must never resurrect the old allowed-user behaviour.
      expect(result.allowed).toBe(false);
      expect(ctx.logger.error).toHaveBeenCalled();
    });

    it('denies an unrecognised mode without falling back to Google Groups', () => {
      ctx = provisionAuthContext({
        config: { authMode: 'unrecognised', authGroupEmail: 'teachers@school.edu' },
        members: { 'teacher@school.edu': 'OWNER' },
      });

      const result = AuthService.getInstance().checkAccess();

      expect(result.allowed).toBe(false);
      expect(ctx.logger.error).toHaveBeenCalled();
    });
  });
});
