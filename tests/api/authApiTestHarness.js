/**
 * Shared test harness for the auth endpoint transport contract (ACTION_PLAN §5).
 *
 * Provisions the global mocks the three auth endpoints read (ABLogger,
 * ConfigurationManager, Session, GroupsApp and the shared LockService) through
 * the real `ApiDispatcher`, mirroring the GAS concatenated runtime. The
 * ConfigurationManager mock is backed by a mutable raw Script Properties store
 * so tests can observe:
 *
 *   - the exact persisted blob after a save/claim (byte-for-byte storage),
 *   - the atomicity contract (exactly one locked `writeConfigurationLocked`
 *     mutation, with the shared script-lock acquired once),
 *   - the 8KB blob cap (`CONFIG_BLOB_TOO_LARGE`) enforced before the single
 *     write, so over-cap saves leave storage unchanged,
 *   - fresh-install detection (`isFreshInstall()`) against the raw key absence.
 *
 * The default `writeConfigurationLocked` mirrors the Section 2 locked write: it
 * acquires the script lock once, re-reads the RAW blob under the lock, runs the
 * mutator, enforces the cap, then writes once. Tests may override it via
 * `ctx.configManager.writeConfigurationLocked.mockImplementation(...)` and
 * restore it through `ctx.defaultWriteConfigurationLocked`.
 *
 * The auth getter surface (getAuthMode/getAuthGroupEmail/getAuthUsers/
 * getAuthRevision) and the generic getProperty/getAllConfigurations surfaces are
 * both exposed so the endpoints can shape settings data regardless of which
 * surface the implementation reads.
 */
import { vi } from 'vitest';
import { withGlobalMocks } from '../helpers/globalMockManager.js';
import { loadApiHandlerModule } from '../helpers/apiHandlerTestUtils.js';
import {
  createAbLoggerSpy,
  createSessionMock,
  createGroupsAppMock,
  buildUsersJson,
  DEFAULT_ACTIVE_EMAIL,
} from '../utils/authService/authServiceTestHarness.js';
import {
  createBootstrapRawStore,
  CONFIG_STORE_KEY,
  createStoreBackedScriptProperties,
  parseRawConfigBlob,
} from '../utils/authService/authServiceBootstrapHarness.js';

const AuthService = require('../../src/backend/Utils/AuthService.js');

/** The conservative Script Properties blob cap enforced on every config write. */
export const MAX_CONFIG_BLOB_BYTES = 8192;

/**
 * Builds a stored scriptProperties auth state for seeding the raw config blob.
 * @param {Array<{email: string, role: string}>} users - The stored user entries.
 * @param {string} revision - The stored auth revision.
 * @param {Object} [extra] - Additional stored config fields.
 * @returns {Object} The stored config object.
 */
export function storedScriptPropertiesState(users, revision, extra = {}) {
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
export function dispatchAuthApi(method, params) {
  const { ApiDispatcher } = loadApiHandlerModule();
  return ApiDispatcher.getInstance().handle({
    method,
    ...(params === undefined ? {} : { params }),
  });
}

/**
 * Resets the shared AuthService and GAS service state before each auth
 * transport test.
 * @returns {void}
 */
export function resetAuthApiTestState() {
  AuthService.resetForTests();
  globalThis.PropertiesService._resetUserProperties();
  globalThis.CacheService._resetScriptCache();
}

/**
 * Restores the provisioned auth API context and shared AuthService state after
 * each auth transport test.
 * @param {Object|undefined} ctx - Result of provisionAuthApiContext, if any.
 * @returns {void}
 */
export function teardownAuthApiTestContext(ctx) {
  if (ctx) ctx.restore();
  AuthService.resetForTests();
  vi.restoreAllMocks();
}

/**
 * Builds a store-backed ConfigurationManager mock for the auth endpoints.
 * @param {Object} options - Mock configuration.
 * @param {Object} options.store - The mutable raw Script Properties store.
 * @param {Object} options.lockMock - The script-lock mock (`waitLock`/`releaseLock` spies).
 * @returns {Object} `{ configManager, scriptProperties, defaultWriteConfigurationLocked, readConfig }`.
 */
export function createAuthApiConfigurationManager({ store, lockMock }) {
  const scriptProperties = createStoreBackedScriptProperties(store);

  const readConfig = () => parseRawConfigBlob(scriptProperties.getProperty(CONFIG_STORE_KEY));

  const defaultWriteConfigurationLocked = (mutator) => {
    lockMock.waitLock();
    try {
      const current = readConfig();
      const next = mutator(current);
      const serialised = JSON.stringify(next);
      if (serialised.length > MAX_CONFIG_BLOB_BYTES) {
        const capError = new Error('Configuration blob exceeds the 8KB cap and was not written.');
        capError.code = 'CONFIG_BLOB_TOO_LARGE';
        capError.retriable = false;
        throw capError;
      }
      scriptProperties.setProperty(CONFIG_STORE_KEY, serialised);
    } finally {
      lockMock.releaseLock();
    }
  };

  const configManager = {
    scriptProperties,
    isFreshInstall: vi.fn(() => store[CONFIG_STORE_KEY] == null),
    writeConfigurationLocked: vi.fn(defaultWriteConfigurationLocked),
    getAllConfigurations: vi.fn(() => readConfig()),
    getProperty: vi.fn((key) => {
      const value = readConfig()[key];
      return value == null ? '' : value;
    }),
    getAuthMode: vi.fn(() => {
      const value = readConfig().authMode ?? '';
      if (value === 'googleGroups' || value === 'scriptProperties') return value;
      if (value !== '') return null;
      const group = readConfig().authGroupEmail ?? '';
      return String(group).trim() === '' ? null : 'googleGroups';
    }),
    getAuthGroupEmail: vi.fn(() => readConfig().authGroupEmail ?? ''),
    getAuthUsers: vi.fn(() => readConfig().authUsers ?? ''),
    getAuthRevision: vi.fn(() => readConfig().authRevision ?? ''),
    ensureDefaultConfiguration: vi.fn(() => ({})),
    ensureInitialized: vi.fn(),
    setProperty: vi.fn((key, value) => {
      const next = { ...readConfig(), [key]: String(value) };
      store[CONFIG_STORE_KEY] = JSON.stringify(next);
    }),
  };

  return {
    configManager,
    scriptProperties,
    defaultWriteConfigurationLocked,
    readConfig,
  };
}

/**
 * Provisions the global mocks the auth endpoints and the real ApiDispatcher
 * read, installing them with `withGlobalMocks` so originals are always restored.
 * @param {Object} options - Test configuration.
 * @param {Object} [options.seed] - Seed a present config blob (not fresh).
 * @param {string} [options.email=DEFAULT_ACTIVE_EMAIL] - Active-user email.
 * @param {Object} [options.members={}] - GroupsApp members map (email → role).
 * @param {boolean} [options.groupExists=true] - Whether the group resolves.
 * @param {Error|null} [options.lookupError=null] - Forced GroupsApp lookup error.
 * @param {Object|null} [options.cache=null] - Optional CacheService wrapper to install.
 * @returns {Object} Handles: restore, logger, configManager, store, lockMock,
 *   getScriptLock, getUserLock, session, groupsApp, scriptProperties,
 *   defaultWriteConfigurationLocked, readConfig.
 */
export function provisionAuthApiContext({
  seed,
  email = DEFAULT_ACTIVE_EMAIL,
  members = {},
  groupExists = true,
  lookupError = null,
  cache = null,
} = {}) {
  const logger = createAbLoggerSpy();
  const store = createBootstrapRawStore(seed);
  const lockMock = { waitLock: vi.fn(() => {}), releaseLock: vi.fn(() => {}) };
  const userLockMock = { tryLock: vi.fn(() => true), releaseLock: vi.fn(() => {}) };
  const { configManager, scriptProperties, defaultWriteConfigurationLocked, readConfig } =
    createAuthApiConfigurationManager({ store, lockMock });
  const sessionMock = createSessionMock({ email });
  const groupsAppMock = createGroupsAppMock({ members, groupExists, lookupError });
  const getScriptLock = vi.fn(() => lockMock);
  const getUserLock = vi.fn(() => userLockMock);

  const globalMocks = {
    ABLogger: () => ({ getInstance: () => logger }),
    ConfigurationManager: () => ({ getInstance: () => configManager }),
    Session: () => sessionMock.session,
    GroupsApp: () => groupsAppMock,
    LockService: () => ({ getScriptLock, getUserLock }),
  };
  if (cache) {
    globalMocks.CacheService = () => ({ getScriptCache: () => cache });
  }
  const mockContext = withGlobalMocks(globalMocks);

  return {
    restore: mockContext.restore,
    logger,
    configManager,
    store,
    lockMock,
    getScriptLock,
    getUserLock,
    session: sessionMock.session,
    groupsApp: groupsAppMock,
    scriptProperties,
    defaultWriteConfigurationLocked,
    readConfig,
  };
}

/**
 * Returns the raw `__CONFIG_STORE_KEY__` blob held by the store, or undefined
 * when the key is absent (a genuinely fresh install). Used for byte-for-byte
 * unchanged-storage assertions.
 * @param {Object} store - The mutable raw Script Properties store.
 * @returns {string|undefined} The raw blob, or undefined when absent.
 */
export function rawStoreBlob(store) {
  return store[CONFIG_STORE_KEY];
}
