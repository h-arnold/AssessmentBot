/**
 * Auth transport endpoint method names (ACTION_PLAN §5).
 *
 * `getApplicationAccess` is the gate-exempt access-status read; the settings
 * pair are admin-required and enforced in the dispatcher admission phase.
 * Kept in a dedicated module so the registry expectations can reference them
 * without growing the shared dispatcher helper file.
 */
const AUTH_API_METHOD_NAMES = Object.freeze([
  'getApplicationAccess',
  'getAuthenticationSettings',
  'setAuthenticationSettings',
]);

module.exports = { AUTH_API_METHOD_NAMES };
