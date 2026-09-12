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

/**
 * Stable, safe API error codes for authentication-settings save failures.
 *
 * These are emitted as the transport envelope `error.code` (never as raw prose)
 * so the frontend can map user-safe copy exclusively from `error.code`, as
 * required by the frontend logging/error-handling policy. They are deliberately
 * distinct from the generic `INVALID_REQUEST` code because each represents a
 * different recovery path (stale revision, last-admin conflict, invalid
 * candidate list, saving-admin denial). Lock contention and GroupsApp
 * service-unavailable failures keep the retriable `RATE_LIMITED` envelope.
 * @type {Readonly<Object>}
 */
const AUTH_SETTINGS_ERROR_CODES = Object.freeze({
  STALE_REVISION: 'AUTH_SETTINGS_STALE_REVISION',
  REVISION_REQUIRED: 'AUTH_SETTINGS_REVISION_REQUIRED',
  LAST_ADMIN: 'AUTH_SETTINGS_LAST_ADMIN',
  INVALID_CANDIDATE: 'AUTH_SETTINGS_INVALID_CANDIDATE',
  SAVING_ADMIN_DENIED: 'AUTH_SETTINGS_SAVING_ADMIN_DENIED',
});

/**
 * Increments a canonical positive-integer decimal string by one.
 *
 * Uses decimal string arithmetic instead of `Number`/`Number.parseInt` so the
 * revision stays exact for arbitrarily long values (beyond
 * `Number.MAX_SAFE_INTEGER`) and never loses precision by round-tripping
 * through a floating-point number.
 *
 * @param {string} value - Canonical positive-integer string to increment.
 * @returns {string} The incremented positive-integer string.
 */
function incrementAuthRevision_(value) {
  const zeroDigitCodePoint = 48;
  const decimalRadix = 10;
  let result = '';
  let carry = 1;
  for (let index = value.length - 1; index >= 0; index -= 1) {
    const digit = value.codePointAt(index) - zeroDigitCodePoint + carry;
    result = String(digit % decimalRadix) + result;
    carry = digit >= decimalRadix ? 1 : 0;
  }
  return carry === 1 ? '1' + result : result;
}

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
    // Consume the ONE shared access-resolution pipeline owned by AuthService;
    // this endpoint shapes its result only. `fallThroughOnClaimFailure` is the
    // one endpoint-specific difference: the gate-exempt access read classifies
    // the state a competing writer committed during the bootstrap claim, while
    // the protected `checkAccess` path denies fail-closed without falling
    // through.
    return authService._resolveAccessDecision({ method, fallThroughOnClaimFailure: true });
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
      throw this.settingsValidationError(
        'Invalid authentication mode.',
        methodName,
        'authMode',
        undefined,
        AUTH_SETTINGS_ERROR_CODES.INVALID_CANDIDATE
      );
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
   * @returns {{
   *   candidateUsersJson: string|null,
   *   candidateUsers: Array<{email: string, role: string}>|null,
   *   candidateGroupEmail: string|null
   * }} The canonical serialised candidate list and its parsed form
   *   (scriptProperties mode), or the trimmed candidate group email
   *   (googleGroups mode).
   * @throws {ApiValidationError} When the candidate configuration is invalid.
   */
  validatedSaveCandidate(methodName, targetMode, settings) {
    if (targetMode === 'scriptProperties') {
      if (settings.authUsers === undefined) {
        throw this.settingsValidationError(
          'A full candidate auth users list is required in scriptProperties mode.',
          methodName,
          'authUsers',
          undefined,
          AUTH_SETTINGS_ERROR_CODES.INVALID_CANDIDATE
        );
      }
      try {
        const validated = validateAuthStateStrict_({
          authMode: 'scriptProperties',
          authUsers: JSON.stringify(settings.authUsers),
          authRevision: '1',
        });
        return {
          candidateUsersJson: validated.authUsers,
          // Reuse the parsed list the strict resolver already produced rather
          // than re-parsing the canonical JSON in the switch check.
          candidateUsers: validated.authUsersParsed,
          candidateGroupEmail: null,
        };
      } catch (error) {
        // The strict resolver is the single validation authority: it tags the
        // zero-admin case so the domain can distinguish a last-admin conflict
        // from any other invalid candidate without matching prose.
        const code =
          error?.reason === 'ZERO_ADMINS'
            ? AUTH_SETTINGS_ERROR_CODES.LAST_ADMIN
            : AUTH_SETTINGS_ERROR_CODES.INVALID_CANDIDATE;
        throw this.settingsValidationError(error.message, methodName, 'authUsers', error, code);
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
      return {
        candidateUsersJson: null,
        candidateUsers: null,
        candidateGroupEmail: validated.authGroupEmail,
      };
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
   * @param {{ candidateUsersJson: string|null, candidateUsers: Array<{email: string, role: string}>|null, candidateGroupEmail: string|null }} candidate - Validated candidate config.
   * @returns {void}
   * @throws {ApiValidationError} When the saving admin is not valid under the candidate config.
   * @throws {ApiRateLimitError} When the candidate Google Group lookup fails at
   *   the external service (retriable); a genuine non-admin role is instead an
   *   `ApiValidationError` so operators can tell the two apart.
   */
  verifySavingAdminForSwitch(methodName, targetMode, candidate) {
    const email = Session.getActiveUser().getEmail().trim().toLowerCase();
    if (targetMode === 'scriptProperties') {
      const adminRetained = candidate.candidateUsers.some(
        (entry) => entry.email === email && entry.role === 'admin'
      );
      if (!adminRetained) {
        throw this.settingsValidationError(
          'The saving administrator must be an admin in the candidate list when switching to scriptProperties mode.',
          methodName,
          'authUsers',
          undefined,
          AUTH_SETTINGS_ERROR_CODES.SAVING_ADMIN_DENIED
        );
      }
      return;
    }

    // Distinguish an external GroupsApp lookup failure (transient, retriable)
    // from a genuine non-admin result (a validation failure). `_isGroupMember`
    // swallows lookup errors for the access path, so use the candidate-specific
    // resolver that lets the external failure propagate.
    let isCandidateAdmin;
    try {
      isCandidateAdmin = GoogleGroupsAuthService.getInstance()._resolveCandidateAdmin(
        email,
        candidate.candidateGroupEmail
      );
    } catch (error) {
      ABLogger.getInstance().warn(
        'AuthService: candidate group lookup failed during a provider switch; save aborted.',
        { method: methodName, err: error }
      );
      throw new ApiRateLimitError(
        'The candidate Google Group could not be checked because the Groups service is unavailable. Please retry.',
        { method: methodName, cause: error }
      );
    }

    if (!isCandidateAdmin) {
      throw this.settingsValidationError(
        'The saving administrator must be an OWNER or MANAGER of the candidate group when switching to googleGroups mode.',
        methodName,
        'authGroupEmail',
        undefined,
        AUTH_SETTINGS_ERROR_CODES.SAVING_ADMIN_DENIED
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
          // Groups mode: revision not applicable. A stored (legacy) user list is
          // retained but not used (auth-users.md persistence rules). The retained
          // revision is cleared so a later switch back to scriptProperties seeds a
          // fresh revision instead of demanding an expectedAuthRevision the
          // groups-mode read never returned.
          const next = {
            ...current,
            authMode: 'googleGroups',
            authGroupEmail: candidate.candidateGroupEmail,
          };
          delete next.authRevision;
          return next;
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
   * @throws {ApiValidationError} When the expected revision is not a string, or
   *   a stored revision exists but the expected revision is missing or stale.
   */
  nextAuthRevision(expectedAuthRevision, current, methodName) {
    // Defence-in-depth: the transport boundary already rejects a non-string
    // expected revision. Reject it here too so a direct domain caller can never
    // force a coercion-based match against the stored revision.
    if (expectedAuthRevision !== undefined && typeof expectedAuthRevision !== 'string') {
      throw this.settingsValidationError(
        'expectedAuthRevision must be a string.',
        methodName,
        'expectedAuthRevision'
      );
    }
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
        'expectedAuthRevision',
        undefined,
        AUTH_SETTINGS_ERROR_CODES.REVISION_REQUIRED
      );
    }
    if (expectedAuthRevision !== storedRevision) {
      throw this.settingsValidationError(
        'Stale auth revision: the stored settings changed since this save was prepared.',
        methodName,
        'expectedAuthRevision',
        undefined,
        AUTH_SETTINGS_ERROR_CODES.STALE_REVISION
      );
    }
    return incrementAuthRevision_(storedRevision);
  },

  /**
   * Builds an `ApiValidationError` for a settings-save violation.
   * @param {string} message - Safe, human-readable validation message.
   * @param {string} method - Canonical method name.
   * @param {string|null} [fieldName] - Related request field, when applicable.
   * @param {Error} [cause] - The underlying error, when wrapping one.
   * @param {string|null} [code] - Stable API error code surfaced as the
   *   transport envelope `error.code`; `null` keeps the generic
   *   `INVALID_REQUEST` mapping.
   * @returns {ApiValidationError} The constructed validation error.
   */
  settingsValidationError(message, method, fieldName = null, cause, code = null) {
    return new ApiValidationError(message, { method, fieldName, cause, code });
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AuthSettingsDomain, AUTH_SETTINGS_ERROR_CODES };
}
