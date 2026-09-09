/**
 * Shared test harness for the AuthService fresh-install bootstrap claim contract.
 *
 * The bootstrap claim (ACTION_PLAN §4) is exercised through
 * `AuthService.getInstance().checkAccess()` — the sole caller entrypoint. Unlike
 * the Section 3 harness (which models a fixed `isFreshInstall()` result and a bare
 * `writeConfigurationLocked` spy), this harness backs the raw Script Properties
 * blob in a mutable store so tests can observe:
 *
 *   - pre-lock freshness (a store-backed `isFreshInstall()` read),
 *   - the in-lock freshness re-check (a second store-backed evaluation while the
 *     script lock is held),
 *   - the atomic, single locked write committed through the Section 2 shared
 *     `writeConfigurationLocked` path (one `getScriptLock` / `waitLock` /
 *     `releaseLock` sequence and one `setProperty` of `__CONFIG_STORE_KEY__`),
 *   - contention / write failures and the absence of partial auth state.
 *
 * The `writeConfigurationLocked` default implementation mirrors the Section 2
 * locked-write contract: it acquires the script lock once, re-reads the RAW blob
 * under the lock, runs the mutator, then writes once. Tests may override it to
 * simulate contention or persist failures, and restore it via
 * `defaultWriteConfigurationLocked` for a subsequent retry.
 */
import { vi } from 'vitest';
import { withGlobalMocks } from '../../helpers/globalMockManager.js';
import {
  createAbLoggerSpy,
  createSessionMock,
  createGroupsAppMock,
  DEFAULT_ACTIVE_EMAIL,
} from './authServiceTestHarness.js';

/** The single Script Properties key under which the whole config blob lives. */
export const CONFIG_STORE_KEY = '__CONFIG_STORE_KEY__';

/**
 * Builds an in-memory raw Script Properties store for the config blob.
 *
 * When `initialConfig` is supplied the key is seeded with its serialised JSON
 * (a present blob → not a fresh install); when omitted the key is absent (a
 * genuinely fresh install). Tests may mutate the returned store directly to
 * simulate competing writers or malformed blobs.
 * @param {Object} [initialConfig] - Optional seeded config object.
 * @returns {Object} A mutable map keyed by `__CONFIG_STORE_KEY__`.
 */
export function createBootstrapRawStore(initialConfig) {
  const store = {};
  if (initialConfig !== undefined) {
    store[CONFIG_STORE_KEY] = JSON.stringify(initialConfig);
  }
  return store;
}

/**
 * Builds a ConfigurationManager mock that backs raw Script Properties with the
 * supplied store and routes every write through the shared locked-write path.
 * @param {Object} options - Mock configuration.
 * @param {Object} options.store - The mutable raw store.
 * @param {Object} options.lockMock - The script-lock mock (`waitLock`/`releaseLock` spies).
 * @returns {Object} `{ configManager, scriptProperties, defaultWriteConfigurationLocked }`.
 */
export function createBootstrapConfigurationManager({ store, lockMock }) {
  const scriptProperties = {
    getProperty: vi.fn((key) => (Object.hasOwn(store, key) ? store[key] : null)),
    setProperty: vi.fn((key, value) => {
      store[key] = value;
    }),
    deleteProperty: vi.fn((key) => {
      delete store[key];
    }),
  };

  const parseRaw = (raw) => {
    if (raw == null || raw === '') return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  };

  const isFreshInstall = vi.fn(() => store[CONFIG_STORE_KEY] == null);

  const defaultWriteConfigurationLocked = (mutator) => {
    // Mirror the Section 2 shared locked write: acquire the script lock once,
    // re-read the RAW blob under the lock, run the mutator, write once.
    lockMock.waitLock();
    try {
      const raw = scriptProperties.getProperty(CONFIG_STORE_KEY);
      const current = parseRaw(raw);
      const next = mutator(current);
      scriptProperties.setProperty(CONFIG_STORE_KEY, JSON.stringify(next));
    } finally {
      lockMock.releaseLock();
    }
  };
  const writeConfigurationLocked = vi.fn(defaultWriteConfigurationLocked);

  const getAllConfigurations = vi.fn(() =>
    parseRaw(scriptProperties.getProperty(CONFIG_STORE_KEY))
  );

  const getProperty = vi.fn((key) => {
    const value = getAllConfigurations()[key];
    return value == null ? '' : value;
  });

  const ensureDefaultConfiguration = vi.fn(() => ({}));

  return {
    configManager: {
      scriptProperties,
      isFreshInstall,
      writeConfigurationLocked,
      getAllConfigurations,
      getProperty,
      ensureDefaultConfiguration,
    },
    scriptProperties,
    defaultWriteConfigurationLocked,
  };
}

/**
 * Provisions the global mocks the bootstrap claim reads (ABLogger,
 * ConfigurationManager, Session, GroupsApp and the shared LockService) using
 * `withGlobalMocks` so originals are always restored.
 *
 * @param {Object} options - Test configuration.
 * @param {Object} [options.initialConfig] - Seed a present config blob (not fresh).
 * @param {Object} [options.store] - A pre-built raw store (takes precedence over `initialConfig`).
 * @param {string} [options.email=DEFAULT_ACTIVE_EMAIL] - Active-user email.
 * @param {Object} [options.members={}] - GroupsApp members map (email → role).
 * @param {Object} [options.abLogger] - ABLogger mock (created if absent).
 * @returns {Object} Handles: restore, logger, configManager, scriptProperties,
 *   store, lockMock, session, defaultWriteConfigurationLocked.
 */
export function provisionBootstrapContext({
  initialConfig,
  store,
  email = DEFAULT_ACTIVE_EMAIL,
  members = {},
  abLogger = null,
} = {}) {
  const logger = abLogger || createAbLoggerSpy();
  const storeRef = store || createBootstrapRawStore(initialConfig);
  const lockMock = {
    waitLock: vi.fn(() => {}),
    releaseLock: vi.fn(() => {}),
  };
  const { configManager, scriptProperties, defaultWriteConfigurationLocked } =
    createBootstrapConfigurationManager({ store: storeRef, lockMock });
  const sessionMock = createSessionMock({ email });
  const groupsAppMock = createGroupsAppMock({ members });
  const getScriptLock = vi.fn(() => lockMock);

  const mockContext = withGlobalMocks({
    ABLogger: () => ({ getInstance: () => logger }),
    ConfigurationManager: () => ({ getInstance: () => configManager }),
    Session: () => sessionMock.session,
    GroupsApp: () => groupsAppMock,
    LockService: () => ({ getScriptLock }),
  });

  return {
    restore: mockContext.restore,
    logger,
    configManager,
    scriptProperties,
    store: storeRef,
    lockMock,
    getScriptLock,
    session: sessionMock.session,
    defaultWriteConfigurationLocked,
  };
}
