/* global BaseSingleton, ABLogger, ConfigurationManager, Session, GroupsApp, CacheManager, Validate */
/**
 * AuthService
 *
 * Application-level access control singleton. Verifies that a caller is a member
 * of a configured Google Group before any protected request is dispatched,
 * resolves the caller's application role, caches successful results through the
 * CacheManager generic methods, and audits every attempt via ABLogger.
 *
 * Use AuthService.getInstance(); do not call the constructor directly.
 */

/**
 * The auth service singleton.
 */
class AuthService extends BaseSingleton {
  /**
   * Creates the AuthService singleton instance.
   * Intentionally lightweight — all heavy dependencies are resolved lazily as
   * the singleton is used, never during construction.
   * @param {boolean} isSingletonCreator - Indicates this is the legitimate singleton construction.
   */
  constructor(isSingletonCreator = false) {
    super();

    // Prevent direct instantiation. ESLint is helpful, but runtime enforcement
    // makes the singleton pattern robust.
    if (!isSingletonCreator) {
      throw new Error(
        'AuthService is a singleton. Use AuthService.getInstance() to get the instance.'
      );
    }

    if (!AuthService._instance) {
      AuthService._instance = this;
    }
  }

  /**
   * Resets the singleton instance so tests start from a clean state.
   * @returns {void}
   */
  static resetForTests() {
    super.resetForTests();
    AuthService._instance = null;
  }

  /**
   * Canonical accessor — always use this instead of `new`.
   * @returns {AuthService} The singleton AuthService instance.
   */
  static getInstance() {
    return super.getInstance();
  }

  /**
   * Resolves whether a given email is a member of the configured Google Group
   * and, if so, maps the Google Group role to an application role.
   *
   * This private helper is named `_isGroupMember` rather than `isAuthorised` to
   * avoid ambiguity with `ScriptAppManager.isAuthorised()` (which checks OAuth
   * scopes, an unrelated concern). Both `email` and `groupEmail` are required;
   * `Validate.requireParams` enforces their presence.
   * @param {string} email - The active user's email to authorise.
   * @param {string} groupEmail - The configured Google Group email.
   * @returns {{ allowed: boolean, role?: string }} `{ allowed: true, role }` when
   *   the user is a member; `{ allowed: false }` otherwise (non-member, denied
   *   role, group lookup failure).
   */
  _isGroupMember(email, groupEmail) {
    Validate.requireParams({ email, groupEmail }, '_isGroupMember');
    try {
      const group = GroupsApp.getGroupByEmail(groupEmail);
      if (!group.hasUser(email)) {
        return { allowed: false };
      }

      const groupRole = group.getRole(email);
      if (groupRole === 'OWNER' || groupRole === 'MANAGER') {
        return { allowed: true, role: 'admin' };
      }
      if (groupRole === 'MEMBER') {
        return { allowed: true, role: 'user' };
      }
      return { allowed: false };
    } catch (error) {
      // Group lookup failure (group not found / GroupsApp error) → deny.
      ABLogger.getInstance().error('AuthService: group lookup failed.', {
        email,
        groupEmail,
        err: error,
      });
      return { allowed: false };
    }
  }

  /**
   * Resolves whether the active user is authorised for the protected surface.
   *
   * When the configured `authMode` is `'none'`, access is granted immediately as
   * a plain `user` without reading the group email, resolving the session
   * identity, or consulting the cache (temporary development bypass — see the
   * inline comment). Otherwise:
   *
   * Reads the configured Google Group email from ConfigurationManager, resolves
   * the caller via Session, and (unless a cached result, a cache bypass is
   * requested, or the group is unconfigured) verifies membership through
   * GroupsApp. Successful authorisations are cached for six hours under the key
   * `auth:<groupEmail>:<email>`; denials are never cached and `bypassCache: true`
   * skips the cache read but still writes the refreshed allowed result. Every
   * attempt is audited via ABLogger including the requested method when supplied.
   *
   * Fail-open bootstrap: when the group email is unconfigured and
   * `requireConfigured` is falsy, access is granted as a `user` with a warning
   * (allows the admin to reach the settings form). When `requireConfigured` is
   * set, access fails closed (used by triggers).
   * @param {Object} [options] - Optional overrides.
   * @param {boolean} [options.bypassCache=false] - Bypass the auth cache read.
   * @param {boolean} [options.requireConfigured=false] - Deny when the group is unconfigured.
   * @param {string} [options.method] - Requested method, recorded in the audit log.
   * @returns {{ allowed: boolean, role?: string }} The access decision.
   */
  checkAccess({ bypassCache = false, requireConfigured = false, method = null } = {}) {
    // TEMPORARY DEVELOPMENT MEASURE — DO NOT USE IN PRODUCTION.
    // When authMode is 'none' the entire group-membership gate is bypassed and every
    // caller is authorised as a plain user. This exists only so the application can be
    // exercised locally when Google Groups access cannot be reached. It MUST be removed
    // or gated behind a build flag before any production deployment — leaving it enabled
    // disables all application-level access control.
    const configManager = ConfigurationManager.getInstance();
    const authMode = configManager.getAuthMode();
    if (authMode === 'none') {
      ABLogger.getInstance().warn(
        'AuthService: auth mode is "none" — bypassing the group-membership gate (TEMPORARY DEVELOPMENT MEASURE, must not be used in production).',
        { method, authMode: 'none' }
      );
      return { allowed: true, role: 'user' };
    }

    const groupEmail = configManager.getAuthGroupEmail();
    const email = Session.getActiveUser().getEmail();

    // Bootstrap state: no auth group configured.
    if (!groupEmail) {
      if (requireConfigured) {
        ABLogger.getInstance().error('AuthService: auth group email is not configured.', {
          email,
          method,
          groupEmail,
        });
        return { allowed: false };
      }
      // Fail-open so the admin can reach the settings form to configure the group.
      ABLogger.getInstance().warn('Auth group email not configured — failing open.', {
        email,
        method,
        groupEmail,
      });
      return { allowed: true, role: 'user' };
    }

    // Defence-in-depth: a blank identity can never be authorised.
    if (!email) {
      ABLogger.getInstance().warn('AuthService: failed to resolve the active user email.', {
        email,
        method,
        groupEmail,
      });
      return { allowed: false };
    }

    const cache = new CacheManager();
    const cacheKey = `auth:${groupEmail}:${email}`;

    if (!bypassCache) {
      const cached = cache.get(cacheKey);
      if (cached?.allowed) {
        ABLogger.getInstance().info('AuthService: access granted (cached).', {
          email,
          method,
          groupEmail,
          allowed: true,
          role: cached.role,
        });
        return { allowed: true, role: cached.role };
      }
    }

    const decision = this._isGroupMember(email, groupEmail);
    if (!decision.allowed) {
      ABLogger.getInstance().warn('AuthService: access denied.', {
        email,
        method,
        groupEmail,
        allowed: false,
      });
      return { allowed: false };
    }

    // Successful authorisations are always cached — even on a cache bypass — so
    // a fresh result is memoised for subsequent requests within the TTL.
    cache.put(cacheKey, { allowed: true, role: decision.role }, CacheManager.CACHE_EXPIRY_SECONDS);

    ABLogger.getInstance().info('AuthService: access granted.', {
      email,
      method,
      groupEmail,
      allowed: true,
      role: decision.role,
    });
    return { allowed: true, role: decision.role };
  }
}

// Export for Node/Vitest. The production GAS bundle resolves CacheManager as a
// pre-existing global via concatenation; the test harness registers the real
// CacheManager on globalThis in tests/setupGlobals.js.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuthService;
}

if (typeof globalThis !== 'undefined') {
  globalThis.AuthService = AuthService;
}
