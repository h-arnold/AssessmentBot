/* global AuthService, ABLogger */
/**
 * ScriptPropertiesAuthService
 *
 * Script Properties user-list membership provider for the AuthService hierarchy.
 * Resolves whether the caller appears in the stored `authUsers` list and maps the
 * stored role directly to the application role (`admin`/`user`). The stored list
 * is read fresh on every request through the base's strict auth-state resolver;
 * this provider never reads or writes a cache entry. Broken stored state is
 * rejected before this provider is reached by the strict resolver and emits the
 * error-level audit in the base.
 *
 * GAS concatenation model: this file loads after `AuthService.js` (alphabetical
 * order within `src/backend/Utils/`), so the base class is already a global when
 * this subclass is declared. Callers never construct this provider directly; the
 * base resolves it from the stored `authMode` and delegates via `_resolveAccess`.
 */
class ScriptPropertiesAuthService extends AuthService {
  /**
   * Resolves caller membership against the stored auth user list.
   *
   * Parses the validated `authUsers` JSON array from the resolved auth state and
   * looks up the caller's email. A listed caller is allowed with their stored
   * role; an unlisted caller is denied. The list is never memoised and no cache
   * entry is written under this provider.
   * @param {Object} options - Internal delegation options from the base.
   * @param {string} options.email - The resolved active-user email, normalised to
   *   trimmed/lowercase by the base before delegation so it matches the canonical
   *   stored `AuthUserEntry` emails.
   * @param {Object} options.authState - The validated auth state (contains the
   *   parsed `authUsersParsed` list produced by the strict resolver).
   * @param {string} [options.method] - Requested method, recorded in the audit log.
   * @returns {{ allowed: boolean, role?: string }} The access decision.
   */
  _resolveAccess({ email, authState, method = null }) {
    // The strict resolver already parsed and validated the stored list, so
    // reuse that canonical result directly rather than re-parsing the JSON.
    const users = authState.authUsersParsed;
    const entry = users.find((user) => user.email === email);
    if (!entry) {
      ABLogger.getInstance().warn('AuthService: access denied.', {
        email,
        method,
        allowed: false,
      });
      return { allowed: false };
    }

    // No success cache: the stored list is read fresh on every request.
    ABLogger.getInstance().info('AuthService: access granted.', {
      email,
      method,
      allowed: true,
      role: entry.role,
    });
    return { allowed: true, role: entry.role };
  }
}

// Each provider class keeps its own singleton slot. Without an own `_instance`
// property, `ScriptPropertiesAuthService._instance` would resolve through the
// prototype chain to `AuthService._instance` (JS statics are inherited), which
// would make getInstance() return the base singleton instead of this provider.
ScriptPropertiesAuthService._instance = null;

// Export for Node/Vitest. The production GAS bundle resolves AuthService as a
// pre-existing global via concatenation order (this file loads after
// `AuthService.js`); the test harness registers this provider on globalThis in
// tests/setupGlobals.js.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ScriptPropertiesAuthService;
}

if (typeof globalThis !== 'undefined') {
  globalThis.ScriptPropertiesAuthService = ScriptPropertiesAuthService;
}
