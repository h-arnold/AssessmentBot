/**
 * RED-phase tests for ACTION_PLAN.md Section 2 — "ConfigurationManager decomposition,
 * locked write path, freshness detection".
 *
 * These tests define the TARGET CONTRACT only. Production code implementing the
 * decomposition (facade in `98_ConfigurationManagerClass.js`, sub-classes
 * `96_ConfigurationManagerStorage.js`, `97_ConfigurationManagerDefaults.js`,
 * `97_ConfigurationManagerLockedWrite.js`) and the new locked write path / freshness
 * method does NOT yet exist, so the behaviour tests below fail in the RED phase.
 *
 * No production code is modified by this file.
 *
 * Target API surface encoded by these tests (see report for the full contract):
 *   - `src/backend/ConfigurationManager/98_ConfigurationManagerClass.js` remains the
 *     facade module path; it must preserve the entire current `ConfigurationManager`
 *     public surface and additionally expose:
 *       - `writeConfigurationLocked(mutator)` — the single serialisation point for ALL
 *         configuration writes. `mutator` is `(currentConfig) => nextConfig` where
 *         `currentConfig` is the blob freshly re-read from storage under the lock.
 *       - `isFreshInstall()` — freshness detection; returns true only when
 *         `__CONFIG_STORE_KEY__` is absent from RAW Script Properties after
 *         initialisation (never the config cache).
 *   - Contention contract: `writeConfigurationLocked` throws a retriable validation
 *     error (`.code === 'CONFIG_LOCK_CONTENTION'`, `.retriable === true`) and leaves
 *     storage unchanged. Transport layers map that code to a retriable validation
 *     failure envelope.
 *   - Cap contract: a write whose serialised blob exceeds `MAX_CONFIG_BLOB_BYTES`
 *     (8192) throws a validation error (`.code === 'CONFIG_BLOB_TOO_LARGE'`,
 *     `.retriable === false`) and leaves storage unchanged, with no partial write.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createConfiguredConfigurationManager,
  installInMemoryScriptProperties,
  installScriptLockMock,
} from '../helpers/backendConfigTestHelpers.js';

const ConfigurationManager = require('../../src/backend/ConfigurationManager/98_ConfigurationManagerClass.js');
const {
  MAX_CONFIG_BLOB_BYTES,
} = require('../../src/backend/ConfigurationManager/01_configKeysAndSchema.js');

const CONFIG_STORE_KEY = ConfigurationManager.CONFIG_STORE_KEY || '__CONFIG_STORE_KEY__';

describe('ConfigurationManager Section 2 — locked write path, freshness, facade (RED contract)', () => {
  let mocks;
  let configManager;
  let restoreLockService;
  let scriptLockFactory;
  let lockMock;

  beforeEach(() => {
    vi.clearAllMocks();
    ({ mocks, configManager } = createConfiguredConfigurationManager(vi, ConfigurationManager));

    // Install a script-wide lock mock. The default lock acquires successfully.
    // Individual tests may make `waitLock` throw to simulate contention.
    ({ lockMock, scriptLockFactory, restore: restoreLockService } = installScriptLockMock(vi));
  });

  afterEach(() => {
    restoreLockService();
    ConfigurationManager.resetForTests();
  });

  /** Builds an in-memory backing store for the serialised config blob. */
  function installInMemoryStore(initialConfig) {
    return installInMemoryScriptProperties(mocks.PropertiesService.scriptProperties, {
      configStoreKey: CONFIG_STORE_KEY,
      initialConfig,
    });
  }

  /**
   * Attempts one locked write carrying an oversized value and asserts the
   * non-retriable cap failure leaves the original blob untouched (no partial
   * write). Shared by the UTF-8 measurement cases so their assertions stay
   * identical across one-, two-, three-, and four-byte code points.
   * @param {*} oversizedValue - The value guaranteed to exceed the 8KB cap.
   * @returns {void}
   */
  function expectOverCapRejection(oversizedValue) {
    expect(typeof configManager.writeConfigurationLocked).toBe('function');

    const store = installInMemoryStore({ apiKey: 'original' });

    let thrown;
    try {
      configManager.writeConfigurationLocked((current) => ({
        ...current,
        big: oversizedValue,
      }));
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect(thrown.code).toBe('CONFIG_BLOB_TOO_LARGE');
    expect(thrown.retriable).toBe(false);

    // No partial write; the original blob persists.
    expect(mocks.PropertiesService.scriptProperties.setProperty).not.toHaveBeenCalled();
    expect(store[CONFIG_STORE_KEY]).toBe(JSON.stringify({ apiKey: 'original' }));
  }

  describe('facade preservation — existing public surface survives the split', () => {
    it('loads the facade from the existing file path 98_ConfigurationManagerClass.js', () => {
      // The module path must remain stable so existing test imports keep working.
      expect(ConfigurationManager).toBeTypeOf('function');
      expect(ConfigurationManager.name).toBe('ConfigurationManager');
    });

    it('preserves every existing instance method after decomposition', () => {
      const instanceMethods = [
        'ensureInitialized',
        'getAllConfigurations',
        'ensureDefaultConfiguration',
        'hasProperty',
        'getProperty',
        'setProperty',
        'isValidApiKey',
        'isValidGoogleDriveFolderId',
        'getBackendAssessorBatchSize',
        'getSlidesFetchBatchSize',
        'getApiKey',
        'getAuthGroupEmail',
        'setAuthGroupEmail',
        'getAuthMode',
        'setAuthMode',
        'getBackendUrl',
        'getRevokeAuthTriggerSet',
        'getDaysUntilAuthRevoke',
        'getJsonDbMasterIndexKey',
        'getJsonDbLockTimeoutMs',
        'getJsonDbLogLevel',
        'getJsonDbBackupOnInitialise',
        'getJsonDbRootFolderId',
        'setBackendAssessorBatchSize',
        'setSlidesFetchBatchSize',
        'setApiKey',
        'setBackendUrl',
        'setJsonDbMasterIndexKey',
        'setJsonDbLockTimeoutMs',
        'setJsonDbLogLevel',
        'setJsonDbBackupOnInitialise',
        'setJsonDbRootFolderId',
        'setRevokeAuthTriggerSet',
        'setDaysUntilAuthRevoke',
        'getIntConfig',
      ];

      for (const name of instanceMethods) {
        expect(ConfigurationManager.prototype[name], `missing instance method ${name}`).toBeTypeOf(
          'function'
        );
      }
    });

    it('preserves every existing static accessor after decomposition', () => {
      // Inherited-from-BaseSingleton public entrypoints.
      expect(ConfigurationManager.getInstance).toBeTypeOf('function');
      expect(ConfigurationManager.resetForTests).toBeTypeOf('function');

      // Static getters must remain defined and stable.
      expect(ConfigurationManager.CONFIG_STORE_KEY).toBe(CONFIG_STORE_KEY);
      expect(ConfigurationManager.CONFIG_KEYS).toBeTypeOf('object');
      expect(ConfigurationManager.CONFIG_SCHEMA).toBeTypeOf('object');
      expect(ConfigurationManager.DEFAULTS).toBeTypeOf('object');
      expect(ConfigurationManager.API_KEY_PATTERN).toBeTypeOf('object'); // RegExp
      expect(ConfigurationManager.DRIVE_ID_PATTERN).toBeTypeOf('object'); // RegExp
      expect(ConfigurationManager.JSON_DB_LOG_LEVELS).toBeTypeOf('object');

      // Static helpers.
      expect(ConfigurationManager.toBoolean).toBeTypeOf('function');
      expect(ConfigurationManager.toBooleanString).toBeTypeOf('function');
    });
  });

  describe('locked merge — no clobber of a concurrent writer', () => {
    it('merges an out-of-band storage change with the writer change, writing once', () => {
      // RED guard: the locked-write entrypoint must exist on the facade.
      expect(typeof configManager.writeConfigurationLocked).toBe('function');

      const store = installInMemoryStore({ apiKey: 'original' });
      // Simulate a concurrent writer that commits just before our writer acquires
      // the lock: the re-read under the lock therefore observes the out-of-band change.
      lockMock.waitLock.mockImplementation(() => {
        store[CONFIG_STORE_KEY] = JSON.stringify({ apiKey: 'original', jsonDbLogLevel: 'WARN' });
      });

      configManager.writeConfigurationLocked((current) => ({
        ...current,
        apiKey: 'writer-key',
      }));

      // The single write must contain BOTH the out-of-band change and the writer's change.
      expect(mocks.PropertiesService.scriptProperties.setProperty).toHaveBeenCalledTimes(1);
      const [writtenKey, writtenValue] =
        mocks.PropertiesService.scriptProperties.setProperty.mock.calls[0];
      expect(writtenKey).toBe(CONFIG_STORE_KEY);
      expect(JSON.parse(writtenValue)).toEqual({
        apiKey: 'writer-key',
        jsonDbLogLevel: 'WARN',
      });
      // The lock was acquired and released exactly once.
      expect(scriptLockFactory).toHaveBeenCalledTimes(1);
      expect(lockMock.waitLock).toHaveBeenCalledTimes(1);
      expect(lockMock.releaseLock).toHaveBeenCalledTimes(1);
    });

    it('merges an out-of-band raw change into a real setter write (no lost update)', () => {
      const logLevelKey = ConfigurationManager.CONFIG_KEYS.JSON_DB_LOG_LEVEL;
      const apiKeyKey = ConfigurationManager.CONFIG_KEYS.API_KEY;
      const store = installInMemoryStore({ [logLevelKey]: 'INFO' });

      // Prime the in-memory cache BEFORE the concurrent writer commits. The cache
      // is a snapshot taken before the lock, so it must NOT be the merge base.
      configManager.getAllConfigurations();
      expect(configManager.configCache).toEqual({ [logLevelKey]: 'INFO' });

      // A concurrent writer commits a DIFFERENT field after the cache was primed
      // but before the locked raw re-read, so the re-read observes the API key.
      lockMock.waitLock.mockImplementation(() => {
        store[CONFIG_STORE_KEY] = JSON.stringify({
          [logLevelKey]: 'INFO',
          [apiKeyKey]: 'abt_7pC98PCoGJOcjN-qz6rNlSzKkgySJF-2',
        });
      });

      // A REAL setter routes through setProperty → writeConfigurationLocked.
      configManager.setProperty(logLevelKey, 'warn');

      // The persisted blob must contain BOTH the setter's change and the concurrent
      // raw change. A stale-cache merge base would drop the out-of-band API key
      // (the lost-update this write path exists to prevent).
      expect(JSON.parse(store[CONFIG_STORE_KEY])).toEqual({
        [logLevelKey]: 'WARN',
        [apiKeyKey]: 'abt_7pC98PCoGJOcjN-qz6rNlSzKkgySJF-2',
      });
    });
  });

  describe('contention — retriable validation error, blob unchanged', () => {
    it('throws a retriable contention error and leaves storage untouched when the lock is unavailable', () => {
      expect(typeof configManager.writeConfigurationLocked).toBe('function');

      const store = installInMemoryStore({ apiKey: 'original' });
      // Mirror the DbLockService pattern: waitLock throws on contention.
      lockMock.waitLock.mockImplementation(() => {
        throw new Error('Script lock could not be acquired within the timeout.');
      });

      let thrown;
      try {
        configManager.writeConfigurationLocked((current) => ({
          ...current,
          apiKey: 'writer-key',
        }));
      } catch (err) {
        thrown = err;
      }

      expect(thrown).toBeInstanceOf(Error);
      expect(thrown.code).toBe('CONFIG_LOCK_CONTENTION');
      expect(thrown.retriable).toBe(true);
      expect(thrown.message).toBeTruthy();

      // Storage must be unchanged: no write occurred and the original blob persists.
      expect(mocks.PropertiesService.scriptProperties.setProperty).not.toHaveBeenCalled();
      expect(store[CONFIG_STORE_KEY]).toBe(JSON.stringify({ apiKey: 'original' }));
    });
  });

  describe('cap — 8KB blob cap enforced on every write', () => {
    it('rejects an over-cap write with the blob unchanged and no partial write', () => {
      // An ASCII value guaranteed to exceed the 8KB serialisation cap.
      expectOverCapRejection('x'.repeat(MAX_CONFIG_BLOB_BYTES + 1024));
    });

    it('measures the cap in UTF-8 bytes rather than UTF-16 string length', () => {
      // 5000 two-byte characters: ~5000 UTF-16 code units but ~10000 UTF-8 bytes,
      // so a string-length check would wrongly admit this over-cap blob.
      const multibyteValue = 'é'.repeat(5000);
      expect(JSON.stringify(multibyteValue).length).toBeLessThan(MAX_CONFIG_BLOB_BYTES);

      expectOverCapRejection(multibyteValue);
    });

    it.each([
      ['a three-byte BMP code point', '€', 3000],
      ['a four-byte astral code point', '😀', 2200],
    ])(
      'measures %s in UTF-8 bytes and rejects the over-cap blob',
      (_label, character, repeatCount) => {
        const multibyteValue = character.repeat(repeatCount);
        // Each value is under the cap when measured as UTF-16 code units, so a
        // string-length check would wrongly admit these over-cap blobs regardless
        // of whether the code point encodes to three or four UTF-8 bytes.
        expect(JSON.stringify(multibyteValue).length).toBeLessThan(MAX_CONFIG_BLOB_BYTES);

        expectOverCapRejection(multibyteValue);
      }
    );

    it('counts an astral code point as four bytes without double-counting its surrogate pair', () => {
      expect(typeof configManager.writeConfigurationLocked).toBe('function');

      const store = installInMemoryStore({ apiKey: 'original' });
      // 1500 astral code points encode to 6000 UTF-8 bytes, which is within the
      // cap. Counting each half of the surrogate pair as a separate three-byte
      // code point would inflate the total past the cap and wrongly reject this
      // valid write.
      const astralValue = '😀'.repeat(1500);
      expect(JSON.stringify(astralValue).length).toBeLessThan(MAX_CONFIG_BLOB_BYTES);

      configManager.writeConfigurationLocked((current) => ({
        ...current,
        big: astralValue,
      }));

      expect(mocks.PropertiesService.scriptProperties.setProperty).toHaveBeenCalledTimes(1);
      expect(JSON.parse(store[CONFIG_STORE_KEY]).big).toBe(astralValue);
    });
  });

  describe('freshness — raw Script Properties consulted, never the cache', () => {
    it('short-circuits to false when a populated cache proves a stored blob exists', () => {
      expect(typeof configManager.isFreshInstall).toBe('function');

      installInMemoryStore(undefined); // key absent
      // A populated cache (at least one own key) can only have been derived from
      // a present stored blob, so the fresh-install probe must skip the raw
      // PropertiesService round-trip.
      configManager.configCache = { apiKey: 'cached-proves-blob-present' };
      const getProperty = mocks.PropertiesService.scriptProperties.getProperty;
      getProperty.mockClear();

      configManager.ensureInitialized();
      expect(configManager.isFreshInstall()).toBe(false);
      expect(getProperty).not.toHaveBeenCalled();
    });

    it('returns true when __CONFIG_STORE_KEY__ is absent from raw storage and the cache is empty', () => {
      expect(typeof configManager.isFreshInstall).toBe('function');

      installInMemoryStore(undefined); // key absent
      // An empty cache does not prove the blob exists, so freshness must consult
      // RAW storage (and must not read through getAllConfigurations).
      configManager.configCache = {};
      const getAllConfigurationsSpy = vi
        .spyOn(configManager, 'getAllConfigurations')
        .mockImplementation(() => configManager.configCache);

      configManager.ensureInitialized();
      expect(configManager.isFreshInstall()).toBe(true);
      // Freshness must read RAW storage, not the config cache / getAllConfigurations.
      expect(getAllConfigurationsSpy).not.toHaveBeenCalled();

      getAllConfigurationsSpy.mockRestore();
    });

    it('returns false when __CONFIG_STORE_KEY__ is present, even as an empty object', () => {
      expect(typeof configManager.isFreshInstall).toBe('function');

      const store = installInMemoryStore({}); // key present but empty
      const getAllConfigurationsSpy = vi
        .spyOn(configManager, 'getAllConfigurations')
        .mockImplementation(() => ({}));

      configManager.ensureInitialized();
      expect(configManager.isFreshInstall()).toBe(false);
      expect(getAllConfigurationsSpy).not.toHaveBeenCalled();

      getAllConfigurationsSpy.mockRestore();
    });

    it('runs after initialisation has completed (ordering guarantee)', () => {
      expect(typeof configManager.isFreshInstall).toBe('function');

      const store = installInMemoryStore(undefined);
      // Explicitly run initialisation first, as the bootstrap state machine requires.
      configManager.ensureInitialized();
      expect(() => configManager.isFreshInstall()).not.toThrow();
    });
  });

  describe('no write-path bypass — setters route through the locked write path', () => {
    it('acquires the script lock for every representative config setter', () => {
      const representativeSetters = [
        (cm) =>
          cm.setProperty(
            ConfigurationManager.CONFIG_KEYS.API_KEY,
            'abt_7pC98PCoGJOcjN-qz6rNlSzKkgySJF-2'
          ),
        (cm) => cm.setApiKey('abt_7pC98PCoGJOcjN-qz6rNlSzKkgySJF-2'),
        (cm) => cm.setAuthMode('googleGroups'),
        (cm) => cm.setAuthGroupEmail('admin@school.edu'),
        (cm) => cm.setBackendUrl('https://example.com'),
        (cm) => cm.setJsonDbLogLevel('warn'),
        (cm) => cm.setRevokeAuthTriggerSet(true),
        (cm) => cm.setDaysUntilAuthRevoke(30),
      ];

      for (const invoke of representativeSetters) {
        scriptLockFactory.mockClear();
        lockMock.waitLock.mockClear();
        invoke(configManager);
        // Each config write must acquire the script lock (i.e. route through the
        // locked write path) rather than writing directly without serialisation.
        expect(
          scriptLockFactory,
          'getScriptLock should be acquired by the setter'
        ).toHaveBeenCalled();
        expect(
          lockMock.waitLock,
          'lock.waitLock should be acquired by the setter'
        ).toHaveBeenCalled();
      }
    });
  });
});
