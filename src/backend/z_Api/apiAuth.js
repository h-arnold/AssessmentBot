/* global AuthService, ConfigurationManager, ApiValidationError */

/**
 * Auth transport endpoints (ACTION_PLAN Section 5).
 *
 * Owns the three authentication endpoints registered in
 * `ALLOWLISTED_METHOD_HANDLERS` inside `z_apiHandler.js`:
 * `getApplicationAccess` (gate-exempt access-status read), and the admin-only
 * settings pair `getAuthenticationSettings` / `setAuthenticationSettings`.
 * Transport files stay thin: request-shape validation happens here, and every
 * domain invariant is enforced by `AuthService` (the access-resolution path and
 * the atomic settings save). Admin enforcement for the settings pair lives in
 * the dispatcher admission phase — it is deliberately NOT duplicated here.
 *
 * @remarks
 * `getApplicationAccess` joins `getAuthorisationStatus` in the dispatcher's
 * gate-exempt set (the same precedent used for the OAuth status read). Unlike
 * `getAuthorisationStatus`, it routes through the SHARED access-resolution path
 * in `AuthService`, so the Section 4 bootstrap claim fires on a fresh install
 * and the same call returns `reason: 'ok'` with the claimed admin role for the
 * first claimable caller.
 */

/**
 * Transport handler for `getApplicationAccess`.
 *
 * Resolves and shapes the caller's own application-access status; it performs
 * the fresh-install bootstrap claim through the shared access-resolution path.
 *
 * @returns {{
 *   allowed: boolean,
 *   role: 'admin'|'user'|null,
 *   email: string,
 *   reason: 'ok'|'freshInstall'|'brokenConfig'|'denied'
 * }} The exact `auth-users.md` access-status shape (no `provider`, no
 *   `'unconfigured'` reason).
 */
function getApplicationAccess_() {
  return AuthService.getInstance().resolveApplicationAccess({ method: 'getApplicationAccess' });
}

/**
 * Transport handler for `getAuthenticationSettings`.
 *
 * Shapes the current authentication settings from the configuration manager.
 * The dispatcher admission phase has already verified the caller is an admin
 * and that the stored auth state resolves, so in scriptProperties mode the
 * stored user list and revision are present and valid; in googleGroups mode the
 * user list is not applicable (`[]`) and the revision is not applicable
 * (`null`). The management-endpoint cache bypass is the dispatcher's
 * responsibility, not this handler's.
 *
 * @returns {{
 *   authMode: 'googleGroups'|'scriptProperties'|null,
 *   authGroupEmail: string,
 *   authUsers: Array<{email: string, role: 'admin'|'user'}>,
 *   authRevision: string|null
 * }} The settings shape defined by `auth-users.md`.
 */
function getAuthenticationSettings_() {
  const configManager = ConfigurationManager.getInstance();
  const stored = configManager.getAllConfigurations();
  const authGroupEmail = configManager.getAuthGroupEmail();
  const authMode = configManager.getAuthMode();

  if (authMode === 'scriptProperties') {
    return {
      authMode,
      authGroupEmail,
      authUsers: JSON.parse(stored.authUsers),
      authRevision: stored.authRevision ?? null,
    };
  }

  return {
    authMode,
    authGroupEmail,
    authUsers: [],
    authRevision: null,
  };
}

/**
 * Transport handler for `setAuthenticationSettings`.
 *
 * Validates the transport request shape (a plain object payload) and delegates
 * the atomic, revision-guarded save to the `AuthService` domain operation.
 *
 * @param {*} parameters - Candidate settings payload.
 * @returns {{ success: true, authRevision: string|null }} The commit result.
 * @throws {ApiValidationError} When `parameters` is not a plain object.
 */
function setAuthenticationSettings_(parameters) {
  if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) {
    throw new ApiValidationError('setAuthenticationSettings requires a parameters object', {
      method: 'setAuthenticationSettings',
    });
  }
  return AuthService.getInstance().saveAuthenticationSettings(parameters);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getApplicationAccess_,
    getAuthenticationSettings_,
    setAuthenticationSettings_,
  };
}
