/* global AuthService, ABLogger, CacheManager, GroupsApp, Validate */
/**
 * GoogleGroupsAuthService
 *
 * Google Groups membership provider for the AuthService hierarchy. Resolves
 * whether the caller is a member of the configured Google Group, maps the group
 * role to an application role (OWNER/MANAGER → `admin`, MEMBER → `user`),
 * caches successful results under the unchanged key `auth:<groupEmail>:<email>`
 * with the six-hour TTL, never caches denials, and honours `bypassCache: true`
 * by forcing a fresh GroupsApp lookup.
 *
 * GAS concatenation model: this file loads after `AuthService.js` (alphabetical
 * order within `src/backend/Utils/`), so the base class is already a global when
 * this subclass is declared. Callers never construct this provider directly; the
 * base resolves it from the stored `authMode` and delegates via `_resolveAccess`.
 */
class GoogleGroupsAuthService extends AuthService {
  /**
   * Resolves Google Groups membership for the caller and maps the group role.
   *
   * Reads the cache unless `bypassCache` is set, then performs a fresh GroupsApp
   * lookup on a miss or bypass. Successful results are always cached (including
   * on a bypass, so the refreshed result is memoised within the TTL); denials are
   * never cached. The resolved `authState.authGroupEmail` comes from the base's
   * strict auth-state resolver and is therefore non-blank.
   * @param {Object} options - Internal delegation options from the base.
   * @param {string} options.email - The resolved active-user email.
   * @param {Object} options.authState - The validated auth state (contains `authGroupEmail`).
   * @param {boolean} [options.bypassCache=false] - Bypass the cache read and force a fresh lookup.
   * @param {string} [options.method] - Requested method, recorded in the audit log.
   * @returns {{ allowed: boolean, role?: string }} The access decision.
   */
  _resolveAccess({ email, authState, bypassCache = false, method = null }) {
    const groupEmail = authState.authGroupEmail;
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

  /**
   * Resolves whether a given email is a member of the given Google Group and, if
   * so, maps the Google Group role to an application role.
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
      return this._mapGroupDecision(this._resolveGroupRole(email, groupEmail));
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
   * Resolves a caller's Google Group role via a FRESH GroupsApp lookup.
   *
   * Unlike `_isGroupMember`, this lets an external GroupsApp failure propagate
   * so callers that must distinguish "lookup failed" from "not a member" (the
   * provider-switch saving-admin check) can do so. A non-member resolves to
   * `null`.
   * @param {string} email - The active user's email to resolve.
   * @param {string} groupEmail - The Google Group email.
   * @returns {string|null} The group role (`OWNER`/`MANAGER`/`MEMBER`/…), or
   *   `null` when the user is not a member.
   * @throws {Error} When the GroupsApp lookup itself fails.
   */
  _resolveGroupRole(email, groupEmail) {
    const group = GroupsApp.getGroupByEmail(groupEmail);
    if (!group.hasUser(email)) {
      return null;
    }
    return group.getRole(email);
  }

  /**
   * Maps a Google Group role to an application-access decision.
   * @param {string|null} groupRole - The resolved group role, or null for a non-member.
   * @returns {{ allowed: boolean, role?: string }} The access decision.
   */
  _mapGroupDecision(groupRole) {
    if (groupRole === 'OWNER' || groupRole === 'MANAGER') {
      return { allowed: true, role: 'admin' };
    }
    if (groupRole === 'MEMBER') {
      return { allowed: true, role: 'user' };
    }
    return { allowed: false };
  }

  /**
   * Resolves whether a caller is a fresh OWNER/MANAGER of the given group.
   *
   * Used by the provider-switch saving-admin check. An external GroupsApp
   * failure is NOT collapsed into a role denial: it propagates so the caller can
   * surface a retriable service failure, while a genuine non-admin resolves to
   * `false`.
   * @param {string} email - The saving administrator's email.
   * @param {string} groupEmail - The candidate Google Group email.
   * @returns {boolean} True only when the fresh lookup resolves OWNER/MANAGER.
   * @throws {Error} When the GroupsApp lookup fails.
   */
  _resolveCandidateAdmin(email, groupEmail) {
    Validate.requireParams({ email, groupEmail }, '_resolveCandidateAdmin');
    const groupRole = this._resolveGroupRole(email, groupEmail);
    return groupRole === 'OWNER' || groupRole === 'MANAGER';
  }
}

// Each provider class keeps its own singleton slot. Without an own `_instance`
// property, `GoogleGroupsAuthService._instance` would resolve through the
// prototype chain to `AuthService._instance` (JS statics are inherited), which
// would make getInstance() return the base singleton instead of this provider.
GoogleGroupsAuthService._instance = null;

// Export for Node/Vitest. The production GAS bundle resolves AuthService as a
// pre-existing global via concatenation order (this file loads after
// `AuthService.js`); the test harness registers this provider on globalThis in
// tests/setupGlobals.js.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GoogleGroupsAuthService;
}

if (typeof globalThis !== 'undefined') {
  globalThis.GoogleGroupsAuthService = GoogleGroupsAuthService;
}
