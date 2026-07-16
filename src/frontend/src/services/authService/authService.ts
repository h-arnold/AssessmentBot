import { callApi, parseApiResponse } from '../apiService';
import { AuthorisationStatusSchema } from './authService.zod';

const GET_AUTHORISATION_STATUS_METHOD = 'getAuthorisationStatus';

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
