import { callApi, parseApiResponse } from '../apiService';
import {
  ApplicationAccessSchema,
  AuthenticationSettingsSchema,
  AuthorisationStatusSchema,
  SetAuthenticationSettingsRequestSchema,
  SetAuthenticationSettingsResultSchema,
  type ApplicationAccess,
  type AuthenticationSettings,
  type SetAuthenticationSettingsResult,
} from './authService.zod';

const GET_AUTHORISATION_STATUS_METHOD = 'getAuthorisationStatus';
const GET_APPLICATION_ACCESS_METHOD = 'getApplicationAccess';
const GET_AUTHENTICATION_SETTINGS_METHOD = 'getAuthenticationSettings';
const SET_AUTHENTICATION_SETTINGS_METHOD = 'setAuthenticationSettings';

/**
 * Calls the backend API handler transport and returns current authorisation status.
 *
 * @returns {Promise<boolean>} Whether the current user is authorised.
 */
export async function getAuthorisationStatus(): Promise<boolean> {
  return parseApiResponse(
    AuthorisationStatusSchema,
    GET_AUTHORISATION_STATUS_METHOD,
    await callApi<boolean>(GET_AUTHORISATION_STATUS_METHOD)
  );
}

/**
 * Calls the gate-exempt backend access endpoint and returns the caller's own
 * application access state.
 *
 * @remarks
 * The endpoint routes through the shared access-resolution path, so on a fresh
 * install a claimable caller receives `reason: 'ok'` with the claimed admin role
 * in the same response. The `role` field is `null` for every deny state.
 *
 * @returns {Promise<ApplicationAccess>} The parsed application access payload.
 */
export async function getApplicationAccess(): Promise<ApplicationAccess> {
  return parseApiResponse(
    ApplicationAccessSchema,
    GET_APPLICATION_ACCESS_METHOD,
    await callApi(GET_APPLICATION_ACCESS_METHOD)
  );
}

/**
 * Calls the admin-only backend endpoint and returns the current authentication
 * settings for the active mode.
 *
 * @remarks
 * The response always carries `authGroupEmail`, a parsed `authUsers` list and an
 * `authRevision` that is `null` when the revision is not maintained (groups mode).
 *
 * @returns {Promise<AuthenticationSettings>} The parsed authentication settings.
 */
export async function getAuthenticationSettings(): Promise<AuthenticationSettings> {
  return parseApiResponse(
    AuthenticationSettingsSchema,
    GET_AUTHENTICATION_SETTINGS_METHOD,
    await callApi(GET_AUTHENTICATION_SETTINGS_METHOD)
  );
}

/**
 * Sends a full candidate authentication-settings save through the shared API transport.
 *
 * @remarks
 * The request is validated against `SetAuthenticationSettingsRequestSchema` before
 * the transport call, so an invalid candidate request never reaches `callApi`
 * (the schema enforces the per-mode field presence and omission rules). The
 * parsed commit result carries the new revision in scriptProperties mode and
 * `null` in googleGroups mode.
 *
 * @param {unknown} request The raw candidate authentication-settings save payload.
 * @returns {Promise<SetAuthenticationSettingsResult>} The parsed commit result.
 */
export async function setAuthenticationSettings(
  request: unknown
): Promise<SetAuthenticationSettingsResult> {
  const parsedRequest = SetAuthenticationSettingsRequestSchema.parse(request);
  return parseApiResponse(
    SetAuthenticationSettingsResultSchema,
    SET_AUTHENTICATION_SETTINGS_METHOD,
    await callApi(SET_AUTHENTICATION_SETTINGS_METHOD, parsedRequest)
  );
}
