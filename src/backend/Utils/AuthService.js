/* global BaseSingleton, ABLogger, ApiValidationError, AuthSettingsDomain, ConfigurationManager,
   Session, validateAuthStateStrict_, GoogleGroupsAuthService, ScriptPropertiesAuthService */
/**
 * AuthService
 *
 * Application-level access control singleton. This base class owns the
 * provider-resolution state machine (fresh install / legacy groups / configured
 * providers / broken config), identity resolution, audit logging, cache-policy
 * coordination, and the atomic fresh-install bootstrap claim (ACTION_PLAN
 * Section 4). Since Section 5 it also exposes the auth-management domain
 * operations consumed by the `z_Api/apiAuth.js` transport endpoints: the
 * gate-exempt access-status resolution (`resolveApplicationAccess`) and the
 * atomic settings save (`saveAuthenticationSettings`). Both delegate to the
 * `AuthSettingsDomain` module so the class stays a thin singleton facade;
 * provider-specific membership decisions are delegated to the concrete provider
 * subclasses (`GoogleGroupsAuthService`, `ScriptPropertiesAuthService`);
 * callers always use `AuthService.getInstance()` and never construct a provider
 * directly.
 *
 * @remarks
 * Provider-resolution order is: (1) freshness — a genuinely fresh install has no
 * `__CONFIG_STORE_KEY__` blob and is claimed by the first eligible interactive
 * caller (Section 4); (2) mode — the stored `authMode` is resolved
 * through the strict security read with the single documented leniency (an
 * absent/blank `authMode` paired with a non-blank `authGroupEmail` reads as
 * `googleGroups`, matching legacy hand-edited/cloned blobs); (3) provider — the
 * concrete provider is selected from the resolved mode and performs the
 * membership decision. The leniency exists solely to keep legacy installs that
 * stored only a group email working; every other broken configuration denies
 * fail-closed and never falls back to Google Groups.
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
    // makes the singleton pattern robust. Each class in the hierarchy keeps its
    // own singleton slot (`this.constructor._instance`), so provider subclass
    // instances never overwrite the base singleton slot.
    if (!isSingletonCreator) {
      throw new Error(
        'AuthService is a singleton. Use AuthService.getInstance() to get the instance.'
      );
    }

    if (!this.constructor._instance) {
      this.constructor._instance = this;
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
   * Resolves whether the active user is authorised for the protected surface.
   *
   * Thin caller-facing wrapper over the shared internal access-resolution
   * pipeline (`_resolveAccessDecision`): the same pipeline also backs the
   * gate-exempt `getApplicationAccess` endpoint, so the two paths can never
   * drift. `checkAccess` deliberately does NOT fall through to the new stored
   * state when a competing writer commits configuration during the bootstrap
   * claim — a claim-failure on the protected path denies fail-closed and the
   * next request resolves normally from the committed state. The gate-exempt
   * endpoint retains the fall-through (documented on `_resolveAccessDecision`).
   *
   * @param {Object} [options] - Optional overrides.
   * @param {boolean} [options.bypassCache=false] - Bypass the provider cache read (Google Groups only).
   * @param {boolean} [options.neverClaim=false] - Never bootstrap a fresh install (trigger context).
   * @param {string} [options.method] - Requested method, recorded in the audit log.
   * @returns {{ allowed: boolean, role?: string }} The access decision; `role`
   *   is present only when access is allowed.
   */
  checkAccess({ bypassCache = false, neverClaim = false, method = null } = {}) {
    const resolution = this._resolveAccessDecision({ bypassCache, neverClaim, method });
    return resolution.allowed ? { allowed: true, role: resolution.role } : { allowed: false };
  }

  /**
   * The single shared access-resolution pipeline for every caller path.
   *
   * The decision pipeline is: resolve and normalise the caller identity
   * (trimmed and lowercased — the AuthUserEntry storage contract; blank
   * identity always denies and never claims or caches), detect a genuinely
   * fresh install (the first eligible interactive caller is claimed as the
   * sole admin through the Section 4 bootstrap claim), run the strict
   * auth-state resolver (broken configuration denies fail-closed with an
   * error-level audit), and delegate the membership decision to the resolved
   * provider subclass. The provider is resolved from stored state on every
   * call; `bypassCache` and `neverClaim` are forwarded to the bootstrap claim
   * and provider selection.
   *
   * @remarks
   * Endpoint-specific claim-failure behaviour is the only intentional branch:
   * `checkAccess` (the protected path) always denies when the claim cannot
   * complete, while `AuthSettingsDomain.resolveApplicationAccess` passes
   * `fallThroughOnClaimFailure: true` so that a competing writer that already
   * committed a blob is resolved from that new state instead of being reported
   * as a transient denial. The identity, freshness, broken-state and
   * provider-selection steps are shared and must not be duplicated.
   *
   * @param {Object} [options] - Optional overrides.
   * @param {boolean} [options.bypassCache=false] - Bypass the provider cache read (Google Groups only).
   * @param {boolean} [options.neverClaim=false] - Never bootstrap a fresh install (trigger context).
   * @param {string} [options.method] - Requested method, recorded in the audit log.
   * @param {boolean} [options.fallThroughOnClaimFailure=false] - Resolve the
   *   newly committed state when a competing writer wins the bootstrap race.
   * @returns {{
   *   allowed: boolean,
   *   role: string|null,
   *   email: string,
   *   reason: 'ok'|'freshInstall'|'brokenConfig'|'denied'
   * }} The access decision; `role` is `null` unless allowed.
   */
  _resolveAccessDecision({
    bypassCache = false,
    neverClaim = false,
    method = null,
    fallThroughOnClaimFailure = false,
  } = {}) {
    // Resolve and normalise the server-resolved identity ONCE so every
    // downstream consumer (audit logs, provider membership checks, the
    // bootstrap claim) compares the same canonical form. Stored AuthUserEntry
    // emails are trimmed and lowercased by contract, so a raw identity with
    // mixed case or surrounding whitespace must be normalised before any
    // membership lookup or claim write.
    const email = Session.getActiveUser().getEmail().trim().toLowerCase();
    const configManager = ConfigurationManager.getInstance();

    // Defence-in-depth: a blank server-resolved identity can never be
    // authorised, claimed, or cached.
    if (!email) {
      ABLogger.getInstance().warn('AuthService: failed to resolve the active user email.', {
        email,
        method,
      });
      return {
        allowed: false,
        role: null,
        email,
        reason: configManager.isFreshInstall() ? 'freshInstall' : 'denied',
      };
    }

    if (configManager.isFreshInstall()) {
      // A genuinely fresh install is claimed by the first eligible interactive
      // caller through the Section 4 atomic bootstrap claim; trigger execution
      // (neverClaim) and blank-identity callers are denied without claiming.
      const claim = this._attemptBootstrapClaim(email, { neverClaim, method });
      if (claim.allowed) {
        return { allowed: true, role: claim.role, email, reason: 'ok' };
      }
      // A still-fresh store means the claim failed transiently (contention/cap/
      // write failure) or no claim was permitted; both deny without a write. A
      // non-fresh store means a competing writer committed configuration — only
      // the gate-exempt endpoint falls through to classify that new state.
      if (!fallThroughOnClaimFailure || configManager.isFreshInstall()) {
        return { allowed: false, role: null, email, reason: 'denied' };
      }
    }

    return this._resolveStoredAccess(configManager, email, bypassCache, method);
  }

  /**
   * Resolves access from the stored (non-fresh) auth state.
   *
   * Runs the strict auth-state resolver and delegates the membership decision
   * to the provider resolved from the stored mode. Broken configuration denies
   * fail-closed with an error-level audit.
   *
   * @param {ConfigurationManager} configManager - The configuration manager instance.
   * @param {string} email - The normalised, non-blank caller email.
   * @param {boolean} bypassCache - Bypass the provider cache read (Google Groups only).
   * @param {string|null} method - Requested method, recorded in the audit log.
   * @returns {{
   *   allowed: boolean,
   *   role: string|null,
   *   email: string,
   *   reason: 'ok'|'brokenConfig'|'denied'
   * }} The stored-state access decision.
   */
  _resolveStoredAccess(configManager, email, bypassCache, method) {
    const resolution = this._resolveAuthState(configManager);
    if (resolution.state === 'broken') {
      ABLogger.getInstance().error(
        'AuthService: broken authentication configuration denies access.',
        { email, method, reason: resolution.error.message }
      );
      return { allowed: false, role: null, email, reason: 'brokenConfig' };
    }

    const { authState } = resolution;
    const provider =
      authState.authMode === 'googleGroups'
        ? GoogleGroupsAuthService.getInstance()
        : ScriptPropertiesAuthService.getInstance();

    const decision = provider._resolveAccess({ email, authState, bypassCache, method });
    return {
      allowed: decision.allowed,
      role: decision.allowed ? decision.role : null,
      email,
      reason: decision.allowed ? 'ok' : 'denied',
    };
  }

  /**
   * Resolves the caller's application-access status for the gate-exempt
   * `getApplicationAccess` endpoint.
   *
   * @remarks
   * Delegates to the shared access-resolution domain logic in
   * `AuthSettingsDomain`. The same path as `checkAccess` performs the Section 4
   * bootstrap claim on a fresh install and classifies the outcome with the
   * `auth-users.md` reason enum, without exposing provider details.
   *
   * @param {Object} [options] - Optional overrides.
   * @param {string} [options.method] - Requested method, recorded in the audit log.
   * @returns {{
   *   allowed: boolean,
   *   role: string|null,
   *   email: string,
   *   reason: 'ok'|'freshInstall'|'brokenConfig'|'denied'
   * }} The access status; `role` is the application role when allowed and `null`
   *   otherwise, and `reason` follows the `auth-users.md` enum.
   */
  resolveApplicationAccess(options = {}) {
    return AuthSettingsDomain.resolveApplicationAccess(this, options);
  }

  /**
   * Commits a complete authentication-settings save atomically or not at all.
   *
   * @remarks
   * Domain-invariant enforcement (candidate validity, revision guard,
   * provider-switch saving-admin checks, mode-shape rules and the 8KB cap)
   * lives in `AuthSettingsDomain`; this is the AuthService-owned entry point
   * consumed by the `apiAuth.js` transport helper.
   *
   * @param {Object} settings - Candidate settings from the transport.
   * @returns {{ success: true, authRevision: string|null }} The commit result;
   *   the new revision in scriptProperties mode and `null` in googleGroups mode.
   * @throws {ApiValidationError} When any domain invariant is violated or the
   *   blob exceeds the 8KB cap; storage is unchanged.
   */
  saveAuthenticationSettings(settings) {
    return AuthSettingsDomain.saveAuthenticationSettings(this, settings);
  }

  /**
   * Strict auth-state resolver: the single source of the deny matrix.
   *
   * Reads the stored authentication configuration and runs the canonical strict
   * security read (`validateAuthStateStrict_`), which applies the single
   * absent/blank-mode-with-group leniency and throws on every other broken state
   * (stored `'none'`, unrecognised modes, blank groups, malformed user lists,
   * zero admins, missing or invalid revision). A `'configured'` result carries
   * the fully validated auth state used by the provider; a `'broken'` result
   * carries the validation error for the fail-closed audit (the error message
   * never contains raw user-list or revision values).
   * @param {ConfigurationManager} configManager - The configuration manager instance.
   * @returns {{ state: 'configured', authState: Object } |
   *           { state: 'broken', error: Error }} The resolution result.
   */
  _resolveAuthState(configManager) {
    const authConfig = configManager.getAllConfigurations();
    try {
      return { state: 'configured', authState: validateAuthStateStrict_(authConfig) };
    } catch (error) {
      return { state: 'broken', error };
    }
  }

  /**
   * Atomic first-admin bootstrap claim (ACTION_PLAN Section 4).
   *
   * A genuinely fresh install (no `__CONFIG_STORE_KEY__` blob) is claimed by the
   * first eligible interactive caller: the caller's server-resolved email
   * (already normalised to trimmed/lowercase and proven non-blank in
   * `checkAccess`) is committed as the sole admin. The claim re-checks
   * freshness before entering the shared locked write and again INSIDE the
   * lock, so a concurrent writer that committed a blob between the two probes
   * is never overwritten. The write goes through
   * `ConfigurationManager.writeConfigurationLocked` — the same script-wide
   * `LockService.getScriptLock()` shared with the vendored `DbLockService` —
   * as a single atomic lock/write operation, never nested inside a DB lock.
   *
   * @remarks
   * The in-lock re-check is the authoritative race guard: the Section 2 locked
   * write re-reads the RAW blob under the lock, so the mutator observes any blob
   * that appeared since the pre-lock probe and aborts the claim rather than
   * overwriting it. The claim writes ONLY auth fields; default seeding
   * (`ensureDefaultConfiguration`) is deliberately NOT invoked, so non-auth
   * getters continue to fall back to `DEFAULTS` on a claimed install (intended
   * behaviour — see SPEC.md "Bootstrap claim"). Contention, cap-excess or any
   * other write failure denies the request (fail closed) with a safe audit (no
   * raw auth values) and leaves a later request able to retry the claim.
   * @param {string} email - The resolved active-user email (normalised to
   *   trimmed/lowercase by `checkAccess`; non-blank).
   * @param {Object} [options] - Resolution options.
   * @param {boolean} [options.neverClaim=false] - True in the trigger execution context.
   * @param {string} [options.method] - Requested method, recorded in the audit log.
   * @returns {{ allowed: boolean, role?: string }} The access decision.
   */
  _attemptBootstrapClaim(email, { neverClaim = false, method = null } = {}) {
    if (neverClaim) {
      ABLogger.getInstance().info(
        'AuthService: fresh install detected but trigger execution never claims an admin.',
        { email, method, neverClaim }
      );
      return { allowed: false };
    }

    const configManager = ConfigurationManager.getInstance();

    // Freshness re-check before entering the locked write: a competing writer
    // may have committed a blob since the pre-lock probe in checkAccess. If one
    // appeared, the claim is skipped and access resolves from the stored state.
    if (!configManager.isFreshInstall()) {
      ABLogger.getInstance().info(
        'AuthService: bootstrap claim skipped — configuration appeared before the claim.',
        { email, method }
      );
      return { allowed: false };
    }

    // The caller becomes the sole admin. `checkAccess` has already normalised
    // the email (trimmed, lowercased), matching the AuthUserEntry storage
    // contract; writing it verbatim keeps the stored canonical form identical
    // to the identity used for later membership resolution.
    const serialisedUsers = JSON.stringify([{ email, role: 'admin' }]);

    try {
      // The shared locked write performs the single script-lock acquisition,
      // raw re-read, merge and write. The mutator deliberately ignores the
      // parsed snapshot and re-probes RAW storage via isFreshInstall(), because
      // the parsed snapshot cannot distinguish an absent key from a present
      // empty blob — only raw absence is genuinely fresh.
      configManager.writeConfigurationLocked(() => {
        if (!configManager.isFreshInstall()) {
          const abort = new Error(
            'Bootstrap claim aborted: configuration appeared while the script lock was held.'
          );
          abort.code = 'CONFIG_BOOTSTRAP_ABORT';
          throw abort;
        }
        return {
          authMode: 'scriptProperties',
          authUsers: serialisedUsers,
          authRevision: '1',
        };
      });
    } catch (error) {
      if (error.code === 'CONFIG_BOOTSTRAP_ABORT') {
        ABLogger.getInstance().warn(
          'AuthService: bootstrap claim skipped — a competing writer committed configuration first.',
          { email, method }
        );
        return { allowed: false };
      }
      // Lock contention, cap excess or a persistence failure: deny fail-closed
      // with a safe audit that never echoes the serialised admin list or the
      // revision value. The original thrown error is retained as developer-only
      // context (never exposed in the user-facing envelope) so the failure is
      // diagnosable. A later request may retry the claim.
      ABLogger.getInstance().warn(
        'AuthService: bootstrap claim failed — access denied; a later request may retry.',
        { email, method, code: error.code, err: error }
      );
      return { allowed: false };
    }

    ABLogger.getInstance().info('AuthService: fresh install claimed; caller granted admin.', {
      email,
      method,
      role: 'admin',
    });
    return { allowed: true, role: 'admin' };
  }

  /**
   * Provider membership-decision contract implemented by the concrete providers.
   *
   * The base class never resolves membership itself; the resolved provider
   * subclass overrides this method to produce the access decision.
   * @param {Object} options - Internal delegation options (email, resolved auth state, request options).
   * @returns {{ allowed: boolean, role?: string }} The access decision.
   */
  _resolveAccess(options) {
    throw new Error(
      'AuthService base does not resolve membership directly; the resolved provider subclass owns access decisions.'
    );
  }
}

// Export for Node/Vitest. The production GAS bundle resolves dependencies as
// pre-existing globals via concatenation; the test harness registers the real
// providers and the AuthSettingsDomain delegate on globalThis in
// tests/setupGlobals.js so AuthService's delegators resolve them the same way
// the concatenated GAS runtime does.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuthService;
}

if (typeof globalThis !== 'undefined') {
  globalThis.AuthService = AuthService;
}
