/**
 * Configuration keys and schema definitions for ConfigurationManager.
 */

// Validator functions are provided by a shared module in tests and at runtime
// through the global scope (Apps Script global-like environment). Do not
// require them here to avoid duplicate declaration errors when running in
// the GAS runtime where these are already present on the global object.
// Tests will populate these on globalThis in `tests/setupGlobals.js`.
/* global validateLogLevel_, validateApiKey_, toBooleanString_, Validate */

const BACKEND_ASSESSOR_BATCH_MAX = 500;
const SLIDES_FETCH_BATCH_MAX = 100;
const DAYS_UNTIL_AUTH_REVOKE_MAX = 365;
const JSON_DB_LOCK_TIMEOUT_MIN_MS = 30000;
const JSON_DB_LOCK_TIMEOUT_MAX_MS = 600000;

/**
 * Conservative upper bound (in bytes) for the entire serialised configuration blob
 * stored under `__CONFIG_STORE_KEY__`. Enforced on every configuration write by the
 * Section 2 locked write path. Script Properties enforces a 9KB-per-value quota, so we
 * cap at 8KB to leave headroom.
 */
const KIBIBYTE_IN_BYTES = 1024;
const MAX_CONFIG_BLOB_KIBIBYTES = 8;
const MAX_CONFIG_BLOB_BYTES = MAX_CONFIG_BLOB_KIBIBYTES * KIBIBYTE_IN_BYTES;

const CONFIG_KEYS = Object.freeze({
  BACKEND_ASSESSOR_BATCH_SIZE: 'backendAssessorBatchSize',
  SLIDES_FETCH_BATCH_SIZE: 'slidesFetchBatchSize',
  API_KEY: 'apiKey',
  BACKEND_URL: 'backendUrl',
  REVOKE_AUTH_TRIGGER_SET: 'revokeAuthTriggerSet',
  DAYS_UNTIL_AUTH_REVOKE: 'daysUntilAuthRevoke',
  JSON_DB_MASTER_INDEX_KEY: 'jsonDbMasterIndexKey',
  JSON_DB_LOCK_TIMEOUT_MS: 'jsonDbLockTimeoutMs',
  JSON_DB_LOG_LEVEL: 'jsonDbLogLevel',
  JSON_DB_BACKUP_ON_INITIALISE: 'jsonDbBackupOnInitialise',
  JSON_DB_ROOT_FOLDER_ID: 'jsonDbRootFolderId',
  AUTH_GROUP_EMAIL: 'authGroupEmail',
  AUTH_MODE: 'authMode',
  AUTH_USERS: 'authUsers',
  AUTH_REVISION: 'authRevision',
});

const AUTH_USER_ALLOWED_ROLES = new Set(['admin', 'user']);
const AUTH_USER_ALLOWED_KEYS = Object.freeze(['email', 'role']);

/**
 * Validates a single `AuthUserEntry` and records its (normalised) email as seen.
 *
 * Returns `true` when the entry's role is `'admin'` so the caller can tally admins.
 * Throws on any violation; see `validateAuthUsersJson_` for the full rule set.
 *
 * @param {*} entry - Candidate entry object.
 * @param {Set<string>} seenEmails - Accumulator of already-seen normalised emails.
 * @returns {boolean} `true` when the entry role is `'admin'`.
 * @throws {Error} When the entry violates any rule.
 */
function validateAuthUserEntry_(entry, seenEmails) {
  if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new Error('Each Auth Users entry must be an object with email and role.');
  }
  const keys = Object.keys(entry);
  if (keys.length !== AUTH_USER_ALLOWED_KEYS.length) {
    throw new Error('Each Auth Users entry must contain only email and role.');
  }
  if (!keys.every((key) => AUTH_USER_ALLOWED_KEYS.includes(key))) {
    throw new Error('Each Auth Users entry must contain only email and role.');
  }
  const { email, role } = entry;
  if (typeof email !== 'string') {
    throw new TypeError('Auth Users email must be a string.');
  }
  const normalisedEmail = email.trim().toLowerCase();
  // Normalisation is NOT applied — an unnormalised email is rejected.
  if (normalisedEmail !== email) {
    throw new Error('Auth Users email must be trimmed and lowercased.');
  }
  if (normalisedEmail === '') {
    throw new Error('Auth Users email must not be blank.');
  }
  if (seenEmails.has(normalisedEmail)) {
    throw new Error('Auth Users entries must have unique emails.');
  }
  seenEmails.add(normalisedEmail);
  if (!AUTH_USER_ALLOWED_ROLES.has(role)) {
    throw new Error('Auth Users role must be "admin" or "user".');
  }
  return role === 'admin';
}

/**
 * Parses and validates a stored `authUsers` value into its entry array.
 *
 * Rules:
 * - Must be a JSON string.
 * - Must parse to a non-empty array of plain objects.
 * - Each entry must contain exactly `email` and `role` (no unknown keys).
 * - `email` must already be trimmed and lowercased (normalisation is NOT applied — an
 *   unnormalised email is rejected); blank emails are rejected.
 * - `role` must be `'admin'` or `'user'`.
 * - Emails must be unique (compared after the same normalisation used for the per-entry check).
 * - At least one entry must have role `'admin'`; that specific violation is tagged with
 *   `error.reason === 'ZERO_ADMINS'` so callers can distinguish a last-admin conflict from
 *   any other invalid candidate.
 *
 * @param {*} value - Candidate `authUsers` string.
 * @returns {Array<{email: string, role: string}>} The validated entry array.
 * @throws {Error} When the value violates any rule above.
 */
function parseAuthUsersJson_(value) {
  if (typeof value !== 'string') {
    throw new TypeError('Auth Users must be a JSON string array.');
  }
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('Auth Users must be a valid JSON string array.');
  }
  if (!Array.isArray(parsed)) {
    throw new TypeError('Auth Users must be a JSON string array.');
  }
  if (parsed.length === 0) {
    throw new Error('Auth Users must contain at least one entry.');
  }

  const seenEmails = new Set();
  let adminCount = 0;
  for (const entry of parsed) {
    if (validateAuthUserEntry_(entry, seenEmails)) {
      adminCount += 1;
    }
  }

  if (adminCount < 1) {
    const error = new Error('Auth Users must contain at least one admin.');
    error.reason = 'ZERO_ADMINS';
    throw error;
  }

  return parsed;
}

/**
 * Validates a stored `authUsers` value: a JSON string array of `{ email, role }` entries.
 *
 * Thin canonical-string wrapper over `parseAuthUsersJson_`; keeps the single validation
 * authority while returning the exact serialised value the schema `validate` seam persists.
 *
 * @param {*} value - Candidate `authUsers` string.
 * @returns {string} The canonical stored JSON string (re-serialised entry array).
 * @throws {Error} When the value violates any rule in `parseAuthUsersJson_`.
 */
function validateAuthUsersJson_(value) {
  return JSON.stringify(parseAuthUsersJson_(value));
}

/**
 * Validates a stored `authRevision` value: a positive-integer string (`'1'`, `'42'`).
 *
 * Rejects `'0'`, negatives, fractions, non-digit strings, the empty string, and any
 * non-string type (e.g. the numeric `1`). Returns the canonical serialisation, so
 * equivalent values cannot persist in multiple textual forms (`'007'` → `'7'`).
 *
 * @param {*} value - Candidate `authRevision` string.
 * @returns {string} The canonical positive-integer string (no leading zeros).
 * @throws {Error} When the value is not a positive-integer string.
 */
function validateAuthRevision_(value) {
  if (typeof value !== 'string') {
    throw new TypeError('Auth Revision must be a positive integer string.');
  }
  if (!/^\d+$/u.test(value)) {
    throw new Error('Auth Revision must be a positive integer string.');
  }
  // Strip leading zeros without a numeric round-trip so arbitrarily large revisions
  // stay exact. `'0'`/`'00'` strip to `'0'` and fail the positive check below.
  const canonical = value.replace(/^0+(?=\d)/u, '');
  if (canonical === '0') {
    throw new Error('Auth Revision must be a positive integer string.');
  }
  return canonical;
}

const CONFIG_SCHEMA = Object.freeze({
  [CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE]: {
    storage: 'script',
    validate: (v) =>
      Validate.validateIntegerInRange(
        'Backend Assessor Batch Size',
        v,
        1,
        BACKEND_ASSESSOR_BATCH_MAX
      ),
  },
  [CONFIG_KEYS.SLIDES_FETCH_BATCH_SIZE]: {
    storage: 'script',
    validate: (v) =>
      Validate.validateIntegerInRange('Slides Fetch Batch Size', v, 1, SLIDES_FETCH_BATCH_MAX),
  },
  [CONFIG_KEYS.DAYS_UNTIL_AUTH_REVOKE]: {
    storage: 'script',
    validate: (v) =>
      Validate.validateIntegerInRange('Days Until Auth Revoke', v, 1, DAYS_UNTIL_AUTH_REVOKE_MAX),
  },
  [CONFIG_KEYS.API_KEY]: {
    storage: 'script',
    validate: validateApiKey_,
  },
  [CONFIG_KEYS.BACKEND_URL]: {
    storage: 'script',
    validate: (v) => Validate.validateUrl('Backend Url', v),
  },
  [CONFIG_KEYS.REVOKE_AUTH_TRIGGER_SET]: {
    storage: 'script',
    validate: (v) => Validate.validateBoolean('Revoke Auth Trigger Set', v),
    normalise: toBooleanString_,
  },
  [CONFIG_KEYS.JSON_DB_MASTER_INDEX_KEY]: {
    storage: 'script',
    validate: (v) => Validate.validateNonEmptyString('JSON DB Master Index Key', v),
  },
  [CONFIG_KEYS.JSON_DB_LOCK_TIMEOUT_MS]: {
    storage: 'script',
    validate: (v) =>
      Validate.validateIntegerInRange(
        'JSON DB Lock Timeout (ms)',
        v,
        JSON_DB_LOCK_TIMEOUT_MIN_MS,
        JSON_DB_LOCK_TIMEOUT_MAX_MS
      ),
  },
  [CONFIG_KEYS.JSON_DB_LOG_LEVEL]: {
    storage: 'script',
    validate: (v) => validateLogLevel_('JSON DB Log Level', v),
  },
  [CONFIG_KEYS.JSON_DB_BACKUP_ON_INITIALISE]: {
    storage: 'script',
    validate: (v) => Validate.validateBoolean('JSON DB Backup On Initialise', v),
    normalise: toBooleanString_,
  },
  [CONFIG_KEYS.JSON_DB_ROOT_FOLDER_ID]: {
    storage: 'script',
    validate: (v, instance) => {
      if (v == null || String(v).trim() === '') {
        return '';
      }
      const trimmed = String(v).trim();
      if (!instance.isValidGoogleDriveFolderId(trimmed)) {
        throw new Error('JSON DB Root Folder ID must be a valid Google Drive Folder ID.');
      }
      return trimmed;
    },
  },
  [CONFIG_KEYS.AUTH_GROUP_EMAIL]: {
    storage: 'script',
    validate: (v, instance) => {
      if (v == null || String(v).trim() === '') {
        const stored = instance.getProperty(CONFIG_KEYS.AUTH_GROUP_EMAIL);
        if (stored && String(stored).trim() !== '') {
          throw new Error('Auth Group Email cannot be cleared once set.');
        }
        return '';
      }
      const trimmed = String(v).trim();
      if (!Validate.isEmail(trimmed)) {
        throw new Error('Auth Group Email must be a valid email address.');
      }
      return trimmed;
    },
  },
  [CONFIG_KEYS.AUTH_MODE]: {
    storage: 'script',
    validate: (v) => {
      if (v === 'googleGroups') return 'googleGroups';
      if (v === 'scriptProperties') return 'scriptProperties';
      throw new Error('Auth Mode must be either "googleGroups" or "scriptProperties".');
    },
  },
  [CONFIG_KEYS.AUTH_USERS]: {
    storage: 'script',
    validate: validateAuthUsersJson_,
  },
  [CONFIG_KEYS.AUTH_REVISION]: {
    storage: 'script',
    validate: validateAuthRevision_,
  },
});

/**
 * Strict security read of stored authentication state.
 *
 * @remarks
 * This function is the fail-closed counterpart to the forgiving transport getter
 * `ConfigurationManager.getAuthMode()` (Section 2 of the access-resolution path). The
 * getter must never throw and resolves to `null` for any unrecognised/blank/absent
 * mode; this function instead fully validates the entire stored auth configuration for
 * the active mode and throws on any broken state so the access-resolution path can deny
 * access loudly (no secrets in output). The two must not be conflated: deny decisions
 * belong here, never in the forgiving getter.
 *
 * Single leniency (mirrors the forgiving getter): an existing blob that lacks `authMode`
 * (or holds a blank `authMode`, treated identically) but holds a non-blank
 * `authGroupEmail` resolves to `googleGroups`. This matches legacy installs that stored
 * only the group email and is reachable only via hand-edited or cloned blobs, not via
 * any setter. Stored `'none'` and unrecognised modes never benefit from the leniency,
 * even alongside a non-blank group email.
 *
 * @param {Object} authConfig - Partial auth config `{ authMode?, authGroupEmail?, authUsers?, authRevision? }`.
 * @returns {Object} Resolved auth state `{ authMode, authGroupEmail, authUsers, authRevision }`.
 * @throws {Error} When the configuration is broken for the active mode.
 */
function validateAuthStateStrict_(authConfig) {
  const config = authConfig || {};
  const authMode = config.authMode;
  const authGroupEmail = config.authGroupEmail;
  const groupEmailBlank = authGroupEmail == null || String(authGroupEmail).trim() === '';

  if (!groupEmailBlank && !Validate.isEmail(String(authGroupEmail).trim())) {
    throw new Error('Auth Group Email must be a valid email address.');
  }

  // Resolve the effective mode, applying the single documented leniency.
  let resolvedMode;
  if (authMode === 'googleGroups' || authMode === 'scriptProperties') {
    resolvedMode = authMode;
  } else if (authMode === 'none') {
    throw new Error('Auth Mode "none" is no longer supported.');
  } else if (authMode !== undefined && authMode !== null && authMode !== '') {
    // Constant message: the raw stored value is not needed for diagnosis and must
    // never be interpolated into the error-level audit trail.
    throw new Error('Unrecognised stored authentication mode.');
  } else if (groupEmailBlank) {
    throw new Error('Auth configuration is incomplete: missing auth mode or group email.');
  } else {
    // Absent mode with a non-blank group email → legacy groups install.
    resolvedMode = 'googleGroups';
  }

  if (resolvedMode === 'googleGroups') {
    if (groupEmailBlank) {
      throw new Error('Google Groups auth mode requires a non-blank group email.');
    }
    return {
      authMode: 'googleGroups',
      authGroupEmail: String(authGroupEmail).trim(),
      authUsers: config.authUsers,
      authRevision: config.authRevision,
    };
  }

  // scriptProperties mode: both authUsers and authRevision are required and must be valid.
  if (config.authUsers == null || String(config.authUsers).trim() === '') {
    throw new Error('Script Properties auth mode requires a valid auth users list.');
  }
  if (config.authRevision == null || String(config.authRevision).trim() === '') {
    throw new Error('Script Properties auth mode requires a valid auth revision.');
  }
  // Reuse the schema validators so validation logic is not duplicated. Parse
  // once and expose both the canonical stored string and the parsed list so
  // downstream consumers (the Script Properties provider and the save-switch
  // checks) never re-parse the same bytes.
  const parsedUsers = parseAuthUsersJson_(config.authUsers);
  const validatedRevision = validateAuthRevision_(config.authRevision);

  return {
    authMode: 'scriptProperties',
    authGroupEmail: config.authGroupEmail,
    authUsers: JSON.stringify(parsedUsers),
    authUsersParsed: parsedUsers,
    authRevision: validatedRevision,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CONFIG_KEYS,
    CONFIG_SCHEMA,
    MAX_CONFIG_BLOB_BYTES,
    validateAuthStateStrict_,
  };
}
