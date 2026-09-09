/**
 * Shared test harness for the AuthService contract tests.
 *
 * Provisions the global mocks (ABLogger, ConfigurationManager, Session,
 * GroupsApp and an optional CacheService) that the AuthService singleton reads
 * in Node, mirroring the GAS concatenated runtime. The ConfigurationManager
 * mock is backed by a mutable config object so tests can simulate stored auth
 * state and observe fresh reads, denied writes, and cache access.
 *
 * The mock's `getAuthMode()` mirrors the production forgiving getter contract
 * (a valid stored mode, else the single absent/blank-mode-with-group leniency,
 * else null) so the tests exercise the resolver regardless of whether it reads
 * through the getter surface or the raw property surface.
 */
import { vi } from 'vitest';
import { withGlobalMocks } from '../../helpers/globalMockManager.js';

/** The Google Groups cache TTL in seconds (six hours). */
export const SIX_HOURS_SECONDS = 6 * 60 * 60;

/** Default active-user email used by the Session mock. */
export const DEFAULT_ACTIVE_EMAIL = 'teacher@school.edu';

/**
 * Creates an ABLogger spy exposing the methods AuthService audits through.
 * @returns {Object} The ABLogger mock with vi.fn() methods.
 */
export function createAbLoggerSpy() {
  return {
    debug: vi.fn(),
    debugUi: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
  };
}

/**
 * Serialises AuthUserEntry rows into the stored authUsers JSON string.
 * @param {Array<{email: string, role: string}>} entries - User entries.
 * @returns {string} The JSON string stored under authUsers.
 */
export function buildUsersJson(entries) {
  return JSON.stringify(entries);
}

/**
 * Builds a per-test Session mock exposing getActiveUser().getEmail().
 * @param {Object} [options] - Mock configuration.
 * @param {string} [options.email=DEFAULT_ACTIVE_EMAIL] - The email to return, or '' for a blank identity.
 * @returns {Object} The Session mock.
 */
export function createSessionMock({ email = DEFAULT_ACTIVE_EMAIL } = {}) {
  return {
    session: {
      getActiveUser: () => ({ getEmail: () => email }),
    },
  };
}

/**
 * Builds a per-test GroupsApp mock. Members map a user email to a Group role.
 * When `groupExists` is false or `lookupError` is supplied, lookup throws,
 * modelling the "group not found / GroupsApp error → deny" contract.
 * @param {Object} options - Mock configuration.
 * @param {Record<string,string>} [options.members={}] - email → Group role map.
 * @param {boolean} [options.groupExists=true] - Whether the group resolves.
 * @param {Error|null} [options.lookupError=null] - Forced lookup error.
 * @returns {Object} The GroupsApp mock plus the resolved group handle.
 */
export function createGroupsAppMock({ members = {}, groupExists = true, lookupError = null } = {}) {
  const group = groupExists
    ? {
        hasUser: vi.fn((email) => Object.hasOwn(members, email)),
        getRole: vi.fn((email) => (Object.hasOwn(members, email) ? members[email] : null)),
      }
    : null;
  return {
    group,
    getGroupByEmail: vi.fn((groupEmail) => {
      if (lookupError) throw lookupError;
      if (!groupExists) throw new Error(`Group not found: ${groupEmail}`);
      return group;
    }),
  };
}

/**
 * Creates a ConfigurationManager singleton mock reading a mutable config object.
 *
 * Exposes both the getter surface (getAuthMode/getAuthGroupEmail) and the raw
 * property surface (getProperty/getAllConfigurations) plus the Section 2
 * freshness method, so the auth resolver can read auth state either way. Every
 * accessor is a vi.fn() so tests can assert read/write counts. The backing
 * `config` object is returned for in-place mutation between requests.
 *
 * @param {Object} options - Mock configuration.
 * @param {Object} [options.config={}] - The stored auth config (mutable).
 * @param {boolean} [options.fresh=false] - The isFreshInstall() result.
 * @returns {Object} The ConfigurationManager mock instance.
 */
export function createConfigurationManagerMock({ config = {}, fresh = false } = {}) {
  const getProperty = vi.fn((key) => {
    const value = config[key];
    return value == null ? '' : value;
  });
  const getAuthMode = vi.fn(() => {
    const value = config.authMode ?? '';
    if (value === 'googleGroups' || value === 'scriptProperties') return value;
    if (value !== '') return null;
    const group = config.authGroupEmail ?? '';
    return String(group).trim() === '' ? null : 'googleGroups';
  });
  const getAuthGroupEmail = vi.fn(() => config.authGroupEmail ?? '');
  const getAuthUsers = vi.fn(() => config.authUsers ?? '');
  const getAuthRevision = vi.fn(() => config.authRevision ?? '');
  const getAllConfigurations = vi.fn(() => ({ ...config }));
  const isFreshInstall = vi.fn(() => fresh);
  const writeConfigurationLocked = vi.fn();
  const setProperty = vi.fn();
  const ensureInitialized = vi.fn();
  return {
    config,
    getProperty,
    getAuthMode,
    getAuthGroupEmail,
    getAuthUsers,
    getAuthRevision,
    getAllConfigurations,
    isFreshInstall,
    writeConfigurationLocked,
    setProperty,
    ensureInitialized,
  };
}

/**
 * Wraps the real in-memory ScriptCache with spies so tests can assert cache
 * reads/writes while still round-tripping through CacheManager.
 * @returns {Object} CacheService wrapper with get/put/remove spies.
 */
export function createCacheSpy() {
  const realCache = globalThis.CacheService.getScriptCache();
  return {
    get: vi.fn((key) => realCache.get(key)),
    put: vi.fn((key, value, ttl) => realCache.put(key, value, ttl)),
    remove: vi.fn((key) => realCache.remove(key)),
  };
}

/**
 * Provisions the global mocks AuthService reads (ABLogger, ConfigurationManager,
 * Session, GroupsApp and an optional CacheService) using withGlobalMocks so
 * originals are always restored. Additional globals (e.g. trigger handler
 * dependencies) can be merged through `extraGlobals`.
 *
 * @param {Object} options - Test configuration.
 * @param {Object} [options.config={}] - Stored auth config (mutable).
 * @param {boolean} [options.fresh=false] - isFreshInstall() result.
 * @param {string} [options.email=DEFAULT_ACTIVE_EMAIL] - Active-user email.
 * @param {Object} [options.members={}] - GroupsApp members map.
 * @param {boolean} [options.groupExists=true] - Whether the group resolves.
 * @param {Error|null} [options.lookupError=null] - Forced GroupsApp lookup error.
 * @param {Object|null} [options.cache=null] - CacheService wrapper to install.
 * @param {Object|null} [options.abLogger=null] - ABLogger mock (created if absent).
 * @param {Object} [options.extraGlobals={}] - Additional globals to install.
 * @returns {Object} Handles: restore, logger, configManager, config, groupsApp, group, session.
 */
export function provisionAuthContext({
  config = {},
  fresh = false,
  email = DEFAULT_ACTIVE_EMAIL,
  members = {},
  groupExists = true,
  lookupError = null,
  cache = null,
  abLogger = null,
  extraGlobals = {},
} = {}) {
  const logger = abLogger || createAbLoggerSpy();
  const configManager = createConfigurationManagerMock({ config, fresh });
  const groupsAppMock = createGroupsAppMock({ members, groupExists, lookupError });
  const sessionMock = createSessionMock({ email });
  const globalMocks = {
    ABLogger: () => ({ getInstance: () => logger }),
    ConfigurationManager: () => ({ getInstance: () => configManager }),
    Session: () => sessionMock.session,
    GroupsApp: () => groupsAppMock,
    ...extraGlobals,
  };
  if (cache) {
    globalMocks.CacheService = () => ({ getScriptCache: () => cache });
  }
  const mockContext = withGlobalMocks(globalMocks);
  return {
    restore: mockContext.restore,
    logger,
    configManager,
    config,
    groupsApp: groupsAppMock,
    group: groupsAppMock.group,
    session: sessionMock.session,
  };
}

/**
 * Flattens every stringified ABLogger payload into a single searchable string.
 * @param {Object} logger - The ABLogger mock.
 * @returns {string} Joined log output.
 */
export function flattenedLog(logger) {
  return [...logger.info.mock.calls, ...logger.warn.mock.calls, ...logger.error.mock.calls]
    .map((args) =>
      args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ')
    )
    .join('\n');
}
