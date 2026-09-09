/* global BaseSingleton, ABLogger, ConfigurationManager, Session, validateAuthStateStrict_,
   GoogleGroupsAuthService, ScriptPropertiesAuthService */
/**
 * AuthService
 *
 * Application-level access control singleton. This base class owns the
 * provider-resolution state machine (fresh install / legacy groups / configured
 * providers / broken config), identity resolution, audit logging, cache-policy
 * coordination, and the bootstrap detection/claim wiring point (ACTION_PLAN
 * Section 4). Provider-specific membership decisions are delegated to the
 * concrete provider subclasses (`GoogleGroupsAuthService`,
 * `ScriptPropertiesAuthService`); callers always use
 * `AuthService.getInstance()` and never construct a provider directly.
 *
 * @remarks
 * Provider-resolution order is: (1) freshness — a genuinely fresh install has no
 * `__CONFIG_STORE_KEY__` blob and is classified/denied without mutation until the
 * Section 4 bootstrap claim lands; (2) mode — the stored `authMode` is resolved
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
   * The decision pipeline is: resolve the caller identity (blank identity always
   * denies and never claims or caches), detect a genuinely fresh install (denied
   * and classified without mutation until the Section 4 bootstrap claim), run the
   * strict auth-state resolver (broken configuration denies fail-closed with an
   * error-level audit), and delegate the membership decision to the resolved
   * provider subclass. The provider is resolved from stored state on every call;
   * the `bypassCache` and `neverClaim` options are passed through for the trigger
   * execution context.
   *
   * @param {Object} [options] - Optional overrides.
   * @param {boolean} [options.bypassCache=false] - Bypass the provider cache read (Google Groups only).
   * @param {boolean} [options.neverClaim=false] - Never bootstrap a fresh install (trigger context).
   * @param {string} [options.method] - Requested method, recorded in the audit log.
   * @returns {{ allowed: boolean, role?: string }} The access decision.
   */
  checkAccess({ bypassCache = false, neverClaim = false, method = null } = {}) {
    const email = Session.getActiveUser().getEmail();

    // Defence-in-depth: a blank server-resolved identity can never be authorised,
    // claimed, or cached.
    if (!email) {
      ABLogger.getInstance().warn('AuthService: failed to resolve the active user email.', {
        email,
        method,
      });
      return { allowed: false };
    }

    const configManager = ConfigurationManager.getInstance();
    if (configManager.isFreshInstall()) {
      // A genuinely fresh install is classified and denied without mutation in
      // this section; the Section 4 bootstrap claim wiring point owns the deny.
      return this._attemptBootstrapClaim(email, { neverClaim, method });
    }

    const resolution = this._resolveAuthState(configManager);
    if (resolution.state === 'broken') {
      ABLogger.getInstance().error(
        'AuthService: broken authentication configuration denies access.',
        { email, method, reason: resolution.error.message }
      );
      return { allowed: false };
    }

    const { authState } = resolution;
    const provider =
      authState.authMode === 'googleGroups'
        ? GoogleGroupsAuthService.getInstance()
        : ScriptPropertiesAuthService.getInstance();

    return provider._resolveAccess({
      email,
      authState,
      bypassCache,
      neverClaim,
      method,
    });
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
   * Bootstrap detection/claim wiring point (ACTION_PLAN Section 4).
   *
   * A genuinely fresh install (no `__CONFIG_STORE_KEY__` blob) is denied and
   * classified WITHOUT mutation in this section. Section 4 will replace this
   * deny with the atomic first-admin claim (script lock, in-lock freshness
   * re-check, single auth-only write of `authMode`, caller as sole admin and
   * `authRevision: '1'`) for claimable interactive callers. `neverClaim` is
   * reserved for the trigger context so triggers never bootstrap an admin.
   * @param {string} email - The resolved active-user email (non-blank).
   * @param {Object} [options] - Resolution options.
   * @param {boolean} [options.neverClaim=false] - True in the trigger execution context.
   * @param {string} [options.method] - Requested method, recorded in the audit log.
   * @returns {{ allowed: boolean }} The access decision (always denied in this section).
   */
  _attemptBootstrapClaim(email, { neverClaim = false, method = null } = {}) {
    ABLogger.getInstance().info(
      'AuthService: fresh install detected — no application configuration exists; access denied pending bootstrap.',
      { email, method, neverClaim }
    );
    return { allowed: false };
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
// providers on globalThis in tests/setupGlobals.js.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuthService;
}

if (typeof globalThis !== 'undefined') {
  globalThis.AuthService = AuthService;
}
