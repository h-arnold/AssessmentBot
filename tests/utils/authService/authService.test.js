/**
 * AuthService unit tests.
 *
 * Red-phase tests for ACTION_PLAN Section 2. The module under test
 * (src/backend/Utils/AuthService.js) does not exist yet, so the top-level
 * require below fails to load until the green implementation lands — that is
 * the intended red state. The GAS harness stubs (Session, GroupsApp,
 * CacheService) are provisioned in tests/setupGlobals.js.
 *
 * AuthService reads AUTH_GROUP_EMAIL via ConfigurationManager.getInstance(),
 * resolves the caller email via Session.getActiveUser().getEmail(), delegates
 * membership/role resolution to GroupsApp, caches successful results through
 * CacheManager (6-hour TTL, auth:<groupEmail>:<email> key), and logs every
 * attempt through ABLogger.
 */
const AuthService = require('../../../src/backend/Utils/AuthService.js');
const { withGlobalMocks } = require('../../helpers/globalMockManager.js');

/** The 6-hour TTL (in seconds) AuthService passes to CacheManager.put(). */
const SIX_HOURS_SECONDS = 6 * 60 * 60;

/**
 * Builds a per-test Session mock exposing getActiveUser().getEmail().
 * @param {string} email - The email to return, or '' for a blank identity.
 * @returns {{ session: { getActiveUser: import('vitest').Mock },
 *            getEmail: () => string }}
 */
function createSessionMock({ email }) {
  return {
    session: {
      getActiveUser: () => ({ getEmail: () => email }),
    },
  };
}

/**
 * Builds a per-test GroupsApp mock. Members are a map of user email → role.
 * When `groupExists` is false, group membership lookup fulfils to an error;
 * when `lookupError` is supplied, it is thrown on lookup regardless. Both
 * paths model the "group not found / GroupsApp error → deny" contract.
 * @param {Record<string,string>} members - email → Group role map.
 * @returns {{ group: { hasUser: import('vitest').Mock,
 *   getRole: import('vitest').Mock } | null, getGroupByEmail: import('vitest').Mock }}
 */
function createGroupsAppMock({ members = {}, groupExists = true, lookupError = null }) {
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

describe('AuthService', () => {
  let restoreGlobals;
  let mockABLogger;
  /** Provides a mutable AUTH_GROUP_EMAIL value read by the ConfigurationManager mock. */
  const authGroup = { value: 'teachers@school.edu' };
  /** Provides a mutable AUTH_MODE value read by the ConfigurationManager mock. */
  const authMode = { value: 'googleGroups' };

  /**
   * Applies per-test global mocks (ABLogger spy + ConfigurationManager +
   * Session + GroupsApp + optional CacheService wrapper). Returns the mock
   * handles tests need for assertions.
   *
   * @param {Object} options - test configuration.
   */
  function provisionAuthContext({
    email = 'teacher@school.edu',
    members = {},
    groupExists = true,
    lookupError = null,
    cache = null,
  } = {}) {
    const groupsAppMock = createGroupsAppMock({ members, groupExists, lookupError });
    const sessionMock = createSessionMock({ email });
    const configManager = {
      getAuthGroupEmail: vi.fn(() => authGroup.value),
      getAuthMode: vi.fn(() => authMode.value),
    };
    const globalMocks = {
      ABLogger: () => ({ getInstance: () => mockABLogger }),
      ConfigurationManager: () => ({ getInstance: () => configManager }),
      Session: () => sessionMock.session,
      GroupsApp: () => groupsAppMock,
    };
    if (cache) {
      globalMocks.CacheService = () => ({ getScriptCache: () => cache });
    }
    const mockContext = withGlobalMocks(globalMocks);
    return {
      restore: mockContext.restore,
      group: groupsAppMock.group,
      configManager,
    };
  }

  /** Flattens every stringified ABLogger payload into a single searchable string. */
  function flattenedLog() {
    return [
      ...mockABLogger.info.mock.calls,
      ...mockABLogger.warn.mock.calls,
      ...mockABLogger.error.mock.calls,
    ]
      .map((args) =>
        args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ')
      )
      .join('\n');
  }

  beforeEach(() => {
    AuthService.resetForTests();
    globalThis.CacheService._resetScriptCache();
    authGroup.value = 'teachers@school.edu';
    authMode.value = 'googleGroups';
    mockABLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      log: vi.fn(),
      debugUi: vi.fn(),
    };
  });

  afterEach(() => {
    if (restoreGlobals) restoreGlobals();
    AuthService.resetForTests();
    vi.restoreAllMocks();
  });

  describe('singleton', () => {
    it('returns the same instance across multiple calls', () => {
      restoreGlobals = provisionAuthContext({
        members: { 'teacher@school.edu': 'MEMBER' },
      }).restore;
      const instanceA = AuthService.getInstance();
      const instanceB = AuthService.getInstance();
      expect(instanceA).toBe(instanceB);
    });

    it('returns an AuthService instance with a checkAccess method', () => {
      restoreGlobals = provisionAuthContext({
        members: { 'teacher@school.edu': 'MEMBER' },
      }).restore;
      const instance = AuthService.getInstance();
      expect(typeof instance.checkAccess).toBe('function');
    });
  });

  describe('_isGroupMember — parameter validation', () => {
    it('throws when email is missing', () => {
      expect(() => AuthService.getInstance()._isGroupMember(undefined, 'grp@school.edu')).toThrow(
        /is required/
      );
    });

    it('throws when groupEmail is missing', () => {
      expect(() =>
        AuthService.getInstance()._isGroupMember('teacher@school.edu', undefined)
      ).toThrow(/is required/);
    });

    it('throws when both parameters are missing', () => {
      expect(() => AuthService.getInstance()._isGroupMember(undefined, undefined)).toThrow(
        /is required/
      );
    });

    it('throws when email is null', () => {
      expect(() => AuthService.getInstance()._isGroupMember(null, 'grp@school.edu')).toThrow(
        /is required/
      );
    });

    it('throws when groupEmail is null', () => {
      expect(() => AuthService.getInstance()._isGroupMember('teacher@school.edu', null)).toThrow(
        /is required/
      );
    });
  });

  describe('checkAccess — group membership', () => {
    it('allows a group member on cache miss and returns the mapped role', () => {
      restoreGlobals = provisionAuthContext({
        email: 'teacher@school.edu',
        members: { 'teacher@school.edu': 'MEMBER' },
      }).restore;

      const result = AuthService.getInstance().checkAccess();
      expect(result).toEqual({ allowed: true, role: 'user' });
      expect(mockABLogger.info).toHaveBeenCalled();
    });

    it('returns a cached allowed result on a cache hit without re-calling GroupsApp', () => {
      const ctx = provisionAuthContext({
        email: 'teacher@school.edu',
        members: { 'teacher@school.edu': 'MEMBER' },
      });
      restoreGlobals = ctx.restore;

      const first = AuthService.getInstance().checkAccess();
      expect(first).toEqual({ allowed: true, role: 'user' });
      expect(ctx.group.hasUser).toHaveBeenCalledTimes(1);

      const second = AuthService.getInstance().checkAccess();
      expect(second).toEqual({ allowed: true, role: 'user' });
      // Cached — GroupsApp membership is not consulted again.
      expect(ctx.group.hasUser).toHaveBeenCalledTimes(1);
    });

    it('denies a non-member and does not cache the denial', () => {
      const ctx = provisionAuthContext({
        email: 'outsider@school.edu',
        members: { 'teacher@school.edu': 'MEMBER' },
      });
      restoreGlobals = ctx.restore;

      const first = AuthService.getInstance().checkAccess();
      expect(first).toEqual({ allowed: false });
      expect(ctx.group.hasUser).toHaveBeenCalledTimes(1);

      // Denials are never cached, so a second attempt re-checks the group.
      const second = AuthService.getInstance().checkAccess();
      expect(second).toEqual({ allowed: false });
      expect(ctx.group.hasUser).toHaveBeenCalledTimes(2);
    });

    it('returns a previously cached allowed result for a revoked user within the TTL', () => {
      const ctx = provisionAuthContext({
        email: 'teacher@school.edu',
        members: { 'teacher@school.edu': 'MEMBER' },
      });
      restoreGlobals = ctx.restore;

      expect(AuthService.getInstance().checkAccess()).toEqual({ allowed: true, role: 'user' });

      // The user is removed from the group, but the cache is still warm.
      ctx.group.hasUser.mockReturnValue(false);
      ctx.group.getRole.mockReturnValue(null);
      const second = AuthService.getInstance().checkAccess();
      // Revocation latency is bounded by the 6-hour TTL.
      expect(second).toEqual({ allowed: true, role: 'user' });
      expect(ctx.group.hasUser).toHaveBeenCalledTimes(1);
    });

    it('denies a blank active-user email', () => {
      restoreGlobals = provisionAuthContext({ email: '', members: {} }).restore;
      const result = AuthService.getInstance().checkAccess();
      expect(result).toEqual({ allowed: false });
      expect(mockABLogger.warn).toHaveBeenCalled();
    });

    it('denies access when GroupsApp lookup throws', () => {
      restoreGlobals = provisionAuthContext({
        email: 'teacher@school.edu',
        lookupError: new Error('GroupsApi failure'),
      }).restore;
      const result = AuthService.getInstance().checkAccess();
      expect(result).toEqual({ allowed: false });
    });

    it('denies access when the group does not exist', () => {
      restoreGlobals = provisionAuthContext({
        email: 'teacher@school.edu',
        groupExists: false,
      }).restore;
      const result = AuthService.getInstance().checkAccess();
      expect(result).toEqual({ allowed: false });
    });
  });

  describe('checkAccess — configuration dependent', () => {
    it('fails open with role user when AUTH_GROUP_EMAIL is unset and requireConfigured is falsy', () => {
      authGroup.value = '';
      restoreGlobals = provisionAuthContext({ email: 'teacher@school.edu', members: {} }).restore;

      const result = AuthService.getInstance().checkAccess();
      expect(result).toEqual({ allowed: true, role: 'user' });
      expect(mockABLogger.warn).toHaveBeenCalled();
    });

    it('fails closed when AUTH_GROUP_EMAIL is unset and requireConfigured is true', () => {
      authGroup.value = '';
      restoreGlobals = provisionAuthContext({ email: 'teacher@school.edu', members: {} }).restore;

      const result = AuthService.getInstance().checkAccess({ requireConfigured: true });
      expect(result).toEqual({ allowed: false });
      expect(mockABLogger.error).toHaveBeenCalled();
    });
  });

  describe('checkAccess — authMode none bypass', () => {
    it('returns allowed as a plain user and never consults the group email when authMode is none', () => {
      authMode.value = 'none';
      authGroup.value = '';
      const ctx = provisionAuthContext({ email: '' });

      const result = AuthService.getInstance().checkAccess({});

      expect(result).toEqual({ allowed: true, role: 'user' });
      // The bypass must fire before the group-email read — this proves the
      // short-circuit happens at the very top of checkAccess.
      expect(ctx.configManager.getAuthGroupEmail).not.toHaveBeenCalled();
    });

    it('returns allowed as a plain user even with requireConfigured when authMode is none', () => {
      authMode.value = 'none';
      authGroup.value = '';
      const ctx = provisionAuthContext({ email: '' });

      const result = AuthService.getInstance().checkAccess({ requireConfigured: true });

      expect(result).toEqual({ allowed: true, role: 'user' });
      expect(ctx.configManager.getAuthGroupEmail).not.toHaveBeenCalled();
    });

    it('returns allowed as a plain user even with bypassCache when authMode is none', () => {
      authMode.value = 'none';
      restoreGlobals = provisionAuthContext({}).restore;

      const result = AuthService.getInstance().checkAccess({ bypassCache: true });

      expect(result).toEqual({ allowed: true, role: 'user' });
    });

    it('logs a warning identifying the authMode bypass when authMode is none', () => {
      authMode.value = 'none';
      restoreGlobals = provisionAuthContext({}).restore;

      AuthService.getInstance().checkAccess({});

      // The bypass is a temporary development measure — the warn must carry the
      // authMode context so the log is distinguishable from a group denial.
      expect(mockABLogger.warn).toHaveBeenCalled();
      expect(flattenedLog()).toContain('authMode');
    });

    it('still denies a non-member when authMode is googleGroups', () => {
      authMode.value = 'googleGroups';
      authGroup.value = 'teachers@school.edu';
      restoreGlobals = provisionAuthContext({
        email: 'outsider@school.edu',
        members: { 'teacher@school.edu': 'MEMBER' },
      }).restore;

      const result = AuthService.getInstance().checkAccess({});

      expect(result).toEqual({ allowed: false });
    });
  });

  describe('checkAccess — role mapping', () => {
    it.each([
      ['OWNER', 'admin'],
      ['MANAGER', 'admin'],
      ['MEMBER', 'user'],
    ])('maps the %s role to %s', (groupRole, expectedAppRole) => {
      restoreGlobals = provisionAuthContext({
        members: { 'teacher@school.edu': groupRole },
      }).restore;

      const result = AuthService.getInstance().checkAccess();
      expect(result).toEqual({ allowed: true, role: expectedAppRole });
    });

    it.each(['INVITED', 'PENDING', 'BANNED'])('denies the %s role', (groupRole) => {
      restoreGlobals = provisionAuthContext({
        members: { 'teacher@school.edu': groupRole },
      }).restore;

      const result = AuthService.getInstance().checkAccess();
      expect(result).toEqual({ allowed: false });
    });
  });

  describe('checkAccess — cache bypass', () => {
    it('calls GroupsApp even on a cache hit when bypassCache is true', () => {
      const ctx = provisionAuthContext({
        members: { 'teacher@school.edu': 'MEMBER' },
      });
      restoreGlobals = ctx.restore;

      expect(AuthService.getInstance().checkAccess()).toEqual({ allowed: true, role: 'user' });
      expect(ctx.group.hasUser).toHaveBeenCalledTimes(1);

      AuthService.getInstance().checkAccess({ bypassCache: true });
      // Cache bypass forces a fresh GroupsApp lookup.
      expect(ctx.group.hasUser).toHaveBeenCalledTimes(2);
    });
  });

  describe('checkAccess — audit logging', () => {
    it('logs an allowed attempt with the caller email and the requested method', () => {
      restoreGlobals = provisionAuthContext({
        members: { 'teacher@school.edu': 'MEMBER' },
      }).restore;

      AuthService.getInstance().checkAccess({ method: 'getAssignment' });

      expect(flattenedLog()).toContain('teacher@school.edu');
      expect(flattenedLog()).toContain('getAssignment');
    });

    it('logs a denied attempt with the caller email and the requested method', () => {
      restoreGlobals = provisionAuthContext({ members: {} }).restore;

      AuthService.getInstance().checkAccess({ method: 'getAssignment' });

      expect(flattenedLog()).toContain('teacher@school.edu');
      expect(flattenedLog()).toContain('getAssignment');
    });
  });

  describe('checkAccess — cache write', () => {
    it('writes an auth:<groupEmail>:<email> key with a 6-hour TTL on success', () => {
      const realCache = globalThis.CacheService.getScriptCache();
      const spyCache = {
        get: vi.fn((key) => realCache.get(key)),
        put: vi.fn((key, value, ttl) => realCache.put(key, value, ttl)),
        remove: vi.fn((key) => realCache.remove(key)),
      };
      restoreGlobals = provisionAuthContext({
        members: { 'teacher@school.edu': 'MEMBER' },
        cache: spyCache,
      }).restore;

      const result = AuthService.getInstance().checkAccess();
      expect(result).toEqual({ allowed: true, role: 'user' });
      expect(spyCache.put).toHaveBeenCalledWith(
        'auth:teachers@school.edu:teacher@school.edu',
        JSON.stringify({ allowed: true, role: 'user' }),
        SIX_HOURS_SECONDS
      );
    });

    it('never writes to the cache for a denied attempt', () => {
      const realCache = globalThis.CacheService.getScriptCache();
      const spyCache = {
        get: vi.fn((key) => realCache.get(key)),
        put: vi.fn((key, value, ttl) => realCache.put(key, value, ttl)),
        remove: vi.fn((key) => realCache.remove(key)),
      };
      restoreGlobals = provisionAuthContext({
        members: {},
        cache: spyCache,
      }).restore;

      const result = AuthService.getInstance().checkAccess();
      expect(result).toEqual({ allowed: false });
      expect(spyCache.put).not.toHaveBeenCalled();
    });
  });
});
