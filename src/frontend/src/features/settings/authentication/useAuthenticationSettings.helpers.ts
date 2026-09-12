/**
 * Pure save-error mapping helpers for {@link useAuthenticationSettings}.
 *
 * Extracted from `useAuthenticationSettings.ts` to keep that file under the
 * 500-line threshold. These helpers translate authentication-settings save
 * failures into user-safe copy and carry no React dependencies.
 *
 * @see useAuthenticationSettings
 */

import { ZodError } from 'zod';
import { ApiTransportError } from '../../../errors/apiTransportError';
import { errorCodes } from '../../../errors/map-error-to-ui';
import { logFrontendError } from '../../../logging/frontendLogger';
import type { AuthenticationSettings } from '../../../services/authService/authService.zod';

export type AuthMode = AuthenticationSettings['authMode'];

const genericSaveErrorMessage = 'Unable to save authentication settings right now.';
const rateLimitedErrorMessage = 'The service is busy. Please try again shortly.';
const staleRevisionWarningMessage =
  'Another administrator saved first. Review and re-save your changes.';
const lastAdminErrorMessage = 'At least one admin must remain. Review the user list and try again.';
const invalidCandidateErrorMessage =
  'The candidate list is invalid. Review the authorised users and try again.';
const scriptPropertiesSavingAdminDeniedMessage =
  'Your admin access is missing from the candidate list. Add yourself as an admin and try again.';
const googleGroupsSavingAdminDeniedMessage =
  'Your group role does not grant access. You must be an OWNER or MANAGER of the Google Group; ask a group owner to update your role, then try again.';

/**
 * Stable backend authentication-settings save codes mapped to user-safe copy.
 *
 * @remarks
 * Emitted by `AUTH_SETTINGS_ERROR_CODES` in the backend `AuthSettingsDomain`
 * and surfaced through `ApiValidationError.code`. User copy is selected from
 * these codes only; raw backend messages are never rendered.
 */
const authSettingsSaveErrorCodes = {
  staleRevision: 'AUTH_SETTINGS_STALE_REVISION',
  revisionRequired: 'AUTH_SETTINGS_REVISION_REQUIRED',
  lastAdmin: 'AUTH_SETTINGS_LAST_ADMIN',
  invalidCandidate: 'AUTH_SETTINGS_INVALID_CANDIDATE',
  savingAdminDenied: 'AUTH_SETTINGS_SAVING_ADMIN_DENIED',
  rateLimited: errorCodes.RATE_LIMITED,
} as const;

export type AuthenticationSettingsSaveErrorMapping = Readonly<{
  message: string;
  isStaleRevision: boolean;
}>;

const genericSaveErrorMapping: AuthenticationSettingsSaveErrorMapping = {
  message: genericSaveErrorMessage,
  isStaleRevision: false,
};

const authSettingsSaveErrorMappings = new Map<string, AuthenticationSettingsSaveErrorMapping>([
  [
    authSettingsSaveErrorCodes.staleRevision,
    { message: staleRevisionWarningMessage, isStaleRevision: true },
  ],
  [
    authSettingsSaveErrorCodes.revisionRequired,
    { message: staleRevisionWarningMessage, isStaleRevision: true },
  ],
  [
    authSettingsSaveErrorCodes.lastAdmin,
    { message: lastAdminErrorMessage, isStaleRevision: false },
  ],
  [
    authSettingsSaveErrorCodes.invalidCandidate,
    { message: invalidCandidateErrorMessage, isStaleRevision: false },
  ],
  [
    authSettingsSaveErrorCodes.rateLimited,
    { message: rateLimitedErrorMessage, isStaleRevision: false },
  ],
]);

/**
 * Resolves the mode-appropriate copy for a saving-admin denial.
 *
 * @remarks
 * The backend emits `AUTH_SETTINGS_SAVING_ADMIN_DENIED` with mode-dependent
 * meaning: in `scriptProperties` mode the saving admin is missing from the
 * candidate list, while in `googleGroups` mode the saving admin lacks an
 * OWNER/MANAGER role on the candidate group. The copy must describe the
 * authority the mode actually requires.
 *
 * @param {AuthMode} targetMode The staged save target mode.
 * @returns {AuthenticationSettingsSaveErrorMapping} User copy for the denial.
 */
function resolveSavingAdminDeniedMapping(
  targetMode: AuthMode
): AuthenticationSettingsSaveErrorMapping {
  return {
    message:
      targetMode === 'googleGroups'
        ? googleGroupsSavingAdminDeniedMessage
        : scriptPropertiesSavingAdminDeniedMessage,
    isStaleRevision: false,
  };
}

/**
 * Client request-validation field paths whose Zod messages are safe to render.
 *
 * @remarks
 * Only the locally authored candidate-request messages (blank group email and
 * missing administrator) are surfaced. Any other `ZodError` — for example a
 * malformed transport response — falls back to generic save copy.
 */
const localValidationFieldNames = new Set(['authGroupEmail', 'authUsers']);

/**
 * Resolves a locally authored request-validation message from a `ZodError`.
 *
 * @param {ZodError} error The client request-validation error.
 * @returns {string | null} The targeted message, or null when the failure is not a local field validation.
 */
function resolveLocalValidationMessage(error: ZodError): string | null {
  const localIssue = error.issues.find((issue) =>
    issue.path.some((pathSegment) => localValidationFieldNames.has(String(pathSegment)))
  );

  return localIssue?.message ?? null;
}

/**
 * Maps an authentication-settings save failure into user-safe copy.
 *
 * @remarks
 * Backend failures are mapped exclusively from the stable `ApiTransportError.code`
 * values emitted by the authentication-settings endpoint. The staged target mode is
 * supplied as UI context (never from backend prose) so the saving-admin denial copy
 * describes the authority the target mode actually requires. A local request-schema
 * rejection carries no transport code, so it is resolved separately for the two
 * user-actionable candidate fields before falling back to generic copy. Raw backend
 * messages are never rendered.
 *
 * @param {unknown} error The failure to map.
 * @param {AuthMode} targetMode The staged save target mode for mode-dependent copy.
 * @returns {AuthenticationSettingsSaveErrorMapping} User copy and stale flag.
 */
export function mapAuthenticationSettingsSaveError(
  error: unknown,
  targetMode: AuthMode
): AuthenticationSettingsSaveErrorMapping {
  if (error instanceof ZodError) {
    return {
      message: resolveLocalValidationMessage(error) ?? genericSaveErrorMessage,
      isStaleRevision: false,
    };
  }

  if (error instanceof ApiTransportError) {
    if (error.code === authSettingsSaveErrorCodes.savingAdminDenied) {
      return resolveSavingAdminDeniedMapping(targetMode);
    }

    return authSettingsSaveErrorMappings.get(error.code) ?? genericSaveErrorMapping;
  }

  return genericSaveErrorMapping;
}

/**
 * Logs a save failure with correlation and code diagnostics for developers.
 *
 * @param {unknown} error The failure to log.
 * @returns {void} Nothing.
 */
export function logAuthenticationSettingsSaveFailure(error: unknown): void {
  const apiTransportError = error instanceof ApiTransportError ? error : undefined;

  logFrontendError('features/settings/authentication/useAuthenticationSettings', error, {
    requestId: apiTransportError?.requestId,
    errorCode: apiTransportError?.code,
  });
}
