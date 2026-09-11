/**
 * Focused regression tests for the locked-write review findings (pre-PR review,
 * backend authentication remediation batch):
 *
 *   1. The in-memory cache must be REPLACED by the post-lock `next` result, not
 *      merged into stale cache state. Merging (`{ ...configCache, ...next }`)
 *      resurrects keys that were deleted by a concurrent mutation.
 *   2. Lock-acquisition contention must retain the original `waitLock` error as
 *      the typed `CONFIG_LOCK_CONTENTION` error's `cause`, so developer
 *      diagnostics are not discarded.
 *
 * Both encode the target contract for `97_ConfigurationManagerLockedWrite.js`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createConfiguredConfigurationManager } from '../helpers/backendConfigTestHelpers.js';

const ConfigurationManager = require('../../src/backend/ConfigurationManager/98_ConfigurationManagerClass.js');

const CONFIG_STORE_KEY = ConfigurationManager.CONFIG_STORE_KEY || '__CONFIG_STORE_KEY__';

describe('ConfigurationManager locked write — cache replacement and contention cause', () => {
  let mocks;
  let configManager;
  let originalLockService;
  let scriptLockFactory;
  let lockMock;

  beforeEach(() => {
    vi.clearAllMocks();
    ({ mocks, configManager } = createConfiguredConfigurationManager(vi, ConfigurationManager));

    lockMock = {
      waitLock: vi.fn(() => {}),
      releaseLock: vi.fn(() => {}),
    };
    scriptLockFactory = vi.fn(() => lockMock);
    originalLockService = globalThis.LockService;
    globalThis.LockService = { ...originalLockService, getScriptLock: scriptLockFactory };
  });

  afterEach(() => {
    globalThis.LockService = originalLockService;
    ConfigurationManager.resetForTests();
  });

  /** Builds an in-memory backing store for the serialised config blob. */
  function installInMemoryStore(initialConfig) {
    const store = {};
    if (initialConfig !== undefined) {
      store[CONFIG_STORE_KEY] = JSON.stringify(initialConfig);
    }
    mocks.PropertiesService.scriptProperties.getProperty.mockImplementation((key) =>
      Object.hasOwn(store, key) ? store[key] : null
    );
    mocks.PropertiesService.scriptProperties.setProperty.mockImplementation((key, value) => {
      store[key] = value;
    });
    return store;
  }

  describe('cache replacement — deleted keys do not survive the locked write', () => {
    it('replaces the cache with the locked-write result instead of merging stale keys', () => {
      const apiKeyKey = ConfigurationManager.CONFIG_KEYS.API_KEY;
      const logLevelKey = ConfigurationManager.CONFIG_KEYS.JSON_DB_LOG_LEVEL;
      const store = installInMemoryStore({
        [apiKeyKey]: 'original',
        [logLevelKey]: 'INFO',
      });

      // Prime the cache with both keys so a merge would resurrect the deleted key.
      configManager.getAllConfigurations();
      expect(configManager.configCache).toEqual({
        [apiKeyKey]: 'original',
        [logLevelKey]: 'INFO',
      });

      configManager.writeConfigurationLocked((current) => {
        const next = { ...current };
        delete next[logLevelKey];
        return next;
      });

      expect(JSON.parse(store[CONFIG_STORE_KEY])).toEqual({ [apiKeyKey]: 'original' });
      // The in-memory cache must mirror the locked-write result exactly.
      expect(configManager.configCache).toEqual({ [apiKeyKey]: 'original' });
    });

    it('does not resurrect a key deleted by a concurrent writer', () => {
      const apiKeyKey = ConfigurationManager.CONFIG_KEYS.API_KEY;
      const logLevelKey = ConfigurationManager.CONFIG_KEYS.JSON_DB_LOG_LEVEL;
      const store = installInMemoryStore({
        [apiKeyKey]: 'abt_7pC98PCoGJOcjN-qz6rNlSzKkgySJF-2',
        [logLevelKey]: 'INFO',
      });

      // Prime the stale cache before the concurrent writer commits.
      configManager.getAllConfigurations();

      // A concurrent writer deletes the API key after our cache was primed but
      // before our writer acquires the lock; the locked re-read observes the
      // deletion and the local setter never touches that key.
      lockMock.waitLock.mockImplementation(() => {
        store[CONFIG_STORE_KEY] = JSON.stringify({ [logLevelKey]: 'INFO' });
      });

      configManager.setJsonDbLogLevel('warn');

      expect(JSON.parse(store[CONFIG_STORE_KEY])).toEqual({ [logLevelKey]: 'WARN' });
      expect(configManager.configCache).toEqual({ [logLevelKey]: 'WARN' });
      expect(configManager.configCache).not.toHaveProperty(apiKeyKey);
    });
  });

  describe('contention — the original lock error is retained as the error cause', () => {
    it('exposes the original waitLock error as the CONFIG_LOCK_CONTENTION cause', () => {
      installInMemoryStore({ apiKey: 'original' });
      const lockError = new Error('Script lock could not be acquired within the timeout.');
      lockMock.waitLock.mockImplementation(() => {
        throw lockError;
      });

      let thrown;
      try {
        configManager.writeConfigurationLocked((current) => ({
          ...current,
          apiKey: 'writer-key',
        }));
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(Error);
      expect(thrown.code).toBe('CONFIG_LOCK_CONTENTION');
      expect(thrown.retriable).toBe(true);
      // The original failure is preserved for developer diagnostics.
      expect(thrown.cause).toBe(lockError);
    });
  });
});
