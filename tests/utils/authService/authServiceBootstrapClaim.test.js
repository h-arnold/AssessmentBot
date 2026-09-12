/**
 * Contract tests for the fresh-install bootstrap claim.
 *
 * These tests encode the target contract (ACTION_PLAN.md §4 / SPEC.md
 * "Bootstrap claim"): the first interactive caller with a non-blank
 * server-resolved email on a genuinely fresh install atomically becomes admin
 * through the shared access-resolution path — one locked mutation that writes
 * only auth fields (`authMode: 'scriptProperties'`, the caller as sole admin,
 * `authRevision: '1'`). Existing config — however empty or malformed — never
 * bootstraps; blank-email and trigger (`neverClaim`) contexts never claim.
 *
 * Contract encoded:
 *   - Claim precondition: `isFreshInstall()` true, interactive caller
 *     (`neverClaim` false), non-blank server-resolved email (normalised to
 *     trimmed/lowercase in `checkAccess` so the stored canonical email matches
 *     later membership resolution).
 *   - One locked mutation with a freshness re-check inside the lock, reusing
 *     the Section 2 `writeConfigurationLocked` shared path; never a DB call
 *     while the non-reentrant script lock is held.
 *   - Claim writes only auth fields with the exact canonical JSON and
 *     `authRevision: '1'`; no default `authMode` is introduced and no default
 *     seeding / non-auth fields are written.
 *   - Claim failure (contention / write or cap error) denies cleanly with a
 *     safe audit (no raw auth values) and leaves the caller able to retry.
 *   - All behaviour is exercised through `AuthService.getInstance().checkAccess()`;
 *     providers are never constructed directly.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  provisionBootstrapContext,
  createBootstrapRawStore,
  CONFIG_STORE_KEY,
} from './authServiceBootstrapHarness.js';
import { buildUsersJson, flattenedLog } from './authServiceTestHarness.js';

const AuthService = require('../../../src/backend/Utils/AuthService.js');

describe('AuthService fresh-install bootstrap claim', () => {
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

  describe('claim on a genuinely fresh install', () => {
    it('atomically claims a claimable interactive caller and returns admin in the same resolution', () => {
      ctx = provisionBootstrapContext({ email: 'teacher@school.edu' });

      const result = AuthService.getInstance().checkAccess();

      // The claim must grant admin within this very resolution.
      expect(result).toEqual({ allowed: true, role: 'admin' });

      // The single locked write committed exactly the canonical auth-only blob.
      expect(ctx.scriptProperties.setProperty).toHaveBeenCalledTimes(1);
      const [writtenKey, writtenValue] = ctx.scriptProperties.setProperty.mock.calls[0];
      expect(writtenKey).toBe(CONFIG_STORE_KEY);
      expect(JSON.parse(writtenValue)).toEqual({
        authMode: 'scriptProperties',
        authUsers: buildUsersJson([{ email: 'teacher@school.edu', role: 'admin' }]),
        authRevision: '1',
      });
      // Only auth fields were written — no default seeding / non-auth fields.
      expect(Object.keys(JSON.parse(writtenValue)).sort()).toEqual([
        'authMode',
        'authRevision',
        'authUsers',
      ]);
      expect(ctx.configManager.ensureDefaultConfiguration).not.toHaveBeenCalled();
      // Freshness was consulted (claim precondition) before the claim.
      expect(ctx.configManager.isFreshInstall).toHaveBeenCalled();
      // The write was atomic: one lock acquisition/release sequence.
      expect(ctx.lockMock.waitLock).toHaveBeenCalledTimes(1);
      expect(ctx.lockMock.releaseLock).toHaveBeenCalledTimes(1);
    });
  });

  describe('existing configuration never bootstraps', () => {
    it.each([
      [
        'an empty object blob',
        createBootstrapRawStore({}),
        { allowed: false },
        {},
        'teacher@school.edu',
      ],
      [
        'a malformed blob',
        (() => {
          const store = createBootstrapRawStore();
          store[CONFIG_STORE_KEY] = '{not-json';
          return store;
        })(),
        { allowed: false },
        {},
        'teacher@school.edu',
      ],
      [
        'a legacy groups configuration',
        createBootstrapRawStore({ authGroupEmail: 'teachers@school.edu' }),
        { allowed: true, role: 'user' },
        { 'teacher@school.edu': 'MEMBER' },
        'teacher@school.edu',
      ],
      [
        'a valid configured googleGroups state',
        createBootstrapRawStore({
          authMode: 'googleGroups',
          authGroupEmail: 'teachers@school.edu',
        }),
        { allowed: true, role: 'user' },
        { 'teacher@school.edu': 'MEMBER' },
        'teacher@school.edu',
      ],
      [
        'a valid configured scriptProperties state',
        createBootstrapRawStore({
          authMode: 'scriptProperties',
          authUsers: buildUsersJson([{ email: 'admin@school.edu', role: 'admin' }]),
          authRevision: '1',
        }),
        { allowed: true, role: 'admin' },
        {},
        'admin@school.edu',
      ],
      [
        'a broken auth state',
        createBootstrapRawStore({ authMode: 'none', authGroupEmail: 'teachers@school.edu' }),
        { allowed: false },
        {},
        'teacher@school.edu',
      ],
    ])(
      '%s never bootstraps: existing config is unchanged and resolution follows the state machine',
      (label, store, expectedResult, members, email) => {
        ctx = provisionBootstrapContext({ store, members, email });

        const result = AuthService.getInstance().checkAccess();

        expect(result).toEqual(expectedResult);
        // No claim/write of any kind.
        expect(ctx.scriptProperties.setProperty).not.toHaveBeenCalled();
        expect(ctx.configManager.writeConfigurationLocked).not.toHaveBeenCalled();
        // The existing blob is byte-for-byte unchanged.
        expect(ctx.store[CONFIG_STORE_KEY]).toBe(store[CONFIG_STORE_KEY]);
      }
    );
  });

  describe('non-claimable callers on a fresh install', () => {
    it('denies a blank resolved email without claiming or writing', () => {
      ctx = provisionBootstrapContext({ email: '' });

      const result = AuthService.getInstance().checkAccess();

      expect(result.allowed).toBe(false);
      expect(ctx.scriptProperties.setProperty).not.toHaveBeenCalled();
      expect(ctx.configManager.writeConfigurationLocked).not.toHaveBeenCalled();
      expect(ctx.store[CONFIG_STORE_KEY]).toBeUndefined();
    });

    it('denies a trigger (neverClaim) context without claiming even on a fresh install', () => {
      ctx = provisionBootstrapContext({ email: 'teacher@school.edu' });

      const result = AuthService.getInstance().checkAccess({ neverClaim: true });

      expect(result.allowed).toBe(false);
      expect(ctx.scriptProperties.setProperty).not.toHaveBeenCalled();
      expect(ctx.configManager.writeConfigurationLocked).not.toHaveBeenCalled();
      expect(ctx.store[CONFIG_STORE_KEY]).toBeUndefined();
    });
  });

  describe('first-claim sequencing on a shared fresh store', () => {
    it('lets the first claimable caller claim and denies a subsequent caller on the same store', () => {
      ctx = provisionBootstrapContext({ email: 'admin@school.edu' });

      const firstResult = AuthService.getInstance().checkAccess();

      // Simulate a second, different caller resolving sequentially after the
      // first claim: the Session identity changes between the two requests.
      // (True parallel lock contention is modelled separately by the in-lock
      // freshness re-check test, which forces the implementation to re-probe
      // storage inside the script lock.)
      ctx.session.getActiveUser = () => ({ getEmail: () => 'outsider@school.edu' });
      const secondResult = AuthService.getInstance().checkAccess();

      // Exactly one caller became admin.
      expect(firstResult).toEqual({ allowed: true, role: 'admin' });
      // The second caller re-reads the now-present config: scriptProperties mode
      // listing only the first caller as admin → denied under the state machine.
      expect(secondResult).toEqual({ allowed: false });

      // Exactly one atomic claim write under one lock acquisition.
      expect(ctx.scriptProperties.setProperty).toHaveBeenCalledTimes(1);
      expect(ctx.lockMock.waitLock).toHaveBeenCalledTimes(1);
      expect(ctx.lockMock.releaseLock).toHaveBeenCalledTimes(1);
      const parsed = JSON.parse(ctx.store[CONFIG_STORE_KEY]);
      expect(JSON.parse(parsed.authUsers)).toEqual([{ email: 'admin@school.edu', role: 'admin' }]);
      // No duplicate/overwriting claim: the second resolution did not rewrite.
      expect(parsed.authRevision).toBe('1');
    });
  });

  describe('identity normalisation', () => {
    it('claims a mixed-case/whitespace identity as a canonical email that authenticates on later requests', () => {
      ctx = provisionBootstrapContext({ email: '  Teacher@School.edu ' });

      const firstResult = AuthService.getInstance().checkAccess();

      expect(firstResult).toEqual({ allowed: true, role: 'admin' });
      // The stored canonical email is trimmed and lowercased.
      const parsed = JSON.parse(ctx.store[CONFIG_STORE_KEY]);
      expect(JSON.parse(parsed.authUsers)).toEqual([
        { email: 'teacher@school.edu', role: 'admin' },
      ]);

      // The same caller's later resolution authenticates against the canonical
      // stored value: the raw mixed-case/whitespace Session identity is
      // normalised once in checkAccess before provider resolution, so it
      // matches the stored admin entry.
      const laterResult = AuthService.getInstance().checkAccess();
      expect(laterResult).toEqual({ allowed: true, role: 'admin' });
    });
  });

  describe('in-lock freshness re-check', () => {
    it('aborts the claim inside the locked write when a blob appears after the lock is entered', () => {
      ctx = provisionBootstrapContext({ email: 'teacher@school.edu' });

      // A competing writer commits a blob only AFTER the claim has entered the
      // shared locked write: the pre-lock probes (checkAccess and the claim's
      // pre-write re-check) stay fresh, and the in-lock probe — the third
      // `isFreshInstall()` evaluation, which runs inside the
      // `writeConfigurationLocked` mutator — observes the blob and must abort
      // the claim without overwriting it.
      const competingBlob = JSON.stringify({
        authMode: 'googleGroups',
        authGroupEmail: 'teachers@school.edu',
      });
      let probeCount = 0;
      ctx.configManager.isFreshInstall.mockImplementation(() => {
        probeCount += 1;
        if (probeCount >= 3 && ctx.store[CONFIG_STORE_KEY] == null) {
          ctx.store[CONFIG_STORE_KEY] = competingBlob;
        }
        return ctx.store[CONFIG_STORE_KEY] == null;
      });

      const result = AuthService.getInstance().checkAccess();

      expect(result.allowed).toBe(false);
      // The claim entered the locked write path exactly once (single lock
      // acquisition), proving the authoritative in-lock guard was exercised.
      expect(ctx.configManager.writeConfigurationLocked).toHaveBeenCalledTimes(1);
      expect(ctx.lockMock.waitLock).toHaveBeenCalledTimes(1);
      expect(ctx.lockMock.releaseLock).toHaveBeenCalledTimes(1);
      // Freshness was re-evaluated inside the lock (pre-lock + pre-write + in-lock).
      expect(ctx.configManager.isFreshInstall.mock.calls.length).toBeGreaterThanOrEqual(3);
      // The mutator aborted: no storage write at all, and the competing blob is
      // preserved byte-for-byte.
      expect(ctx.scriptProperties.setProperty).not.toHaveBeenCalled();
      expect(ctx.store[CONFIG_STORE_KEY]).toBe(competingBlob);
    });

    it('skips the claim before the locked write when a blob appears between the pre-lock probes', () => {
      ctx = provisionBootstrapContext({ email: 'teacher@school.edu' });

      // A competing writer commits a blob immediately after the checkAccess
      // pre-lock probe (modelled by seeding on the second evaluation, which is
      // the claim's pre-write freshness re-check). The claim must abort before
      // entering the locked write — no writeConfigurationLocked invocation.
      const competingBlob = JSON.stringify({
        authMode: 'googleGroups',
        authGroupEmail: 'teachers@school.edu',
      });
      let probeCount = 0;
      ctx.configManager.isFreshInstall.mockImplementation(() => {
        probeCount += 1;
        if (probeCount >= 2 && ctx.store[CONFIG_STORE_KEY] == null) {
          ctx.store[CONFIG_STORE_KEY] = competingBlob;
        }
        return ctx.store[CONFIG_STORE_KEY] == null;
      });

      const result = AuthService.getInstance().checkAccess();

      expect(result.allowed).toBe(false);
      // Freshness was consulted again before the write (pre-lock + pre-write).
      expect(ctx.configManager.isFreshInstall.mock.calls.length).toBeGreaterThanOrEqual(2);
      // The claim was skipped: the locked write was never entered and no write
      // occurred; the competing blob is preserved.
      expect(ctx.configManager.writeConfigurationLocked).not.toHaveBeenCalled();
      expect(ctx.scriptProperties.setProperty).not.toHaveBeenCalled();
      expect(ctx.store[CONFIG_STORE_KEY]).toBe(competingBlob);
    });
  });

  describe('claim failure denies cleanly and allows a retry', () => {
    it('denies on lock contention with a safe audit, no partial state, and a later request retries', () => {
      ctx = provisionBootstrapContext({ email: 'teacher@school.edu' });

      const contention = new Error('Script lock could not be acquired within the timeout.');
      contention.code = 'CONFIG_LOCK_CONTENTION';
      contention.retriable = true;
      ctx.configManager.writeConfigurationLocked.mockImplementation(() => {
        throw contention;
      });

      const failed = AuthService.getInstance().checkAccess();

      expect(failed.allowed).toBe(false);
      // No partial auth state was persisted.
      expect(ctx.store[CONFIG_STORE_KEY]).toBeUndefined();
      // The failure is audited (warn/error), without leaking raw auth values.
      const failureAudit = flattenedLog(ctx.logger);
      expect(
        ctx.logger.warn.mock.calls.length + ctx.logger.error.mock.calls.length
      ).toBeGreaterThan(0);
      // The audit may name the auth field, but it must never echo the raw auth
      // values the claim would have written: the serialised admin list and the
      // raw revision value (`authRevision: '1'`).
      expect(failureAudit).not.toContain(
        buildUsersJson([{ email: 'teacher@school.edu', role: 'admin' }])
      );
      expect(failureAudit).not.toContain(JSON.stringify({ authRevision: '1' }));

      // A later request may retry the claim now the contention has cleared.
      ctx.configManager.writeConfigurationLocked.mockImplementation(
        ctx.defaultWriteConfigurationLocked
      );
      const retried = AuthService.getInstance().checkAccess();

      expect(retried).toEqual({ allowed: true, role: 'admin' });
      expect(ctx.scriptProperties.setProperty).toHaveBeenCalledTimes(1);
    });

    it('denies on a write/cap error with a safe audit and no partial auth state', () => {
      ctx = provisionBootstrapContext({ email: 'teacher@school.edu' });

      const capError = new Error('Configuration blob exceeds the 8KB cap and was not written.');
      capError.code = 'CONFIG_BLOB_TOO_LARGE';
      capError.retriable = false;
      ctx.configManager.writeConfigurationLocked.mockImplementation(() => {
        throw capError;
      });

      const result = AuthService.getInstance().checkAccess();

      expect(result.allowed).toBe(false);
      expect(ctx.store[CONFIG_STORE_KEY]).toBeUndefined();
      const failureAudit = flattenedLog(ctx.logger);
      expect(
        ctx.logger.warn.mock.calls.length + ctx.logger.error.mock.calls.length
      ).toBeGreaterThan(0);
      // The audit may name the auth field, but it must never echo the raw auth
      // values the claim would have written: the serialised admin list and the
      // raw revision value (`authRevision: '1'`).
      expect(failureAudit).not.toContain(
        buildUsersJson([{ email: 'teacher@school.edu', role: 'admin' }])
      );
      expect(failureAudit).not.toContain(JSON.stringify({ authRevision: '1' }));
    });

    it('preserves the original thrown error as developer-only logging context', () => {
      ctx = provisionBootstrapContext({ email: 'teacher@school.edu' });

      const persistenceError = new Error('Script Properties write rejected.');
      persistenceError.code = 'CONFIG_WRITE_FAILED';
      ctx.configManager.writeConfigurationLocked.mockImplementation(() => {
        throw persistenceError;
      });

      const result = AuthService.getInstance().checkAccess();

      expect(result.allowed).toBe(false);
      const failureCall = ctx.logger.warn.mock.calls.find((args) =>
        JSON.stringify(args).includes('bootstrap claim failed')
      );
      expect(failureCall).toBeDefined();
      // The raw error is retained as developer-only context (never in the envelope).
      expect(failureCall[1]).toMatchObject({
        code: 'CONFIG_WRITE_FAILED',
        err: persistenceError,
      });
    });
  });

  describe('default seeding is skipped after a successful claim', () => {
    it('writes only auth fields and non-auth getters fall back to DEFAULTS', () => {
      ctx = provisionBootstrapContext({ email: 'teacher@school.edu' });

      const result = AuthService.getInstance().checkAccess();

      expect(result).toEqual({ allowed: true, role: 'admin' });
      // Default configuration seeding is never triggered by the claim.
      expect(ctx.configManager.ensureDefaultConfiguration).not.toHaveBeenCalled();
      // The persisted blob carries only auth fields; non-auth keys are absent.
      const parsed = JSON.parse(ctx.store[CONFIG_STORE_KEY]);
      expect(Object.hasOwn(parsed, 'authMode')).toBe(true);
      expect(Object.hasOwn(parsed, 'apiKey')).toBe(false);
      expect(Object.hasOwn(parsed, 'backendUrl')).toBe(false);
      // Non-auth getters continue to use the DEFAULTS fallback.
      expect(ctx.configManager.getProperty('apiKey')).toBe('');
    });
  });
});
