/* global ABLogger, ApiRateLimitError, ApiValidationError, ConfigurationManager, Session,
   validateAuthStateStrict_, GoogleGroupsAuthService, ScriptPropertiesAuthService */

/**
 * AuthSettingsDomain
 *
 * Auth-management domain logic for the `apiAuth.js` transport endpoints
 * (ACTION_PLAN Section 5). `AuthService` is the singleton facade and delegates
 * here so its file stays a thin, reviewable class; this module owns the two
 * settled domain operations:
 *
 * - `resolveApplicationAccess`: the gate-exempt access-status resolution. It
 *   routes through the SAME shared access-resolution path as `AuthService`
 *   `checkAccess` (fresh-install detection, the Section 4 bootstrap claim for
 *   the first eligible interactive caller, the strict auth-state resolver and
 *   the resolved provider's membership decision) and classifies the outcome
 *   with the `auth-users.md` reason enum.
 * - `saveAuthenticationSettings`: the atomic settings save. It enforces every
 *   domain invariant (candidate validity, last-admin rule, revision guard,
 *   provider-switch saving-admin checks, mode-shape rules and the 8KB cap) and
 *   commits through the Section 2 `ConfigurationManager.writeConfigurationLocked`
 *   path as exactly one locked write or none.
 *
 * GAS concatenation model: this file loads after `AuthService.js` (alphabetical
 * order within `src/backend/Utils/`). `AuthService` references the global
 * `AuthSettingsDomain` object only inside method bodies, so evaluation order
 * does not matter at load time; Node tests register the same global in
 * `tests/setupGlobals.js` before any auth resolution executes.
 */
const AuthSettingsDomain = {
  /**
   * Resolves the caller's application-access status for `getApplicationAccess`.
   *
   * @param {AuthService} authService - The AuthService singleton instance.
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
  resolveApplicationAccess(authService, { method = null } = {}) {
    const configManager = ConfigurationManager.getInstance();
    const email = Session.getActiveUser().getEmail().trim().toLowerCase();

    // A blank server-resolved identity is never claimable or authorised: on a
    // genuinely fresh store the caller cannot claim (`freshInstall`), and on
    // any existing store it is an ordinary denial.
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
      const claim = authService._attemptBootstrapClaim(email, { neverClaim: false, method });
      if (claim.allowed) {
        return { allowed: true, role: 'admin', email, reason: 'ok' };
      }
      // A failed claim on a still-fresh store (contention/cap/write failure) is
      // a transient denial; a later request may retry. When a competing writer
      // committed configuration, fall through and resolve the new state below.
      if (configManager.isFreshInstall()) {
        return { allowed: false, role: null, email, reason: 'denied' };
      }
    }

    const resolution = authService._resolveAuthState(configManager);
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
    const decision = provider._resolveAccess({ email, authState, method });

    if (decision.allowed) {
      return { allowed: true, role: decision.role, email, reason: 'ok' };
    }
    return { allowed: false, role: null, email, reason: 'denied' };
  },

  /**
   * Commits a complete authentication-settings save atomically or not at all.
   *
   * @param {AuthService} authService - The AuthService singleton instance.
   * @param {Object} settings - Candidate settings from the transport.
   * @param {'googleGroups'|'scriptProperties'} settings.authMode - Candidate mode.
   * @param {string} [settings.authGroupEmail] - Candidate group email (required non-blank in googleGroups mode).
   * @param {Array<{email: string, role: string}>} [settings.authUsers] - Full candidate list (required in scriptProperties mode; omitted in googleGroups mode).
   * @param {string} [settings.expectedAuthRevision] - Expected stored revision (required when a stored revision exists).
   * @returns {{ success: true, authRevision: string|null }} The commit result;
   *   the new revision in scriptProperties mode and `null` in googleGroups mode.
   * @throws {ApiValidationError} When any domain invariant is violated or the
   *   blob exceeds the 8KB cap; storage is unchanged.
   * @throws {ApiRateLimitError} When the configuration script lock cannot be
   *   acquired (contention); storage is unchanged and the caller may retry.
   */
  saveAuthenticationSettings(authService, settings) {
    const methodName = 'setAuthenticationSettings';
    const targetMode = settings.authMode;
    if (targetMode !== 'googleGroups' && targetMode !== 'scriptProperties') {
      throw this.settingsValidationError('Invalid authentication mode.', methodName, 'authMode');
    }

    const configManager = ConfigurationManager.getInstance();
    const currentResolution = authService._resolveAuthState(configManager);
    if (currentResolution.state === 'broken') {
      throw this.settingsValidationError(
        'Authentication settings cannot be saved while the stored authentication configuration is broken.',
        methodName,
        null,
        currentResolution.error
      );
    }

    const candidate = this.validatedSaveCandidate(methodName, targetMode, settings);
    if (currentResolution.authState.authMode !== targetMode) {
      this.verifySavingAdminForSwitch(methodName, targetMode, candidate);
    }

    const authRevision = this.commitSettingsSave(
      configManager,
      targetMode,
      settings.expectedAuthRevision,
      candidate,
      methodName
    );
    return { success: true, authRevision };
  },

  /**
   * Validates the candidate configuration through the canonical strict read.
   *
   * Reuses `validateAuthStateStrict_` so the `AuthUserEntry`/candidate rules
   * from the config schema are never duplicated in this domain module.
   * @param {string} methodName - Canonical method name for validation errors.
   * @param {'googleGroups'|'scriptProperties'} targetMode - Candidate mode.
   * @param {Object} settings - Candidate settings from the transport.
   * @returns {{ candidateUsersJson: string|null, candidateGroupEmail: string|null }}
   *   The canonical serialised candidate list (scriptProperties mode) and the
   *   trimmed candidate group email (googleGroups mode).
   * @throws {ApiValidationError} When the candidate configuration is invalid.
   */
  validatedSaveCandidate(methodName, targetMode, settings) {
    if (targetMode === 'scriptProperties') {
      if (settings.authUsers === undefined) {
        throw this.settingsValidationError(
          'A full candidate auth users list is required in scriptProperties mode.',
          methodName,
          'authUsers'
        );
      }
      try {
        const validated = validateAuthStateStrict_({
          authMode: 'scriptProperties',
          authUsers: JSON.stringify(settings.authUsers),
          authRevision: '1',
        });
        return { candidateUsersJson: validated.authUsers, candidateGroupEmail: null };
      } catch (error) {
        throw this.settingsValidationError(error.message, methodName, 'authUsers', error);
      }
    }

    if (settings.authUsers !== undefined) {
      throw this.settingsValidationError(
        'authUsers must be omitted when the mode is googleGroups.',
        methodName,
        'authUsers'
      );
    }
    try {
      const validated = validateAuthStateStrict_({
        authMode: 'googleGroups',
        authGroupEmail: settings.authGroupEmail,
      });
      return { candidateUsersJson: null, candidateGroupEmail: validated.authGroupEmail };
    } catch (error) {
      throw this.settingsValidationError(error.message, methodName, 'authGroupEmail', error);
    }
  },

  /**
   * Verifies the saving admin against the candidate configuration on a switch.
   *
   * Provider-switch candidate check (SPEC decision 7): for target
   * `scriptProperties` the saving admin must appear with role `admin` in the
   * candidate list; for target `googleGroups` a FRESH GroupsApp lookup against
   * the candidate group must yield `OWNER`/`MANAGER` (never the membership
   * cache). Same-mode saves are user add/remove/role-change and are exempt.
   * @param {string} methodName - Canonical method name for validation errors.
   * @param {'googleGroups'|'scriptProperties'} targetMode - Candidate mode.
   * @param {{ candidateUsersJson: string|null, candidateGroupEmail: string|null }} candidate - Validated candidate config.
   * @returns {void}
   * @throws {ApiValidationError} When the saving admin is not valid under the candidate config.
   */
  verifySavingAdminForSwitch(methodName, targetMode, candidate) {
    const email = Session.getActiveUser().getEmail().trim().toLowerCase();
    if (targetMode === 'scriptProperties') {
      const candidateUsers = JSON.parse(candidate.candidateUsersJson);
      const adminRetained = candidateUsers.some(
        (entry) => entry.email === email && entry.role === 'admin'
      );
      if (!adminRetained) {
        throw this.settingsValidationError(
          'The saving administrator must be an admin in the candidate list when switching to scriptProperties mode.',
          methodName,
          'authUsers'
        );
      }
      return;
    }
    const decision = GoogleGroupsAuthService.getInstance()._isGroupMember(
      email,
      candidate.candidateGroupEmail
    );
    if (!decision.allowed || decision.role !== 'admin') {
      throw this.settingsValidationError(
        'The saving administrator must be an OWNER or MANAGER of the candidate group when switching to googleGroups mode.',
        methodName,
        'authGroupEmail'
      );
    }
  },

  /**
   * Performs the single atomic locked settings write.
   *
   * Builds the next blob inside the `writeConfigurationLocked` mutator so the
   * revision guard compares against the RAW blob re-read under the script lock.
   * @param {ConfigurationManager} configManager - The configuration manager instance.
   * @param {'googleGroups'|'scriptProperties'} targetMode - Candidate mode.
   * @param {string} [expectedAuthRevision] - Expected stored revision (scriptProperties mode).
   * @param {{ candidateUsersJson: string|null, candidateGroupEmail: string|null }} candidate - Validated candidate config.
   * @param {string} methodName - Canonical method name for validation errors.
   * @returns {string|null} The committed revision (null in googleGroups mode).
   * @throws {ApiValidationError} On a stale/omitted revision or an over-cap blob.
   * @throws {ApiRateLimitError} On configuration-lock contention; no write
   *   occurred and the caller may retry.
   */
  commitSettingsSave(configManager, targetMode, expectedAuthRevision, candidate, methodName) {
    let committedRevision = null;
    try {
      configManager.writeConfigurationLocked((current) => {
        if (targetMode === 'googleGroups') {
          // Groups mode: revision not applicable; a stored (legacy) user list /
          // revision is retained but not used (auth-users.md persistence rules).
          return {
            ...current,
            authMode: 'googleGroups',
            authGroupEmail: candidate.candidateGroupEmail,
          };
        }
        committedRevision = this.nextAuthRevision(expectedAuthRevision, current, methodName);
        return {
          ...current,
          authMode: 'scriptProperties',
          authUsers: candidate.candidateUsersJson,
          authRevision: committedRevision,
        };
      });
    } catch (error) {
      if (error?.code === 'CONFIG_LOCK_CONTENTION') {
        // SPEC decision 12 / auth-users.md persistence rules: configuration-lock
        // contention is transient and must surface to the transport boundary as a
        // retriable rate-limit envelope (ApiRateLimitError → RATE_LIMITED), never
        // as a non-retriable INTERNAL_ERROR. The raw CONFIG_LOCK_CONTENTION error
        // is an internal write-path signal and is not frontend-safe on its own.
        ABLogger.getInstance().warn(
          'AuthService: authentication settings save aborted — configuration lock contention.',
          { method: methodName }
        );
        throw new ApiRateLimitError(
          'Authentication settings could not be saved because the configuration lock is busy. Please retry.',
          { method: methodName, cause: error }
        );
      }
      if (error?.code === 'CONFIG_BLOB_TOO_LARGE') {
        ABLogger.getInstance().warn(
          'AuthService: authentication settings exceed the configuration blob cap.',
          { method: methodName }
        );
        throw this.settingsValidationError(
          'Authentication settings exceed the 8KB configuration cap and were not saved.',
          methodName,
          'authUsers',
          error
        );
      }
      throw error;
    }
    return committedRevision;
  },

  /**
   * Computes the next revision or rejects a stale/omitted expected revision.
   * @param {string} [expectedAuthRevision] - Expected stored revision from the request.
   * @param {Object} current - The fresh config snapshot re-read under the lock.
   * @param {string} methodName - Canonical method name for validation errors.
   * @returns {string} The next revision string (`'1'` seed or incremented value).
   * @throws {ApiValidationError} When a stored revision exists but the expected revision is missing or stale.
   */
  nextAuthRevision(expectedAuthRevision, current, methodName) {
    const storedRevision =
      current.authRevision == null || String(current.authRevision).trim() === ''
        ? null
        : String(current.authRevision).trim();
    if (storedRevision === null) {
      // First switch from groups/legacy (no stored revision): no expected
      // revision is required and the seed is '1'.
      return '1';
    }
    if (expectedAuthRevision === undefined) {
      throw this.settingsValidationError(
        'expectedAuthRevision is required when a stored auth revision exists.',
        methodName,
        'expectedAuthRevision'
      );
    }
    if (String(expectedAuthRevision) !== storedRevision) {
      throw this.settingsValidationError(
        'Stale auth revision: the stored settings changed since this save was prepared.',
        methodName,
        'expectedAuthRevision'
      );
    }
    return String(Number.parseInt(storedRevision, 10) + 1);
  },

  /**
   * Builds an `ApiValidationError` for a settings-save violation.
   * @param {string} message - Safe, human-readable validation message.
   * @param {string} method - Canonical method name.
   * @param {string|null} [fieldName] - Related request field, when applicable.
   * @param {Error} [cause] - The underlying error, when wrapping one.
   * @returns {ApiValidationError} The constructed validation error.
   */
  settingsValidationError(message, method, fieldName = null, cause) {
    return new ApiValidationError(message, { method, fieldName, cause });
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AuthSettingsDomain };
}
